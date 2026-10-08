"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

const COMMON = ["Skin allergy", "Food allergy", "Arthritis", "Diabetes", "Heart murmur", "Hip dysplasia", "Epilepsy", "Ear infection", "Kidney disease", "Anxiety"];

/** Tap common conditions or type your own; selected ones show as removable chips. */
export function ConditionsInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (c: string) => {
    const name = c.trim();
    if (name && !value.some((v) => v.toLowerCase() === name.toLowerCase())) onChange([...value, name].slice(0, 10));
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected conditions">
          {value.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== c))}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-rose-soft pr-2.5 pl-3.5 text-sm font-extrabold text-rose-ink"
                aria-label={`Remove ${c}`}
              >
                {c} <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Add a condition</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            maxLength={40}
            placeholder="Type a condition…"
            className="min-h-12 w-full rounded-2xl border-2 border-line bg-white px-4 text-base font-semibold placeholder:font-normal placeholder:text-faint"
          />
        </label>
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          aria-label="Add condition"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white disabled:opacity-40"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COMMON.filter((c) => !value.includes(c)).map((c) => (
          <button key={c} type="button" onClick={() => add(c)} className="min-h-9 rounded-full border-2 border-line bg-white px-3 text-[13px] font-bold text-muted active:bg-sand">
            + {c}
          </button>
        ))}
      </div>
    </div>
  );
}
