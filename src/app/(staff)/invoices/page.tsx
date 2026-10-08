import { ChevronRight, ReceiptText, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { invoiceBadge } from "@/components/InvoiceView";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { getInvoices, type InvoiceRow } from "@/db/queries";
import { formatMoney } from "@/lib/pricing";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Invoices" };

const TABS = [
  { id: "due", label: "Due now", match: (i: InvoiceRow) => i.status === "unpaid" && (i.due === "overdue" || i.due === "today") },
  { id: "upcoming", label: "Upcoming", match: (i: InvoiceRow) => i.status === "unpaid" && i.due === "upcoming" },
  { id: "paid", label: "Paid", match: (i: InvoiceRow) => i.status === "paid" },
  { id: "closed", label: "Refunded & void", match: (i: InvoiceRow) => i.status === "refunded" || i.status === "void" },
  { id: "all", label: "All", match: () => true },
] as const;

export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const user = await requireRole("staff", "admin");
  const { tab: tabParam, q: qParam } = await props.searchParams;
  const tab = TABS.find((t) => t.id === tabParam) ?? TABS[0];
  const q = typeof qParam === "string" ? qParam.trim().toLowerCase() : "";
  const all = await getInvoices();
  const searched = q
    ? all.filter((i) => [i.pet.name, i.pet.owner.name, `#${i.number}`, String(i.number)].some((s) => s.toLowerCase().includes(q)))
    : all;
  const list = searched.filter(tab.match).sort((a, b) => (tab.id === "paid" ? (b.paidAt ?? "").localeCompare(a.paidAt ?? "") : 0));
  const href = (t: string) => `/invoices?tab=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <AutoRefresh seconds={10} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-ink">
          <ReceiptText className="size-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[38px] leading-tight font-semibold">Invoices</h1>
          <p className="font-semibold text-muted">
            Take payments at the desk, add extras and print receipts.
            {user.role === "admin" && (
              <>
                {" "}
                Totals are on{" "}
                <Link href="/revenue" className="text-grape underline">
                  Revenue
                </Link>
                .
              </>
            )}
          </p>
        </div>
        <form action="/invoices" className="flex min-h-12 items-center gap-2 rounded-full border-2 border-line bg-white px-4">
          <input type="hidden" name="tab" value={tab.id} />
          <Search className="size-4.5 text-muted" aria-hidden="true" />
          <label htmlFor="inv-q" className="sr-only">
            Search invoices
          </label>
          <input id="inv-q" name="q" defaultValue={q} placeholder="Pet, owner or #number" className="w-52 bg-transparent font-semibold outline-none" />
        </form>
      </div>

      <nav aria-label="Invoice filter" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = searched.filter(t.match).length;
          const on = t.id === tab.id;
          return (
            <Link
              key={t.id}
              href={href(t.id)}
              aria-current={on ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-white/20" : "bg-sand"}`}>{n}</span>
            </Link>
          );
        })}
      </nav>

      {list.length === 0 ? (
        <Card className="p-12 text-center font-semibold text-muted">Nothing here{q ? ` for "${q}"` : ""}.</Card>
      ) : (
        <ul className="overflow-hidden rounded-[24px] bg-white shadow-card">
          {list.map((inv) => {
            const badge = invoiceBadge(inv, inv.due === "overdue");
            return (
              <li key={inv.id} className="border-b border-sand last:border-0">
                <Link href={`/invoices/${inv.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-cream">
                  <PetPhoto src={inv.pet.photo} alt="" className="size-12 shrink-0 rounded-2xl" sizes="48px" />
                  <span className="min-w-0 flex-[1_1_220px]">
                    <strong className="block">
                      {inv.pet.name} · {inv.title}
                    </strong>
                    <span className="block text-sm font-semibold text-muted">
                      #{inv.number} · {inv.pet.owner.name} · {inv.when}
                    </span>
                  </span>
                  <Pill className={badge.className}>{badge.label}</Pill>
                  <span className="w-24 text-right font-display text-xl font-semibold tabular-nums">{formatMoney(inv.totalCents)}</span>
                  <ChevronRight className="size-5 text-faint" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
