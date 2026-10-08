"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { uploadVaccineRecord } from "@/app/actions";
import { RecordScanner, type ScannedRecord } from "@/components/RecordScanner";
import type { Species } from "@/lib/vaccines";

export function UnlockBooking({ pet, ownerName }: { pet: { id: string; name: string; species: Species; breed: string }; ownerName: string }) {
  const [record, setRecord] = useState<ScannedRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 rounded-[24px] border-2 border-dashed border-grape/40 p-3.5">
      <h3 className="font-display text-xl font-semibold">Upload {pet.name}&apos;s updated record</h3>
      <RecordScanner pet={pet} ownerName={ownerName} onChange={setRecord} />
      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!record || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await uploadVaccineRecord(pet.id, record!);
            if (!r.ok) setError(r.error);
          })
        }
        className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-grape px-7 text-base font-extrabold text-white transition hover:bg-grape-dark disabled:opacity-50"
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Upload className="size-5" aria-hidden="true" />}
        Submit record
      </button>
    </div>
  );
}
