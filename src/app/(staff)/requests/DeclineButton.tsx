"use client";

import { useState, useTransition } from "react";
import { declineBooking, declineVetVisit } from "@/app/actions";

const QUICK = ["We're fully booked then — please pick another time.", "That time no longer works for us — please choose another.", "Please book a vet checkup first."];

/** Decline with a reason the owner will see. */
export function DeclineButton({ kind, id }: { kind: "booking" | "vet"; id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 flex-1 rounded-full border-2 border-line bg-white px-5 text-[15px] font-extrabold text-muted transition hover:border-rose hover:text-rose-ink"
      >
        Decline
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2.5 rounded-2xl bg-rose-soft/60 p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = kind === "booking" ? await declineBooking(id, reason) : await declineVetVisit(id, reason);
          if (!r.ok) setError(r.error);
        });
      }}
    >
      <label className="text-sm font-extrabold text-rose-ink">
        Reason (the owner will see this)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={200}
          autoFocus
          className="mt-1 w-full rounded-xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setReason(q)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-muted hover:text-ink">
            {q}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-full bg-rose px-4 text-sm font-extrabold text-white disabled:opacity-60">
          {pending ? "Declining…" : "Decline & tell owner"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full px-4 text-sm font-bold hover:bg-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
