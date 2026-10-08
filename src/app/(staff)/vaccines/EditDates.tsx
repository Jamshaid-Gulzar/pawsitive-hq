"use client";

import { useState, useTransition } from "react";
import { correctVaccineDates } from "@/app/actions";
import type { VaccineDates, VaccineKey } from "@/lib/vaccines";

/** Lets staff fix a date the scanner misread, then re-checks the bookings. */
export function EditDates({ petId, dates, labels }: { petId: string; dates: VaccineDates; labels: Record<VaccineKey, string> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(dates);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-12 flex-1 rounded-full border-2 border-ink bg-white px-5 text-[15px] font-extrabold transition hover:bg-ink hover:text-white"
      >
        Edit dates
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-2xl bg-cream p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await correctVaccineDates(petId, value);
          if (r.ok) setEditing(false);
          else setError(r.error);
        });
      }}
    >
      {(Object.keys(labels) as VaccineKey[]).map((key) => (
        <label key={key} className="flex items-center justify-between gap-3 text-sm font-bold">
          {labels[key]}
          <input
            type="date"
            value={value[key] ?? ""}
            onChange={(e) => setValue({ ...value, [key]: e.target.value || null })}
            className="min-h-11 rounded-xl border-2 border-line bg-white px-3 font-semibold"
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-full bg-grape px-4 text-sm font-extrabold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save & re-check"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-full px-4 text-sm font-bold hover:bg-sand">
          Cancel
        </button>
      </div>
    </form>
  );
}
