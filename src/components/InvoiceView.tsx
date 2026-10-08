import type { ReactNode } from "react";
import type { Invoice } from "@/db/schema";
import { formatStamp } from "@/lib/dates";
import { formatMoney, sumItems } from "@/lib/pricing";
import { Pill } from "./ui";

/** Status pill wording and colour for an invoice. */
export function invoiceBadge(inv: Pick<Invoice, "status" | "paidMethod">, overdue = false) {
  if (inv.status === "paid")
    return { label: inv.paidMethod === "online" ? "Paid online" : `Paid · ${inv.paidMethod === "cash" ? "cash" : "card"}`, className: "bg-mint-soft text-mint-ink" };
  if (inv.status === "refunded") return { label: "Refunded", className: "bg-lilac-soft text-lilac-ink" };
  if (inv.status === "void") return { label: "Void", className: "bg-sand text-muted" };
  return overdue ? { label: "Overdue", className: "bg-rose-soft text-rose-ink" } : { label: "Unpaid", className: "bg-sun-soft text-sun-ink" };
}

/**
 * The line items and totals of an invoice. `lineAction` renders a control next
 * to each extra line (e.g. a remove button for staff).
 */
export function InvoiceLines({ invoice, lineAction, compact = false }: { invoice: Invoice; lineAction?: (index: number) => ReactNode; compact?: boolean }) {
  const discount = invoice.items.filter((i) => i.cents < 0);
  const subtotal = sumItems(invoice.items.filter((i) => i.cents >= 0));
  return (
    <div className={`flex flex-col ${compact ? "gap-1.5 text-sm" : "gap-2 text-[15px]"}`}>
      <ul className="flex flex-col gap-1.5">
        {invoice.items.map((item, i) => (
          <li key={i} className="flex items-start justify-between gap-3">
            <span className={`min-w-0 ${item.cents < 0 ? "font-bold text-mint-ink" : "font-semibold"}`}>
              {item.label}
              {item.qty > 1 && (
                <span className="block text-xs font-bold text-faint">
                  {item.qty} × {formatMoney(item.unitCents)}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className={`font-bold tabular-nums ${item.cents < 0 ? "text-mint-ink" : ""}`}>{formatMoney(item.cents)}</span>
              {lineAction?.(i)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 border-t-2 border-dashed border-line pt-2">
        {discount.length > 0 && (
          <div className="flex justify-between font-semibold text-muted">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="font-extrabold">Total</span>
          <span className={`font-display font-semibold tabular-nums ${compact ? "text-xl" : "text-2xl"}`}>{formatMoney(invoice.totalCents)}</span>
        </div>
      </div>
    </div>
  );
}

/** One line about how and when it was paid (or refunded / voided). */
export function PaymentNote({ invoice }: { invoice: Invoice }) {
  const badge = invoiceBadge(invoice);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
      <Pill className={badge.className}>{badge.label}</Pill>
      {invoice.status === "paid" && invoice.paidAt && (
        <span>
          {formatStamp(invoice.paidAt)}
          {invoice.cardLast4 ? ` · card •••• ${invoice.cardLast4}` : ""}
          {invoice.txnRef ? ` · ${invoice.txnRef}` : ""}
        </span>
      )}
      {invoice.status === "refunded" && <span>{invoice.refundedAt ? `Refunded ${formatStamp(invoice.refundedAt)}` : "Refunded"}</span>}
      {invoice.status === "void" && invoice.voidReason && <span>{invoice.voidReason}</span>}
    </div>
  );
}
