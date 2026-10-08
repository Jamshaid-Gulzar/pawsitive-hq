import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { getBusiness } from "@/db/business";
import { DAY_NAMES, hoursLabel, mapsEmbedUrl, mapsUrl, openStatus } from "@/lib/business";
import { nowStamp, todayISO } from "@/lib/dates";

/** Where the clinic is, whether it's open now, and one tap to the map. */
export async function VisitUsCard() {
  const b = await getBusiness();
  const today = new Date(`${todayISO()}T12:00:00Z`).getUTCDay();
  const status = openStatus(b.hours, today, nowStamp().slice(11, 16));

  return (
    <section aria-labelledby="visit-h" className="overflow-hidden rounded-[26px] bg-white shadow-card">
      <div className="flex items-start gap-3.5 p-4">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-coral-soft text-coral-ink">
          <MapPin className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="visit-h" className="font-display text-xl font-semibold">
            Visit {b.name}
          </h2>
          <p className="text-sm font-semibold text-muted">{b.address}</p>
          <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-extrabold ${status.open ? "text-mint-ink" : "text-rose-ink"}`}>
            <span className={`size-2 rounded-full ${status.open ? "bg-mint" : "bg-rose"}`} /> {status.text}
          </p>
        </div>
      </div>
      {mapsEmbedUrl(b) && <iframe title={`Map of ${b.name}`} src={mapsEmbedUrl(b)!} className="h-44 w-full border-t border-sand bg-sand" />}
      <details className="group border-t border-sand px-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-extrabold text-grape">
          <Clock className="size-4" aria-hidden="true" /> Opening hours
        </summary>
        <ul className="pb-3 text-sm">
          {DAY_NAMES.map((d, i) => (
            <li key={d} className={`flex justify-between py-0.5 ${i === today ? "font-extrabold" : "font-semibold text-muted"}`}>
              <span>{d}</span>
              <span>{hoursLabel(b.hours[i])}</span>
            </li>
          ))}
        </ul>
      </details>
      <div className="grid grid-cols-2 gap-2 border-t border-sand p-3">
        <a
          href={mapsUrl(b)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink text-sm font-extrabold text-white active:scale-[0.98]"
        >
          <Navigation className="size-4.5" aria-hidden="true" /> Open map
        </a>
        {b.phone && (
          <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cream text-sm font-extrabold active:scale-[0.98]">
            <Phone className="size-4.5" aria-hidden="true" /> Call us
          </a>
        )}
      </div>
    </section>
  );
}
