"use client";

import { useState, useTransition } from "react";
import { assignUnit } from "@/app/actions";

/** Shown on an empty run or table: pick a pet arriving today and check it in here. */
export function AssignPet({ unitId, unitLabel, options }: { unitId: string; unitLabel: string; options: { bookingId: string; label: string }[] }) {
  const [bookingId, setBookingId] = useState(options[0]?.bookingId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (options.length === 0) {
    return <p className="text-[13px] font-semibold text-muted">No arrivals waiting</p>;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <label className="sr-only" htmlFor={`assign-${unitId}`}>
        Pet to check in to {unitLabel}
      </label>
      <select
        id={`assign-${unitId}`}
        value={bookingId}
        onChange={(e) => setBookingId(e.target.value)}
        className="min-h-11 w-full rounded-xl border-2 border-line bg-white px-3 text-sm font-bold"
      >
        {options.map((o) => (
          <option key={o.bookingId} value={o.bookingId}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await assignUnit(bookingId, unitId);
            if (!r.ok) setError(r.error);
          })
        }
        className="min-h-11 rounded-full border-2 border-ink bg-white px-4 text-sm font-extrabold transition hover:bg-ink hover:text-white disabled:opacity-60"
      >
        {pending ? "Checking in…" : "Check in here"}
      </button>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
    </div>
  );
}
