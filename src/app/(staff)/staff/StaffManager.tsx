"use client";

import { LoaderCircle, Trash2, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { addStaff, removeStaff, type StaffInput } from "@/app/actions";
import { Initials, Pill } from "@/components/ui";

type Member = { id: string; name: string; role: "staff" | "admin"; title: string | null; email: string | null; phone: string | null };

const EMPTY: StaffInput = { name: "", title: "", email: "", phone: "", password: "", role: "staff" };

export function StaffManager({ members, meId }: { members: Member[]; meId: string }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = "min-h-11 w-full rounded-xl border-2 border-line bg-white px-3 font-semibold outline-none focus:border-grape";
  const label = "flex flex-col gap-1 text-sm font-extrabold";

  return (
    <div className="flex flex-col gap-5">
      {adding ? (
        <form
          className="flex flex-col gap-4 rounded-[24px] bg-white p-6 shadow-card"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              setError(null);
              const r = await addStaff(f);
              if (r.ok) {
                setAdding(false);
                setF(EMPTY);
              } else setError(r.error);
            });
          }}
        >
          <h2 className="font-display text-2xl font-semibold">Add a team member</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <label className={label}>
              Full name
              <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} />
            </label>
            <label className={label}>
              Job title
              <input className={input} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={40} placeholder="Groomer, Front desk…" />
            </label>
            <label className={label}>
              Sign-in email
              <input className={input} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            </label>
            <label className={label}>
              Starting password
              <input className={input} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required placeholder="8+ characters with a number" />
            </label>
            <label className={label}>
              Phone (optional)
              <input className={input} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={25} />
            </label>
            <fieldset className={label}>
              <legend className="mb-1">Access</legend>
              <div className="flex gap-2">
                {(["staff", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={f.role === r}
                    onClick={() => setF({ ...f, role: r })}
                    className={`min-h-11 flex-1 rounded-full border-2 px-3 font-extrabold ${f.role === r ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
                  >
                    {r === "staff" ? "Staff" : "Admin"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <p className="text-xs font-semibold text-muted">
            Staff run the floor, invoices and care. Admins also see revenue and manage prices, doctors, staff and settings.
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-soft px-3.5 py-2.5 text-sm font-bold text-rose-ink">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-grape px-6 font-extrabold text-white disabled:opacity-60">
              {pending && <LoaderCircle className="size-4.5 animate-spin" aria-hidden="true" />} Add team member
            </button>
            <button type="button" onClick={() => setAdding(false)} className="min-h-12 rounded-full px-5 font-bold hover:bg-sand">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-12 items-center gap-2 self-start rounded-full bg-grape px-5 font-extrabold text-white hover:bg-grape-dark">
          <UserPlus className="size-5" aria-hidden="true" /> Add a team member
        </button>
      )}

      <ul className="overflow-hidden rounded-[24px] bg-white shadow-card">
        {members.map((m) => (
          <MemberRow key={m.id} m={m} isMe={m.id === meId} />
        ))}
      </ul>
    </div>
  );
}

function MemberRow({ m, isMe }: { m: Member; isMe: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-sand px-5 py-4 last:border-0">
      <Initials name={m.name} className={m.role === "admin" ? "bg-mint-soft text-ink" : "bg-sun text-ink"} />
      <span className="min-w-0 flex-[1_1_220px]">
        <strong className="block">
          {m.name} {isMe && <span className="text-sm font-bold text-muted">(you)</span>}
        </strong>
        <span className="block text-sm font-semibold text-muted">
          {m.title ?? "Team member"}
          {m.email ? ` · ${m.email}` : ""}
          {m.phone ? ` · ${m.phone}` : ""}
        </span>
      </span>
      <Pill className={m.role === "admin" ? "bg-ink text-white" : "bg-coral-soft text-coral-ink"}>{m.role === "admin" ? "Admin" : "Staff"}</Pill>
      {!isMe &&
        (confirming ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await removeStaff(m.id);
                  if (!r.ok) setError(r.error);
                })
              }
              className="min-h-10 rounded-full bg-rose px-4 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {pending ? "Removing…" : `Remove ${m.name.split(" ")[0]}`}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="min-h-10 rounded-full px-3 text-sm font-bold hover:bg-sand">
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold text-rose-ink hover:bg-rose-soft">
            <Trash2 className="size-4" aria-hidden="true" /> Remove
          </button>
        ))}
      {error && (
        <p role="alert" className="w-full text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
    </li>
  );
}
