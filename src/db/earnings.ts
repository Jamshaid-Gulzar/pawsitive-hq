import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { nowStamp, todayISO } from "@/lib/dates";
import { DEFAULT_DOCTOR_FEE, doctorSplit } from "@/lib/pricing";
import type { Db } from ".";
import { invoices, payouts, pets, settings, vetVisits, vets, type Payout, type PayoutLine } from "./schema";

/** The % of each vet visit the clinic keeps as its platform fee. */
export async function getDoctorFee(db: Db): Promise<number> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "doctor_fee_pct"));
  const n = Number(row?.value ?? DEFAULT_DOCTOR_FEE);
  return Number.isFinite(n) ? n : DEFAULT_DOCTOR_FEE;
}

export type EarningLine = PayoutLine & { vetId: string; payoutId: string | null; paid: boolean };

/**
 * One line per finished vet visit: what the owner paid, the platform fee, and
 * the doctor's share. Unpaid visits are listed too (paid: false) but earn
 * nothing until the owner pays.
 */
export async function earningLines(db: Db, vetId?: string): Promise<EarningLine[]> {
  const fee = await getDoctorFee(db);
  const rows = await db
    .select({ invoice: invoices, vetId: vetVisits.vetId, petName: pets.name, date: vetVisits.date })
    .from(invoices)
    .innerJoin(vetVisits, eq(invoices.refId, vetVisits.id))
    .innerJoin(pets, eq(invoices.petId, pets.id))
    .where(
      and(
        eq(invoices.refKind, "vet"),
        eq(vetVisits.status, "completed"),
        inArray(invoices.status, ["paid", "unpaid"]),
        vetId ? eq(vetVisits.vetId, vetId) : undefined,
      ),
    )
    .orderBy(desc(vetVisits.date));
  return rows
    .filter((r) => r.vetId)
    .map((r) => {
      const gross = r.invoice.totalCents;
      const split = doctorSplit(gross, fee);
      return {
        invoiceId: r.invoice.id,
        number: r.invoice.number,
        petName: r.petName,
        date: r.date,
        grossCents: gross,
        feeCents: split.feeCents,
        netCents: split.netCents,
        vetId: r.vetId!,
        payoutId: r.invoice.payoutId,
        paid: r.invoice.status === "paid",
      };
    });
}

/**
 * Credits a doctor with every paid visit not yet paid out (optionally only
 * visits before `before`). Returns null when there's nothing to pay.
 */
export async function createPayout(db: Db, vetId: string, createdBy: string, before?: string): Promise<Payout | null> {
  const fee = await getDoctorFee(db);
  const lines = (await earningLines(db, vetId)).filter((l) => l.paid && !l.payoutId && (!before || l.date < before));
  if (lines.length === 0) return null;
  const payout: Payout = {
    id: `po_${randomUUID().slice(0, 8)}`,
    vetId,
    period: lines.map((l) => l.date.slice(0, 7)).sort().at(-1)!,
    lines: lines.map(({ invoiceId, number, petName, date, grossCents, feeCents, netCents }) => ({ invoiceId, number, petName, date, grossCents, feeCents, netCents })),
    grossCents: lines.reduce((s, l) => s + l.grossCents, 0),
    feeCents: lines.reduce((s, l) => s + l.feeCents, 0),
    netCents: lines.reduce((s, l) => s + l.netCents, 0),
    feePercent: fee,
    createdAt: nowStamp(),
    createdBy,
    seenByDoctor: false,
  };
  await db.insert(payouts).values(payout);
  await db.update(invoices).set({ payoutId: payout.id }).where(inArray(invoices.id, lines.map((l) => l.invoiceId)));
  return payout;
}

/** At month end, every doctor is paid for last month's (and older) visits automatically. */
export async function runMonthEndPayouts(db: Db) {
  const firstOfMonth = `${todayISO().slice(0, 7)}-01`;
  const outstanding = await db
    .select({ id: invoices.id })
    .from(invoices)
    .innerJoin(vetVisits, eq(invoices.refId, vetVisits.id))
    .where(and(eq(invoices.refKind, "vet"), eq(invoices.status, "paid"), isNull(invoices.payoutId), eq(vetVisits.status, "completed"), lt(vetVisits.date, firstOfMonth)))
    .limit(1);
  if (outstanding.length === 0) return;
  for (const v of await db.select({ id: vets.id }).from(vets)) await createPayout(db, v.id, "Automatic month-end payout", firstOfMonth);
}
