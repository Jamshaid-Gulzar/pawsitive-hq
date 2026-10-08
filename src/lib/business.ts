// The clinic's own details, set by the admin on the Settings page: name,
// logo, contact info, address and opening hours. Pure helpers only.

export type DayHours = { open: string; close: string } | null;

export interface BusinessInfo {
  name: string;
  tagline: string;
  /** Data URL of an uploaded logo, or null for the paw mark. */
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  /** What to search for on the map; falls back to the address. */
  mapQuery: string;
  /** Map pin, looked up from the address when the admin saves. */
  lat: number | null;
  lon: number | null;
  /** 0 = Sunday … 6 = Saturday; null = closed. */
  hours: DayHours[];
}

export const DEFAULT_BUSINESS: BusinessInfo = {
  name: "Pawsitive HQ",
  tagline: "Pet care, boarding, grooming & vet clinic",
  logo: null,
  phone: "(555) 010-7297",
  email: "hello@pawsitive.demo",
  address: "1 Ferry Building, San Francisco, CA 94111",
  mapQuery: "Ferry Building, San Francisco, CA",
  lat: 37.7955,
  lon: -122.3937,
  hours: [
    { open: "09:00", close: "16:00" },
    { open: "07:00", close: "19:00" },
    { open: "07:00", close: "19:00" },
    { open: "07:00", close: "19:00" },
    { open: "07:00", close: "19:00" },
    { open: "07:00", close: "19:00" },
    { open: "08:00", close: "18:00" },
  ],
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A free Google Maps link (no API key): opens the map app on phones. */
export function mapsUrl(b: Pick<BusinessInfo, "address" | "mapQuery">): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.mapQuery || b.address)}`;
}

/**
 * An embeddable OpenStreetMap with a pin (free, no key, works on localhost —
 * Google's keyless embed blocks its map tiles there). Null until the address
 * has been placed on the map.
 */
export function mapsEmbedUrl(b: Pick<BusinessInfo, "lat" | "lon">): string | null {
  if (b.lat == null || b.lon == null) return null;
  const bbox = [b.lon - 0.008, b.lat - 0.005, b.lon + 0.008, b.lat + 0.005].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
}

/** Looks an address up on OpenStreetMap's free geocoder (server only). */
export async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "PawsitiveHQ-portfolio-demo/1.0", "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}

const hhmm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};

export function hoursLabel(h: DayHours): string {
  return h ? `${hhmm(h.open)} – ${hhmm(h.close)}` : "Closed";
}

/** "Open now · until 7 PM" / "Closed now · opens Mon 7 AM", for a weekday and "HH:MM". */
export function openStatus(hours: DayHours[], day: number, time: string): { open: boolean; text: string } {
  const today = hours[day];
  if (today && time >= today.open && time < today.close) return { open: true, text: `Open now · until ${hhmm(today.close)}` };
  if (today && time < today.open) return { open: false, text: `Closed now · opens today ${hhmm(today.open)}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const h = hours[d];
    if (h) return { open: false, text: `Closed now · opens ${i === 1 ? "tomorrow" : DAY_NAMES[d].slice(0, 3)} ${hhmm(h.open)}` };
  }
  return { open: false, text: "Closed" };
}

/** Accepts saved JSON and fills any gaps with the defaults. */
export function parseBusiness(json: string | null | undefined): BusinessInfo {
  try {
    const v = json ? (JSON.parse(json) as Partial<BusinessInfo>) : {};
    const hours = Array.isArray(v.hours) && v.hours.length === 7 ? v.hours : DEFAULT_BUSINESS.hours;
    return { ...DEFAULT_BUSINESS, ...v, hours };
  } catch {
    return DEFAULT_BUSINESS;
  }
}
