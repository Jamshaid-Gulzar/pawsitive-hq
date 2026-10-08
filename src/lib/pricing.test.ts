import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICES,
  doctorSplit,
  formatMoney,
  onlineDiscountCents,
  parseMoney,
  quoteBooking,
  quoteVet,
  sumItems,
  toPriceMap,
  withOnlineDiscount,
} from "./pricing";

const prices = toPriceMap(DEFAULT_PRICES);

describe("quoteBooking", () => {
  it("charges boarding per night", () => {
    const items = quoteBooking({ service: "boarding", startDate: "2026-10-10", endDate: "2026-10-13", groomServices: [] }, prices);
    expect(items).toEqual([{ label: "Boarding · 3 nights", qty: 3, unitCents: 5500, cents: 16500 }]);
  });

  it("charges daycare per day, counting the first day", () => {
    const items = quoteBooking({ service: "daycare", startDate: "2026-10-10", endDate: "2026-10-10", groomServices: [] }, prices);
    expect(sumItems(items)).toBe(3800);
  });

  it("adds up the chosen grooming services", () => {
    const items = quoteBooking({ service: "grooming", startDate: "2026-10-10", endDate: "2026-10-10", groomServices: ["bath", "nails"] }, prices);
    expect(items.map((i) => i.label)).toEqual(["Bath & blow-dry", "Nail trim"]);
    expect(sumItems(items)).toBe(5000);
  });

  it("applies the full-groom package price when all six are chosen", () => {
    const all = ["bath", "haircut", "nails", "ears", "teeth", "deshed"];
    const items = quoteBooking({ service: "grooming", startDate: "2026-10-10", endDate: "2026-10-10", groomServices: all }, prices);
    expect(items.at(-1)!.label).toBe("Full groom package saving");
    expect(sumItems(items)).toBe(11000);
  });
});

describe("quoteVet", () => {
  it("prices by visit reason and names the doctor", () => {
    expect(quoteVet("sick", prices, "Dr. Thomas Hale")).toEqual([{ label: "Sick visit · Dr. Thomas Hale", qty: 1, unitCents: 8500, cents: 8500 }]);
  });
});

describe("online discount", () => {
  it("adds a discount line once, rounded to the cent", () => {
    const items = quoteBooking({ service: "daycare", startDate: "2026-10-10", endDate: "2026-10-10", groomServices: [] }, prices);
    const paid = withOnlineDiscount(withOnlineDiscount(items, 10), 10);
    expect(paid.map((i) => i.label)).toEqual(["Daycare · 1 day", "Online payment discount (10%)"]);
    expect(sumItems(paid)).toBe(3420);
    expect(onlineDiscountCents(999, 15)).toBe(150);
    expect(withOnlineDiscount(items, 0)).toEqual(items);
  });
});

describe("doctorSplit", () => {
  it("keeps the platform fee and pays the doctor the rest", () => {
    expect(doctorSplit(6500, 30)).toEqual({ feeCents: 1950, netCents: 4550 });
    expect(doctorSplit(4050, 25)).toEqual({ feeCents: 1013, netCents: 3037 });
  });
});

describe("money", () => {
  it("formats and parses dollars", () => {
    expect(formatMoney(5500)).toBe("$55");
    expect(formatMoney(123450)).toBe("$1,234.50");
    expect(formatMoney(-2000)).toBe("−$20");
    expect(parseMoney("$1,045.5")).toBe(104550);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});
