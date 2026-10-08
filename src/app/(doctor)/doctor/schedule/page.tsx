import type { Metadata } from "next";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DoctorVisitCard } from "@/components/DoctorVisitCard";
import { Card } from "@/components/ui";
import { getDoctorSchedule } from "@/db/queries";
import { formatLongDate } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { CLINIC_HOURS, workDaysLabel } from "@/lib/vet";

export const metadata: Metadata = { title: "My schedule" };

export default async function DoctorSchedulePage() {
  const user = await requireRole("vet");
  const { vet, today, upcoming } = await getDoctorSchedule(user.vetId ?? "");
  const byDate = new Map<string, typeof upcoming>();
  for (const v of upcoming) byDate.set(v.date, [...(byDate.get(v.date) ?? []), v]);

  return (
    <>
      <AutoRefresh seconds={15} />
      <h1 className="font-display text-[38px] font-semibold">My schedule</h1>
      <p className="mt-1.5 mb-6 font-semibold text-muted">
        Next two weeks · you work {vet ? workDaysLabel(vet.workDays) : "—"}, {CLINIC_HOURS}. The front desk confirms every booking; you&apos;ll see who
        confirmed it.
      </p>
      {byDate.size === 0 ? (
        <Card className="p-10 text-center font-semibold text-muted">No appointments in the next two weeks yet.</Card>
      ) : (
        <div className="flex flex-col gap-7">
          {[...byDate.entries()].map(([date, visits]) => (
            <section key={date} aria-label={formatLongDate(date)} className="flex flex-col gap-3">
              <h2 className="font-display text-[22px] font-semibold">
                {formatLongDate(date)} <span className="text-base font-bold text-muted">· {visits.length} appointment{visits.length === 1 ? "" : "s"}</span>
              </h2>
              {visits.map((v) => (
                <DoctorVisitCard key={v.id} visit={v} today={today} />
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
