"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions";

/** Change the account's name and phone number. */
export function EditProfile({ name, phone }: { name: string; phone: string | null }) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-lilac-ink shadow-card"
        >
          <Pencil className="size-4" aria-hidden="true" /> Edit profile
        </button>
        {saved && (
          <p role="status" className="text-sm font-bold text-mint-ink">
            Profile saved ✓
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-[22px] bg-white p-4 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await updateProfile(n, p);
          if (r.ok) {
            setOpen(false);
            setSaved(true);
          } else setError(r.error);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Full name
        <input
          value={n}
          onChange={(e) => setN(e.target.value)}
          autoComplete="name"
          maxLength={60}
          required
          className="min-h-12 rounded-2xl border-2 border-line px-3.5 text-base font-semibold"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Phone number
        <input
          value={p}
          onChange={(e) => setP(e.target.value)}
          type="tel"
          autoComplete="tel"
          maxLength={25}
          placeholder="(555) 123-4567"
          className="min-h-12 rounded-2xl border-2 border-line px-3.5 text-base font-semibold"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-12 flex-1 rounded-full bg-grape text-[15px] font-extrabold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setN(name);
            setP(phone ?? "");
            setError(null);
          }}
          className="min-h-12 rounded-full px-5 text-[15px] font-bold text-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
