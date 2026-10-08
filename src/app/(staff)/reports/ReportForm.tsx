"use client";

import { Camera, Check, LoaderCircle } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { submitDailyReport } from "@/app/actions";
import type { DailyReport } from "@/db/schema";
import { REPORT_OPTIONS } from "@/lib/care";
import { compressImage, isImageFile } from "@/lib/image";

function Choice({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={`min-h-10 rounded-full border-2 px-3.5 text-sm font-extrabold transition ${value === o ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Today's report card for one pet. Sent to the owner when saved. */
export function ReportForm({ bookingId, petName, existing, onDone }: { bookingId: string; petName: string; existing: DailyReport | null; onDone?: () => void }) {
  const [meals, setMeals] = useState<string | null>(existing?.meals ?? null);
  const [potty, setPotty] = useState<string | null>(existing?.potty ?? null);
  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);
  const [acts, setActs] = useState<string[]>(existing?.activities ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [photo, setPhoto] = useState<string | null>(existing?.photo ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const missing = !meals ? "How did they eat?" : !potty ? "Potty?" : !mood ? "Pick a mood" : null;

  return (
    <form
      className="flex flex-col gap-4 rounded-[22px] bg-cream p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (missing) return;
        startTransition(async () => {
          setError(null);
          const r = await submitDailyReport({ bookingId, meals: meals!, potty: potty!, mood: mood!, activities: acts, notes, photo: photo?.startsWith("data:") ? photo : null });
          if (r.ok) onDone?.();
          else setError(r.error);
        });
      }}
    >
      <Choice label="Meals" options={REPORT_OPTIONS.meals} value={meals} onChange={setMeals} />
      <Choice label="Potty" options={REPORT_OPTIONS.potty} value={potty} onChange={setPotty} />
      <Choice label="Mood" options={REPORT_OPTIONS.moods} value={mood} onChange={setMood} />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">Today&apos;s activities</span>
        <div className="flex flex-wrap gap-1.5">
          {REPORT_OPTIONS.activities.map((a) => {
            const on = acts.includes(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                onClick={() => setActs(on ? acts.filter((x) => x !== a) : [...acts, a])}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-extrabold transition ${on ? "border-mint bg-mint-soft text-mint-ink" : "border-line bg-white"}`}
              >
                {on && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
                {a}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-extrabold tracking-[0.06em] text-muted uppercase">
        Notes for the family
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={`Anything fun or worth knowing about ${petName} today`}
          className="rounded-2xl border-2 border-line bg-white px-3.5 py-2.5 text-[15px] font-semibold tracking-normal normal-case text-ink"
        />
      </label>
      <div className="flex items-center gap-3">
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Report photo"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f && isImageFile(f)) setPhoto(await compressImage(f, 1000, 0.78));
          }}
        />
        <button type="button" onClick={() => file.current?.click()} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-white px-4 text-sm font-extrabold">
          <Camera className="size-4.5" aria-hidden="true" /> {photo ? "Change photo" : "Add a photo"}
        </button>
        {photo && <span className="text-sm font-bold text-mint-ink">Photo added ✓</span>}
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !!missing}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-grape text-[15px] font-extrabold text-white disabled:bg-[#b9b4dc]"
      >
        {pending && <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" />}
        {missing ?? (existing ? "Update report & notify family" : "Send report to family")}
      </button>
    </form>
  );
}
