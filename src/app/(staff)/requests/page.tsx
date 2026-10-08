import { Bath, CalendarDays, CheckCheck, CircleCheck, Clock, Inbox, Moon, Phone, ShieldAlert, ShieldCheck, Stethoscope, Sun, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { confirmAllForPet, confirmBooking, confirmVetVisit } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { VetAvatar } from "@/components/VetAvatar";
import { getRequests, type RequestItem } from "@/db/queries";
import { GROOM_SERVICES, groomLabel } from "@/lib/availability";
import { daysBetween, formatLongDate, formatStamp, formatTime, nowStamp } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { VET_REASONS } from "@/lib/vet";
import { describeIssue } from "@/lib/vaccines";
import type { ReactNode } from "react";
import { DeclineButton } from "./DeclineButton";
import { VaccinesDueBanner } from "@/components/VaccinesDueBanner";

export const metadata: Metadata = { title: "Booking requests" };

const SERVICE = {
  boarding: { label: "Boarding", icon: Moon, tone: "bg-lilac-soft text-lilac-ink" },
  daycare: { label: "Daycare", icon: Sun, tone: "bg-sun-soft text-sun-ink" },
  grooming: { label: "Grooming", icon: Bath, tone: "bg-sky-soft text-sky-ink" },
  vet: { label: "Vet checkup", icon: Stethoscope, tone: "bg-mint-soft text-mint-ink" },
};

export default async function RequestsPage() {
  await requireRole("admin");
  const { items, groups, onHold, onHoldCount, confirmedToday } = await getRequests();
  const now = nowStamp();

  return (
    <>
      <AutoRefresh seconds={8} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-coral-soft text-coral-ink">
          <Inbox className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Booking requests</h1>
          <p className="font-semibold text-muted">New bookings from the customer app. Confirm them so the owner (and the doctor) can see it.</p>
        </div>
      </div>

      <VaccinesDueBanner />
      <section aria-label="Summary" className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <div className="rounded-[22px] bg-coral-soft px-5 py-4.5 text-coral-ink">
          <div className="font-display text-[34px] leading-none font-semibold">{items.length}</div>
          <div className="mt-1.5 text-sm font-extrabold">Waiting for you</div>
        </div>
        <Link href="/vaccines" className="rounded-[22px] bg-sun-soft px-5 py-4.5 text-sun-ink transition hover:-translate-y-0.5">
          <div className="font-display text-[34px] leading-none font-semibold">{onHoldCount}</div>
          <div className="mt-1.5 text-sm font-extrabold">On hold for vaccines →</div>
        </Link>
        <div className="rounded-[22px] bg-mint-soft px-5 py-4.5 text-mint-ink">
          <div className="font-display text-[34px] leading-none font-semibold">{confirmedToday}</div>
          <div className="mt-1.5 text-sm font-extrabold">Confirmed today</div>
        </div>
      </section>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <CircleCheck className="size-12 text-mint" aria-hidden="true" />
          <p className="font-display text-2xl font-semibold">All caught up!</p>
          <p className="font-semibold text-muted">New requests from the app appear here automatically.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,440px),1fr))] items-start gap-4">
          {groups.map((g, i) => (
            <PetRequestCard key={g.pet.id} group={g} latest={i === 0} now={now} />
          ))}
        </div>
      )}

      {onHold.length > 0 && (
        <section aria-labelledby="hold-h" className="mt-9">
          <h2 id="hold-h" className="font-display text-2xl font-semibold">
            On hold for vaccines <span className="text-muted">· {onHold.length}</span>
          </h2>
          <p className="mb-3.5 text-sm font-semibold text-muted">
            These requests came in, but a vaccine is expired or unreadable. They move up here as soon as the owner uploads a current record — or approve one yourself in Vaccine check.
          </p>
          <ul className="overflow-hidden rounded-[24px] bg-white shadow-card">
            {onHold.map((b) => (
              <li key={b.id} className="border-b border-sand last:border-0">
                <Link href="/vaccines" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition hover:bg-cream">
                  <PetPhoto src={b.pet.photo} alt="" className="size-11 shrink-0 rounded-2xl" sizes="44px" />
                  <span className="min-w-0 flex-[1_1_240px]">
                    <strong className="block capitalize">
                      {b.pet.name} · {b.service}
                    </strong>
                    <span className="text-sm font-semibold text-muted">
                      {b.pet.owner.name} · {formatLongDate(b.startDate)} · sent {formatStamp(b.createdAt)}
                    </span>
                  </span>
                  <Pill className={b.status === "locked" ? "bg-rose-soft text-rose-ink" : "bg-sun-soft text-sun-ink"}>
                    {b.status === "locked" ? b.issues.map((i) => describeIssue(i, b.pet.species)).join(", ") || "Vaccine expired" : "Record being checked"}
                  </Pill>
                  <span className="text-sm font-extrabold text-grape">Review →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Minutes between two "YYYY-MM-DDTHH:MM" stamps. */
function minutesBetween(from: string, to: string) {
  return (Date.parse(`${to}Z`) - Date.parse(`${from}Z`)) / 60000;
}

const NEW_WINDOW_MIN = 120;

/** One card per pet: every service the pet is waiting on, each with its own confirm/decline. */
function PetRequestCard({ group, latest, now }: { group: { pet: RequestItem["pet"]; items: RequestItem[]; newest: string }; latest: boolean; now: string }) {
  const { pet, items } = group;
  const isNew = minutesBetween(group.newest, now) <= NEW_WINDOW_MIN;
  const highlight = latest || isNew;

  return (
    <article
      className={`relative flex flex-col gap-4 overflow-hidden rounded-[24px] bg-white p-5 shadow-card ${highlight ? "ring-[3px] ring-coral" : ""}`}
    >
      {highlight && (
        <span className="absolute top-4 -right-9 w-32 rotate-45 bg-coral py-1 text-center text-xs font-extrabold tracking-[0.12em] text-ink shadow-sm">
          {isNew ? "NEW" : "LATEST"}
        </span>
      )}
      <div className="flex items-start gap-4 pr-10">
        <PetPhoto src={pet.photo} alt={pet.name} className="size-18 shrink-0 rounded-[22px]" sizes="72px" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl leading-tight font-semibold">{pet.name}</h2>
            {items.length > 1 && <Pill className="bg-grape text-white">{items.length} requests</Pill>}
          </div>
          <p className="text-sm font-semibold text-muted">
            {pet.breed} · {pet.sex === "f" ? "Female" : "Male"} · {pet.species === "cat" ? "Cat" : "Dog"}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm font-bold">
            {pet.owner.name}
            {pet.owner.phone && (
              <span className="inline-flex items-center gap-1 font-semibold text-muted">
                <Phone className="size-3.5" aria-hidden="true" /> {pet.owner.phone}
              </span>
            )}
          </p>
        </div>
      </div>

      {(pet.alert || pet.conditions.length > 0 || pet.meds) && (
        <div className="flex flex-wrap gap-1.5">
          {pet.alert && (
            <Pill className="bg-rose-soft text-rose-ink">
              <TriangleAlert className="size-3.5" aria-hidden="true" /> {pet.alert}
            </Pill>
          )}
          {pet.conditions.map((c) => (
            <Pill key={c} className="bg-rose-soft text-rose-ink">
              <ShieldAlert className="size-3.5" aria-hidden="true" /> {c}
            </Pill>
          ))}
          {pet.meds && <Pill className="bg-lilac-soft text-lilac-ink">Meds: {pet.meds}</Pill>}
        </div>
      )}

      {items.map((item) => (
        <RequestItemBlock key={item.id} item={item} isNew={minutesBetween(item.createdAt, now) <= NEW_WINDOW_MIN} />
      ))}

      {items.length > 1 && (
        <ActionButton
          action={confirmAllForPet.bind(null, pet.id)}
          pendingLabel="Confirming all…"
          className="min-h-12 w-full rounded-full bg-ink px-5 text-[15px] font-extrabold text-white hover:bg-grape"
        >
          <CheckCheck className="size-5" aria-hidden="true" /> Confirm all {items.length} for {pet.name}
        </ActionButton>
      )}
    </article>
  );
}

function RequestItemBlock({ item, isNew }: { item: RequestItem; isNew: boolean }) {
  const svc = SERVICE[item.kind === "vet" ? "vet" : item.service];
  const Icon = svc.icon;

  return (
    <section aria-label={svc.label} className="flex flex-col gap-3 rounded-[20px] border-2 border-line p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill className={svc.tone}>
          <Icon className="size-3.5" aria-hidden="true" /> {svc.label}
        </Pill>
        {isNew && <Pill className="bg-coral text-ink">New</Pill>}
        <span className="ml-auto text-xs font-bold text-faint">{formatStamp(item.createdAt)}</span>
      </div>
      <dl className="grid gap-2.5 rounded-2xl bg-cream p-4 text-sm">
        {item.kind === "booking" ? (
          <>
            <Row icon={CalendarDays} label="Dates">
              {formatLongDate(item.startDate)}
              {item.endDate !== item.startDate && ` → ${formatLongDate(item.endDate)} (${daysBetween(item.startDate, item.endDate)} nights)`}
            </Row>
            <Row icon={Clock} label="Times">
              {item.service === "grooming" ? "Appointment" : "Drop-off"} {item.dropoffTime ? formatTime(item.dropoffTime) : "—"}
              {item.pickupTime && ` · ${item.service === "grooming" ? "ready about" : "pickup"} ${formatTime(item.pickupTime)}`}
            </Row>
            {item.service === "grooming" && (
              <Row icon={Bath} label="Services">
                {item.groomServices.length === GROOM_SERVICES.length ? "Full groom (all services)" : item.groomServices.map(groomLabel).join(", ")}
              </Row>
            )}
            <Row icon={ShieldCheck} label="Vaccines">
              <span className="text-mint-ink">All current ✓</span>
            </Row>
          </>
        ) : (
          <>
            {item.vet && (
              <div className="flex items-center gap-2.5">
                <VetAvatar name={item.vet.name} color={item.vet.color} size="size-9" text="text-xs" />
                <span>
                  <strong>{item.vet.name}</strong>
                  <span className="block text-xs font-semibold text-muted">{item.vet.specialty}</span>
                </span>
              </div>
            )}
            <Row icon={CalendarDays} label="When">
              {formatLongDate(item.date)} · {formatTime(item.time)}
            </Row>
            <Row icon={Stethoscope} label="Reason">
              {VET_REASONS[item.reason].label}
            </Row>
          </>
        )}
      </dl>

      {(item.kind === "booking" ? item.notes : item.symptoms) && (
        <p className="rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm font-semibold">
          &ldquo;{item.kind === "booking" ? item.notes : item.symptoms}&rdquo;
        </p>
      )}

      <div className="flex flex-wrap items-start gap-2.5">
        <div className="flex-1">
          <ActionButton
            action={item.kind === "booking" ? confirmBooking.bind(null, item.id) : confirmVetVisit.bind(null, item.id)}
            pendingLabel="Confirming…"
            className="min-h-12 w-full rounded-full bg-mint px-5 text-[15px] font-extrabold text-white hover:brightness-95"
          >
            <CircleCheck className="size-5" aria-hidden="true" /> Confirm
          </ActionButton>
        </div>
        <DeclineButton kind={item.kind} id={item.id} />
      </div>
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-grape" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="font-bold">{children}</dd>
    </div>
  );
}
