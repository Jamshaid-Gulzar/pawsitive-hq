"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { saveDoctor, type DoctorInput } from "@/app/actions";
import { VetAvatar } from "@/components/VetAvatar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLORS = ["mint", "coral", "lilac", "sky"];

export type DoctorDraft = Omit<DoctorInput, "password">;

export const EMPTY_DOCTOR: DoctorDraft = {
  id: null,
  name: "Dr. ",
  title: "DVM",
  specialty: "",
  experienceYears: 3,
  education: "Doctor of Veterinary Medicine (DVM)",
  languages: "English",
  focus: "",
  bio: "",
  workDays: [1, 2, 3, 4, 5],
  color: "mint",
  phone: "",
  email: "",
};

/** Add a doctor (with their own sign-in) or edit one. */
export function DoctorForm({ initial, onDone }: { initial: DoctorDraft; onDone: () => void }) {
  const [d, setD] = useState(initial);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isNew = !initial.id;
  const set = <K extends keyof DoctorDraft>(k: K, v: DoctorDraft[K]) => setD({ ...d, [k]: v });
  const input = "min-h-11 w-full rounded-xl border-2 border-line bg-white px-3 font-semibold outline-none focus:border-grape";
  const label = "flex flex-col gap-1 text-sm font-extrabold";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await saveDoctor({ ...d, password });
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
    >
      <div className="flex items-center gap-3">
        <VetAvatar name={d.name.length > 4 ? d.name : "Dr. New"} color={d.color} size="size-14" text="text-lg" />
        <div role="radiogroup" aria-label="Colour" className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={d.color === c}
              aria-label={c}
              onClick={() => set("color", c)}
              className={`size-9 rounded-full bg-${c} ring-offset-2 transition ${d.color === c ? "ring-3 ring-ink" : ""}`}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <label className={label}>
          Full name
          <input className={input} value={d.name} onChange={(e) => set("name", e.target.value)} required maxLength={60} />
        </label>
        <label className={label}>
          Title
          <input className={input} value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={60} placeholder="DVM · Internal Medicine" />
        </label>
        <label className={label}>
          Specialty (shown to customers)
          <input className={input} value={d.specialty} onChange={(e) => set("specialty", e.target.value)} required maxLength={60} placeholder="Skin, ears & allergies" />
        </label>
        <label className={label}>
          Years of experience
          <input className={input} type="number" min={0} max={60} value={d.experienceYears} onChange={(e) => set("experienceYears", Number(e.target.value))} />
        </label>
        <label className={label}>
          Education
          <input className={input} value={d.education} onChange={(e) => set("education", e.target.value)} maxLength={120} />
        </label>
        <label className={label}>
          Languages (comma separated)
          <input className={input} value={d.languages} onChange={(e) => set("languages", e.target.value)} placeholder="English, Spanish" />
        </label>
      </div>
      <label className={label}>
        Focus areas (comma separated)
        <input className={input} value={d.focus} onChange={(e) => set("focus", e.target.value)} placeholder="Wellness exams, Vaccinations, Senior pets" />
      </label>
      <label className={label}>
        Short bio
        <textarea className={`${input} py-2`} rows={3} value={d.bio} onChange={(e) => set("bio", e.target.value)} maxLength={600} />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-extrabold">Working days</legend>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((name, i) => {
            const on = d.workDays.includes(i);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={on}
                onClick={() => set("workDays", on ? d.workDays.filter((x) => x !== i) : [...d.workDays, i])}
                className={`min-h-10 min-w-13 rounded-full border-2 px-3 text-sm font-extrabold ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-2xl bg-cream p-4">
        <h3 className="mb-2 font-display text-lg font-semibold">Sign-in</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <label className={label}>
            Email
            <input className={input} type="email" value={d.email} onChange={(e) => set("email", e.target.value)} required placeholder="dr.sam@pawsitive.demo" />
          </label>
          <label className={label}>
            {isNew ? "Starting password" : "New password (optional)"}
            <input
              className={input}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={isNew}
              autoComplete="new-password"
              placeholder={isNew ? "8+ characters with a number" : "Leave blank to keep"}
            />
          </label>
          <label className={label}>
            Phone (optional)
            <input className={input} type="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} maxLength={25} />
          </label>
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">They sign in at the Team sign-in page and only see their own patients.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-3.5 py-2.5 text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-grape px-6 font-extrabold text-white disabled:opacity-60">
          {pending && <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" />}
          {isNew ? "Add doctor" : "Save changes"}
        </button>
        <button type="button" onClick={onDone} className="min-h-12 rounded-full px-5 font-bold hover:bg-sand">
          Cancel
        </button>
      </div>
    </form>
  );
}
