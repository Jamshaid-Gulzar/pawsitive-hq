import type { HealthStatus, VetReason } from "@/db/schema";
import type { DayState, SlotState } from "./availability";

export const VET_REASONS: Record<VetReason, { label: string; blurb: string; tone: string }> = {
  checkup: { label: "Wellness checkup", blurb: "Yearly head-to-tail exam", tone: "bg-mint-soft text-mint-ink" },
  sick: { label: "Not feeling well", blurb: "Symptoms you're worried about", tone: "bg-rose-soft text-rose-ink" },
  vaccination: { label: "Vaccination", blurb: "Boosters and due shots", tone: "bg-sky-soft text-sky-ink" },
  follow_up: { label: "Follow-up", blurb: "Re-check after treatment", tone: "bg-lilac-soft text-lilac-ink" },
  staff_flag: { label: "Flagged by staff", blurb: "Our team noticed something", tone: "bg-sun-soft text-sun-ink" },
};

/** Reasons a pet parent can choose; staff flags come from the floor board. */
export const PARENT_REASONS: VetReason[] = ["checkup", "sick", "vaccination", "follow_up"];

export const HEALTH_STATUS: Record<HealthStatus, { label: string; tone: string; dot: string }> = {
  healthy: { label: "Healthy", tone: "bg-mint-soft text-mint-ink", dot: "bg-mint" },
  monitor: { label: "Keep an eye on", tone: "bg-sun-soft text-sun-ink", dot: "bg-amber" },
  treatment: { label: "Under treatment", tone: "bg-rose-soft text-rose-ink", dot: "bg-rose" },
};

export const VET_COLORS: Record<string, { avatar: string; soft: string; ink: string }> = {
  mint: { avatar: "bg-mint text-white", soft: "bg-mint-soft", ink: "text-mint-ink" },
  coral: { avatar: "bg-coral text-ink", soft: "bg-coral-soft", ink: "text-coral-ink" },
  lilac: { avatar: "bg-lilac text-white", soft: "bg-lilac-soft", ink: "text-lilac-ink" },
  sky: { avatar: "bg-sky text-white", soft: "bg-sky-soft", ink: "text-sky-ink" },
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" date. */
export function weekday(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export function worksOn(vet: { workDays: number[] }, iso: string): boolean {
  return vet.workDays.includes(weekday(iso));
}

/** "Mon – Fri" or "Mon, Wed, Thu, Sat" */
export function workDaysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) return `${DAY_NAMES[sorted[0]]} – ${DAY_NAMES[sorted.at(-1)!]}`;
  return sorted.map((d) => DAY_NAMES[d]).join(", ");
}

export const CLINIC_HOURS = "9:00 AM – 5:00 PM";

/** A doctor's time: taken = "vetId date time" keys of requested or confirmed visits. */
export function vetSlotState(vetId: string, iso: string, time: string, taken: string[], today: string, nowTime: string): SlotState {
  if (iso < today || (iso === today && time <= nowTime)) return "passed";
  return taken.includes(`${vetId} ${iso} ${time}`) ? "booked" : "free";
}

export function vetDayState(vet: { id: string; workDays: number[] }, iso: string, taken: string[], today: string, nowTime: string): DayState {
  if (iso < today) return "past";
  if (!worksOn(vet, iso)) return "closed";
  const free = VET_SLOTS.filter((s) => vetSlotState(vet.id, iso, s, taken, today, nowTime) === "free").length;
  return free === 0 ? "full" : free <= 2 ? "limited" : "open";
}

// Matches what the owner tells us to the doctor whose focus fits best.
const HINTS: [RegExp, string][] = [
  [/skin|itch|scratch|allerg|ear|rash|coat|hot spot|paw lick/i, "vet_aisha"],
  [/heart|murmur|cough|breath|senior|old|kidney|diabet|cat\b|tired/i, "vet_mei"],
  [/limp|leg|joint|arthritis|hip|injur|wound|cut|tooth|teeth|dental|surgery|fracture/i, "vet_carlos"],
];

/** The doctor to suggest for this visit, or null when anyone is a good fit. */
export function recommendVet(reason: string, symptoms: string, conditions: string[], species: string): string | null {
  const text = [symptoms, ...conditions, species === "cat" ? "cat" : ""].join(" ");
  for (const [re, id] of HINTS) if (re.test(text)) return id;
  return reason === "checkup" || reason === "vaccination" ? "vet_leo" : null;
}

export const VET_SLOTS = ["09:00", "10:00", "11:00", "13:30", "14:30", "15:30", "16:30"];
