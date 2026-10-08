"use client";

import { Check, ChevronRight, LoaderCircle, Sparkles, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bookVetVisit } from "@/app/actions";
import { MonthCalendar } from "@/components/MonthCalendar";
import { TimeSlots } from "@/components/TimeSlots";
import { PetPhoto } from "@/components/ui";
import { VetAvatar } from "@/components/VetAvatar";
import { PaymentChoice, type PayChoice } from "@/components/PaymentChoice";
import { quoteVet, type PriceMap } from "@/lib/pricing";
import type { VetReason } from "@/db/schema";
import { addDays, formatShortDate, formatTime } from "@/lib/dates";
import { PARENT_REASONS, VET_REASONS, VET_SLOTS, recommendVet, vetDayState, vetSlotState, workDaysLabel, worksOn } from "@/lib/vet";

type VetPet = { id: string; name: string; breed: string; species: string; photo: string | null; conditions: string[] };
type Doctor = { id: string; name: string; title: string; specialty: string; experienceYears: number; color: string; workDays: number[] };

export function VetBookingForm({
  pets,
  vets,
  today,
  nowTime,
  taken,
  initialPetId,
  initialReason,
  initialVetId,
  initialDate,
  initialTime,
  prices,
  discount,
}: {
  prices: PriceMap;
  discount: number;
  pets: VetPet[];
  vets: Doctor[];
  today: string;
  nowTime: string;
  taken: string[];
  initialPetId?: string;
  initialReason?: VetReason;
  initialVetId?: string;
  initialDate?: string;
  initialTime?: string;
}) {
  const router = useRouter();
  const [petId, setPetId] = useState(pets.some((p) => p.id === initialPetId) ? initialPetId! : pets[0]?.id);
  const [reason, setReason] = useState<VetReason>(initialReason && PARENT_REASONS.includes(initialReason) ? initialReason : "checkup");
  const [symptoms, setSymptoms] = useState("");
  const days = Array.from({ length: 60 }, (_, i) => addDays(today, i));
  const slotFree = (doc: Doctor, d: string, s: string) => vetSlotState(doc.id, d, s, taken, today, nowTime) === "free";
  /** The doctor's next working day that still has an open time. */
  const firstWorkDay = (doc: Doctor) => days.find((d) => worksOn(doc, d) && VET_SLOTS.some((s) => slotFree(doc, d, s))) ?? null;
  const initialVet = vets.find((v) => v.id === initialVetId) ?? null;
  // A time picked on the doctor's profile arrives pre-selected, if it's still free.
  const pickedOk =
    !!initialVet && !!initialDate && !!initialTime && days.includes(initialDate) && worksOn(initialVet, initialDate) && slotFree(initialVet, initialDate, initialTime);
  const [vetId, setVetId] = useState<string | null>(initialVet?.id ?? null);
  const [date, setDate] = useState<string | null>(pickedOk ? initialDate! : initialVet ? firstWorkDay(initialVet) : null);
  const [time, setTime] = useState<string | null>(pickedOk ? initialTime! : null);
  const [error, setError] = useState<string | null>(null);
  const [payWith, setPayWith] = useState<PayChoice>("online");
  const [pending, startTransition] = useTransition();
  const pet = pets.find((p) => p.id === petId);
  const vet = vets.find((v) => v.id === vetId) ?? null;

  if (!pet) return <p className="py-16 text-center font-semibold text-muted">Add a pet first to book a vet checkup.</p>;
  const suggested = recommendVet(reason, symptoms, pet.conditions, pet.species);

  function chooseVet(id: string) {
    setVetId(id);
    setTime(null);
    setDate(firstWorkDay(vets.find((v) => v.id === id)!));
  }

  // What's still missing, shown on the button itself.
  const missing =
    reason === "sick" && !symptoms.trim()
      ? "Describe what's wrong"
      : !vet
        ? "Choose a doctor"
        : !date
          ? "Choose a day"
          : !time
            ? "Choose a time"
            : null;

  function submit() {
    if (missing || !vet || !date || !time) return;
    startTransition(async () => {
      setError(null);
      const r = await bookVetVisit({ petId: pet!.id, vetId: vet.id, reason, symptoms, date, time });
      if (!r.ok) setError(r.error);
      else if (payWith === "online" && r.invoiceId) router.push(`/my/pay/${r.invoiceId}?new=1`);
      else router.push(`/my/vet/${r.id}?new=1`);
    });
  }

  return (
    <div className="flex flex-col gap-7 pb-24">
      <section className="flex items-center gap-4 rounded-[26px] bg-mint-soft p-4">
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white text-mint-ink">
          <Stethoscope className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[26px] leading-tight font-semibold">Vet checkup</h1>
          <p className="text-sm font-semibold text-mint-ink">{vets.length} in-house doctors · pick the one you like</p>
        </div>
      </section>

      <fieldset>
        <legend className="mb-3 font-display text-[22px] font-semibold">Which pet?</legend>
        <div className="relative -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {pets.map((p) => {
            const selected = p.id === petId;
            return (
              <label
                key={p.id}
                className={`relative flex shrink-0 cursor-pointer snap-start items-center gap-3 rounded-[20px] border-2 bg-white p-2.5 pr-5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-grape ${
                  selected ? "border-coral bg-coral-soft" : "border-line"
                }`}
              >
                <input type="radio" name="vet-pet" className="sr-only" checked={selected} onChange={() => setPetId(p.id)} />
                <PetPhoto src={p.photo} alt="" className="size-14 rounded-2xl" sizes="56px" />
                <span>
                  <strong className="block font-display text-lg font-semibold">{p.name}</strong>
                  <span className="text-sm font-semibold text-muted">{p.breed}</span>
                </span>
                {selected && <Check className="size-5 text-coral-ink" strokeWidth={3} aria-hidden="true" />}
              </label>
            );
          })}
        </div>
        {pet.conditions.length > 0 && (
          <p className="mt-2.5 text-sm font-semibold text-muted">
            Known conditions: <span className="font-extrabold text-rose-ink">{pet.conditions.join(", ")}</span> — the vet will see these.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-[22px] font-semibold">Reason for visit</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {PARENT_REASONS.map((r) => {
            const selected = r === reason;
            return (
              <label
                key={r}
                className={`relative flex cursor-pointer flex-col gap-1 rounded-[20px] border-2 bg-white p-3.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-grape ${
                  selected ? "border-grape bg-grape-soft" : "border-line"
                }`}
              >
                <input type="radio" name="reason" className="sr-only" checked={selected} onChange={() => setReason(r)} />
                <strong className="font-display text-base font-semibold">{VET_REASONS[r].label}</strong>
                <span className="text-[13px] font-semibold text-muted">{VET_REASONS[r].blurb}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-extrabold">
        {reason === "sick" ? "What's wrong?" : "Anything the vet should know?"}
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={reason === "sick" ? "e.g. Limping on front left leg since yesterday, not eating much" : "Optional"}
          className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-base font-semibold placeholder:font-normal placeholder:text-faint"
        />
        {reason === "sick" && <span className="text-[13px] font-semibold text-rose-ink">If it&apos;s an emergency, please call us right away.</span>}
      </label>

      <fieldset>
        <legend className="mb-3 font-display text-[22px] font-semibold">Choose your doctor</legend>
        <ul className="flex flex-col gap-2.5">
          {[...vets]
            .sort((a, b) => Number(b.id === suggested) - Number(a.id === suggested))
            .map((v) => {
              const selected = v.id === vetId;
              return (
                <li key={v.id} className={`overflow-hidden rounded-[22px] border-2 bg-white ${selected ? "border-mint" : "border-line"}`}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseVet(v.id)}
                    className={`flex w-full items-center gap-3.5 p-3.5 text-left ${selected ? "bg-mint-soft/60" : ""}`}
                  >
                    <VetAvatar name={v.name} color={v.color} />
                    <span className="min-w-0 flex-1">
                      {v.id === suggested && (
                        <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-sun-soft px-2 py-0.5 text-[11px] font-extrabold text-sun-ink">
                          <Sparkles className="size-3" aria-hidden="true" /> Good match for {pet.name}
                        </span>
                      )}
                      <strong className="block font-display text-lg leading-tight font-semibold">{v.name}</strong>
                      <span className="block text-sm font-semibold text-muted">{v.specialty}</span>
                      <span className="block text-xs font-bold text-faint">
                        {v.experienceYears} yrs experience · {workDaysLabel(v.workDays)}
                      </span>
                    </span>
                    <span
                      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-mint bg-mint text-white" : "border-line"}`}
                    >
                      {selected && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
                    </span>
                  </button>
                  <Link
                    href={`/my/vets/${v.id}?pet=${pet.id}`}
                    className="flex min-h-11 items-center justify-between border-t border-sand px-4 text-sm font-extrabold text-grape active:bg-sand"
                  >
                    View profile & experience <ChevronRight className="size-4.5" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
        </ul>
      </fieldset>

      {vet && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-[22px] font-semibold">When?</legend>
          <p className="text-sm font-semibold text-muted">
            {vet.name} works {workDaysLabel(vet.workDays)}. Days off are greyed out.
          </p>
          <MonthCalendar
            key={vet.id}
            today={today}
            mode="single"
            start={date}
            end={date}
            onChange={(d) => {
              setDate(d);
              setTime(null);
            }}
            dayState={(iso) => vetDayState(vet, iso, taken, today, nowTime)}
            closedLabel="Day off"
          />
          {date && (
            <TimeSlots
              dayKey={date}
              scrollOnMount={!initialVet}
              slots={VET_SLOTS.map((s) => ({ time: s, state: vetSlotState(vet.id, date, s, taken, today, nowTime) }))}
              value={time}
              onChange={setTime}
            />
          )}
        </fieldset>
      )}

      {vet && date && time && <PaymentChoice items={quoteVet(reason, prices, vet.name)} discount={discount} value={payWith} onChange={setPayWith} />}

      <div className="fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[430px] bg-gradient-to-t from-cream from-70% to-transparent px-4 pt-6 pb-3">
        {error && (
          <p role="alert" className="animate-pop mb-2 rounded-2xl bg-rose-soft px-4 py-2.5 text-sm font-bold text-rose-ink shadow-card">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || !!missing}
          className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-grape text-base font-extrabold text-white shadow-float active:scale-[0.98] disabled:bg-[#b9b4dc] disabled:shadow-none"
        >
          {pending && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
          {pending
            ? "Sending…"
            : missing ?? `Request ${vet!.name.split(" ").slice(0, 2).join(" ")} · ${formatShortDate(date!)}, ${formatTime(time!)}`}
        </button>
      </div>
    </div>
  );
}
