import { CircleCheck, FileDown, House, Pill as PillIcon, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { getVetVisit } from "@/db/queries";
import { formatLongDate, formatShortDate, formatStamp, formatTime, todayISO } from "@/lib/dates";
import { HEALTH_STATUS, VET_REASONS } from "@/lib/vet";
import { Card, PetPhoto, Pill } from "./ui";
import { VetAvatar } from "./VetAvatar";
import { VetReportCard } from "./VetReportCard";

type VisitData = NonNullable<Awaited<ReturnType<typeof getVetVisit>>>;

/** The patient's file for one vet visit. `action` is the doctor's exam form, or a status note for staff. */
export function PatientVisit({ data, action }: { data: VisitData; action?: ReactNode }) {
  const { visit, history, hereIn } = data;
  const { pet } = visit;
  const reason = VET_REASONS[visit.reason];
  const age = pet.birthday ? Number(todayISO().slice(0, 4)) - Number(pet.birthday.slice(0, 4)) : null;

  return (
    <div className="flex flex-wrap items-start gap-7">
      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4.5">
        <Card className="overflow-hidden">
          <PetPhoto src={pet.photo} alt={pet.name} className="aspect-[4/3] w-full" sizes="360px" priority />
          <div className="flex flex-col gap-3 p-5">
            <div>
              <h1 className="font-display text-[30px] leading-tight font-semibold">{pet.name}</h1>
              <p className="font-semibold text-muted">
                {pet.breed} · {pet.sex === "f" ? "Female" : "Male"}
                {age !== null ? ` · ${age} yrs` : ""}
              </p>
              <p className="text-sm font-semibold text-muted">
                Owner: {pet.owner.name}
                {pet.owner.phone ? ` · ${pet.owner.phone}` : ""}
              </p>
            </div>
            {hereIn && (
              <Pill className="self-start bg-sky-soft text-sky-ink">
                <House className="size-3.5" aria-hidden="true" /> Staying with us · {hereIn}
              </Pill>
            )}
            {pet.alert && (
              <p className="flex items-center gap-2 rounded-xl bg-rose-soft px-3 py-2 text-sm font-bold text-rose-ink">
                <TriangleAlert className="size-4" aria-hidden="true" /> {pet.alert}
              </p>
            )}
            {pet.meds && (
              <p className="flex items-center gap-2 text-sm font-semibold">
                <PillIcon className="size-4 text-lilac-ink" aria-hidden="true" /> Current meds: {pet.meds}
              </p>
            )}
            <div>
              <div className="mb-1.5 text-xs font-extrabold tracking-[0.06em] text-muted uppercase">Conditions</div>
              {pet.conditions.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {pet.conditions.map((c) => (
                    <span key={c} className="rounded-full bg-rose-soft px-2.5 py-1 text-xs font-extrabold text-rose-ink">
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-muted">None on file</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-display text-xl font-semibold">Past checkups</h2>
          {history.length === 0 ? (
            <p className="text-sm font-semibold text-muted">First visit with us.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {history.map((h) => (
                <li key={h.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong>
                      {formatShortDate(h.date)}
                      {h.vetName ? ` · ${h.vetName}` : ""}
                    </strong>
                    {h.healthStatus && <Pill className={HEALTH_STATUS[h.healthStatus].tone}>{HEALTH_STATUS[h.healthStatus].label}</Pill>}
                  </div>
                  <p className="text-muted">{h.diagnosis}</p>
                  {h.weightKg && <p className="text-xs font-bold text-faint">{h.weightKg} kg</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>

      <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-4.5">
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <Pill className={`${reason.tone} text-[13px]`}>{reason.label}</Pill>
          <span className="text-sm font-bold text-muted">
            {formatLongDate(visit.date)} · {formatTime(visit.time)} · requested by {visit.requestedBy}
          </span>
          {visit.vet && (
            <span className="flex w-full items-center gap-2.5">
              <VetAvatar name={visit.vet.name} color={visit.vet.color} size="size-10" text="text-sm" />
              <span className="text-sm leading-tight">
                <strong>{visit.vet.name}</strong>
                <br />
                <span className="font-semibold text-muted">{visit.vet.specialty}</span>
              </span>
            </span>
          )}
          {visit.symptoms && <p className="w-full rounded-2xl bg-cream p-4 text-[15px] font-semibold">&ldquo;{visit.symptoms}&rdquo;</p>}
          {visit.confirmedBy && (
            <p className="flex w-full items-center gap-2 text-sm font-bold text-mint-ink">
              <CircleCheck className="size-4.5" aria-hidden="true" /> Confirmed by {visit.confirmedBy}
              {visit.confirmedAt ? ` · ${formatStamp(visit.confirmedAt)}` : ""}
            </p>
          )}
        </Card>

        {visit.status === "completed" ? (
          <>
            <p className="flex items-center gap-2 rounded-2xl bg-mint-soft p-4 font-bold text-mint-ink">
              <CircleCheck className="size-5" aria-hidden="true" /> Checkup complete — {pet.owner.name.split(" ")[0]} has the report.
            </p>
            <VetReportCard visit={visit} />
            <a
              href={`/api/vet-report/${visit.id}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-grape px-6 text-[15px] font-extrabold text-white hover:bg-grape-dark"
            >
              <FileDown className="size-5" aria-hidden="true" /> Download PDF report
            </a>
          </>
        ) : visit.status === "cancelled" || visit.status === "declined" ? (
          <p className="rounded-2xl bg-sand p-4 font-bold text-muted">This appointment was {visit.status}.</p>
        ) : (
          action
        )}
      </section>
    </div>
  );
}
