import { CalendarClock, Pill as PillIcon, Scale, Stethoscope, Thermometer } from "lucide-react";
import type { VetVisit } from "@/db/schema";
import { formatShortDate } from "@/lib/dates";
import { HEALTH_STATUS } from "@/lib/vet";
import { Pill } from "./ui";

/** The vet's findings for a completed checkup. */
export function VetReportCard({ visit }: { visit: VetVisit }) {
  const status = visit.healthStatus ? HEALTH_STATUS[visit.healthStatus] : null;
  const rows = [
    { icon: Stethoscope, label: "Findings", value: visit.diagnosis },
    { icon: Stethoscope, label: "Treatment", value: visit.treatment },
    { icon: PillIcon, label: "Medication", value: visit.medication },
    { icon: CalendarClock, label: "Follow-up", value: visit.followUpDate ? `${formatShortDate(visit.followUpDate)} at 10:00 AM` : null },
  ].filter((r) => r.value);

  return (
    <div className="overflow-hidden rounded-[24px] bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-sand p-4">
        <div>
          <div className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">Vet report</div>
          <div className="font-display text-lg font-semibold">{visit.vetName}</div>
        </div>
        {status && (
          <Pill className={`${status.tone} text-[13px]`}>
            <span className={`size-2 rounded-full ${status.dot}`} /> {status.label}
          </Pill>
        )}
      </div>
      {(visit.weightKg || visit.temperatureC) && (
        <div className="grid grid-cols-2 divide-x divide-sand border-b border-sand">
          <div className="flex items-center gap-2.5 p-4">
            <Scale className="size-5 text-grape" aria-hidden="true" />
            <div>
              <div className="text-xs font-bold text-muted">Weight</div>
              <div className="font-display text-xl font-semibold">{visit.weightKg ? `${visit.weightKg} kg` : "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-4">
            <Thermometer className="size-5 text-coral-ink" aria-hidden="true" />
            <div>
              <div className="text-xs font-bold text-muted">Temperature</div>
              <div className="font-display text-xl font-semibold">{visit.temperatureC ? `${visit.temperatureC} °C` : "—"}</div>
            </div>
          </div>
        </div>
      )}
      <dl className="flex flex-col gap-3.5 p-4">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex gap-3">
            <Icon className="mt-0.5 size-4.5 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <dt className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
