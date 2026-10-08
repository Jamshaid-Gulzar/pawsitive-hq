"use client";

import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { registerCustomer } from "@/app/actions";

const RULES = [
  { test: (p: string) => p.length >= 8, label: "8+ characters" },
  { test: (p: string) => /[a-zA-Z]/.test(p), label: "a letter" },
  { test: (p: string) => /\d/.test(p), label: "a number" },
];

/** New pet parent account. Signs them in and opens the app. */
export function RegisterForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const field = "min-h-13 w-full rounded-2xl border-2 border-line bg-white px-4 text-base font-semibold outline-none transition focus:border-grape";
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await registerCustomer(form);
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Full name
        <input value={form.name} onChange={set("name")} autoComplete="name" required maxLength={60} placeholder="Emily Carter" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Email
        <input type="email" value={form.email} onChange={set("email")} autoComplete="email" required placeholder="you@example.com" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        <span>
          Phone <span className="font-semibold text-muted">(optional — for pickup calls)</span>
        </span>
        <input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" maxLength={25} placeholder="(555) 123-4567" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Password
        <span className="relative">
          <input
            type={show ? "text" : "password"}
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            required
            className={`${field} pr-13`}
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted"
          >
            {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </span>
      </label>
      <ul className="-mt-2 flex flex-wrap gap-1.5" aria-label="Password rules">
        {RULES.map((r) => {
          const ok = r.test(form.password);
          return (
            <li key={r.label} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${ok ? "bg-mint-soft text-mint-ink" : "bg-sand text-muted"}`}>
              {ok && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
              {r.label}
            </li>
          );
        })}
      </ul>
      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        Confirm password
        <input
          type={show ? "text" : "password"}
          value={form.confirm}
          onChange={set("confirm")}
          autoComplete="new-password"
          required
          aria-invalid={mismatch}
          className={`${field} ${mismatch ? "border-rose" : ""}`}
        />
        {mismatch && <span className="text-xs font-bold text-rose-ink">Passwords don&apos;t match yet</span>}
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-soft px-3.5 py-2.5 text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-coral text-base font-extrabold text-ink shadow-float transition hover:brightness-105 disabled:opacity-70"
      >
        {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
        {pending ? "Creating your account…" : "Create my account"}
      </button>
    </form>
  );
}
