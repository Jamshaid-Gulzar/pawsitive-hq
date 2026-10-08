"use client";

import { BadgePercent, Check, CreditCard, Store } from "lucide-react";
import { formatMoney, onlineDiscountCents, sumItems, type InvoiceItem } from "@/lib/pricing";

export type PayChoice = "online" | "center";

/** Price breakdown plus "pay online (save X%)" or "pay at the center". */
export function PaymentChoice({
  items,
  discount,
  value,
  onChange,
}: {
  items: InvoiceItem[];
  discount: number;
  value: PayChoice;
  onChange: (v: PayChoice) => void;
}) {
  const total = sumItems(items);
  const off = onlineDiscountCents(total, discount);
  const options: { id: PayChoice; title: string; note: string; amount: number; icon: React.ReactNode }[] = [
    {
      id: "online",
      title: off ? `Pay online now · save ${discount}%` : "Pay online now",
      note: "Secure checkout right after you book. Fully refunded if you cancel.",
      amount: total - off,
      icon: <CreditCard className="size-5" aria-hidden="true" />,
    },
    { id: "center", title: "Pay at the center", note: "Pay by card or cash at drop-off or pickup.", amount: total, icon: <Store className="size-5" aria-hidden="true" /> },
  ];

  return (
    <section aria-labelledby="pay-h" className="flex flex-col gap-3 rounded-[26px] bg-white p-5 shadow-card">
      <h2 id="pay-h" className="font-display text-[22px] font-semibold">
        Price & payment
      </h2>
      <ul className="flex flex-col gap-1.5 text-[15px]">
        {items.map((i) => (
          <li key={i.label} className="flex justify-between gap-3">
            <span className={`font-semibold ${i.cents < 0 ? "text-mint-ink" : ""}`}>
              {i.label}
              {i.qty > 1 && <span className="block text-xs font-bold text-faint">{i.qty} × {formatMoney(i.unitCents)}</span>}
            </span>
            <span className={`font-bold tabular-nums ${i.cents < 0 ? "text-mint-ink" : ""}`}>{formatMoney(i.cents)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t-2 border-dashed border-line pt-2">
        <span className="font-extrabold">Total</span>
        <span className="font-display text-2xl font-semibold tabular-nums">{formatMoney(total)}</span>
      </div>
      {off > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3.5 py-2.5 text-sm font-bold text-mint-ink">
          <BadgePercent className="size-4.5 shrink-0" aria-hidden="true" /> Offer: pay online and save {formatMoney(off)} ({discount}% off).
        </p>
      )}
      <div role="radiogroup" aria-label="How would you like to pay?" className="flex flex-col gap-2">
        {options.map((o) => {
          const on = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              className={`flex items-center gap-3 rounded-[20px] border-2 p-3.5 text-left transition ${on ? "border-grape bg-grape-soft" : "border-line bg-white"}`}
            >
              <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${on ? "bg-grape text-white" : "bg-sand text-muted"}`}>{o.icon}</span>
              <span className="min-w-0 flex-1">
                <strong className="block leading-tight">{o.title}</strong>
                <span className="text-xs font-semibold text-muted">{o.note}</span>
              </span>
              <span className="flex flex-col items-end">
                <strong className="font-display text-lg font-semibold tabular-nums">{formatMoney(o.amount)}</strong>
                {on && <Check className="size-4 text-grape" strokeWidth={3} aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
