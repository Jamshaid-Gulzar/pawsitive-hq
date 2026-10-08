"use client";

import { useState, useTransition } from "react";
import { assignUnit } from "@/app/actions";

/** Check an arriving pet straight into a free spot from the arrivals list. */
export function QuickCheckIn({ bookingId, petName, units }: { bookingId: string; petName: string; units: { id: string; label: string }[] }) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (units.length === 0) return <p className="text-[13px] font-semibold text-rose-ink">No free spot right now</p>;

  return (
    <div className="flex w-full flex-wrap gap-2">
      <label className="sr-only" htmlFor={`qc-${bookingId}`}>
        Spot for {petName}
      </label>
      <select
        id={`qc-${bookingId}`}
        value={unitId}
        onChange={(e) => setUnitId(e.target.value)}
        className="min-h-10 min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-2.5 text-sm font-bold"
      >
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
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
        className="min-h-10 rounded-full bg-ink px-4 text-sm font-extrabold text-white transition hover:bg-grape disabled:opacity-60"
      >
        {pending ? "Checking in…" : "Check in"}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
    </div>
  );
}
