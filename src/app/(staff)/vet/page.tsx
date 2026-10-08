import { ChevronRight, Clock, PartyPopper, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, PetPhoto, Pill, SectionTitle } from "@/components/ui";
import { getVetClinic, type VetVisitWithPet } from "@/db/queries";
import { formatLongDate, formatShortDate, formatTime } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { VetAvatar } from "@/components/VetAvatar";
import { HEALTH_STATUS, VET_REASONS } from "@/lib/vet";

export const metadata: Metadata = { title: "Vet clinic" };

export default async function VetClinicPage() {
  await requireRole("staff", "admin");
  const { today, queue, upcoming, doneToday, onDuty } = await getVetClinic();

  return (
    <>
      <AutoRefresh seconds={10} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-ink">
          <Stethoscope className="size-7" aria-hidden="true" />
        </span>
        <div>
          <div className="text-[15px] font-bold text-muted">{formatLongDate(today)}</div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Vet clinic</h1>
        </div>
      </div>

      <section aria-label="Doctors on duty today" className="mb-7 flex flex-wrap items-center gap-3">
        <span className="text-sm font-extrabold tracking-[0.06em] text-muted uppercase">On duty today</span>
        {onDuty.length === 0 && <span className="text-sm font-semibold text-muted">No doctors scheduled</span>}
        {onDuty.map((v) => (
          <span key={v.id} className="flex items-center gap-2.5 rounded-full bg-white py-1.5 pr-4 pl-1.5 shadow-card">
            <VetAvatar name={v.name} color={v.color} size="size-9" text="text-xs" />
            <span className="text-sm leading-tight">
              <strong>{v.name}</strong>
              <br />
              <span className="text-xs font-semibold text-muted">{v.specialty}</span>
            </span>
          </span>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-7">
        <section aria-labelledby="queue-h" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          <SectionTitle id="queue-h" aside={<span className="text-sm font-bold text-muted">{queue.length} waiting</span>}>
            Today&apos;s checkups
          </SectionTitle>
          {queue.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center">
              <PartyPopper className="size-10 text-mint" aria-hidden="true" />
              <p className="font-display text-xl font-semibold">All patients seen</p>
              <p className="text-sm font-semibold text-muted">New checkups and staff flags show up here.</p>
            </Card>
          ) : (
            queue.map((v) => <QueueCard key={v.id} visit={v} today={today} />)
          )}
        </section>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4.5">
          <Card className="p-5">
            <h2 className="mb-3 font-display text-xl font-semibold">Coming up</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm font-semibold text-muted">Nothing booked yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcoming.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 text-sm">
                    <PetPhoto src={v.pet.photo} alt="" className="size-11 shrink-0 rounded-[14px]" sizes="44px" />
                    <span className="min-w-0 flex-1">
                      <strong>{v.pet.name}</strong> · {VET_REASONS[v.reason].label}
                      <br />
                      <span className="text-muted">
                        {formatShortDate(v.date)}, {formatTime(v.time)}
                        {v.vet ? ` · ${v.vet.name}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-xl font-semibold">Done today</h2>
            {doneToday.length === 0 ? (
              <p className="text-sm font-semibold text-muted">No finished checkups yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {doneToday.map((v) => (
                  <li key={v.id}>
                    <Link href={`/vet/${v.id}`} className="flex items-center gap-3 rounded-xl p-1.5 text-sm hover:bg-cream">
                      <PetPhoto src={v.pet.photo} alt="" className="size-10 shrink-0 rounded-full" sizes="40px" />
                      <span className="min-w-0 flex-1 truncate font-bold">{v.pet.name}</span>
                      {v.healthStatus && <Pill className={HEALTH_STATUS[v.healthStatus].tone}>{HEALTH_STATUS[v.healthStatus].label}</Pill>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

function QueueCard({ visit, today }: { visit: VetVisitWithPet; today: string }) {
  const reason = VET_REASONS[visit.reason];
  const overdue = visit.date < today;
  return (
    <Link
      href={`/vet/${visit.id}`}
      className="group flex flex-wrap items-center gap-4 rounded-[22px] bg-white p-4 shadow-card transition hover:-translate-y-0.5"
    >
      <div className="flex w-20 shrink-0 flex-col items-center rounded-2xl bg-cream py-2.5">
        <Clock className="size-4 text-muted" aria-hidden="true" />
        <span className="font-display text-lg font-semibold">{formatTime(visit.time).replace(" ", " ")}</span>
        {overdue && <span className="text-[11px] font-extrabold text-rose-ink">{formatShortDate(visit.date)}</span>}
      </div>
      <PetPhoto src={visit.pet.photo} alt={visit.pet.name} className="size-16 shrink-0 rounded-[20px]" sizes="64px" />
      <div className="min-w-0 flex-[1_1_220px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[21px] font-semibold">{visit.pet.name}</span>
          <Pill className={reason.tone}>{reason.label}</Pill>
        </div>
        <div className="text-sm font-semibold text-muted">
          {visit.pet.breed} · {visit.pet.owner.name}
          {visit.vet && <span className="font-extrabold text-ink"> · {visit.vet.name}</span>}
        </div>
        {visit.symptoms && <p className="mt-1.5 line-clamp-2 text-sm">{visit.symptoms}</p>}
        {visit.pet.conditions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visit.pet.conditions.map((c) => (
              <span key={c} className="rounded-full bg-rose-soft px-2.5 py-0.5 text-xs font-extrabold text-rose-ink">
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-mint px-4 text-sm font-extrabold text-white group-hover:brightness-95">
        Start checkup <ChevronRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
