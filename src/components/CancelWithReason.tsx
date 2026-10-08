"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { cancelBooking, cancelVetVisit } from "@/app/actions";
import { CANCEL_REASONS } from "@/lib/care";

/** "Cancel booking" opens a short form: pick a reason, then confirm. */
export function CancelWithReason({ kind, id, label }: { kind: "booking" | "vet"; id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 w-full rounded-full border-2 border-rose/30 text-[15px] font-extrabold text-rose-ink transition active:bg-rose-soft"
      >
        {label}
      </button>
    );
  }

  const finalReason = reason === "Other" ? other.trim() : reason;

  return (
    <form
      className="animate-pop flex flex-col gap-3 rounded-[24px] bg-white p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = kind === "booking" ? await cancelBooking(id, finalReason ?? "") : await cancelVetVisit(id, finalReason ?? "");
          if (!r.ok) setError(r.error);
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-display text-lg font-semibold">Why are you cancelling?</legend>
        {CANCEL_REASONS.map((r) => {
          const on = reason === r;
          return (
            <label
              key={r}
              className={`relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-3.5 font-bold transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-grape ${
                on ? "border-rose bg-rose-soft text-rose-ink" : "border-line"
              }`}
            >
              <input type="radio" name="cancel-reason" className="sr-only" checked={on} onChange={() => setReason(r)} />
              <span className={`inline-flex size-5.5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-rose bg-rose text-white" : "border-[#b8b1a6]"}`}>
                {on && <Check className="size-3.5" strokeWidth={3.4} aria-hidden="true" />}
              </span>
              {r}
            </label>
          );
        })}
        {reason === "Other" && (
          <label className="text-sm font-extrabold">
            Tell us more
            <textarea
              value={other}
              onChange={(e) => setOther(e.target.value)}
              rows={2}
              maxLength={200}
              autoFocus
              className="mt-1 w-full rounded-2xl border-2 border-line bg-white px-3.5 py-2.5 text-[15px] font-semibold"
            />
          </label>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !finalReason}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-rose px-4 text-[15px] font-extrabold text-white disabled:opacity-50"
        >
          {pending && <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" />}
          {finalReason ? "Confirm cancellation" : "Choose a reason"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-full px-4 font-bold active:bg-sand">
          Keep it
        </button>
      </div>
    </form>
  );
}
