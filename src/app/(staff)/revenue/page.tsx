import { AlertTriangle, ArrowDownLeft, Bath, ChevronRight, Moon, Stethoscope, Sun, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { invoiceBadge } from "@/components/InvoiceView";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { getRevenue } from "@/db/queries";
import { formatLongDate, formatShortDate, formatStamp, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/pricing";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Revenue" };

const SERVICE = {
  boarding: { label: "Boarding", icon: Moon, bar: "bg-lilac", tone: "bg-lilac-soft text-lilac-ink" },
  daycare: { label: "Daycare", icon: Sun, bar: "bg-sun", tone: "bg-sun-soft text-sun-ink" },
  grooming: { label: "Grooming", icon: Bath, bar: "bg-sky", tone: "bg-sky-soft text-sky-ink" },
  vet: { label: "Vet clinic", icon: Stethoscope, bar: "bg-mint", tone: "bg-mint-soft text-mint-ink" },
};

export default async function RevenuePage() {
  await requireRole("admin");
  const r = await getRevenue();
  const maxDay = Math.max(1, ...r.daily.map((d) => d.cents));
  const maxService = Math.max(1, ...r.byService.map((s) => s.collected + s.pending));
  const change = r.collectedLastMonth ? Math.round(((r.collectedMonth - r.collectedLastMonth) / r.collectedLastMonth) * 100) : null;
  const overdueTotal = r.overdue.reduce((s, i) => s + i.totalCents, 0);

  return (
    <>
      <AutoRefresh seconds={15} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-ink">
          <TrendingUp className="size-7" aria-hidden="true" />
        </span>
        <div>
          <div className="text-[15px] font-bold text-muted">{formatLongDate(todayISO())} · admin only</div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Revenue</h1>
        </div>
      </div>

      <section aria-label="Totals" className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        <Stat tone="bg-mint-soft text-mint-ink" label="Collected today" value={formatMoney(r.collectedToday)} />
        <Stat
          tone="bg-sky-soft text-sky-ink"
          label="Collected this month"
          value={formatMoney(r.collectedMonth)}
          note={change === null ? undefined : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs last month`}
        />
        <Link href="/invoices?tab=due" className="transition hover:-translate-y-0.5">
          <Stat tone="bg-sun-soft text-sun-ink" label={`Pending · ${r.pendingCount} unpaid →`} value={formatMoney(r.pending)} note={`${formatMoney(r.upcoming14)} due in the next 14 days`} />
        </Link>
        <Link href="/invoices?tab=closed" className="transition hover:-translate-y-0.5">
          <Stat tone="bg-lilac-soft text-lilac-ink" label="Refunded this month →" value={formatMoney(r.refundedMonth)} />
        </Link>
      </section>

      {r.overdue.length > 0 && (
        <Link href="/invoices?tab=due" className="mb-7 flex items-center gap-3 rounded-[20px] bg-rose-soft px-5 py-4 font-bold text-rose-ink transition hover:-translate-y-0.5">
          <AlertTriangle className="size-6 shrink-0" aria-hidden="true" />
          <span className="flex-1">
            {r.overdue.length} finished visit{r.overdue.length === 1 ? " hasn't" : "s haven't"} been paid yet — {formatMoney(overdueTotal)} overdue.
          </span>
          <ChevronRight className="size-5" aria-hidden="true" />
        </Link>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold">Last 14 days</h2>
              <span className="text-sm font-bold text-muted">Money collected per day</span>
            </div>
            <ol className="flex h-48 items-end gap-1.5" aria-label="Collected per day">
              {r.daily.map((d) => (
                <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${formatShortDate(d.date)}: ${formatMoney(d.cents)}`}>
                  <span className="text-[10px] font-bold text-muted tabular-nums">{d.cents ? formatMoney(d.cents).replace(/\.\d+$/, "") : ""}</span>
                  <span
                    className={`w-full rounded-t-lg ${d.date === todayISO() ? "bg-coral" : "bg-grape/80"}`}
                    style={{ height: `${Math.max(2, (d.cents / maxDay) * 100)}%` }}
                  />
                  <span className="text-[10px] font-bold text-faint">{formatShortDate(d.date).replace(/^\w+ /, "")}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-6">
            <h2 className="mb-1 font-display text-2xl font-semibold">By service</h2>
            <p className="mb-4 text-sm font-semibold text-muted">Collected this month, plus what&apos;s still to be paid.</p>
            <ul className="flex flex-col gap-4">
              {r.byService.map((s) => {
                const svc = SERVICE[s.service];
                const Icon = svc.icon;
                return (
                  <li key={s.service} className="flex items-center gap-3">
                    <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${svc.tone}`}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-sm font-bold">
                        <span>{svc.label}</span>
                        <span className="tabular-nums">
                          {formatMoney(s.collected)} <span className="text-muted">+ {formatMoney(s.pending)} pending</span>
                        </span>
                      </div>
                      <div className="flex h-3 overflow-hidden rounded-full bg-sand">
                        <span className={svc.bar} style={{ width: `${(s.collected / maxService) * 100}%` }} />
                        <span className={`${svc.bar} opacity-35`} style={{ width: `${(s.pending / maxService) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
              <Wallet className="size-5 text-grape" aria-hidden="true" /> This month
            </h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="font-semibold text-muted">Paid online</dt>
                <dd className="font-extrabold">{r.onlineShare}% of payments</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-muted">Online discounts given</dt>
                <dd className="font-extrabold">{formatMoney(r.discountsGiven)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-muted">Last month</dt>
                <dd className="font-extrabold">{formatMoney(r.collectedLastMonth)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-display text-xl font-semibold">Recent payments</h2>
            <ul className="flex flex-col gap-3">
              {r.recentPayments.map((p) => {
                const badge = invoiceBadge(p);
                return (
                  <li key={p.id}>
                    <Link href={`/invoices/${p.id}`} className="flex items-center gap-3 rounded-xl transition hover:bg-cream">
                      <PetPhoto src={p.pet.photo} alt="" className="size-10 rounded-xl" sizes="40px" />
                      <span className="min-w-0 flex-1 text-sm">
                        <strong className="block truncate">
                          {p.pet.name} · {p.title}
                        </strong>
                        <span className="text-muted">{formatStamp(p.paidAt!)}</span>
                      </span>
                      <span className="text-right">
                        <strong className="block tabular-nums">{formatMoney(p.totalCents)}</strong>
                        <Pill className={`${badge.className} px-2 py-0.5 text-[10px]`}>{badge.label}</Pill>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          {r.refunds.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
                <ArrowDownLeft className="size-5 text-lilac-ink" aria-hidden="true" /> Refunds
              </h2>
              <ul className="flex flex-col gap-2.5 text-sm">
                {r.refunds.map((p) => (
                  <li key={p.id}>
                    <Link href={`/invoices/${p.id}`} className="flex justify-between gap-2 hover:underline">
                      <span className="min-w-0 truncate font-semibold">
                        #{p.number} · {p.pet.name} · {p.title}
                      </span>
                      <strong className="tabular-nums">{formatMoney(p.totalCents)}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function Stat({ tone, label, value, note }: { tone: string; label: string; value: string; note?: string }) {
  return (
    <div className={`h-full rounded-[22px] px-5 py-4.5 ${tone}`}>
      <div className="font-display text-[32px] leading-none font-semibold tabular-nums">{value}</div>
      <div className="mt-1.5 text-sm font-extrabold">{label}</div>
      {note && <div className="mt-0.5 text-xs font-bold opacity-80">{note}</div>}
    </div>
  );
}
