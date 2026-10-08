import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nowStamp } from "@/lib/dates";
import { DEFAULT_ONLINE_DISCOUNT, quoteBooking, quoteVet, sumItems, toPriceMap, type PriceMap } from "@/lib/pricing";
import type { Db } from ".";
import { bookings, invoices, pets, prices, settings, vetVisits, vets, type Invoice } from "./schema";

export async function getPriceMap(db: Db): Promise<PriceMap> {
  return toPriceMap(await db.select().from(prices).orderBy(asc(prices.sort)));
}

/** The % off for paying online, set by the team on the Prices & offers page. */
export async function getOnlineDiscount(db: Db): Promise<number> {
  const [row] = await db.select().from(settings).where(eq(settings.key, "online_discount_pct"));
  const n = Number(row?.value ?? DEFAULT_ONLINE_DISCOUNT);
  return Number.isFinite(n) ? n : DEFAULT_ONLINE_DISCOUNT;
}

async function nextNumber(db: Db) {
  const [last] = await db.select({ n: invoices.number }).from(invoices).orderBy(desc(invoices.number)).limit(1);
  return (last?.n ?? 1000) + 1;
}

/** The live (unpaid or paid) invoice for a booking or vet visit, if any. */
export async function activeInvoice(db: Db, refId: string): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.refId, refId), inArray(invoices.status, ["unpaid", "paid"])))
    .limit(1);
  return row ?? null;
}

/**
 * Creates the invoice for a booking or vet visit using today's prices, so the
 * owner can pay online straight away. Safe to call twice: an existing live
 * invoice is kept.
 */
export async function ensureInvoice(db: Db, kind: "booking" | "vet", refId: string): Promise<Invoice | null> {
  const existing = await activeInvoice(db, refId);
  if (existing) return existing;
  const priceMap = await getPriceMap(db);
  let row: Pick<Invoice, "petId" | "ownerId" | "refKind" | "refId" | "service" | "serviceDate" | "items" | "totalCents"> | null = null;

  if (kind === "booking") {
    const [b] = await db.select({ booking: bookings, ownerId: pets.ownerId }).from(bookings).innerJoin(pets, eq(bookings.petId, pets.id)).where(eq(bookings.id, refId));
    if (!b) return null;
    const items = quoteBooking(b.booking, priceMap);
    row = { petId: b.booking.petId, ownerId: b.ownerId, refKind: "booking", refId, service: b.booking.service, serviceDate: b.booking.startDate, items, totalCents: sumItems(items) };
  } else {
    const [v] = await db
      .select({ visit: vetVisits, ownerId: pets.ownerId, doctor: vets.name })
      .from(vetVisits)
      .innerJoin(pets, eq(vetVisits.petId, pets.id))
      .leftJoin(vets, eq(vetVisits.vetId, vets.id))
      .where(eq(vetVisits.id, refId));
    if (!v) return null;
    const items = quoteVet(v.visit.reason, priceMap, v.doctor);
    row = { petId: v.visit.petId, ownerId: v.ownerId, refKind: "vet", refId, service: "vet", serviceDate: v.visit.date, items, totalCents: sumItems(items) };
  }

  const invoice: Invoice = {
    ...row,
    id: `inv_${randomUUID().slice(0, 8)}`,
    number: await nextNumber(db),
    status: "unpaid",
    createdAt: nowStamp(),
    paidAt: null,
    paidMethod: null,
    paidBy: null,
    cardLast4: null,
    txnRef: null,
    voidReason: null,
    refundedAt: null,
    payoutId: null,
  };
  await db.insert(invoices).values(invoice);
  return invoice;
}

/**
 * A cancelled or declined booking: an unpaid invoice is voided; a paid one is
 * refunded right away (the owner is told it can take up to 30 minutes).
 */
export async function closeInvoice(db: Db, refId: string, reason: string) {
  const inv = await activeInvoice(db, refId);
  if (!inv) return null;
  const status = inv.status === "paid" ? ("refunded" as const) : ("void" as const);
  await db
    .update(invoices)
    .set({ status, voidReason: reason, refundedAt: status === "refunded" ? nowStamp() : null })
    .where(eq(invoices.id, inv.id));
  return { ...inv, status };
}
