"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { setOnlineDiscount, updatePrices } from "@/app/actions";
import type { Price } from "@/db/schema";
import { PRICE_CATEGORIES, formatMoney, parseMoney } from "@/lib/pricing";

const toText = (cents: number) => (cents / 100).toFixed(cents % 100 ? 2 : 0);

/** The whole price list as one form. Read-only for staff. */
export function PriceEditor({ prices, canEdit }: { prices: Price[]; canEdit: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(prices.map((p) => [p.key, toText(p.cents)])));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const changed = prices.filter((p) => parseMoney(values[p.key]) !== p.cents);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          setSaved(false);
          const r = await updatePrices(changed.map((p) => ({ key: p.key, amount: values[p.key] })));
          if (r.ok) setSaved(true);
          else setError(r.error);
        });
      }}
    >
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
        {PRICE_CATEGORIES.map((cat) => (
          <fieldset key={cat.id} className="flex flex-col gap-1 rounded-[22px] bg-white p-5 shadow-card">
            <legend className="sr-only">{cat.label}</legend>
            <h2 className="mb-2 font-display text-xl font-semibold" aria-hidden="true">
              {cat.label}
            </h2>
            {prices
              .filter((p) => p.category === cat.id)
              .map((p) => {
                const bad = parseMoney(values[p.key]) === null;
                return (
                  <label key={p.key} className="flex min-h-12 items-center gap-3 border-b border-sand last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{p.label}</span>
                      <span className="text-xs font-semibold text-muted">{p.unit}</span>
                    </span>
                    {canEdit ? (
                      <span className={`flex items-center rounded-xl border-2 px-2.5 ${bad ? "border-rose" : "border-line"} focus-within:border-grape`}>
                        <span className="font-bold text-muted">$</span>
                        <input
                          value={values[p.key]}
                          onChange={(e) => {
                            setSaved(false);
                            setValues({ ...values, [p.key]: e.target.value });
                          }}
                          inputMode="decimal"
                          aria-label={`${p.label} price`}
                          aria-invalid={bad}
                          className="h-10 w-20 bg-transparent text-right font-extrabold tabular-nums outline-none"
                        />
                      </span>
                    ) : (
                      <strong className="tabular-nums">{formatMoney(p.cents)}</strong>
                    )}
                  </label>
                );
              })}
          </fieldset>
        ))}
      </div>
      {canEdit && (
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 self-start rounded-full bg-white p-2 pr-4 shadow-float">
          <button
            type="submit"
            disabled={pending || changed.length === 0}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-grape px-6 text-[15px] font-extrabold text-white disabled:bg-[#b9b4dc]"
          >
            {pending && <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" />}
            {changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "No changes"}
          </button>
          {saved && (
            <span role="status" className="inline-flex items-center gap-1 font-bold text-mint-ink">
              <Check className="size-4.5" aria-hidden="true" /> Saved — new bookings use these prices
            </span>
          )}
          {error && (
            <span role="alert" className="font-bold text-rose-ink">
              {error}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

const PRESETS = [0, 5, 10, 15, 20];

/** Staff and admin: how much customers save by paying online. */
export function DiscountEditor({ current }: { current: number }) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const save = (n: number) =>
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const r = await setOnlineDiscount(n);
      if (r.ok) setSaved(true);
      else setError(r.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Online payment discount">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            disabled={pending}
            onClick={() => {
              setValue(n);
              save(n);
            }}
            className={`min-h-11 min-w-16 rounded-full border-2 px-4 font-extrabold transition ${value === n ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
          >
            {n === 0 ? "Off" : `${n}%`}
          </button>
        ))}
        <label className="flex min-h-11 items-center gap-1 rounded-full border-2 border-line bg-white px-3">
          <span className="sr-only">Custom discount percent</span>
          <input
            type="number"
            min={0}
            max={50}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            onBlur={() => value !== current && save(value)}
            className="w-12 bg-transparent text-right font-extrabold outline-none"
          />
          <span className="font-bold text-muted">%</span>
        </label>
        {pending && <LoaderCircle className="size-5 animate-spin text-muted" aria-label="Saving" />}
      </div>
      {saved && (
        <p role="status" className="text-sm font-bold text-mint-ink">
          Saved. Customers now see {value === 0 ? "no online discount" : `${value}% off when they pay online`}.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
    </div>
  );
}
