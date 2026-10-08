"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { addInvoiceItem, refundInvoice, voidInvoice } from "@/app/actions";

const EXTRAS = [
  { label: "Extra walk", amount: "12" },
  { label: "Medication handling", amount: "8" },
  { label: "Late pickup", amount: "20" },
  { label: "Loyalty discount", amount: "-10" },
];

/** Add an extra charge (or a negative amount for a discount) to an unpaid invoice. */
export function AddItemForm({ invoiceId }: { invoiceId: string }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await addInvoiceItem(invoiceId, label, amount);
          if (r.ok) {
            setLabel("");
            setAmount("");
          } else setError(r.error);
        });
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {EXTRAS.map((x) => (
          <button
            key={x.label}
            type="button"
            onClick={() => {
              setLabel(x.label);
              setAmount(x.amount);
            }}
            className="rounded-full bg-cream px-3 py-1.5 text-xs font-extrabold text-muted hover:text-ink"
          >
            {x.label} {x.amount.startsWith("-") ? `−$${x.amount.slice(1)}` : `$${x.amount}`}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="extra-label">
          Description
        </label>
        <input
          id="extra-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Description, e.g. Extra walk"
          maxLength={60}
          className="min-h-11 min-w-0 flex-[1_1_180px] rounded-xl border-2 border-line px-3 font-semibold"
        />
        <label className="sr-only" htmlFor="extra-amount">
          Amount in dollars
        </label>
        <input
          id="extra-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="$ 0.00"
          inputMode="decimal"
          className="min-h-11 w-28 rounded-xl border-2 border-line px-3 font-semibold"
        />
        <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-extrabold text-white disabled:opacity-60">
          <Plus className="size-4" aria-hidden="true" /> {pending ? "Adding…" : "Add"}
        </button>
      </div>
      <p className="text-xs font-semibold text-muted">Use a minus amount for a discount, e.g. -10.</p>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
    </form>
  );
}

/** Admin: void an unpaid invoice or refund a paid one, with a reason for the records. */
export function ReasonAction({ invoiceId, kind }: { invoiceId: string; kind: "void" | "refund" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = kind === "void" ? "Void invoice" : "Refund in full";
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full border-2 border-rose/40 px-4 text-sm font-extrabold text-rose-ink hover:bg-rose-soft">
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex w-full flex-col gap-2 rounded-2xl bg-rose-soft/60 p-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = kind === "void" ? await voidInvoice(invoiceId, reason) : await refundInvoice(invoiceId, reason);
          if (!r.ok) setError(r.error);
        });
      }}
    >
      <label className="text-sm font-extrabold text-rose-ink">
        Reason (kept with the invoice{kind === "refund" ? " and sent to the owner" : ""})
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          maxLength={200}
          className="mt-1 min-h-11 w-full rounded-xl border-2 border-white bg-white px-3 font-semibold text-ink"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-full bg-rose px-4 text-sm font-extrabold text-white disabled:opacity-60">
          {pending ? "Saving…" : label}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-full px-4 text-sm font-bold hover:bg-white">
          Keep it
        </button>
      </div>
    </form>
  );
}
