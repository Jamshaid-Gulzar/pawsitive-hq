import {
  Cake,
  CalendarPlus,
  ChevronLeft,
  HeartPulse,
  PartyPopper,
  Pill as PillIcon,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  Utensils,
} from "lucide-react";
import { HEALTH_STATUS, VET_REASONS } from "@/lib/vet";
import { ConditionsEditor } from "./ConditionsEditor";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { VaccineCards } from "@/components/VaccineCards";
import { VisitRow } from "@/components/VisitRow";
import { getPetProfile, recordDates } from "@/db/queries";
import { formatDate, formatShortDate, formatTime, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { evaluateCompliance } from "@/lib/vaccines";

export const metadata: Metadata = { title: "Pet profile" };

export default async function PetProfilePage(props: PageProps<"/my/pets/[id]">) {
  const user = await requireRole("parent");
  const { id } = await props.params;
  const { welcome } = await props.searchParams;
  const profile = await getPetProfile(user.id, id);
  if (!profile) notFound();
  const { pet, record, visits, photos, vetVisits } = profile;
  const lastCheck = vetVisits.find((v) => v.status === "completed");
  const health = lastCheck?.healthStatus ? HEALTH_STATUS[lastCheck.healthStatus] : null;
  const today = todayISO();
  const dates = recordDates(record ?? undefined);
  const { issues } = evaluateCompliance(dates, pet.species, "boarding", today, today);
  const upcoming = visits.filter((v) => v.endDate >= today && v.status !== "completed").reverse();
  const past = visits.filter((v) => v.status === "completed");
  const age = pet.birthday ? Number(today.slice(0, 4)) - Number(pet.birthday.slice(0, 4)) - (today.slice(5) < pet.birthday.slice(5) ? 1 : 0) : null;
  const hereNow = visits.find((v) => v.status === "checked_in");

  const care = [
    { icon: Utensils, label: "Food", value: pet.food, tone: "text-coral-ink" },
    { icon: PillIcon, label: "Medication", value: pet.meds ? `${pet.meds}${pet.medTime ? ` at ${formatTime(pet.medTime)}` : ""}` : "None", tone: "text-lilac-ink" },
    ...(pet.alert ? [{ icon: TriangleAlert, label: "Heads-up for staff", value: pet.alert, tone: "text-rose-ink" }] : []),
    ...(pet.note ? [{ icon: Sparkles, label: "Fun fact", value: pet.note, tone: "text-sun-ink" }] : []),
    ...(pet.birthday ? [{ icon: Cake, label: "Birthday", value: formatDate(pet.birthday), tone: "text-grape" }] : []),
  ];

  return (
    <div className="flex flex-col gap-6 pb-20">
      <Link href="/my" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> Home
      </Link>

      {welcome && (
        <p role="status" className="animate-pop flex items-center gap-3 rounded-[20px] bg-mint p-4 font-bold text-white">
          <PartyPopper className="size-7 shrink-0" aria-hidden="true" />
          Welcome to the family, {pet.name}! You can book a visit now.
        </p>
      )}

      <section className="overflow-hidden rounded-[30px] bg-white shadow-card">
        <div className="relative aspect-square">
          <PetPhoto src={pet.photo} alt={`${pet.name} the ${pet.breed}`} priority className="h-full w-full" sizes="430px" />
          {hereNow && (
            <Pill className="absolute top-4 left-4 bg-white text-sky-ink">
              <span className="size-2 rounded-full bg-mint" /> Here now · {hereNow.unitLabel}
            </Pill>
          )}
        </div>
        <div className="p-5">
          <h1 className="font-display text-[34px] leading-tight font-semibold">{pet.name}</h1>
          <p className="font-semibold text-muted">
            {pet.breed} · {pet.sex === "f" ? "Female" : "Male"}
            {age !== null ? ` · ${age} yr${age === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </section>

      <section aria-labelledby="vax-h">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="vax-h" className="font-display text-[22px] font-semibold">
            Vaccines
          </h2>
          {record && <span className="text-xs font-bold text-muted">Updated {formatShortDate(record.uploadedAt.slice(0, 10))}</span>}
        </div>
        <VaccineCards species={pet.species} service="boarding" dates={dates} issues={issues} />
        {issues.length > 0 && (
          <Link href={`/my/book?pet=${pet.id}`} className="mt-3 inline-flex text-sm font-extrabold text-grape underline">
            Upload a new record when you book
          </Link>
        )}
      </section>

      <section aria-labelledby="health-h">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="health-h" className="font-display text-[22px] font-semibold">
            Health
          </h2>
          {lastCheck && (
            <span className="text-xs font-bold text-muted">
              Last checkup {formatShortDate(lastCheck.date)}
            </span>
          )}
        </div>
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-2xl ${health ? health.tone : "bg-sand text-muted"}`}>
              <HeartPulse className="size-5.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-lg leading-tight font-semibold">{health ? health.label : "No checkup yet"}</div>
              <div className="text-sm font-semibold text-muted">
                {lastCheck ? `${lastCheck.vetName} · ${lastCheck.diagnosis}` : "Book a checkup with one of our vets"}
              </div>
            </div>
          </div>
          <div className="border-t border-sand pt-3.5">
            <div className="mb-2 text-xs font-extrabold tracking-[0.06em] text-muted uppercase">Conditions</div>
            <ConditionsEditor petId={pet.id} conditions={pet.conditions} />
          </div>
          {vetVisits.length > 0 && (
            <ul className="-mx-2 border-t border-sand pt-2">
              {vetVisits.map((v) => (
                <li key={v.id}>
                  <Link href={`/my/vet/${v.id}`} className="flex items-center gap-3 rounded-2xl p-2 active:bg-sand">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-mint-ink">
                      <Stethoscope className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[15px]">{VET_REASONS[v.reason].label}</strong>
                      <span className="block truncate text-sm text-muted">
                        {formatShortDate(v.date)} · {formatTime(v.time)}
                        {v.doctor ? ` · ${v.doctor}` : ""}
                      </span>
                    </span>
                    {v.status === "completed" && v.healthStatus ? (
                      <Pill className={HEALTH_STATUS[v.healthStatus].tone}>{HEALTH_STATUS[v.healthStatus].label}</Pill>
                    ) : (
                      <Pill className={v.status === "booked" ? "bg-sky-soft text-sky-ink" : "bg-sand text-muted"}>
                        {v.status === "booked" ? "Booked" : "Cancelled"}
                      </Pill>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/my/vet?pet=${pet.id}`}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-mint text-[15px] font-extrabold text-mint-ink active:bg-mint-soft"
          >
            <Stethoscope className="size-5" aria-hidden="true" /> Book a vet checkup
          </Link>
        </Card>
      </section>

      <section aria-labelledby="care-h">
        <h2 id="care-h" className="mb-3 font-display text-[22px] font-semibold">
          Care notes
        </h2>
        <Card className="divide-y divide-sand">
          {care.map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className="flex items-center gap-3.5 px-4 py-3.5">
              <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-cream ${tone}`}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">{label}</div>
                <div className="font-bold">{value}</div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      {photos.length > 0 && (
        <section aria-labelledby="photos-h">
          <h2 id="photos-h" className="mb-3 font-display text-[22px] font-semibold">
            Photo memories
          </h2>
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((ph) => (
              <li key={ph.id}>
                <Link href="/my/inbox" className="block overflow-hidden rounded-2xl">
                  <PetPhoto src={ph.photo} alt={`${pet.name}, ${formatShortDate(ph.createdAt.slice(0, 10))}`} className="aspect-square w-full" sizes="140px" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="visits-h">
        <h2 id="visits-h" className="mb-3 font-display text-[22px] font-semibold">
          Visits
        </h2>
        <Card className="p-2">
          {upcoming.length + past.length === 0 ? (
            <p className="p-3 text-sm font-semibold text-muted">No visits yet.</p>
          ) : (
            <ul>
              {[...upcoming, ...past].map((v) => (
                <li key={v.id}>
                  <VisitRow visit={v} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Thumb-reach booking button, just above the tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[430px] px-4 pb-3">
        <Link
          href={`/my/book?pet=${pet.id}`}
          className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-grape text-base font-extrabold text-white shadow-float active:scale-[0.98]"
        >
          <CalendarPlus className="size-5" aria-hidden="true" /> Book a visit for {pet.name}
        </Link>
      </div>
    </div>
  );
}
