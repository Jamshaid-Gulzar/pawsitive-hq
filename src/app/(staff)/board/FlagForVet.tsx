"use client";

import { Stethoscope } from "lucide-react";
import { useState, useTransition } from "react";
import { flagForVet } from "@/app/actions";

/** "Something's not right" → books the in-house vet today and tells the owner. */
export function FlagForVet({ petId, petName }: { petId: string; petName: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-extrabold text-mint-ink hover:bg-mint-soft"
      >
        <Stethoscope className="size-4" aria-hidden="true" /> Request vet check
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-mint-soft p-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await flagForVet(petId, note);
          if (r.ok) setOpen(false);
          else setError(r.error);
        });
      }}
    >
      <label className="text-[13px] font-extrabold text-mint-ink">
        What did you notice about {petName}?
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          autoFocus
          placeholder="e.g. Limping on back leg, not eating"
          className="mt-1 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-10 flex-1 rounded-full bg-mint text-sm font-extrabold text-white disabled:opacity-60">
          {pending ? "Booking…" : "Book vet today"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-full px-3 text-sm font-bold">
          Cancel
        </button>
      </div>
    </form>
  );
}
