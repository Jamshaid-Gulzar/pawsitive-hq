import { Bath, ChevronRight, FileText, Moon, Stethoscope, Sun, Syringe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PetPhoto, Pill } from "@/components/ui";
import { getOwnerHistory } from "@/db/queries";
import { groomLabel, GROOM_SERVICES } from "@/lib/availability";
import { daysBetween, formatLongDate, formatShortDate, formatStamp } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { DUE_TONE, dueText } from "@/lib/vaccines";
import { VET_REASONS } from "@/lib/vet";

export const metadata: Metadata = { title: "History" };

const SERVICE = {
  boarding: { label: "Boarding", icon: Moon, tone: "bg-lilac-soft text-lilac-ink" },
  daycare: { label: "Daycare", icon: Sun, tone: "bg-sun-soft text-sun-ink" },
  grooming: { label: "Grooming", icon: Bath, tone: "bg-sky-soft text-sky-ink" },
  vet: { label: "Vet visit", icon: Stethoscope, tone: "bg-mint-soft text-mint-ink" },
};

const STATUS: Record<string, { label: string; className: string }> = {
  completed: { label: "Done", className: "bg-mint-soft text-mint-ink" },
  cancelled: { label: "Cancelled", className: "bg-sand text-muted" },
  declined: { label: "Declined", className: "bg-sand text-muted" },
};

const SOURCE = { scan: "Uploaded by you", staff: "Updated by our team", seed: "On file" } as const;

const monthLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function HistoryPage(props: PageProps<"/my/history">) {
  const user = await requireRole("parent");
  const { pet: petParam, svc: svcParam } = await props.searchParams;
  const all = await getOwnerHistory(user.id);
  const selected = all.pets.find((p) => p.id === petParam) ?? null;
  const shownPets = selected ? [selected] : all.pets;
  const visits = all.visits.filter((v) => !selected || v.petId === selected.id);
  const petById = new Map(all.pets.map((p) => [p.id, p]));
  const serviceOf = (v: (typeof visits)[number]) => (v.kind === "vet" ? "vet" : v.booking.service);
  const svc = typeof svcParam === "string" && svcParam in SERVICE ? (svcParam as keyof typeof SERVICE) : null;
  // Keeps the pet filter when switching service, and the reverse.
  const historyHref = (pet: string | null, service: string | null) => {
    const q = new URLSearchParams();
    if (pet) q.set("pet", pet);
    if (service) q.set("svc", service);
    const s = q.toString();
    return `/my/history${s ? `?${s}` : ""}`;
  };

  const done = visits.filter((v) => (v.kind === "booking" ? v.booking.status : v.visit.status) === "completed");
  const counts = (["boarding", "daycare", "grooming", "vet"] as const).map((key) => ({
    ...SERVICE[key],
    key,
    label: { boarding: "Boarding stays", daycare: "Daycare days", grooming: "Grooms", vet: "Vet visits" }[key],
    n: done.filter((v) => serviceOf(v) === key).length,
  }));
  const listed = svc ? visits.filter((v) => serviceOf(v) === svc) : visits;
  const svcLabel = svc ? counts.find((c) => c.key === svc)!.label.toLowerCase() : null;

  // Group past visits by month, newest first.
  const months: { label: string; items: typeof visits }[] = [];
  for (const v of listed) {
    const label = monthLabel(v.date);
    const last = months.at(-1);
    if (last?.label === label) last.items.push(v);
    else months.push({ label, items: [v] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[30px] leading-tight font-semibold">History</h1>
        <p className="font-semibold text-muted">Every visit, vet checkup and vaccine for your pets.</p>
      </div>

      <nav aria-label="Choose a pet" className="relative -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <Link
          href={historyHref(null, svc)}
          aria-current={!selected ? "page" : undefined}
          className={`flex min-h-11 shrink-0 items-center rounded-full border-2 px-4 text-sm font-extrabold ${!selected ? "border-coral bg-coral-soft" : "border-line bg-white"}`}
        >
          All pets
        </Link>
        {all.pets.map((p) => (
          <Link
            key={p.id}
            href={historyHref(p.id, svc)}
            aria-current={selected?.id === p.id ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 py-1 pr-4 pl-1 text-sm font-extrabold ${
              selected?.id === p.id ? "border-coral bg-coral-soft" : "border-line bg-white"
            }`}
          >
            <PetPhoto src={p.photo} alt="" className="size-8 rounded-full" sizes="32px" />
            {p.name}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="vax-h" className="flex flex-col gap-3">
        <h2 id="vax-h" className="flex items-center gap-2 font-display text-[22px] font-semibold">
          <Syringe className="size-5.5 text-sky-ink" aria-hidden="true" /> Vaccines & next due dates
        </h2>
        {shownPets.map((p) => {
          const needs = p.schedule.filter((v) => v.stage !== "ok");
          const next = p.schedule.find((v) => v.date && v.stage !== "expired");
          return (
            <article key={p.id} className="overflow-hidden rounded-[24px] bg-white shadow-card">
              <div className="flex items-center gap-3 p-4 pb-3">
                <PetPhoto src={p.photo} alt="" className="size-12 rounded-2xl" sizes="48px" />
                <div className="min-w-0 flex-1">
                  <strong className="block font-display text-lg leading-tight font-semibold">{p.name}</strong>
                  <span className="text-sm font-semibold text-muted">
                    {next ? `Next due: ${next.label} on ${formatShortDate(next.date!)}` : "No upcoming dates on file"}
                  </span>
                </div>
              </div>
              <ul className="flex flex-col gap-2 px-4">
                {p.schedule.map((v) => (
                  <li key={v.key} className="flex items-center gap-3 rounded-2xl bg-cream px-3.5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <strong className="block text-[15px]">{v.label}</strong>
                      <span className="text-xs font-bold text-muted">{v.date ? `Valid until ${formatLongDate(v.date)}` : "No date on file"}</span>
                    </span>
                    <Pill className={DUE_TONE[v.stage]}>{v.stage === "ok" ? "Up to date" : dueText(v)}</Pill>
                  </li>
                ))}
              </ul>
              {needs.length > 0 && (
                <div className="px-4 pt-3">
                  <Link
                    href={`/my/vet?pet=${p.id}&reason=vaccination`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-grape text-[15px] font-extrabold text-white"
                  >
                    <Syringe className="size-4.5" aria-hidden="true" /> Book a vaccination for {p.name}
                  </Link>
                </div>
              )}
              <details className="group px-4 pt-2 pb-4">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-extrabold text-grape">
                  <FileText className="size-4" aria-hidden="true" /> Vaccine records on file ({p.records.length})
                  <ChevronRight className="size-4 transition group-open:rotate-90" aria-hidden="true" />
                </summary>
                <ol className="mt-1 flex flex-col gap-2 border-l-2 border-sand pl-3.5">
                  {p.records.map((r, i) => (
                    <li key={r.id} className="text-sm">
                      <strong>{formatLongDate(r.uploadedAt.slice(0, 10))}</strong>
                      {i === 0 && <span className="ml-2 rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-extrabold text-mint-ink">Current</span>}
                      <span className="block text-xs font-semibold text-muted">
                        {SOURCE[r.source]} · Rabies {r.rabiesExp ? formatShortDate(r.rabiesExp) : "—"} · {p.species === "cat" ? "FVRCP" : "DHPP"}{" "}
                        {r.coreExp ? formatShortDate(r.coreExp) : "—"}
                        {p.species === "dog" ? ` · Bordetella ${r.bordetellaExp ? formatShortDate(r.bordetellaExp) : "—"}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          );
        })}
        <p className="px-1 text-xs font-semibold text-muted">We&apos;ll message you 30 days before a vaccine is due, again in its last week, and if it expires.</p>
      </section>

      <nav aria-label="Show past visits by service" className="grid grid-cols-4 gap-2">
        {counts.map(({ key, label, n, icon: Icon, tone }) => {
          const on = svc === key;
          return (
            <Link
              key={key}
              href={`${historyHref(selected?.id ?? null, on ? null : key)}#past-h`}
              aria-current={on ? "true" : undefined}
              className={`flex flex-col items-center gap-1 rounded-[20px] border-2 bg-white px-1 py-3 text-center shadow-card transition active:scale-[0.97] ${
                on ? "border-coral" : "border-transparent"
              }`}
            >
              <span className={`inline-flex size-9 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="font-display text-xl leading-none font-semibold">{n}</span>
              <span className="text-[11px] leading-tight font-bold text-muted">{label}</span>
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby="past-h" className="flex scroll-mt-20 flex-col gap-4" id="past">
        <div className="flex items-center justify-between gap-2">
          <h2 id="past-h" className="scroll-mt-20 font-display text-[22px] font-semibold">
            {svcLabel ? `Past ${svcLabel}` : "Past visits"}
          </h2>
          {svc && (
            <Link href={`${historyHref(selected?.id ?? null, null)}#past-h`} className="inline-flex min-h-11 items-center text-sm font-extrabold text-grape">
              Show all
            </Link>
          )}
        </div>
        {months.length === 0 ? (
          <p className="rounded-[22px] bg-white p-5 text-sm font-semibold text-muted shadow-card">
            {svcLabel ? `No past ${svcLabel} yet.` : "No past visits yet."}
          </p>
        ) : (
          months.map((m) => (
            <div key={m.label}>
              <h3 className="mb-2 px-1 text-xs font-extrabold tracking-[0.07em] text-muted uppercase">{m.label}</h3>
              <ul className="overflow-hidden rounded-[22px] bg-white shadow-card">
                {m.items.map((v) => {
                  const pet = petById.get(v.petId)!;
                  const svc = SERVICE[v.kind === "vet" ? "vet" : v.booking.service];
                  const Icon = svc.icon;
                  const status = STATUS[v.kind === "vet" ? v.visit.status : v.booking.status] ?? { label: "Past", className: "bg-sand text-muted" };
                  const detail =
                    v.kind === "vet"
                      ? `${VET_REASONS[v.visit.reason].label}${v.visit.doctor ? ` · ${v.visit.doctor}` : ""}`
                      : v.booking.service === "grooming"
                        ? v.booking.groomServices.length === GROOM_SERVICES.length
                          ? "Full groom"
                          : v.booking.groomServices.map(groomLabel).join(", ")
                        : v.booking.endDate !== v.booking.startDate
                          ? `${daysBetween(v.booking.startDate, v.booking.endDate)} nights${v.booking.unitLabel ? ` · ${v.booking.unitLabel}` : ""}`
                          : (v.booking.unitLabel ?? "Day visit");
                  return (
                    <li key={v.id} className="border-b border-sand last:border-0">
                      <Link href={v.kind === "vet" ? `/my/vet/${v.id}` : `/my/bookings/${v.id}`} className="flex items-center gap-3 p-3.5 transition active:bg-sand">
                        <span className="relative shrink-0">
                          <PetPhoto src={pet.photo} alt="" className="size-12 rounded-2xl" sizes="48px" />
                          <span className={`absolute -right-1 -bottom-1 inline-flex size-6 items-center justify-center rounded-full border-2 border-white ${svc.tone}`}>
                            <Icon className="size-3.5" aria-hidden="true" />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[15px]">
                            {pet.name} · {svc.label}
                          </strong>
                          <span className="block truncate text-sm text-muted">
                            {formatShortDate(v.date)}
                            {v.kind === "booking" && v.booking.endDate !== v.booking.startDate ? ` → ${formatShortDate(v.booking.endDate)}` : ""} · {detail}
                          </span>
                          {v.kind === "booking" && v.booking.status === "cancelled" && v.booking.cancelReason && (
                            <span className="block truncate text-xs font-bold text-faint">Reason: {v.booking.cancelReason}</span>
                          )}
                          {v.kind === "vet" && v.visit.completedAt && (
                            <span className="block truncate text-xs font-bold text-mint-ink">Report ready · {formatStamp(v.visit.completedAt)}</span>
                          )}
                        </span>
                        <Pill className={status.className}>{status.label}</Pill>
                        <ChevronRight className="size-4.5 shrink-0 text-faint" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
