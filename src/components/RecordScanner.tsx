"use client";

import { FileText, ScanLine, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { compressImage, isImageFile } from "@/lib/image";
import { readText } from "@/lib/ocr";
import { drawSampleRecord } from "@/lib/sample-record";
import { parseVaccineRecord, vaccineLabel, type Species, type VaccineDates, type VaccineKey } from "@/lib/vaccines";

export type ScannedRecord = { image: string; dates: VaccineDates; ocrText: string };

type Phase = { kind: "idle" } | { kind: "reading"; progress: number } | { kind: "done"; lowConfidence: VaccineKey[] } | { kind: "error"; message: string };

/**
 * Upload a photo of a vet record (or generate a sample), read it with OCR in
 * the browser, and let the owner fix any date before it's used.
 */
export function RecordScanner({
  pet,
  ownerName,
  onChange,
}: {
  pet: { name: string; species: Species; breed: string };
  ownerName: string;
  onChange: (record: ScannedRecord | null) => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [dates, setDates] = useState<VaccineDates>({ rabies: null, core: null, bordetella: null });
  const [ocrText, setOcrText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const fileInput = useRef<HTMLInputElement>(null);
  const keys: VaccineKey[] = pet.species === "cat" ? ["rabies", "core"] : ["rabies", "core", "bordetella"];

  async function scan(dataUrl: string) {
    setImage(dataUrl);
    onChange(null);
    setPhase({ kind: "reading", progress: 0 });
    try {
      const text = await readText(dataUrl, (p) => setPhase({ kind: "reading", progress: p }));
      const parsed = parseVaccineRecord(text);
      const found: VaccineDates = { rabies: parsed.rabies.date, core: parsed.core.date, bordetella: parsed.bordetella.date };
      setDates(found);
      setOcrText(text);
      setPhase({ kind: "done", lowConfidence: keys.filter((k) => parsed[k].confidence !== "high") });
      onChange({ image: dataUrl, dates: found, ocrText: text });
    } catch {
      setPhase({ kind: "error", message: "We couldn't read that image. Check your connection, or enter the dates by hand below." });
      setOcrText("");
      onChange({ image: dataUrl, dates, ocrText: "" });
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isImageFile(file)) {
      setPhase({ kind: "error", message: "Please upload a photo (JPG or PNG) of the record. Tip: a phone photo works great." });
      return;
    }
    await scan(await compressImage(file, 1600, 0.85));
  }

  function editDate(key: VaccineKey, value: string) {
    const next = { ...dates, [key]: value || null };
    setDates(next);
    if (image) onChange({ image, dates: next, ocrText });
  }

  const sample = (expired: boolean) => scan(drawSampleRecord({ petName: pet.name, ownerName, species: pet.species, breed: pet.breed, expired }));
  const reading = phase.kind === "reading";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-grape-soft p-3.5">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-white text-grape">
          {reading ? <ScanLine className="size-6 animate-pulse" aria-hidden="true" /> : <FileText className="size-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-[1_1_200px]">
          <div className="text-base font-extrabold">
            {phase.kind === "idle" && "Add a photo of the vet record"}
            {reading && "Reading the record…"}
            {phase.kind === "done" && "Record read — please check the dates"}
            {phase.kind === "error" && "Couldn't read the record"}
          </div>
          <div className="text-sm font-semibold text-muted">
            {reading ? `${Math.round(phase.progress * 100)}% · runs privately in your browser` : "Photo or screenshot · JPG or PNG"}
          </div>
          {reading && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-grape transition-[width]" style={{ width: `${Math.max(6, phase.progress * 100)}%` }} />
            </div>
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Upload vet record photo" />
        <button
          type="button"
          disabled={reading}
          onClick={() => fileInput.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-grape bg-white px-4.5 text-sm font-extrabold text-grape transition hover:bg-grape hover:text-white disabled:opacity-60"
        >
          <Upload className="size-4" aria-hidden="true" />
          {image ? "Replace" : "Upload"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
        <Sparkles className="size-4 text-sun-ink" aria-hidden="true" />
        No record handy? Try a sample:
        <button type="button" disabled={reading} onClick={() => sample(false)} className="rounded-full bg-mint-soft px-3 py-1.5 font-extrabold text-mint-ink hover:brightness-95 disabled:opacity-60">
          Up-to-date record
        </button>
        <button type="button" disabled={reading} onClick={() => sample(true)} className="rounded-full bg-rose-soft px-3 py-1.5 font-extrabold text-rose-ink hover:brightness-95 disabled:opacity-60">
          Record with an expired shot
        </button>
      </div>

      {phase.kind === "error" && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-bold text-rose-ink">
          {phase.message}
        </p>
      )}

      {image && (
        <div className="grid gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
          <img src={image} alt={`${pet.name}'s vet record`} className="max-h-48 w-full rounded-2xl border-2 border-line bg-white object-contain" />
          {phase.kind !== "reading" && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-1 text-[13px] font-extrabold tracking-[0.06em] text-muted uppercase">Expiry dates we found</legend>
              {keys.map((key) => {
                const unsure = phase.kind === "done" && phase.lowConfidence.includes(key);
                return (
                  <label key={key} className="flex flex-wrap items-center justify-between gap-2 text-[15px] font-bold">
                    <span>
                      {vaccineLabel(key, pet.species)}
                      {unsure && <span className="ml-2 rounded-full bg-sun-soft px-2 py-0.5 text-xs text-sun-ink">{dates[key] ? "Double-check" : "Not found"}</span>}
                    </span>
                    <input
                      type="date"
                      value={dates[key] ?? ""}
                      onChange={(e) => editDate(key, e.target.value)}
                      className="min-h-11 rounded-xl border-2 border-line bg-white px-3 font-semibold"
                    />
                  </label>
                );
              })}
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
