"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { changePassword } from "@/app/actions";

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const field =
    "min-h-12 w-full rounded-2xl border-2 border-line bg-white px-3.5 text-base font-semibold outline-none focus:border-grape";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMsg(null);
        }}
        className="flex min-h-15 w-full items-center gap-3.5 px-4 text-left font-bold transition active:bg-sand"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-sky-soft text-sky-ink">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1">
          Change password
          {msg?.ok && (
            <span className="block text-sm font-bold text-mint-ink">
              {msg.text}
            </span>
          )}
        </span>
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await changePassword(f.current, f.next, f.confirm);
          if (r.ok) {
            setOpen(false);
            setF({ current: "", next: "", confirm: "" });
            setMsg({ ok: true, text: "Password changed ✓" });
          } else setMsg({ ok: false, text: r.error });
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Current password
        <input
          type="password"
          className={field}
          value={f.current}
          onChange={(e) => setF({ ...f, current: e.target.value })}
          autoComplete="current-password"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        New password
        <input
          type="password"
          className={field}
          value={f.next}
          onChange={(e) => setF({ ...f, next: e.target.value })}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Confirm new password
        <input
          type="password"
          className={field}
          value={f.confirm}
          onChange={(e) => setF({ ...f, confirm: e.target.value })}
          autoComplete="new-password"
          required
        />
      </label>
      {msg && !msg.ok && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {msg.text}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-grape font-extrabold text-white disabled:opacity-60"
        >
          {pending && (
            <LoaderCircle
              className="size-4.5 animate-spin"
              aria-hidden="true"
            />
          )}{" "}
          Save password
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-12 rounded-full px-5 font-bold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
