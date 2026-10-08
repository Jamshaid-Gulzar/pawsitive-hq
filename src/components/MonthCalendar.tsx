"use client";

import { ChevronLeft, ChevronRight, Info, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { DayState } from "@/lib/availability";
import { addDays, formatShortDate } from "@/lib/dates";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const monthKey = (iso: string) => iso.slice(0, 7);

function monthDays(key: string): (string | null)[] {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= count; d++) cells.push(`${key}-${String(d).padStart(2, "0")}`);
  return cells;
}

function shiftMonth(key: string, by: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

const BLOCKED_TEXT: Partial<Record<DayState, string>> = {
  full: "This date is fully booked. Please choose another date.",
  closed: "We're closed for this service that day. Please choose another date.",
  past: "That date has already passed.",
};

/**
 * A month calendar showing availability per day. In range mode the first tap
 * sets the start and the second the end (boarding drop-off → pickup).
 */
export function MonthCalendar({
  today,
  windowDays = 60,
  mode,
  start,
  end,
  onChange,
  dayState,
  stayFull,
  closedLabel = "Closed",
}: {
  today: string;
  windowDays?: number;
  mode: "single" | "range";
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  dayState: (iso: string) => DayState;
  /** Range mode: whether a night of the stay has no room (defaults to a "full" day). */
  stayFull?: (iso: string) => boolean;
  closedLabel?: string;
}) {
  const last = addDays(today, windowDays - 1);
  const [month, setMonth] = useState(monthKey(start ?? today));
  const [notice, setNotice] = useState<string | null>(null);
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  function clear() {
    setNotice(null);
    onChange(null, null);
  }

  function pick(iso: string) {
    // Tapping a selected day unselects it, so the customer is never stuck.
    if (iso === start || iso === end) return clear();
    const state = iso > last ? "past" : dayState(iso);
    // In range mode the pickup day only needs a free kennel, not a free drop-off time.
    const blocked = state === "full" || state === "closed" || state === "past";
    if (mode === "range" && start && !end && iso > start) {
      const between: string[] = [];
      for (let d = addDays(start, 1); d <= iso; d = addDays(d, 1)) between.push(d);
      const fullDay = between.find((d) => (stayFull ? stayFull(d) : dayState(d) === "full"));
      if (fullDay) {
        setNotice(
          `${formatShortDate(fullDay)} is fully booked, so this stay can't run across it. Pick an earlier pickup day, or tap ${formatShortDate(start)} to choose a new drop-off.`,
        );
        return;
      }
      setNotice(null);
      onChange(start, iso);
      return;
    }
    if (blocked) {
      setNotice(iso > last ? "We take bookings up to 60 days ahead." : BLOCKED_TEXT[state] ?? null);
      return;
    }
    setNotice(null);
    onChange(iso, mode === "range" ? null : iso);
  }

  const canPrev = month > monthKey(today);
  const canNext = month < monthKey(last);

  return (
    <div className="rounded-[24px] bg-white p-3.5 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={!canPrev}
          aria-label="Previous month"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-cream disabled:opacity-30"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="font-display text-lg font-semibold" aria-live="polite">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={!canNext}
          aria-label="Next month"
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-cream disabled:opacity-30"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-extrabold text-faint" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label={label}>
        {monthDays(month).map((iso, i) => {
          if (!iso) return <span key={`blank-${i}`} />;
          const state: DayState = iso > last ? "past" : dayState(iso);
          const isStart = iso === start;
          const isEnd = iso === end;
          const inRange = mode === "range" && start && end && iso > start && iso < end;
          const selected = isStart || isEnd;
          const dim = state === "past" || state === "closed";
          const day = Number(iso.slice(8));
          const status =
            state === "full" ? "Full" : state === "closed" ? closedLabel : state === "limited" ? "Few left" : state === "past" ? "" : "Free";
          return (
            <div
              key={iso}
              className={`flex justify-center ${inRange ? "bg-grape-soft" : ""} ${
                mode === "range" && isStart && end ? "rounded-l-full bg-grape-soft" : ""
              } ${mode === "range" && isEnd ? "rounded-r-full bg-grape-soft" : ""}`}
            >
              <button
                type="button"
                role="gridcell"
                aria-selected={selected}
                aria-label={`${formatShortDate(iso)}${status ? `, ${status}` : ""}`}
                onClick={() => pick(iso)}
                className={`relative flex size-11 flex-col items-center justify-center rounded-full text-[15px] font-extrabold transition ${
                  selected
                    ? "bg-ink text-white"
                    : state === "full"
                      ? "bg-rose-soft text-rose-ink line-through decoration-2"
                      : dim
                        ? "text-faint/60"
                        : "hover:bg-cream"
                } ${iso === today && !selected ? "ring-2 ring-coral" : ""}`}
              >
                {day}
                {!selected && (state === "open" || state === "limited") && (
                  <span className={`absolute bottom-1 size-1.5 rounded-full ${state === "open" ? "bg-mint" : "bg-amber"}`} />
                )}
              </button>
            </div>
          );
        })}
      </div>

      {notice && (
        <p role="alert" className="animate-pop mt-3 flex items-start gap-2 rounded-2xl bg-rose-soft px-3.5 py-2.5 text-sm font-bold text-rose-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {notice}
        </p>
      )}

      {start && (
        <button
          type="button"
          onClick={clear}
          className="mt-2.5 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border-2 border-line text-sm font-extrabold text-muted hover:border-ink hover:text-ink"
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Clear {mode === "range" ? "dates" : "date"} and pick again
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 border-t border-sand pt-2.5 text-[11px] font-bold text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-mint" /> Free
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber" /> Few left
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-4 rounded bg-rose-soft" /> Fully booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full ring-2 ring-coral" /> Today
        </span>
      </div>
    </div>
  );
}
