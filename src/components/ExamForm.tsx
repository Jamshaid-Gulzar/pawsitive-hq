"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { completeVetVisit } from "@/app/actions";
import { ConditionsInput } from "@/components/ConditionsInput";
import type { HealthStatus } from "@/db/schema";
import { HEALTH_STATUS } from "@/lib/vet";

const field = "min-h-12 w-full rounded-2xl border-2 border-line bg-white px-4 text-base font-semibold placeholder:font-normal placeholder:text-faint";

export function ExamForm({ visitId, petName, ownerName, conditions, minFollowUp }: { visitId: string; petName: string; ownerName: string; conditions: string[]; minFollowUp: string }) {
  const [weightKg, setWeight] = useState("");
  const [temperatureC, setTemp] = useState("");
  const [healthStatus, setStatus] = useState<HealthStatus | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [medication, setMedication] = useState("");
  const [followUpDate, setFollowUp] = useState("");
  const [resolved, setResolved] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!healthStatus) {
      setError("Choose an overall health status.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const r = await completeVetVisit(visitId, {
        weightKg,
        temperatureC,
        healthStatus,
        diagnosis,
        treatment,
        medication,
        followUpDate: followUpDate || null,
        addConditions: added,
        resolvedConditions: resolved,
      });
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <form
      className="flex flex-col gap-5 rounded-[26px] bg-white p-5 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className="font-display text-2xl font-semibold">Exam notes</h2>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Weight (kg)
          <input inputMode="decimal" value={weightKg} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 8.4" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Temperature (°C)
          <input inputMode="decimal" value={temperatureC} onChange={(e) => setTemp(e.target.value)} placeholder="e.g. 38.5" className={field} />
        </label>
      </div>

      <div role="radiogroup" aria-label="Overall health" className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold">Overall health</span>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(HEALTH_STATUS) as HealthStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={healthStatus === s}
              onClick={() => setStatus(s)}
              className={`flex min-h-13 items-center justify-center gap-2 rounded-2xl border-2 px-2 text-sm font-extrabold transition ${
                healthStatus === s ? `${HEALTH_STATUS[s].tone} border-current` : "border-line hover:bg-cream"
              }`}
            >
              <span className={`size-2.5 rounded-full ${HEALTH_STATUS[s].dot}`} /> {HEALTH_STATUS[s].label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Findings / diagnosis
        <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={3} maxLength={500} placeholder={`What did you find with ${petName}?`} className={`${field} py-3`} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Treatment given
        <input value={treatment} onChange={(e) => setTreatment(e.target.value)} maxLength={500} placeholder="e.g. Ears cleaned, wound dressed" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Medication prescribed
        <input value={medication} onChange={(e) => setMedication(e.target.value)} maxLength={300} placeholder="e.g. Otomax, 4 drops twice daily for 7 days" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Follow-up visit
        <input type="date" min={minFollowUp} value={followUpDate} onChange={(e) => setFollowUp(e.target.value)} className={`${field} max-w-60`} />
        <span className="text-[13px] font-semibold text-muted">Optional — books a follow-up automatically.</span>
      </label>

      <fieldset className="flex flex-col gap-2.5 rounded-2xl bg-cream p-4">
        <legend className="sr-only">Conditions</legend>
        <span className="text-sm font-extrabold">Conditions on file</span>
        {conditions.length ? (
          <ul className="flex flex-wrap gap-2">
            {conditions.map((c) => {
              const gone = resolved.includes(c);
              return (
                <li key={c}>
                  <button
                    type="button"
                    aria-pressed={gone}
                    onClick={() => setResolved(gone ? resolved.filter((x) => x !== c) : [...resolved, c])}
                    className={`min-h-10 rounded-full px-3.5 text-sm font-extrabold ${gone ? "bg-mint-soft text-mint-ink line-through" : "bg-rose-soft text-rose-ink"}`}
                  >
                    {c} {gone ? "· resolved" : ""}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-muted">None on file.</p>
        )}
        <span className="mt-1 text-sm font-extrabold">New conditions found</span>
        <ConditionsInput value={added} onChange={setAdded} />
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-mint text-base font-extrabold text-white transition hover:brightness-95 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <CircleCheck className="size-5" aria-hidden="true" />}
        Complete checkup &amp; send report to {ownerName}
      </button>
    </form>
  );
}
