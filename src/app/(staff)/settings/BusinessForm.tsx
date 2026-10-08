"use client";

import { Check, ImagePlus, LoaderCircle, MapPin, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { saveBusiness } from "@/app/actions";
import { Logo } from "@/components/ui";
import { DAY_NAMES, mapsEmbedUrl, mapsUrl, type BusinessInfo } from "@/lib/business";
import { compressImage, isImageFile } from "@/lib/image";

/** Admin: the clinic's name, logo, contact details, address and opening hours. */
export function BusinessForm({ initial }: { initial: BusinessInfo }) {
  const [b, setB] = useState(initial);
  const [savedInfo, setSavedInfo] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const set = <K extends keyof BusinessInfo>(k: K, v: BusinessInfo[K]) => {
    setSaved(false);
    setB({ ...b, [k]: v });
  };
  const input = "min-h-11 w-full rounded-xl border-2 border-line bg-white px-3 font-semibold outline-none focus:border-grape";
  const label = "flex flex-col gap-1 text-sm font-extrabold";
  const card = "flex flex-col gap-4 rounded-[24px] bg-white p-6 shadow-card";

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await saveBusiness(b);
          if (r.ok) {
            const next = { ...b, lat: r.lat, lon: r.lon };
            setB(next);
            setSavedInfo(next);
            setSaved(true);
          } else setError(r.error);
        });
      }}
    >
      <section className={card} aria-labelledby="brand-h">
        <h2 id="brand-h" className="font-display text-2xl font-semibold">
          Business & logo
        </h2>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-cream p-4">
          <Logo name={b.name || "Your business"} logo={b.logo} />
          <span className="ml-auto flex gap-2">
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Logo image"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f && isImageFile(f)) set("logo", await compressImage(f, 256, 0.9));
              }}
            />
            <button type="button" onClick={() => file.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-4 text-sm font-extrabold">
              <ImagePlus className="size-4.5" aria-hidden="true" /> {b.logo ? "Change logo" : "Upload logo"}
            </button>
            {b.logo && (
              <button type="button" onClick={() => set("logo", null)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold text-rose-ink hover:bg-rose-soft">
                <Trash2 className="size-4" aria-hidden="true" /> Remove
              </button>
            )}
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          <label className={label}>
            Business name
            <input className={input} value={b.name} onChange={(e) => set("name", e.target.value)} maxLength={40} required />
          </label>
          <label className={label}>
            Tagline
            <input className={input} value={b.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={80} />
          </label>
          <label className={label}>
            Phone
            <input className={input} type="tel" value={b.phone} onChange={(e) => set("phone", e.target.value)} maxLength={25} />
          </label>
          <label className={label}>
            Email
            <input className={input} type="email" value={b.email} onChange={(e) => set("email", e.target.value)} maxLength={80} />
          </label>
        </div>
      </section>

      <section className={card} aria-labelledby="loc-h">
        <h2 id="loc-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <MapPin className="size-6 text-coral-ink" aria-hidden="true" /> Location
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          <label className={label}>
            Street address (shown to customers)
            <input className={input} value={b.address} onChange={(e) => set("address", e.target.value)} maxLength={160} required />
          </label>
          <label className={label}>
            Map search (optional, e.g. place name)
            <input className={input} value={b.mapQuery} onChange={(e) => set("mapQuery", e.target.value)} maxLength={160} placeholder="Same as the address" />
          </label>
        </div>
        {mapsEmbedUrl(b) ? (
          <div className="overflow-hidden rounded-2xl border-2 border-line">
            <iframe key={mapsEmbedUrl(b)!} title="Clinic map preview" src={mapsEmbedUrl(b)!} className="h-64 w-full bg-sand" />
          </div>
        ) : (
          <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm font-bold text-sun-ink">
            We couldn&apos;t find this address on the map. Check the spelling or try the map search field — customers can still use &ldquo;Open in Google Maps&rdquo;.
          </p>
        )}
        {(b.address !== savedInfo.address || b.mapQuery !== savedInfo.mapQuery) && (
          <p className="-mt-2 text-sm font-bold text-muted">Save to move the pin to the new address.</p>
        )}
        <a href={mapsUrl(b)} target="_blank" rel="noreferrer" className="self-start text-sm font-extrabold text-grape underline">
          Open in Google Maps
        </a>
      </section>

      <section className={card} aria-labelledby="hours-h">
        <h2 id="hours-h" className="font-display text-2xl font-semibold">
          Opening hours
        </h2>
        <p className="-mt-2 text-sm font-semibold text-muted">Shown in the customer app. Booking times per service are set separately.</p>
        <ul className="flex flex-col divide-y divide-sand">
          {DAY_NAMES.map((day, i) => {
            const h = b.hours[i];
            const setDay = (v: BusinessInfo["hours"][number]) => set("hours", b.hours.map((x, j) => (j === i ? v : x)));
            return (
              <li key={day} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-28 font-extrabold">{day}</span>
                <label className="inline-flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={!!h} onChange={(e) => setDay(e.target.checked ? { open: "09:00", close: "17:00" } : null)} className="size-5 accent-grape" />
                  Open
                </label>
                {h ? (
                  <span className="flex items-center gap-2">
                    <input type="time" aria-label={`${day} opens`} value={h.open} onChange={(e) => setDay({ ...h, open: e.target.value })} className="min-h-10 rounded-xl border-2 border-line px-2 font-semibold" />
                    <span className="text-muted">to</span>
                    <input type="time" aria-label={`${day} closes`} value={h.close} onChange={(e) => setDay({ ...h, close: e.target.value })} className="min-h-10 rounded-xl border-2 border-line px-2 font-semibold" />
                  </span>
                ) : (
                  <span className="text-sm font-bold text-muted">Closed</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 self-start rounded-full bg-white p-2 pr-4 shadow-float">
        <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-grape px-6 font-extrabold text-white disabled:opacity-60">
          {pending && <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" />} Save settings
        </button>
        {saved && (
          <span role="status" className="inline-flex items-center gap-1 font-bold text-mint-ink">
            <Check className="size-4.5" aria-hidden="true" /> Saved — the whole app is updated
          </span>
        )}
        {error && (
          <span role="alert" className="font-bold text-rose-ink">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
