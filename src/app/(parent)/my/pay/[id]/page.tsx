import { BadgePercent, ChevronLeft, CircleCheck, FileDown, Info, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceLines, PaymentNote } from "@/components/InvoiceView";
import { PetPhoto } from "@/components/ui";
import { getInvoice, getPriceList } from "@/db/queries";
import { formatMoney, onlineDiscountCents, withOnlineDiscount } from "@/lib/pricing";
import { requireRole } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Pay online" };

export default async function PayPage(props: PageProps<"/my/pay/[id]">) {
  const user = await requireRole("parent");
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;
  const inv = await getInvoice(id);
  if (!inv || inv.ownerId !== user.id) notFound();
  const { discount } = await getPriceList();
  const back = inv.refKind === "vet" ? `/my/vet/${inv.refId}` : `/my/bookings/${inv.refId}`;
  const cancelled = ["cancelled", "declined"].includes(inv.refStatus);

  // Paid: the receipt screen.
  if (inv.status !== "unpaid" || cancelled) {
    return (
      <div className="flex flex-col gap-5">
        <Link href={back} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
          <ChevronLeft className="size-4.5" aria-hidden="true" /> {inv.refKind === "vet" ? "Vet visit" : "Booking"}
        </Link>
        {inv.status === "paid" && (
          <section className="animate-pop flex flex-col items-center gap-2 rounded-[28px] bg-mint p-6 text-center text-white">
            <CircleCheck className="size-14" aria-hidden="true" />
            <h1 className="font-display text-[28px] leading-tight font-semibold">Payment successful!</h1>
            <p className="font-semibold text-white/90">
              Thank you, {user.name.split(" ")[0]}. We&apos;ve sent your receipt to your Updates.
            </p>
          </section>
        )}
        <section className="flex flex-col gap-4 rounded-[26px] bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <PetPhoto src={inv.pet.photo} alt="" className="size-12 rounded-2xl" sizes="48px" />
            <div>
              <p className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">Receipt · Invoice #{inv.number}</p>
              <strong className="block">
                {inv.pet.name} · {inv.title}
              </strong>
              <span className="text-sm font-semibold text-muted">{inv.when}</span>
            </div>
          </div>
          <InvoiceLines invoice={inv} compact />
          <PaymentNote invoice={inv} />
          <a href={`/api/invoice/${inv.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink font-extrabold text-white">
            <FileDown className="size-5" aria-hidden="true" /> Download receipt (PDF)
          </a>
        </section>
      </div>
    );
  }

  const preview = { ...inv, items: withOnlineDiscount(inv.items, discount) };
  const off = onlineDiscountCents(inv.totalCents, discount);
  preview.totalCents = inv.totalCents - off;

  return (
    <div className="flex flex-col gap-5">
      <Link href={back} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> {isNew ? "Pay later" : "Back"}
      </Link>
      <div>
        <h1 className="font-display text-[30px] leading-tight font-semibold">Pay online</h1>
        <p className="font-semibold text-muted">
          {isNew ? "Your request is in! " : ""}Invoice #{inv.number} for {inv.pet.name}&apos;s {inv.title.toLowerCase()}.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-[26px] bg-white p-5 shadow-card">
        <InvoiceLines invoice={preview} compact />
        {off > 0 && (
          <p className="flex items-center gap-2 rounded-2xl bg-mint-soft px-3.5 py-2.5 text-sm font-bold text-mint-ink">
            <BadgePercent className="size-4.5 shrink-0" aria-hidden="true" /> You save {formatMoney(off)} by paying online.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-[26px] bg-white p-5 shadow-card">
        <p className="flex items-start gap-2 rounded-2xl bg-sky-soft px-3.5 py-2.5 text-sm font-bold text-sky-ink">
          <Info className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
          Demo checkout — no real card is charged. A test card is filled in for you.
        </p>
        <CheckoutForm invoiceId={inv.id} amount={preview.totalCents} ownerName={user.name} />
        <p className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted">
          <ShieldCheck className="size-4" aria-hidden="true" /> Full refund if you cancel before the visit.
        </p>
      </section>

      <Link href={back} className="text-center text-sm font-extrabold text-muted underline">
        I&apos;ll pay at the center instead
      </Link>
    </div>
  );
}
