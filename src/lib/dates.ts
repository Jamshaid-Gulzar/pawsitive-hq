// All calendar dates in the app are plain "YYYY-MM-DD" strings. Arithmetic is
// done in UTC so daylight-saving changes never shift a day.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isoFromParts(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.toISOString().slice(0, 10);
}

// The facility's wall clock. Set FACILITY_TIMEZONE (e.g. "America/New_York")
// on a server whose clock is UTC; locally the machine's own zone is used.
function facilityParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.FACILITY_TIMEZONE || undefined,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function todayISO(now: Date = new Date()): string {
  return facilityParts(now).date;
}

/** Facility-local timestamp, "YYYY-MM-DDTHH:MM". Sorts as text. */
export function nowStamp(now: Date = new Date()): string {
  const { date, time } = facilityParts(now);
  return `${date}T${time}`;
}

/** "Today 2:44 PM", "Yesterday 7:40 PM" or "Oct 3, 9:05 AM" */
export function formatStamp(stamp: string, today: string = todayISO()): string {
  const [date, time] = stamp.split("T");
  const t = formatTime(time.slice(0, 5));
  if (date === today) return `Today ${t}`;
  if (date === addDays(today, -1)) return `Yesterday ${t}`;
  return `${formatShortDate(date)}, ${t}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** "Mar 14, 2027" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Mar 14" */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "Tuesday, October 6" */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "17:15" -> "5:15 PM" */
export function formatTime(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function greeting(now: Date = new Date()): string {
  const h = Number(facilityParts(now).time.slice(0, 2));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
