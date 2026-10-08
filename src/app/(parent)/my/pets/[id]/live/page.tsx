import { ChevronLeft, Footprints, House, NotebookPen, Scissors, Smile, Utensils, Activity, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PetPhoto, Pill } from "@/components/ui";
import { getLiveStay } from "@/db/queries";
import { formatLongDate, formatShortDate, formatStamp, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Live stay" };

const LOG_ICON = {
  checked_in: { icon: House, tone: "bg-sky-soft text-sky-ink", label: "Checked in" },
  activity: { icon: Activity, tone: "bg-sun-soft text-sun-ink", label: "Activity" },
  stage_1: { icon: Scissors, tone: "bg-lilac-soft text-lilac-ink", label: "Grooming" },
  stage_2: { icon: Scissors, tone: "bg-lilac-soft text-lilac-ink", label: "Grooming" },
  stage_3: { icon: Scissors, tone: "bg-lilac-soft text-lilac-ink", label: "Grooming" },
  report: { icon: NotebookPen, tone: "bg-mint-soft text-mint-ink", label: "Daily report card sent" },
  completed: { icon: PartyPopper, tone: "bg-coral-soft text-coral-ink", label: "Ready to go home" },
} as const;

export default async function LiveStayPage(props: PageProps<"/my/pets/[id]/live">) {
  const user = await requireRole("parent");
  const { id } = await props.params;
  const data = await getLiveStay(user.id, id);
  if (!data) notFound();
  const { pet, stay, log, reports, photos } = data;
  const today = todayISO();
  const here = stay?.status === "checked_in";
  const todaysLog = log.filter((e) => e.at.startsWith(today)).reverse();

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={8} />
      <Link href="/my" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> Home
      </Link>

      <section className="overflow-hidden rounded-[28px] bg-sky-soft">
        <div className="relative">
          <PetPhoto src={photos[0]?.photo ?? pet.photo} alt={`${pet.name}`} className="aspect-[4/3] w-full" sizes="430px" priority />
          {here && (
            <Pill className="absolute top-3 left-3 bg-white text-sky-ink">
              <span className="size-2 animate-pulse rounded-full bg-mint" /> Live
            </Pill>
          )}
        </div>
        <div className="p-4">
          <h1 className="font-display text-[28px] leading-tight font-semibold">
            {here ? `${pet.name} is with us` : `${pet.name}'s last stay`}
          </h1>
          {stay ? (
            <p className="text-sm font-bold text-sky-ink capitalize">
              {stay.service} · {stay.unitLabel ?? "Play yard"} · {formatShortDate(stay.startDate)}
              {stay.endDate !== stay.startDate ? ` → ${formatShortDate(stay.endDate)}` : ""}
            </p>
          ) : (
            <p className="text-sm font-semibold text-muted">{pet.name} isn&apos;t staying with us right now.</p>
          )}
          {here && (
            <div className="mt-3 rounded-2xl bg-white p-4">
              <div className="text-xs font-extrabold tracking-[0.07em] text-sky-ink uppercase">Right now</div>
              <div className="font-display text-2xl font-semibold">{stay.activity ?? "Settling in"}</div>
              {stay.activityAt && <div className="text-sm font-semibold text-muted">since {formatStamp(stay.activityAt)}</div>}
            </div>
          )}
        </div>
      </section>

      {stay && (
        <section aria-labelledby="log-h" className="rounded-[28px] bg-white p-5 shadow-card">
          <h2 id="log-h" className="mb-3 font-display text-[22px] font-semibold">
            Today&apos;s log
          </h2>
          {todaysLog.length === 0 ? (
            <p className="text-sm font-semibold text-muted">Nothing logged yet today. Check back soon!</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {todaysLog.map((e) => {
                const k = LOG_ICON[e.kind as keyof typeof LOG_ICON] ?? LOG_ICON.activity;
                const Icon = k.icon;
                return (
                  <li key={e.id} className="flex items-start gap-3">
                    <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-2xl ${k.tone}`}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-[15px]">{e.kind === "report" ? k.label : (e.note ?? k.label)}</strong>
                      <span className="text-xs font-bold text-faint">{formatStamp(e.at)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {photos.length > 0 && (
        <section aria-labelledby="ph-h">
          <h2 id="ph-h" className="mb-3 font-display text-[22px] font-semibold">
            Photos from this stay
          </h2>
          <ul className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {photos
              .filter((p) => p.photo)
              .map((p) => (
                <li key={p.id} className="w-36 shrink-0">
                  <PetPhoto src={p.photo} alt={p.title ?? `${pet.name}`} className="aspect-square w-full rounded-2xl" sizes="144px" />
                  <span className="mt-1 block text-[11px] font-bold text-faint">{formatStamp(p.createdAt)}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="rep-h" className="flex flex-col gap-3">
        <h2 id="rep-h" className="font-display text-[22px] font-semibold">
          Daily report cards
        </h2>
        {reports.length === 0 ? (
          <p className="rounded-[22px] bg-white p-5 text-sm font-semibold text-muted shadow-card">
            Our team sends a report card every day of the stay. The first one is on its way!
          </p>
        ) : (
          reports.map((r) => (
            <article key={r.id} className="overflow-hidden rounded-[24px] bg-white shadow-card">
              {r.photo && <PetPhoto src={r.photo} alt={`${pet.name} on ${formatLongDate(r.date)}`} className="aspect-[16/10] w-full" sizes="430px" />}
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-display text-lg font-semibold">{r.date === today ? "Today" : formatLongDate(r.date)}</strong>
                  <span className="text-xs font-bold text-faint">by {r.staffName}</span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-sun-soft p-2.5">
                    <Utensils className="mx-auto size-4.5 text-sun-ink" aria-hidden="true" />
                    <dt className="sr-only">Meals</dt>
                    <dd className="mt-1 text-[13px] font-extrabold">{r.meals}</dd>
                  </div>
                  <div className="rounded-2xl bg-sky-soft p-2.5">
                    <Footprints className="mx-auto size-4.5 text-sky-ink" aria-hidden="true" />
                    <dt className="sr-only">Potty</dt>
                    <dd className="mt-1 text-[13px] font-extrabold">{r.potty}</dd>
                  </div>
                  <div className="rounded-2xl bg-mint-soft p-2.5">
                    <Smile className="mx-auto size-4.5 text-mint-ink" aria-hidden="true" />
                    <dt className="sr-only">Mood</dt>
                    <dd className="mt-1 text-[13px] font-extrabold">{r.mood}</dd>
                  </div>
                </dl>
                {r.activities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {r.activities.map((a) => (
                      <span key={a} className="rounded-full bg-lilac-soft px-2.5 py-1 text-xs font-extrabold text-lilac-ink">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {r.notes && <p className="rounded-2xl bg-cream px-3.5 py-2.5 text-[15px] font-semibold">&ldquo;{r.notes}&rdquo;</p>}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
