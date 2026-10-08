"use client";

import { BadgePercent, Pencil, Plus, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { sendDoctorPayout, setDoctorActive, setDoctorFee } from "@/app/actions";
import { Pill } from "@/components/ui";
import { VetAvatar } from "@/components/VetAvatar";
import type { Payout, Vet } from "@/db/schema";
import { formatStamp } from "@/lib/dates";
import { formatMoney } from "@/lib/pricing";
import { workDaysLabel } from "@/lib/vet";
import { DoctorForm, EMPTY_DOCTOR, type DoctorDraft } from "./DoctorForm";

type Doctor = Vet & { phone: string | null; email: string | null; upcoming: number; completed: number };
type Money = { monthNet: number; monthFee: number; monthCount: number; outstanding: number; lastPayout: Payout | null };

/** The platform fee the clinic keeps from every vet visit. */
export function FeeEditor({ current }: { current: number }) {
  const [value, setValue] = useState(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mb-6 flex flex-wrap items-center gap-3 rounded-[22px] bg-white p-5 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await setDoctorFee(value);
          setMsg(r.ok ? { ok: true, text: "Saved — applies to visits not yet paid out." } : { ok: false, text: r.error });
        });
      }}
    >
      <BadgePercent className="size-6 text-mint-ink" aria-hidden="true" />
      <label htmlFor="doctor-fee" className="font-extrabold">
        Platform fee kept by the clinic
      </label>
      <span className="flex items-center rounded-xl border-2 border-line px-2.5">
        <input
          id="doctor-fee"
          type="number"
          min={0}
          max={80}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="h-10 w-14 bg-transparent text-right font-extrabold outline-none"
        />
        <span className="font-bold text-muted">%</span>
      </span>
      <span className="text-sm font-semibold text-muted">Doctors earn the other {100 - value}% of each paid checkup.</span>
      <button type="submit" disabled={pending || value === current} className="ml-auto min-h-11 rounded-full bg-ink px-5 text-sm font-extrabold text-white disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`w-full text-sm font-bold ${msg.ok ? "text-mint-ink" : "text-rose-ink"}`}>
          {msg.text}
        </p>
      )}
    </form>
  );
}

const toDraft = (v: Doctor): DoctorDraft => ({
  id: v.id,
  name: v.name,
  title: v.title,
  specialty: v.specialty,
  experienceYears: v.experienceYears,
  education: v.education,
  languages: v.languages.join(", "),
  focus: v.focus.join(", "),
  bio: v.bio,
  workDays: v.workDays,
  color: v.color,
  phone: v.phone ?? "",
  email: v.email ?? "",
});

export function DoctorsBoard({ doctors, money }: { doctors: Doctor[]; money: Record<string, Money> }) {
  const [editing, setEditing] = useState<DoctorDraft | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {editing ? (
        <section aria-label={editing.id ? "Edit doctor" : "Add a doctor"} className="rounded-[24px] bg-white p-6 shadow-card">
          <h2 className="mb-4 font-display text-2xl font-semibold">{editing.id ? `Edit ${editing.name}` : "Add a doctor"}</h2>
          <DoctorForm initial={editing} onDone={() => setEditing(null)} />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(EMPTY_DOCTOR)}
          className="inline-flex min-h-12 items-center gap-2 self-start rounded-full bg-grape px-5 font-extrabold text-white hover:bg-grape-dark"
        >
          <Plus className="size-5" aria-hidden="true" /> Add a doctor
        </button>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))] gap-4">
        {doctors.map((v) => (
          <DoctorCard key={v.id} doctor={v} money={money[v.id]} onEdit={() => setEditing(toDraft(v))} />
        ))}
      </ul>
    </div>
  );
}

function DoctorCard({ doctor: v, money, onEdit }: { doctor: Doctor; money?: Money; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [paying, startPaying] = useTransition();
  const [paid, setPaid] = useState<string | null>(null);
  return (
    <li className={`flex flex-col gap-3 rounded-[24px] bg-white p-5 shadow-card ${v.active ? "" : "opacity-70"}`}>
      <div className="flex items-start gap-3.5">
        <VetAvatar name={v.name} color={v.color} size="size-14" text="text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-display text-xl font-semibold">{v.name}</strong>
            {v.active ? <Pill className="bg-mint-soft text-mint-ink">Taking bookings</Pill> : <Pill className="bg-sand text-muted">Turned off</Pill>}
          </div>
          <p className="text-sm font-semibold text-muted">
            {v.specialty} · {v.experienceYears} yrs
          </p>
          <p className="text-sm font-semibold text-muted">{workDaysLabel(v.workDays)}</p>
          {v.email && <p className="text-xs font-bold text-faint">Sign-in: {v.email}</p>}
        </div>
      </div>
      <p className="text-sm font-bold">
        {v.upcoming} upcoming · {v.completed} checkups done
      </p>
      {money && (
        <div className="rounded-2xl bg-cream p-3.5">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs font-extrabold tracking-[0.05em] text-muted uppercase">Earned this month</dt>
              <dd className="font-display text-xl font-semibold tabular-nums">{formatMoney(money.monthNet)}</dd>
              <dd className="text-xs font-bold text-muted">
                {money.monthCount} paid checkup{money.monthCount === 1 ? "" : "s"} · clinic fee {formatMoney(money.monthFee)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-extrabold tracking-[0.05em] text-muted uppercase">Owed now</dt>
              <dd className="font-display text-xl font-semibold tabular-nums">{formatMoney(money.outstanding)}</dd>
              <dd className="text-xs font-bold text-muted">
                {money.lastPayout ? `Last payout ${formatMoney(money.lastPayout.netCents)}, ${formatStamp(money.lastPayout.createdAt)}` : "No payouts yet"}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={paying || money.outstanding === 0}
            onClick={() =>
              startPaying(async () => {
                setError(null);
                const r = await sendDoctorPayout(v.id);
                if (r.ok) setPaid(`Sent! ${formatMoney(r.netCents)} credited — ${v.name.replace(/^Dr\. /, "")} has been notified.`);
                else setError(r.error);
              })
            }
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-mint text-sm font-extrabold text-white disabled:bg-[#a9d9c4]"
          >
            <Send className="size-4" aria-hidden="true" />
            {paying ? "Sending…" : money.outstanding ? `Send payout summary & credit ${formatMoney(money.outstanding)}` : "Nothing owed right now"}
          </button>
          {paid && (
            <p role="status" className="mt-2 text-sm font-bold text-mint-ink">
              {paid}
            </p>
          )}
          <p className="mt-2 text-xs font-semibold text-muted">Unpaid balances are also sent automatically when the month ends.</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="mt-auto flex gap-2">
        <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink px-4 text-sm font-extrabold hover:bg-ink hover:text-white">
          <Pencil className="size-4" aria-hidden="true" /> Edit
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await setDoctorActive(v.id, !v.active);
              if (!r.ok) setError(r.error);
            })
          }
          className={`min-h-11 rounded-full px-4 text-sm font-extrabold disabled:opacity-60 ${v.active ? "text-rose-ink hover:bg-rose-soft" : "bg-mint text-white"}`}
        >
          {pending ? "Saving…" : v.active ? "Turn off" : "Turn back on"}
        </button>
      </div>
    </li>
  );
}
