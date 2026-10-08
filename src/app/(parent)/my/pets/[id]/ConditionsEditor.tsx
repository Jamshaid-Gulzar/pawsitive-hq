"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { updateConditions } from "@/app/actions";
import { ConditionsInput } from "@/components/ConditionsInput";

export function ConditionsEditor({ petId, conditions }: { petId: string; conditions: string[] }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(conditions);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        {conditions.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {conditions.map((c) => (
              <li key={c} className="rounded-full bg-rose-soft px-3 py-1 text-[13px] font-extrabold text-rose-ink">
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-muted">No known conditions</p>
        )}
        <button
          type="button"
          onClick={() => {
            setValue(conditions);
            setEditing(true);
          }}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold text-grape active:bg-sand"
        >
          <Pencil className="size-3.5" aria-hidden="true" /> Edit
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ConditionsInput value={value} onChange={setValue} />
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await updateConditions(petId, value);
              if (r.ok) setEditing(false);
              else setError(r.error);
            })
          }
          className="min-h-11 flex-1 rounded-full bg-grape text-sm font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-full px-4 text-sm font-bold active:bg-sand">
          Cancel
        </button>
      </div>
    </div>
  );
}
