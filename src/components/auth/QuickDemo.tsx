"use client";

import { ChevronDown, LayoutGrid, LoaderCircle, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { useState, useTransition } from "react";
import { loginAs, loginAsVet } from "@/app/actions";
import { PawIcon } from "@/components/ui";
import type { Role } from "@/db/schema";

type Doctor = { id: string; name: string; specialty: string };

const ROLES: { role: Exclude<Role, "vet">; title: string; who: string; email: string; icon: React.ReactNode; tone: string }[] = [
  { role: "parent", title: "Pet parent", who: "Emily Carter · Bella & Biscuit", email: "emily@pawsitive.demo", icon: <PawIcon className="size-5" />, tone: "bg-lilac text-white" },
  { role: "staff", title: "Staff", who: "Anna Reed · Lead groomer", email: "anna@pawsitive.demo", icon: <LayoutGrid className="size-5" aria-hidden="true" />, tone: "bg-coral text-ink" },
  { role: "admin", title: "Admin", who: "Jo Morgan · Owner", email: "jo@pawsitive.demo", icon: <ShieldCheck className="size-5" aria-hidden="true" />, tone: "bg-sky text-white" },
];

/**
 * The "try every role" panel on each sign-in screen. Hidden behind a toggle so
 * the real sign-in form stays the focus. `first` puts this screen's role on top.
 */
export function QuickDemo({ doctors, first, dark = false, defaultOpen = false }: { doctors: Doctor[]; first?: Role; dark?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [doctor, setDoctor] = useState(doctors[0]?.id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const ordered = [...ROLES].sort((a, b) => Number(b.role === first) - Number(a.role === first));
  const vetFirst = first === "vet";

  const go = (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    startTransition(async () => {
      await fn();
    });
  };

  const card = dark ? "bg-white/8 text-white hover:bg-white/14" : "bg-white text-ink shadow-card hover:-translate-y-0.5";
  const sub = dark ? "text-[#b9bcd6]" : "text-muted";

  const doctorBlock = doctors.length > 0 && (
    <div className={`flex flex-col gap-2.5 rounded-[18px] p-3 ${card}`}>
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-white">
          <Stethoscope className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <strong className="block leading-tight">Doctor</strong>
          <span className={`text-xs font-semibold ${sub}`}>Choose which vet to sign in as</span>
        </span>
      </div>
      <div className="flex gap-2">
        <label htmlFor="demo-doctor" className="sr-only">
          Doctor
        </label>
        <select
          id="demo-doctor"
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-2.5 text-sm font-bold text-ink"
        >
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.specialty}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => go("vet", () => loginAsVet(doctor))}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-mint px-4 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busy === "vet" && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Go
        </button>
      </div>
    </div>
  );

  return (
    <section aria-label="Quick demo login" className={`rounded-[22px] ${dark ? "bg-white/6" : "bg-sand/70"} p-1.5`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex min-h-12 w-full items-center gap-2.5 rounded-[18px] px-3.5 text-left font-extrabold ${dark ? "text-white" : "text-ink"}`}
      >
        <Sparkles className="size-5 text-coral" aria-hidden="true" />
        <span className="flex-1">
          {open ? "Hide" : "Show"} quick demo login
          <span className={`block text-xs font-semibold ${sub}`}>One tap into any role — for trying the demo</span>
        </span>
        <ChevronDown className={`size-5 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="animate-pop flex flex-col gap-2 p-1.5 pt-1">
          {vetFirst && doctorBlock}
          {ordered.map((r) => (
            <button
              key={r.role}
              type="button"
              disabled={!!busy}
              onClick={() => go(r.role, () => loginAs(r.role))}
              className={`flex min-h-14 items-center gap-3 rounded-[18px] p-3 text-left transition disabled:opacity-60 ${card}`}
            >
              <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${r.tone}`}>{r.icon}</span>
              <span className="min-w-0 flex-1">
                <strong className="block leading-tight">{r.title}</strong>
                <span className={`block truncate text-xs font-semibold ${sub}`}>{r.who}</span>
              </span>
              {busy === r.role ? <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" /> : <span className={`text-xs font-bold ${sub}`}>Sign in →</span>}
            </button>
          ))}
          {!vetFirst && doctorBlock}
          <p className={`px-2 pt-1 text-xs leading-relaxed font-semibold ${sub}`}>
            Or type any demo account, e.g. <strong className={dark ? "text-white" : "text-ink"}>{ordered[0].email}</strong> with password{" "}
            <strong className={dark ? "text-white" : "text-ink"}>demo1234</strong>.
          </p>
        </div>
      )}
    </section>
  );
}
