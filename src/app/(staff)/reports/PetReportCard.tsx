"use client";

import { CircleCheck, NotebookPen } from "lucide-react";
import { useState, useTransition } from "react";
import { setActivity } from "@/app/actions";
import { PetPhoto, Pill } from "@/components/ui";
import type { DailyReport } from "@/db/schema";
import { ACTIVITIES } from "@/lib/care";
import { formatStamp } from "@/lib/dates";
import { ReportForm } from "./ReportForm";

/** One pet on the reports board: live activity buttons and today's report card. */
export function PetReportCard({
  booking,
}: {
  booking: {
    id: string;
    activity: string | null;
    activityAt: string | null;
    unitLabel: string | null;
    pet: { name: string; breed: string; photo: string | null; owner: { name: string } };
    report: DailyReport | null;
  };
}) {
  const [writing, setWriting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(booking.activity);
  const { pet, report } = booking;

  return (
    <article className={`flex flex-col gap-4 rounded-[24px] bg-white p-5 shadow-card ${!report ? "ring-2 ring-lilac/40" : ""}`}>
      <div className="flex items-center gap-3.5">
        <PetPhoto src={pet.photo} alt={pet.name} className="size-16 shrink-0 rounded-[20px]" sizes="64px" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[22px] leading-tight font-semibold">{pet.name}</div>
          <div className="text-sm font-semibold text-muted">
            {booking.unitLabel ?? "On site"} · {pet.owner.name}
          </div>
        </div>
        {report ? (
          <Pill className="bg-mint-soft text-mint-ink">
            <CircleCheck className="size-3.5" aria-hidden="true" /> Report sent
          </Pill>
        ) : (
          <Pill className="bg-lilac-soft text-lilac-ink">Report due</Pill>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">
          Doing right now {booking.activityAt && current === booking.activity ? `· since ${formatStamp(booking.activityAt)}` : ""}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITIES.map((a) => (
            <button
              key={a}
              type="button"
              disabled={pending}
              aria-pressed={current === a}
              onClick={() =>
                startTransition(async () => {
                  setCurrent(a);
                  await setActivity(booking.id, a);
                })
              }
              className={`min-h-10 rounded-full border-2 px-3 text-[13px] font-extrabold transition ${
                current === a ? "border-sky bg-sky text-white" : "border-line bg-white hover:border-sky"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {report && !writing ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-mint-soft/60 px-4 py-3 text-sm font-semibold">
          <span>
            {report.meals} · {report.mood} · by {report.staffName}, {formatStamp(report.createdAt)}
          </span>
          <button type="button" onClick={() => setWriting(true)} className="font-extrabold text-grape underline">
            Edit
          </button>
        </div>
      ) : writing ? (
        <ReportForm bookingId={booking.id} petName={pet.name} existing={report} onDone={() => setWriting(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-lilac text-[15px] font-extrabold text-white"
        >
          <NotebookPen className="size-5" aria-hidden="true" /> Write today&apos;s report
        </button>
      )}
    </article>
  );
}
