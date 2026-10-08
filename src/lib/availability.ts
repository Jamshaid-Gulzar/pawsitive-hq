// Opening days, time slots and capacity for each service. Pure functions, used
// by the booking calendar in the browser and re-checked by the server.

import { addDays, daysBetween, formatShortDate } from "./dates";
import type { Service } from "./vaccines";

export const GROOM_SERVICES = [
  { id: "bath", label: "Bath & blow-dry" },
  { id: "haircut", label: "Haircut & styling" },
  { id: "nails", label: "Nail trim" },
  { id: "ears", label: "Ear cleaning" },
  { id: "teeth", label: "Teeth brushing" },
  { id: "deshed", label: "De-shedding" },
] as const;

export const groomLabel = (id: string) => GROOM_SERVICES.find((g) => g.id === id)?.label ?? id;

interface ServiceSchedule {
  /** 0 = Sunday … 6 = Saturday */
  openDays: number[];
  /** Drop-off times (boarding, daycare) or appointment times (grooming). */
  slots: string[];
  /** Pets that can start at the same time. */
  perSlot: number;
  pickupTimes: string[];
}

export const SCHEDULE: Record<Service, ServiceSchedule> = {
  boarding: { openDays: [0, 1, 2, 3, 4, 5, 6], slots: ["08:00", "10:00", "12:00", "16:00"], perSlot: 2, pickupTimes: ["10:00", "12:00", "16:00", "18:00"] },
  daycare: { openDays: [1, 2, 3, 4, 5, 6], slots: ["07:30", "08:00", "08:30", "09:00", "09:30"], perSlot: 3, pickupTimes: ["16:00", "17:00", "18:00"] },
  grooming: { openDays: [1, 2, 3, 4, 5, 6], slots: ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"], perSlot: 2, pickupTimes: [] },
};

/** Runs plus the cat suite. */
export const KENNEL_CAPACITY = 8;
export const BOOKING_WINDOW_DAYS = 60;
const GROOM_HOURS = 2;

/** Statuses that hold a kennel or a time slot. */
export const ACTIVE_STATUSES = ["requested", "review", "locked", "confirmed", "checked_in"] as const;

export interface AvailabilityData {
  /** Kennels in use per date ("YYYY-MM-DD" → count), for boarding and daycare. */
  kennelLoad: Record<string, number>;
  /** Pets per start time ("service date time" → count). */
  slotLoad: Record<string, number>;
}

export type DayState = "open" | "limited" | "full" | "closed" | "past";
export type SlotState = "free" | "booked" | "passed";

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Every date a stay occupies a kennel: drop-off day through pickup day. */
export function kennelDays(start: string, end: string): string[] {
  return Array.from({ length: daysBetween(start, end) + 1 }, (_, i) => addDays(start, i));
}

export function isOpen(service: Service, iso: string): boolean {
  return SCHEDULE[service].openDays.includes(weekday(iso));
}

export function slotState(service: Service, iso: string, time: string, data: AvailabilityData, today: string, nowTime: string): SlotState {
  if (iso < today || (iso === today && time <= nowTime)) return "passed";
  return (data.slotLoad[`${service} ${iso} ${time}`] ?? 0) >= SCHEDULE[service].perSlot ? "booked" : "free";
}

export function freeSlots(service: Service, iso: string, data: AvailabilityData, today: string, nowTime: string): number {
  return SCHEDULE[service].slots.filter((t) => slotState(service, iso, t, data, today, nowTime) === "free").length;
}

export function kennelsFree(iso: string, data: AvailabilityData): number {
  return Math.max(0, KENNEL_CAPACITY - (data.kennelLoad[iso] ?? 0));
}

/** How a date looks on the calendar for this service. */
export function dayState(service: Service, iso: string, data: AvailabilityData, today: string, nowTime: string): DayState {
  if (iso < today) return "past";
  if (!isOpen(service, iso)) return "closed";
  const slots = freeSlots(service, iso, data, today, nowTime);
  if (service !== "grooming") {
    const kennels = kennelsFree(iso, data);
    if (kennels === 0 || slots === 0) return "full";
    return kennels <= 2 ? "limited" : "open";
  }
  if (slots === 0) return "full";
  return slots <= 2 ? "limited" : "open";
}

/** Why a boarding stay can't run across these dates, or null if it can. */
export function stayProblem(start: string, end: string, data: AvailabilityData): string | null {
  const full = kennelDays(start, end).find((d) => kennelsFree(d, data) === 0);
  return full ? `We're fully booked on ${formatShortDate(full)}. Please choose other dates.` : null;
}

export function groomPickup(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h + GROOM_HOURS).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
