"use client";

import { Bath, Check, ChevronLeft, Clock, LoaderCircle, Lock, Moon, Plus, ShieldCheck, Sparkles, Stethoscope, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { createBooking } from "@/app/actions";
import { MonthCalendar } from "@/components/MonthCalendar";
import { RecordScanner, type ScannedRecord } from "@/components/RecordScanner";
import { TimeSlots } from "@/components/TimeSlots";
import { PetPhoto } from "@/components/ui";
import { VaccineCards } from "@/components/VaccineCards";
import {
  GROOM_SERVICES,
  SCHEDULE,
  dayState,
  groomLabel,
  groomPickup,
  kennelsFree,
  slotState,
  type AvailabilityData,
} from "@/lib/availability";
import { daysBetween, formatLongDate, formatShortDate, formatTime } from "@/lib/dates";
import { describeIssue, evaluateCompliance, type Service, type Species, type VaccineDates } from "@/lib/vaccines";
import { PaymentChoice, type PayChoice } from "@/components/PaymentChoice";
import { formatMoney, quoteBooking, type PriceMap } from "@/lib/pricing";

type WizardPet = { id: string; name: string; species: Species; breed: string; sex: "f" | "m"; photo: string | null; onFile: VaccineDates };

const SERVICES: { id: Service; title: string; blurb: string; icon: ReactNode; tone: string }[] = [
  { id: "boarding", title: "Boarding", blurb: "Overnight stays with walks, playtime and photo updates.", icon: <Moon className="size-6" aria-hidden="true" />, tone: "bg-lilac-soft text-lilac-ink" },
  { id: "daycare", title: "Daycare", blurb: "A fun day of play, home by evening. Mon – Sat.", icon: <Sun className="size-6" aria-hidden="true" />, tone: "bg-sun-soft text-sun-ink" },
  { id: "grooming", title: "Grooming", blurb: "Pick the services you want, or the full groom. Mon – Sat.", icon: <Bath className="size-6" aria-hidden="true" />, tone: "bg-sky-soft text-sky-ink" },
];

const STEPS = ["Pet & service", "Date & time", "Vaccines", "Review"];

export function BookingWizard({
  pets,
  ownerName,
  today,
  nowTime,
  availability,
  initialPetId,
  initialService,
  prices,
  discount,
}: {
  pets: WizardPet[];
  ownerName: string;
  today: string;
  nowTime: string;
  availability: AvailabilityData;
  initialPetId?: string;
  initialService?: Service;
  prices: PriceMap;
  discount: number;
}) {
  const [payWith, setPayWith] = useState<PayChoice>("online");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [petId, setPetId] = useState(pets.some((p) => p.id === initialPetId) ? initialPetId! : pets[0]?.id);
  const [service, setService] = useState<Service>(initialService ?? "boarding");
  const [groom, setGroom] = useState<string[]>(GROOM_SERVICES.map((g) => g.id));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [dropoff, setDropoff] = useState<string | null>(null);
  const [pickup, setPickup] = useState<string | null>(null);
  const [source, setSource] = useState<"file" | "upload">("file");
  const [scanned, setScanned] = useState<ScannedRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pet = pets.find((p) => p.id === petId);
  if (!pet) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="font-display text-2xl font-semibold">Add your first pet</p>
        <p className="font-semibold text-muted">Register your pet to book a visit.</p>
        <Link href="/my/pets/new" className="inline-flex min-h-13 items-center gap-2 rounded-full bg-grape px-7 font-extrabold text-white">
          <Plus className="size-5" aria-hidden="true" /> Add a pet
        </Link>
      </div>
    );
  }

  const schedule = SCHEDULE[service];
  const boarding = service === "boarding";
  const endDate = boarding ? end : start;
  const nights = start && end ? daysBetween(start, end) : 0;
  const fullGroom = groom.length === GROOM_SERVICES.length;
  const vaccineDates = source === "upload" ? scanned?.dates ?? null : pet.onFile;
  const result = vaccineDates && endDate ? evaluateCompliance(vaccineDates, pet.species, service, endDate, today) : null;
  const slots = start ? schedule.slots.map((time) => ({ time, state: slotState(service, start, time, availability, today, nowTime) })) : [];

  function resetSchedule() {
    setStart(null);
    setEnd(null);
    setDropoff(null);
    setPickup(null);
  }

  // What's still missing on this step, shown on the button instead of failing silently.
  const missing =
    step === 1
      ? service === "grooming" && groom.length === 0
        ? "Choose at least one grooming service"
        : null
      : step === 2
        ? !start
          ? boarding
            ? "Tap your drop-off date"
            : "Choose a date"
          : boarding && !end
            ? "Now tap your pickup date"
            : !dropoff
              ? service === "grooming"
                ? "Choose an appointment time"
                : "Choose a drop-off time"
              : service !== "grooming" && !pickup
                ? "Choose a pickup time"
                : null
        : step === 3
          ? !result
            ? "Add a vaccine record to continue"
            : null
          : null;

  const nextLabel = ["", "Next: date & time", "Next: vaccine check", "Next: review", ""][step];

  function go(next: number) {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    if (!start || !endDate || !dropoff) return;
    startTransition(async () => {
      setError(null);
      const r = await createBooking({
        petId: pet!.id,
        service,
        startDate: start,
        endDate,
        dropoffTime: dropoff,
        pickupTime: service === "grooming" ? null : pickup,
        groomServices: service === "grooming" ? groom : [],
        notes,
        record: source === "upload" ? scanned : null,
      });
      if (!r.ok) setError(r.error);
      else if (payWith === "online" && r.invoiceId) router.push(`/my/pay/${r.invoiceId}?new=1`);
      else router.push(`/my/bookings/${r.id}?new=1`);
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-32">
      <div className="flex items-center gap-2">
        {step > 1 && (
          <button type="button" onClick={() => go(step - 1)} aria-label="Back" className="-ml-2 inline-flex size-11 items-center justify-center rounded-full active:bg-sand">
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
        )}
        <h1 className="font-display text-[30px] leading-tight font-semibold">{step === 1 ? "Book a visit" : STEPS[step - 1]}</h1>
      </div>

      <div>
        <div className="mb-1.5 text-xs font-extrabold text-muted">
          Step {step} of {STEPS.length} · {STEPS[step - 1]}
        </div>
        <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full ${i < step ? "bg-grape" : "bg-sand"}`} />
          ))}
        </div>
      </div>

      {step > 1 && (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
          <PetPhoto src={pet.photo} alt="" className="size-12 rounded-xl" sizes="48px" />
          <p className="min-w-0 text-sm font-bold">
            {pet.name} · <span className="capitalize">{service}</span>
            {start && (
              <>
                {" "}
                · {formatShortDate(start)}
                {boarding && end ? ` – ${formatShortDate(end)}` : ""}
                {dropoff ? ` · ${formatTime(dropoff)}` : ""}
              </>
            )}
          </p>
        </div>
      )}

      {/* ── Step 1: pet & service ── */}
      {step === 1 && (
        <div className="flex flex-col gap-7">
          <fieldset>
            <legend className="mb-3 font-display text-[22px] font-semibold">Who&apos;s coming?</legend>
            {/* relative: keeps each card's visually hidden radio inside this scroller. */}
            <div className="relative -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {pets.map((p) => {
                const selected = p.id === petId;
                return (
                  <label
                    key={p.id}
                    className={`relative flex shrink-0 cursor-pointer snap-start items-center gap-3 rounded-[20px] border-2 bg-white p-2.5 pr-5 transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-grape ${
                      selected ? "border-coral bg-coral-soft" : "border-line"
                    }`}
                  >
                    <input type="radio" name="pet" className="sr-only" checked={selected} onChange={() => setPetId(p.id)} />
                    <PetPhoto src={p.photo} alt="" className="size-14 rounded-2xl" sizes="56px" />
                    <span>
                      <strong className="block font-display text-lg font-semibold">{p.name}</strong>
                      <span className="text-sm font-semibold text-muted">{p.breed}</span>
                    </span>
                    {selected && <Check className="size-5 text-coral-ink" strokeWidth={3} aria-hidden="true" />}
                  </label>
                );
              })}
              <Link href="/my/pets/new" className="flex shrink-0 snap-start items-center gap-2 rounded-[20px] border-2 border-dashed border-grape/40 px-5 font-extrabold text-grape">
                <Plus className="size-5" aria-hidden="true" /> Add pet
              </Link>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 font-display text-[22px] font-semibold">What does {pet.name} need?</legend>
            <div className="grid grid-cols-2 gap-2.5">
              {SERVICES.map((s) => {
                const selected = s.id === service;
                return (
                  <label
                    key={s.id}
                    className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-[20px] border-2 bg-white px-2 py-4 text-center transition has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-grape ${
                      selected ? "border-grape bg-grape-soft" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="service"
                      className="sr-only"
                      checked={selected}
                      onChange={() => {
                        setService(s.id);
                        resetSchedule();
                      }}
                    />
                    <span className={`inline-flex size-11 items-center justify-center rounded-[14px] ${s.tone}`}>{s.icon}</span>
                    <strong className="font-display text-base font-semibold">{s.title}</strong>
                    <span className="-mt-1.5 text-xs font-bold text-muted">
                      {s.id === "boarding"
                        ? `${formatMoney(prices.boarding_night ?? 0)} / night`
                        : s.id === "daycare"
                          ? `${formatMoney(prices.daycare_day ?? 0)} / day`
                          : `from ${formatMoney(Math.min(...GROOM_SERVICES.map((g) => prices[`groom_${g.id}`] ?? 0)))}`}
                    </span>
                  </label>
                );
              })}
              <Link
                href={`/my/vet?pet=${pet.id}`}
                className="flex flex-col items-center gap-2 rounded-[20px] border-2 border-line bg-white px-2 py-4 text-center transition active:scale-[0.98]"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-[14px] bg-mint-soft text-mint-ink">
                  <Stethoscope className="size-6" aria-hidden="true" />
                </span>
                <strong className="font-display text-base font-semibold">Vet checkup</strong>
              </Link>
            </div>
            <p className="mt-2.5 text-sm font-semibold text-muted">{SERVICES.find((s) => s.id === service)!.blurb}</p>
          </fieldset>

          {service === "grooming" && (
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 font-display text-[22px] font-semibold">Grooming services</legend>
              <button
                type="button"
                aria-pressed={fullGroom}
                onClick={() => setGroom(fullGroom ? [] : GROOM_SERVICES.map((g) => g.id))}
                className={`flex items-center gap-3.5 rounded-[20px] border-2 p-4 text-left transition ${
                  fullGroom ? "border-sky bg-sky-soft" : "border-line bg-white"
                }`}
              >
                <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-2xl ${fullGroom ? "bg-sky text-white" : "bg-sky-soft text-sky-ink"}`}>
                  <Sparkles className="size-5.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block font-display text-lg font-semibold">Full groom</strong>
                  <span className="text-sm font-semibold text-muted">
                    All {GROOM_SERVICES.length} services — the works{prices.groom_full ? ` · package ${formatMoney(prices.groom_full)}` : ""}
                  </span>
                </span>
                <span className={`inline-flex size-7 items-center justify-center rounded-lg border-2 ${fullGroom ? "border-sky bg-sky text-white" : "border-line"}`}>
                  {fullGroom && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
                </span>
              </button>
              <p className="text-sm font-bold text-muted">Or pick just what {pet.name} needs:</p>
              <div className="grid grid-cols-2 gap-2">
                {GROOM_SERVICES.map((g) => {
                  const on = groom.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setGroom(on ? groom.filter((x) => x !== g.id) : [...groom, g.id])}
                      className={`flex min-h-12 items-center gap-2 rounded-2xl border-2 px-3 text-left text-sm font-extrabold transition ${
                        on ? "border-mint bg-[#e7f7ef]" : "border-line bg-white"
                      }`}
                    >
                      <span className={`inline-flex size-5.5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-mint bg-mint text-white" : "border-[#b8b1a6]"}`}>
                        {on && <Check className="size-3.5" strokeWidth={3.4} aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 flex-1 leading-tight">
                        {g.label}
                        <span className="block text-xs font-bold text-muted">{formatMoney(prices[`groom_${g.id}`] ?? 0)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {/* ── Step 2: date & time ── */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-display text-[22px] font-semibold">{boarding ? "Drop-off & pickup dates" : "Pick a date"}</h2>
            <p className="text-sm font-semibold text-muted">
              {boarding
                ? !start
                  ? "Tap the day you'll drop off."
                  : !end
                    ? `Drop-off ${formatShortDate(start)} — now tap the pickup day.`
                    : `${nights} night${nights === 1 ? "" : "s"}: ${formatShortDate(start)} – ${formatShortDate(end)}. Tap a new day to start over.`
                : "Green dots have free times; full days are crossed out."}
            </p>
          </div>
          <MonthCalendar
            today={today}
            mode={boarding ? "range" : "single"}
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
              setDropoff(null);
            }}
            dayState={(iso) => dayState(service, iso, availability, today, nowTime)}
            stayFull={(iso) => kennelsFree(iso, availability) === 0}
          />

          {start && (!boarding || end) && (
            <section aria-labelledby="time-h" className="flex flex-col gap-2.5">
              <h2 id="time-h" className="flex items-center gap-2 font-display text-[22px] font-semibold">
                <Clock className="size-5 text-grape" aria-hidden="true" />
                {service === "grooming" ? "Appointment time" : "Drop-off time"}
                <span className="text-sm font-bold text-muted">· {formatShortDate(start)}</span>
              </h2>
              <TimeSlots dayKey={start} scrollOnMount slots={slots} value={dropoff} onChange={setDropoff} />
              {service === "grooming" && dropoff && (
                <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm font-bold text-sky-ink">
                  Grooming takes about 2 hours — {pet.name} will be ready around {formatTime(groomPickup(dropoff))}.
                </p>
              )}
            </section>
          )}

          {service !== "grooming" && dropoff && (
            <section aria-labelledby="pickup-h">
              <h2 id="pickup-h" className="mb-2.5 font-display text-[22px] font-semibold">
                Pickup time <span className="text-sm font-bold text-muted">· {formatShortDate(endDate!)}</span>
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {schedule.pickupTimes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={pickup === t}
                    onClick={() => setPickup(t)}
                    className={`min-h-12 rounded-2xl border-2 text-sm font-extrabold ${pickup === t ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
                  >
                    {formatTime(t)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Step 3: vaccines ── */}
      {step === 3 && (
        <section className="flex flex-col gap-5">
          <p className="text-base text-muted">
            Every pet needs current shots for the whole visit. Use the record we have, or upload a new one — we read the dates for you.
          </p>
          <div role="radiogroup" aria-label="Vaccine record" className="grid grid-cols-2 gap-2">
            {(
              [
                ["file", "Record on file"],
                ["upload", "Upload new"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={source === id}
                onClick={() => setSource(id)}
                className={`min-h-12 rounded-full border-2 px-4.5 text-sm font-extrabold transition ${source === id ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {source === "upload" && <RecordScanner key={pet.id} pet={pet} ownerName={ownerName} onChange={setScanned} />}
          {vaccineDates && result && (
            <>
              <VaccineCards species={pet.species} service={service} dates={vaccineDates} issues={result.issues} />
              <ResultBanner status={result.status} petName={pet.name} problems={result.issues.map((i) => describeIssue(i, pet.species))} />
            </>
          )}
        </section>
      )}

      {/* ── Step 4: review ── */}
      {step === 4 && start && endDate && dropoff && (
        <section className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-[26px] bg-white shadow-card">
            <PetPhoto src={pet.photo} alt={pet.name} className="h-40 w-full" sizes="430px" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 p-5 text-[15px]">
              <dt className="font-semibold text-muted">Pet</dt>
              <dd className="font-extrabold">
                {pet.name} · {pet.breed}
              </dd>
              <dt className="font-semibold text-muted">Service</dt>
              <dd className="font-extrabold capitalize">{service}</dd>
              {service === "grooming" && (
                <>
                  <dt className="font-semibold text-muted">Includes</dt>
                  <dd className="font-extrabold">{fullGroom ? "Full groom (all services)" : groom.map(groomLabel).join(", ")}</dd>
                </>
              )}
              <dt className="font-semibold text-muted">{boarding ? "Drop-off" : "Date"}</dt>
              <dd className="font-extrabold">
                {formatLongDate(start)} · {formatTime(dropoff)}
              </dd>
              {boarding && end && (
                <>
                  <dt className="font-semibold text-muted">Pickup</dt>
                  <dd className="font-extrabold">
                    {formatLongDate(end)} · {pickup ? formatTime(pickup) : ""}
                  </dd>
                </>
              )}
              {service === "daycare" && pickup && (
                <>
                  <dt className="font-semibold text-muted">Pickup</dt>
                  <dd className="font-extrabold">{formatTime(pickup)}</dd>
                </>
              )}
              {service === "grooming" && (
                <>
                  <dt className="font-semibold text-muted">Ready by</dt>
                  <dd className="font-extrabold">about {formatTime(groomPickup(dropoff))}</dd>
                </>
              )}
              <dt className="font-semibold text-muted">Vaccines</dt>
              <dd className={`font-extrabold ${result?.status === "clear" ? "text-mint-ink" : "text-rose-ink"}`}>
                {result?.status === "clear" ? "All current ✓" : result?.status === "blocked" ? "Needs an update" : "Being checked"}
              </dd>
            </dl>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Anything we should know?
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Optional — e.g. bringing own food, nervous of loud noises"
              className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-base font-semibold placeholder:font-normal placeholder:text-faint"
            />
          </label>
          <PaymentChoice
            items={quoteBooking({ service, startDate: start, endDate, groomServices: service === "grooming" ? groom : [] }, prices)}
            discount={discount}
            value={payWith}
            onChange={setPayWith}
          />
          <ol className="flex flex-col gap-2 rounded-[22px] bg-grape-soft p-4 text-sm font-bold text-grape">
            <li>1. You send the request{payWith === "online" ? " and pay online" : ""}</li>
            <li>2. Our team confirms it — you&apos;ll get a message</li>
            <li>3. Follow every step live on {pet.name}&apos;s timeline</li>
          </ol>
        </section>
      )}

      {/* Thumb-reach action bar, just above the tab bar. Errors show right here, never off-screen. */}
      <div className="fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[430px] bg-gradient-to-t from-cream from-70% to-transparent px-4 pt-6 pb-3">
        {error && (
          <p role="alert" className="animate-pop mb-2 rounded-2xl bg-rose-soft px-4 py-2.5 text-sm font-bold text-rose-ink shadow-card">
            {error}
          </p>
        )}
        {step < 4 ? (
          <button
            type="button"
            disabled={!!missing}
            onClick={() => go(step + 1)}
            className="min-h-13 w-full rounded-full bg-grape px-7 text-base font-extrabold text-white shadow-float transition active:scale-[0.98] disabled:bg-[#b9b4dc] disabled:shadow-none"
          >
            {missing ?? nextLabel}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-grape px-7 text-base font-extrabold text-white shadow-float transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
            {pending ? "Sending…" : payWith === "online" ? "Send request & pay online" : "Send booking request"}
          </button>
        )}
      </div>
    </div>
  );
}

function ResultBanner({ status, petName, problems }: { status: "clear" | "blocked" | "review"; petName: string; problems: string[] }) {
  if (status === "clear") {
    return (
      <div className="flex items-center gap-4 rounded-[20px] bg-mint p-4.5 text-white">
        <ShieldCheck className="size-9 shrink-0" aria-hidden="true" />
        <div>
          <div className="font-display text-xl font-semibold">All vaccines check out!</div>
          <div className="text-[15px]">{petName} is cleared for this visit.</div>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className="flex items-center gap-4 rounded-[20px] bg-ink p-4.5 text-white">
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-coral text-ink">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="font-display text-xl font-semibold">{status === "blocked" ? "This visit will be on hold" : "We'll double-check this record"}</div>
        <div className="text-[15px] leading-relaxed text-[#d5d7ea]">
          {problems.join(" · ")}. {status === "blocked" ? "You can still send the request and upload a new record later." : "A team member will confirm it shortly."}
        </div>
      </div>
    </div>
  );
}
