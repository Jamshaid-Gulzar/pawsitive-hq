"use client";

import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { useState, useTransition } from "react";
import { signInWithPassword, type Portal } from "@/app/actions";

/** Email + password sign-in for one portal (pet parents, team, or admin). */
export function SignInForm({ portal, button = "Sign in", dark = false, accent = "bg-grape" }: { portal: Portal; button?: string; dark?: boolean; accent?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const field = `min-h-13 w-full rounded-2xl border-2 px-4 text-base font-semibold outline-none transition ${
    dark ? "border-white/15 bg-white/8 text-white placeholder:text-[#8f93b5] focus:border-coral" : "border-line bg-white text-ink focus:border-grape"
  }`;
  const label = `flex flex-col gap-1.5 text-sm font-extrabold ${dark ? "text-[#d5d7ea]" : ""}`;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await signInWithPassword(portal, email, password);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <label className={label}>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" className={field} />
      </label>
      <label className={label}>
        Password
        <span className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={`${field} pr-13`}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className={`absolute top-1/2 right-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl ${dark ? "text-[#b9bcd6]" : "text-muted"}`}
          >
            {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </span>
      </label>
      {error && (
        <p role="alert" className={`rounded-xl px-3.5 py-2.5 text-sm font-bold ${dark ? "bg-rose/20 text-[#ffc9c9]" : "bg-rose-soft text-rose-ink"}`}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex min-h-13 items-center justify-center gap-2 rounded-full text-base font-extrabold text-white transition hover:brightness-110 disabled:opacity-70 ${accent}`}
      >
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <LogIn className="size-5" aria-hidden="true" />}
        {pending ? "Signing in…" : button}
      </button>
    </form>
  );
}
