import { BadgePercent, CreditCard, FileDown, ReceiptText } from "lucide-react";
import Link from "next/link";
import { getInvoiceForRef, getPriceList } from "@/db/queries";
import { formatMoney, onlineDiscountCents } from "@/lib/pricing";
import { InvoiceLines, PaymentNote } from "./InvoiceView";

/** The bill on a customer's booking or vet visit: pay online, or see the receipt. */
export async function BillCard({ refId, closed = false }: { refId: string; closed?: boolean }) {
  const invoice = await getInvoiceForRef(refId);
  if (!invoice) return null;
  const { discount } = await getPriceList();
  const unpaid = invoice.status === "unpaid" && !closed;
  const off = unpaid ? onlineDiscountCents(invoice.totalCents, discount) : 0;

  return (
    <section aria-labelledby={`bill-${invoice.id}`} className="flex flex-col gap-3.5 rounded-[28px] bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`bill-${invoice.id}`} className="flex items-center gap-2 font-display text-[22px] font-semibold">
          <ReceiptText className="size-5.5 text-grape" aria-hidden="true" /> Bill
        </h2>
        <span className="text-xs font-bold text-faint">Invoice #{invoice.number}</span>
      </div>
      <InvoiceLines invoice={invoice} compact />
      <PaymentNote invoice={invoice} />
      {unpaid && (
        <>
          <Link
            href={`/my/pay/${invoice.id}`}
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-grape text-base font-extrabold text-white shadow-float transition active:scale-[0.98]"
          >
            <CreditCard className="size-5" aria-hidden="true" /> Pay now {off ? `· ${formatMoney(invoice.totalCents - off)}` : ""}
          </Link>
          {off > 0 && (
            <p className="-mt-1 flex items-center justify-center gap-1.5 text-sm font-bold text-mint-ink">
              <BadgePercent className="size-4" aria-hidden="true" /> Save {discount}% by paying online — or pay at the center.
            </p>
          )}
        </>
      )}
      {invoice.status !== "unpaid" && (
        <a href={`/api/invoice/${invoice.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-ink text-sm font-extrabold">
          <FileDown className="size-4.5" aria-hidden="true" /> {invoice.status === "paid" ? "Download receipt" : "Download statement"}
        </a>
      )}
    </section>
  );
}
