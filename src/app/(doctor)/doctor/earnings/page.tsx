import { BadgeDollarSign, CircleCheck, Clock, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { MarkPayoutsSeen } from "./MarkPayoutsSeen";
import { Card, Pill } from "@/components/ui";
import { getDoctorEarnings } from "@/db/queries";
import { formatShortDate, formatStamp } from "@/lib/dates";
import { formatMoney, monthName } from "@/lib/pricing";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const user = await requireRole("vet");
  const e = await getDoctorEarnings(user.vetId ?? "");
  const unseen = e.statements.some((s) => !s.seenByDoctor);

  return (
    <div className="flex flex-col gap-7">
      {unseen && <MarkPayoutsSeen />}
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-ink">
          <Wallet className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Earnings</h1>
          <p className="font-semibold text-muted">
            You keep {100 - e.feePercent}% of each paid checkup; the clinic&apos;s platform fee is {e.feePercent}%. Payouts are credited at the end of each month.
          </p>
        </div>
      </div>

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
        <div className="rounded-[22px] bg-mint px-5 py-4.5 text-white">
          <div className="font-display text-[34px] leading-none font-semibold tabular-nums">{formatMoney(e.thisMonth.net)}</div>
          <div className="mt-1.5 text-sm font-extrabold">Earned in {monthName(e.month)}</div>
          <div className="text-xs font-bold opacity-85">
            {e.thisMonth.count} paid checkup{e.thisMonth.count === 1 ? "" : "s"} · {formatMoney(e.thisMonth.gross)} billed · {formatMoney(e.thisMonth.fee)} fee
          </div>
        </div>
        <div className="rounded-[22px] bg-sun-soft px-5 py-4.5 text-sun-ink">
          <div className="font-display text-[34px] leading-none font-semibold tabular-nums">{formatMoney(e.outstanding.net)}</div>
          <div className="mt-1.5 text-sm font-extrabold">Waiting for your next payout</div>
          <div className="text-xs font-bold opacity-85">{e.outstanding.count} checkup{e.outstanding.count === 1 ? "" : "s"}</div>
        </div>
        <div className="rounded-[22px] bg-sky-soft px-5 py-4.5 text-sky-ink">
          <div className="font-display text-[34px] leading-none font-semibold tabular-nums">{formatMoney(e.lifetimeNet)}</div>
          <div className="mt-1.5 text-sm font-extrabold">Paid out to you so far</div>
          <div className="text-xs font-bold opacity-85">{e.statements.length} statement{e.statements.length === 1 ? "" : "s"}</div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[999_1_520px] overflow-hidden">
          <h2 className="px-6 pt-5 pb-3 font-display text-2xl font-semibold">Checkups & your share</h2>
          {e.lines.length === 0 ? (
            <p className="px-6 pb-6 font-semibold text-muted">No paid checkups yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y border-sand text-left text-xs font-extrabold tracking-[0.05em] text-muted uppercase">
                    <th className="px-6 py-2.5">Date</th>
                    <th className="py-2.5">Patient</th>
                    <th className="py-2.5 text-right">Billed</th>
                    <th className="py-2.5 text-right">Fee</th>
                    <th className="py-2.5 text-right">You earn</th>
                    <th className="px-6 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {e.lines.map((l) => (
                    <tr key={l.invoiceId} className="border-b border-sand last:border-0">
                      <td className="px-6 py-3 font-bold">{formatShortDate(l.date)}</td>
                      <td className="py-3 font-semibold">
                        {l.petName}{" "}
                        <a href={`/api/invoice/${l.invoiceId}`} className="text-grape underline">
                          #{l.number}
                        </a>
                      </td>
                      <td className="py-3 text-right tabular-nums">{formatMoney(l.grossCents)}</td>
                      <td className="py-3 text-right text-muted tabular-nums">−{formatMoney(l.feeCents)}</td>
                      <td className="py-3 text-right font-extrabold tabular-nums">{formatMoney(l.netCents)}</td>
                      <td className="px-6 py-3 text-right">
                        {l.payoutId ? <Pill className="bg-mint-soft text-mint-ink">Paid out</Pill> : <Pill className="bg-sun-soft text-sun-ink">Next payout</Pill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {e.awaitingPayment.length > 0 && (
            <p className="flex items-center gap-2 border-t border-sand px-6 py-3 text-sm font-semibold text-muted">
              <Clock className="size-4" aria-hidden="true" />
              {e.awaitingPayment.length} finished checkup{e.awaitingPayment.length === 1 ? " is" : "s are"} waiting for the owner to pay — they count once paid.
            </p>
          )}
        </Card>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <h2 className="font-display text-2xl font-semibold">Payout statements</h2>
          {e.statements.length === 0 && <Card className="p-5 font-semibold text-muted">Your first statement arrives at the end of the month.</Card>}
          {e.statements.map((s) => (
            <Card key={s.id} className={`flex flex-col gap-2 p-5 ${s.seenByDoctor ? "" : "ring-3 ring-mint"}`}>
              <div className="flex items-center justify-between gap-2">
                <strong className="font-display text-lg font-semibold">{monthName(s.period)}</strong>
                <Pill className="bg-mint-soft text-mint-ink">
                  <CircleCheck className="size-3.5" aria-hidden="true" /> Credited
                </Pill>
              </div>
              <div className="flex items-baseline gap-2">
                <BadgeDollarSign className="size-5 self-center text-mint-ink" aria-hidden="true" />
                <span className="font-display text-3xl font-semibold tabular-nums">{formatMoney(s.netCents)}</span>
                <span className="text-sm font-semibold text-muted">to your account</span>
              </div>
              <dl className="grid gap-0.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Billed for {s.lines.length} checkup{s.lines.length === 1 ? "" : "s"}</dt>
                  <dd className="font-bold tabular-nums">{formatMoney(s.grossCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Platform fee ({s.feePercent}%)</dt>
                  <dd className="font-bold tabular-nums">−{formatMoney(s.feeCents)}</dd>
                </div>
              </dl>
              <details className="text-sm">
                <summary className="cursor-pointer font-extrabold text-grape">See checkups</summary>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {s.lines.map((l) => (
                    <li key={l.invoiceId} className="flex justify-between gap-2">
                      <span>
                        {formatShortDate(l.date)} · {l.petName}
                      </span>
                      <span className="font-bold tabular-nums">{formatMoney(l.netCents)}</span>
                    </li>
                  ))}
                </ul>
              </details>
              <p className="text-xs font-bold text-faint">
                {s.createdBy} · {formatStamp(s.createdAt)}
              </p>
            </Card>
          ))}
        </aside>
      </div>
    </div>
  );
}
