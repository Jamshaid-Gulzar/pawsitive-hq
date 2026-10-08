"use client";

import { CalendarCheck, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MonthCalendar } from "@/components/MonthCalendar";
import { TimeSlots } from "@/components/TimeSlots";
import { addDays, formatShortDate, formatTime } from "@/lib/dates";
import { VET_SLOTS, vetDayState, vetSlotState } from "@/lib/vet";

/** The doctor's calendar: pick a free time here and go straight to booking it. */
export function Availability({
  vet,
  today,
  nowTime,
  taken,
  petId,
}: {
  vet: { id: string; name: string; workDays: number[] };
  today: string;
  nowTime: string;
  taken: string[];
  petId?: string;
}) {
  const firstOpen =
    Array.from({ length: 60 }, (_, i) => addDays(today, i)).find((d) => {
      const s = vetDayState(vet, d, taken, today, nowTime);
      return s === "open" || s === "limited";
    }) ?? null;
  const [date, setDate] = useState<string | null>(firstOpen);
  const [time, setTime] = useState<string | null>(null);

  const params = new URLSearchParams({ vet: vet.id });
  if (petId) params.set("pet", petId);
  if (date && time) {
    params.set("date", date);
    params.set("time", time);
  }

  return (
    <section aria-labelledby="avail-h" className="flex flex-col gap-3">
      <div>
        <h2 id="avail-h" className="flex items-center gap-2 font-display text-[22px] font-semibold">
          <CalendarCheck className="size-5.5 text-grape" aria-hidden="true" /> Availability
        </h2>
        <p className="text-sm font-semibold text-muted">Tap a day, then a free time to book it.</p>
      </div>
      <MonthCalendar
        today={today}
        mode="single"
        start={date}
        end={date}
        onChange={(d) => {
          setDate(d);
          setTime(null);
        }}
        dayState={(iso) => vetDayState(vet, iso, taken, today, nowTime)}
        closedLabel="Day off"
      />
      {date && (
        <TimeSlots
          dayKey={date}
          slots={VET_SLOTS.map((s) => ({ time: s, state: vetSlotState(vet.id, date, s, taken, today, nowTime) }))}
          value={time}
          onChange={setTime}
        />
      )}

      <div className="fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[430px] px-4 pb-3">
        <Link
          href={`/my/vet?${params}`}
          className="flex min-h-13 items-center justify-center gap-2 rounded-full bg-grape text-base font-extrabold text-white shadow-float active:scale-[0.98]"
        >
          <Stethoscope className="size-5" aria-hidden="true" />
          {date && time ? `Book ${formatShortDate(date)}, ${formatTime(time)}` : `Book with ${vet.name}`}
        </Link>
      </div>
    </section>
  );
}
