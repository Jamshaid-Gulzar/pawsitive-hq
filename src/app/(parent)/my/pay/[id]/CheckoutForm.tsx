"use client";

import { Lock, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { payOnline } from "@/app/actions";
import { formatMoney } from "@/lib/pricing";

const groups = (digits: string) => digits.replace(/\D/g, "").slice(0, 19).replace(/(.{4})(?=.)/g, "$1 ");

/**
 * Demo card form. No payment provider is connected, so nothing is charged;
 * it's prefilled with a test card so anyone can try the flow.
 */
export function CheckoutForm({ invoiceId, amount, ownerName }: { invoiceId: string; amount: number; ownerName: string }) {
  const router = useRouter();
  const [card, setCard] = useState({ name: ownerName, number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = "min-h-13 w-full rounded-2xl border-2 border-line bg-white px-4 text-base font-semibold outline-none focus:border-grape";

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await payOnline(invoiceId, card);
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Name on card
        <input className={field} value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} autoComplete="cc-name" required />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Card number
        <input
          className={`${field} tracking-wider tabular-nums`}
          value={card.number}
          onChange={(e) => setCard({ ...card, number: groups(e.target.value) })}
          inputMode="numeric"
          autoComplete="cc-number"
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Expiry (MM/YY)
          <input
            className={field}
            value={card.expiry}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 4);
              setCard({ ...card, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d });
            }}
            inputMode="numeric"
            autoComplete="cc-exp"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Security code
          <input
            className={field}
            value={card.cvc}
            onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            inputMode="numeric"
            autoComplete="cc-csc"
            required
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-3.5 py-2.5 text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-grape text-lg font-extrabold text-white shadow-float transition active:scale-[0.98] disabled:opacity-70"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Lock className="size-5" aria-hidden="true" />}
        {pending ? "Processing payment…" : `Pay ${formatMoney(amount)} now`}
      </button>
    </form>
  );
}
