import { CalendarOff, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DoctorVisitCard } from "@/components/DoctorVisitCard";
import { Card } from "@/components/ui";
import { getDoctorSchedule } from "@/db/queries";
import { formatLongDate, greeting } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { workDaysLabel, worksOn } from "@/lib/vet";

export const metadata: Metadata = { title: "My day" };

export default async function DoctorDayPage() {
  const user = await requireRole("vet");
  const { vet, today, todays } = await getDoctorSchedule(user.vetId ?? "");
  const waiting = todays.filter((v) => v.status === "booked");
  const pending = todays.filter((v) => v.status === "requested");
  const done = todays.filter((v) => v.status === "completed");
  const working = vet ? worksOn(vet, today) : false;

  return (
    <>
      <AutoRefresh seconds={10} />
      <div className="mb-6">
        <div className="text-[15px] font-bold text-muted">{formatLongDate(today)}</div>
        <h1 className="mt-1 font-display text-[38px] font-semibold">
          {greeting()}, {user.name.split(" ").slice(0, 2).join(" ")}
        </h1>
      </div>

      <section aria-label="Today" className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        <Tile value={waiting.length} label="Patients to see" className="bg-mint-soft text-mint-ink" />
        <Tile value={pending.length} label="Awaiting confirmation" className="bg-sun-soft text-sun-ink" />
        <Tile value={done.length} label="Done today" className="bg-sky-soft text-sky-ink" />
      </section>

      {!working && todays.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CalendarOff className="size-12 text-muted" aria-hidden="true" />
          <p className="font-display text-2xl font-semibold">Day off today</p>
          <p className="font-semibold text-muted">You work {vet ? workDaysLabel(vet.workDays) : "your usual days"}. See My schedule for what&apos;s next.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-7">
          <section aria-labelledby="see-h" className="flex flex-col gap-3">
            <h2 id="see-h" className="font-display text-[26px] font-semibold">
              Today&apos;s patients
            </h2>
            {waiting.length === 0 ? (
              <Card className="flex items-center gap-3 p-6 font-semibold text-muted">
                <PartyPopper className="size-6 text-mint" aria-hidden="true" /> No one waiting right now.
              </Card>
            ) : (
              waiting.map((v) => <DoctorVisitCard key={v.id} visit={v} today={today} />)
            )}
          </section>
          {pending.length > 0 && (
            <section aria-labelledby="pending-h" className="flex flex-col gap-3">
              <h2 id="pending-h" className="font-display text-[22px] font-semibold">
                Booked with you, waiting for the front desk
              </h2>
              {pending.map((v) => (
                <DoctorVisitCard key={v.id} visit={v} today={today} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section aria-labelledby="done-h" className="flex flex-col gap-3">
              <h2 id="done-h" className="font-display text-[22px] font-semibold">
                Done today
              </h2>
              {done.map((v) => (
                <DoctorVisitCard key={v.id} visit={v} today={today} />
              ))}
            </section>
          )}
        </div>
      )}
    </>
  );
}

function Tile({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`rounded-[22px] px-5 py-4.5 ${className}`}>
      <div className="font-display text-[34px] leading-none font-semibold">{value}</div>
      <div className="mt-1.5 text-sm font-extrabold">{label}</div>
    </div>
  );
}
