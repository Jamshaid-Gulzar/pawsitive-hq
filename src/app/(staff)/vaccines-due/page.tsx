import { BellRing, CalendarClock, CircleCheck, MessageCircle, Phone, Syringe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { remindVaccineDue } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { getVaccinesDue, type DueVaccine } from "@/db/queries";
import { formatLongDate, formatStamp } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { DUE_TONE, dueText } from "@/lib/vaccines";

export const metadata: Metadata = { title: "Vaccines due" };

const GROUPS = [
  { stages: ["expired", "missing"], title: "Expired or missing", blurb: "Bookings for these pets are put on hold until a new record arrives." },
  { stages: ["due_7"], title: "Due this week", blurb: "Renew now so upcoming visits aren't held." },
  { stages: ["due_30"], title: "Due in the next 30 days", blurb: "Owners have been reminded automatically." },
] as const;

export default async function VaccinesDuePage() {
  await requireRole("staff", "admin");
  const due = await getVaccinesDue();
  const pets = new Set(due.map((d) => d.pet.id)).size;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-sky-soft text-sky-ink">
          <Syringe className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Vaccines due</h1>
          <p className="font-semibold text-muted">
            {pets} pet{pets === 1 ? "" : "s"} need a vaccine soon. Owners get an automatic reminder 30 days before, in the last week, and when it expires.
          </p>
        </div>
      </div>

      {due.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CircleCheck className="size-12 text-mint" aria-hidden="true" />
          <p className="font-display text-2xl font-semibold">Every pet is up to date!</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {GROUPS.map((g) => {
            const items = due.filter((d) => (g.stages as readonly string[]).includes(d.stage));
            if (items.length === 0) return null;
            return (
              <section key={g.title} aria-labelledby={`g-${g.stages[0]}`}>
                <h2 id={`g-${g.stages[0]}`} className="font-display text-2xl font-semibold">
                  {g.title} <span className="text-muted">· {items.length}</span>
                </h2>
                <p className="mb-3.5 text-sm font-semibold text-muted">{g.blurb}</p>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,400px),1fr))] gap-3.5">
                  {items.map((v) => (
                    <DueCard key={`${v.pet.id}-${v.key}`} v={v} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function DueCard({ v }: { v: DueVaccine }) {
  const { pet } = v;
  return (
    <li className="flex flex-col gap-3.5 rounded-[24px] bg-white p-5 shadow-card">
      <div className="flex items-start gap-3.5">
        <PetPhoto src={pet.photo} alt={pet.name} className="size-14 shrink-0 rounded-[18px]" sizes="56px" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-display text-xl font-semibold">{pet.name}</strong>
            <Pill className={DUE_TONE[v.stage]}>
              {v.label} · {dueText(v)}
            </Pill>
          </div>
          <p className="text-sm font-bold">
            {pet.owner.name}
            {pet.owner.phone && (
              <span className="ml-2 inline-flex items-center gap-1 font-semibold text-muted">
                <Phone className="size-3.5" aria-hidden="true" /> {pet.owner.phone}
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm font-semibold text-muted">
        <CalendarClock className="size-4 text-grape" aria-hidden="true" />
        {v.date ? `${v.stage === "expired" ? "Expired" : "Expires"} ${formatLongDate(v.date)}` : "No date on file"}
      </p>
      <p className={`flex items-center gap-2 text-sm font-bold ${v.reminderSentAt ? "text-mint-ink" : "text-sun-ink"}`}>
        <BellRing className="size-4" aria-hidden="true" />
        {v.reminderSentAt ? `Owner reminded ${formatStamp(v.reminderSentAt)}` : "Owner not reminded yet"}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <div className="flex-1">
          <ActionButton
            action={remindVaccineDue.bind(null, pet.id, v.key)}
            pendingLabel="Sending…"
            className="min-h-11 w-full rounded-full bg-grape px-4 text-sm font-extrabold text-white hover:bg-grape-dark"
          >
            <BellRing className="size-4.5" aria-hidden="true" /> Remind {pet.owner.name.split(" ")[0]} now
          </ActionButton>
        </div>
        <Link
          href={`/messages?pet=${pet.id}&c=vet`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink px-4 text-sm font-extrabold transition hover:bg-ink hover:text-white"
        >
          <MessageCircle className="size-4.5" aria-hidden="true" /> Chat
        </Link>
      </div>
    </li>
  );
}
