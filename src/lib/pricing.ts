// The price list and how a booking or vet visit turns into invoice lines.
// Pure functions, so the booking screen's estimate and the real invoice use
// exactly the same maths.

import { GROOM_SERVICES, groomLabel } from "./availability";
import { daysBetween } from "./dates";
import type { Service } from "./vaccines";

export type PriceCategory = "boarding" | "daycare" | "grooming" | "vet";

export interface PriceDef {
  key: string;
  label: string;
  category: PriceCategory;
  unit: string;
  cents: number;
}

/** Starting prices (in cents). The admin can change them on the Prices page. */
export const DEFAULT_PRICES: PriceDef[] = [
  { key: "boarding_night", label: "Boarding", category: "boarding", unit: "per night", cents: 5500 },
  { key: "daycare_day", label: "Daycare", category: "daycare", unit: "per day", cents: 3800 },
  { key: "groom_bath", label: "Bath & blow-dry", category: "grooming", unit: "each", cents: 3500 },
  { key: "groom_haircut", label: "Haircut & styling", category: "grooming", unit: "each", cents: 4500 },
  { key: "groom_nails", label: "Nail trim", category: "grooming", unit: "each", cents: 1500 },
  { key: "groom_ears", label: "Ear cleaning", category: "grooming", unit: "each", cents: 1200 },
  { key: "groom_teeth", label: "Teeth brushing", category: "grooming", unit: "each", cents: 1200 },
  { key: "groom_deshed", label: "De-shedding", category: "grooming", unit: "each", cents: 3000 },
  { key: "groom_full", label: "Full groom package (all 6)", category: "grooming", unit: "package", cents: 11000 },
  { key: "vet_checkup", label: "Wellness checkup", category: "vet", unit: "per visit", cents: 6500 },
  { key: "vet_sick", label: "Sick visit", category: "vet", unit: "per visit", cents: 8500 },
  { key: "vet_vaccination", label: "Vaccination visit", category: "vet", unit: "per visit", cents: 4500 },
  { key: "vet_follow_up", label: "Follow-up visit", category: "vet", unit: "per visit", cents: 4000 },
  { key: "vet_staff_flag", label: "Staff-requested vet check", category: "vet", unit: "per visit", cents: 6500 },
];

export const PRICE_CATEGORIES: { id: PriceCategory; label: string }[] = [
  { id: "boarding", label: "Boarding" },
  { id: "daycare", label: "Daycare" },
  { id: "grooming", label: "Grooming" },
  { id: "vet", label: "Vet clinic" },
];

export type PriceMap = Record<string, number>;

export const toPriceMap = (list: { key: string; cents: number }[]): PriceMap => Object.fromEntries(list.map((p) => [p.key, p.cents]));

export interface InvoiceItem {
  label: string;
  qty: number;
  unitCents: number;
  /** qty × unitCents; negative for a discount. */
  cents: number;
}

const line = (label: string, qty: number, unitCents: number): InvoiceItem => ({ label, qty, unitCents, cents: qty * unitCents });

/** Nights for boarding (at least one), days for daycare. */
export function stayUnits(service: Service, startDate: string, endDate: string): number {
  if (service === "boarding") return Math.max(1, daysBetween(startDate, endDate));
  if (service === "daycare") return Math.max(1, daysBetween(startDate, endDate) + 1);
  return 1;
}

/** Invoice lines for a boarding, daycare or grooming booking. */
export function quoteBooking(
  b: { service: Service; startDate: string; endDate: string; groomServices: string[] },
  prices: PriceMap,
): InvoiceItem[] {
  if (b.service === "boarding") {
    const n = stayUnits("boarding", b.startDate, b.endDate);
    return [line(`Boarding · ${n} night${n === 1 ? "" : "s"}`, n, prices.boarding_night ?? 0)];
  }
  if (b.service === "daycare") {
    const n = stayUnits("daycare", b.startDate, b.endDate);
    return [line(`Daycare · ${n} day${n === 1 ? "" : "s"}`, n, prices.daycare_day ?? 0)];
  }
  const items = b.groomServices.map((g) => line(groomLabel(g), 1, prices[`groom_${g}`] ?? 0));
  // All six services: the package price, shown as a saving so the owner sees the deal.
  if (b.groomServices.length === GROOM_SERVICES.length && prices.groom_full) {
    const sum = items.reduce((s, i) => s + i.cents, 0);
    if (prices.groom_full < sum) items.push(line("Full groom package saving", 1, prices.groom_full - sum));
  }
  return items;
}

const VET_LINE: Record<string, string> = {
  checkup: "Wellness checkup",
  sick: "Sick visit",
  vaccination: "Vaccination visit",
  follow_up: "Follow-up visit",
  staff_flag: "Vet check (requested by our team)",
};

/** Invoice lines for a vet visit. */
export function quoteVet(reason: string, prices: PriceMap, doctor?: string | null): InvoiceItem[] {
  return [line(`${VET_LINE[reason] ?? "Vet visit"}${doctor ? ` · ${doctor}` : ""}`, 1, prices[`vet_${reason}`] ?? 0)];
}

export const sumItems = (items: InvoiceItem[]) => items.reduce((s, i) => s + i.cents, 0);

export const ONLINE_DISCOUNT_LABEL = "Online payment discount";
export const DEFAULT_ONLINE_DISCOUNT = 10;

/** The saving for paying online, rounded to the cent (0 when there's no offer). */
export function onlineDiscountCents(totalCents: number, percent: number): number {
  if (percent <= 0 || totalCents <= 0) return 0;
  return Math.round((totalCents * Math.min(percent, 90)) / 100);
}

/** The invoice lines once paid online: the discount is added as its own line. */
export function withOnlineDiscount(items: InvoiceItem[], percent: number): InvoiceItem[] {
  const base = items.filter((i) => !i.label.startsWith(ONLINE_DISCOUNT_LABEL));
  const off = onlineDiscountCents(sumItems(base), percent);
  return off ? [...base, { label: `${ONLINE_DISCOUNT_LABEL} (${percent}%)`, qty: 1, unitCents: -off, cents: -off }] : base;
}

export const DEFAULT_DOCTOR_FEE = 30;

/** How a paid vet visit splits: the platform fee the clinic keeps, and the doctor's share. */
export function doctorSplit(grossCents: number, feePercent: number) {
  const feeCents = Math.round((grossCents * Math.min(Math.max(feePercent, 0), 100)) / 100);
  return { feeCents, netCents: grossCents - feeCents };
}

/** "2026-09" → "September 2026" */
export function monthName(period: string): string {
  return new Date(`${period}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "$1,234.50" — whole dollars drop the cents. */
export function formatMoney(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const text = (abs / 100).toLocaleString("en-US", { minimumFractionDigits: abs % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return `${neg ? "−" : ""}$${text}`;
}

/** Parses "45", "45.5" or "$1,045.50" into cents; null if it isn't a sensible amount. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[$,\s]/g, "");
  if (!/^-?\d{1,6}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
