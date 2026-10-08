"use client";

import { CircleX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SlotState } from "@/lib/availability";
import { formatTime } from "@/lib/dates";

/**
 * Times for the chosen day. Booked ones stay tappable so we can say why they
 * can't be picked, instead of silently ignoring the tap.
 */
export function TimeSlots({
  dayKey,
  scrollOnMount = false,
  slots,
  value,
  onChange,
}: {
  /** The chosen day; a new value scrolls the times into view. */
  dayKey: string;
  /** Also scroll when the times first appear (they were revealed by a tap). */
  scrollOnMount?: boolean;
  slots: { time: string; state: SlotState }[];
  value: string | null;
  onChange: (time: string) => void;
}) {
  // The "already booked" note belongs to the day it was shown for.
  const [noticeFor, setNoticeFor] = useState<{ day: string; text: string } | null>(null);
  const notice = noticeFor?.day === dayKey ? noticeFor.text : null;
  const setNotice = (text: string | null) => setNoticeFor(text ? { day: dayKey, text } : null);
  const free = slots.filter((s) => s.state === "free").length;
  const box = useRef<HTMLDivElement>(null);
  const shownDay = useRef(scrollOnMount ? null : dayKey);

  // When the customer picks another day, bring its times into view above the
  // pinned button (but don't jump the page on first load).
  useEffect(() => {
    if (shownDay.current === dayKey) return;
    shownDay.current = dayKey;
    box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [dayKey]);

  return (
    <div ref={box} className="flex scroll-mb-40 flex-col gap-2.5">
      <p className="text-sm font-bold text-muted">
        {free ? `${free} of ${slots.length} times free` : "Every time is taken on this day. Please choose another date."}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map(({ time, state }) => {
          const selected = time === value;
          return (
            <button
              key={time}
              type="button"
              aria-pressed={selected}
              aria-disabled={state !== "free"}
              aria-label={`${formatTime(time)}${state === "booked" ? ", already booked" : state === "passed" ? ", already passed" : ""}`}
              onClick={() => {
                if (state === "booked") return setNotice(`${formatTime(time)} is already booked. Please choose another time.`);
                if (state === "passed") return setNotice(`${formatTime(time)} has already passed today. Please choose a later time.`);
                setNotice(null);
                onChange(time);
              }}
              className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border-2 text-sm font-extrabold transition ${
                state === "booked"
                  ? "border-rose-soft bg-rose-soft text-rose-ink"
                  : state === "passed"
                    ? "border-transparent bg-sand text-faint"
                    : selected
                      ? "border-mint bg-mint text-white shadow-[0_6px_16px_rgb(34_160_107/0.35)]"
                      : "border-line bg-white hover:border-mint"
              }`}
            >
              <span className={state !== "free" ? "line-through decoration-2" : ""}>{formatTime(time)}</span>
              {state === "booked" && <span className="text-[10px] tracking-wide uppercase">Booked</span>}
              {state === "passed" && <span className="text-[10px] tracking-wide uppercase">Passed</span>}
              {state === "free" && !selected && <span className="text-[10px] font-bold tracking-wide text-mint-ink uppercase">Free</span>}
            </button>
          );
        })}
      </div>
      {notice && (
        <p role="alert" className="animate-pop flex items-center gap-2 rounded-2xl bg-rose-soft px-3.5 py-2.5 text-sm font-bold text-rose-ink">
          <CircleX className="size-4.5 shrink-0" aria-hidden="true" /> {notice}
        </p>
      )}
    </div>
  );
}
