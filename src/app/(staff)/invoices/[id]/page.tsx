import { Banknote, ChevronLeft, CreditCard, FileDown, MessageCircle, Phone, Stethoscope, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { recordPayment, removeInvoiceItem } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { InvoiceLines, PaymentNote, invoiceBadge } from "@/components/InvoiceView";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { getInvoice, getVetInvoiceSplit } from "@/db/queries";
import { formatStamp } from "@/lib/dates";
import { formatMoney } from "@/lib/pricing";
import { requireRole } from "@/lib/session";
import { AddItemForm, ReasonAction } from "./InvoiceTools";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage(props: PageProps<"/invoices/[id]">) {
  const user = await requireRole("staff", "admin");
  const { id } = await props.params;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const badge = invoiceBadge(inv, inv.due === "overdue");
  const split = await getVetInvoiceSplit(inv);
  const unpaid = inv.status === "unpaid";
  const cancelled = ["cancelled", "declined"].includes(inv.refStatus);
  const refHref = inv.refKind === "vet" ? `/vet/${inv.refId}` : null;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/invoices" className="inline-flex items-center gap-1 self-start text-sm font-extrabold text-grape hover:underline">
        <ChevronLeft className="size-4" aria-hidden="true" /> All invoices
      </Link>

      <div className="flex flex-wrap items-start gap-7">
        <Card className="flex min-w-0 flex-[999_1_480px] flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold tracking-[0.08em] text-muted uppercase">Invoice #{inv.number}</p>
              <h1 className="font-display text-[32px] leading-tight font-semibold">
                {inv.pet.name} · {inv.title}
              </h1>
              <p className="font-semibold text-muted">
                {inv.when} · issued {formatStamp(inv.createdAt)}
              </p>
            </div>
            <Pill className={`${badge.className} text-sm`}>{badge.label}</Pill>
          </div>

          <InvoiceLines
            invoice={inv}
            lineAction={
              unpaid
                ? (i) =>
                    i > 0 && (
                      <ActionButton
                        action={removeInvoiceItem.bind(null, inv.id, i)}
                        className="size-7 rounded-full text-muted hover:bg-rose-soft hover:text-rose-ink"
                      >
                        <X className="size-4" aria-label={`Remove ${inv.items[i].label}`} />
                      </ActionButton>
                    )
                : undefined
            }
          />
          <PaymentNote invoice={inv} />
          {inv.paidBy && inv.status === "paid" && <p className="-mt-3 text-sm font-semibold text-muted">Recorded by {inv.paidBy}</p>}

          {split && (inv.status === "paid" || inv.status === "unpaid") && (
            <div className="rounded-2xl bg-mint-soft/60 p-4">
              <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold">
                <Stethoscope className="size-5 text-mint-ink" aria-hidden="true" /> Doctor fee split
              </h2>
              <dl className="grid gap-1 text-sm">
                <div className="flex justify-between">
                  <dt className="font-semibold text-muted">{split.doctor} earns</dt>
                  <dd className="font-extrabold tabular-nums">{formatMoney(split.netCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="font-semibold text-muted">Clinic platform fee ({split.feePercent}%)</dt>
                  <dd className="font-extrabold tabular-nums">{formatMoney(split.feeCents)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs font-bold text-muted">
                {inv.status === "unpaid"
                  ? "The doctor is paid once the owner pays and the checkup is done."
                  : split.paidOut
                    ? "Already credited to the doctor in a payout."
                    : "Goes into the doctor's next payout."}
              </p>
            </div>
          )}

          <a
            href={`/api/invoice/${inv.id}`}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border-2 border-ink px-4 text-sm font-extrabold transition hover:bg-ink hover:text-white"
          >
            <FileDown className="size-4.5" aria-hidden="true" /> {inv.status === "paid" ? "Receipt PDF" : "Invoice PDF"}
          </a>
        </Card>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4.5">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <PetPhoto src={inv.pet.photo} alt="" className="size-12 rounded-2xl" sizes="48px" />
              <div>
                <strong className="block">{inv.pet.owner.name}</strong>
                {inv.pet.owner.phone && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
                    <Phone className="size-3.5" aria-hidden="true" /> {inv.pet.owner.phone}
                  </span>
                )}
              </div>
            </div>
            <Link
              href={`/messages?pet=${inv.petId}&c=${inv.refKind === "vet" ? "vet" : "team"}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cream text-sm font-extrabold"
            >
              <MessageCircle className="size-4.5" aria-hidden="true" /> Message {inv.pet.owner.name.split(" ")[0]}
            </Link>
            {refHref && (
              <Link href={refHref} className="text-center text-sm font-extrabold text-grape underline">
                Open the vet visit
              </Link>
            )}
          </Card>

          {unpaid && !cancelled && (
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="font-display text-xl font-semibold">Take payment · {formatMoney(inv.totalCents)}</h2>
              <p className="text-sm font-semibold text-muted">The owner can also pay online in the app and get the online discount.</p>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton action={recordPayment.bind(null, inv.id, "card")} pendingLabel="Saving…" className="min-h-12 w-full rounded-full bg-mint text-[15px] font-extrabold text-white">
                  <CreditCard className="size-5" aria-hidden="true" /> Card
                </ActionButton>
                <ActionButton action={recordPayment.bind(null, inv.id, "cash")} pendingLabel="Saving…" className="min-h-12 w-full rounded-full bg-ink text-[15px] font-extrabold text-white">
                  <Banknote className="size-5" aria-hidden="true" /> Cash
                </ActionButton>
              </div>
            </Card>
          )}

          {unpaid && (
            <Card className="flex flex-col gap-3 p-5">
              <h2 className="font-display text-xl font-semibold">Add an extra</h2>
              <AddItemForm invoiceId={inv.id} />
            </Card>
          )}

          {user.role === "admin" && (unpaid || inv.status === "paid") && (
            <Card className="flex flex-col gap-2 p-5">
              <h2 className="font-display text-lg font-semibold">Admin</h2>
              <ReasonAction invoiceId={inv.id} kind={unpaid ? "void" : "refund"} />
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
