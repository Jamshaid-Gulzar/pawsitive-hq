import { Cake, Camera, Clock, House, Pill as PillIcon, Plus, ShieldAlert, Stethoscope, Utensils } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { advanceGroom, checkOut } from "@/app/actions";
import { AssignPet } from "./AssignPet";
import { FlagForVet } from "./FlagForVet";
import { QuickCheckIn } from "./QuickCheckIn";
import { VaccinesDueBanner } from "@/components/VaccinesDueBanner";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, Pill, PawIcon, PetPhoto, SectionTitle } from "@/components/ui";
import { getBoard, type BookingWithPet } from "@/db/queries";
import type { Unit } from "@/db/schema";
import { GROOM_SERVICES, groomLabel } from "@/lib/availability";
import { GROOM_STAGES, READY_STAGE } from "@/lib/care";
import { formatLongDate, formatShortDate, formatTime, greeting } from "@/lib/dates";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Floor board" };

export default async function BoardPage() {
  const user = await requireRole("staff", "admin");
  const board = await getBoard();
  const freeRuns = board.kennels.filter((k) => !k.booking).length;

  const arrivalOptions = (kind: "table" | "kennel") =>
    board.arrivals
      .filter((b) => (kind === "table") === (b.service === "grooming"))
      .sort((a, b) => Number(!!b.arrivedAt) - Number(!!a.arrivedAt))
      .map((b) => ({ bookingId: b.id, label: `${b.pet.name} · ${b.service}${b.arrivedAt ? " · here now ✓" : ""}` }));

  return (
    <>
      <AutoRefresh seconds={5} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[15px] font-bold text-muted">{formatLongDate(board.today)}</div>
          <h1 className="mt-1 font-display text-[38px] font-semibold">
            {greeting()}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-bold text-mint-ink shadow-card">
            <span className="size-2.5 animate-pulse rounded-full bg-mint" />
            Live · refreshes every 5s
          </span>
          <Link
            href="/updates"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-grape px-5 text-[15px] font-extrabold text-white transition hover:bg-grape-dark"
          >
            <Camera className="size-4.5" aria-hidden="true" />
            Send an update
          </Link>
        </div>
      </div>

      <VaccinesDueBanner />
      <section aria-label="Today at a glance" className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <Stat value={board.petsInToday} label="Pets in today" tone="bg-coral-soft" ink="text-coral-ink" icon={<PawIcon className="size-6" />} />
        <Stat
          value={<>{freeRuns} <span className="text-[17px] text-sky-ink">of {board.kennels.length}</span></>}
          label="Kennels free"
          tone="bg-sky-soft"
          ink="text-sky-ink"
          icon={<House className="size-6" aria-hidden="true" />}
        />
        <Stat value={board.meds.length} label="Meds on schedule" tone="bg-lilac-soft" ink="text-lilac-ink" icon={<PillIcon className="size-6" aria-hidden="true" />} />
        <Link href="/vaccines" className="rounded-[22px] transition hover:-translate-y-0.5">
          <Stat value={board.flaggedCount} label="Vaccine flags →" tone="bg-sun-soft" ink="text-sun-ink" icon={<ShieldAlert className="size-6" aria-hidden="true" />} />
        </Link>
      </section>

      <div className="flex flex-wrap items-start gap-7">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-9">
          <section aria-labelledby="groom-h">
            <SectionTitle
              id="groom-h"
              aside={
                <div className="flex flex-wrap gap-2">
                  {GROOM_STAGES.map((s) => (
                    <Pill key={s.short} className={`${s.soft} ${s.ink} text-[13px]`}>
                      {s.short === "Ready" ? "Ready" : s.label}
                    </Pill>
                  ))}
                </div>
              }
            >
              Grooming salon
            </SectionTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
              {board.tables.map(({ unit, booking }) =>
                booking ? (
                  <GroomCard key={unit.id} unit={unit} booking={booking} />
                ) : (
                  <EmptySlot key={unit.id} unit={unit} options={arrivalOptions("table")} />
                ),
              )}
            </div>
          </section>

          <section aria-labelledby="kennels-h">
            <SectionTitle
              id="kennels-h"
              aside={
                <span className="text-sm font-bold text-muted">
                  Boarding &amp; daycare · {board.kennels.length - freeRuns} of {board.kennels.length} full
                </span>
              }
            >
              Kennel runs
            </SectionTitle>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5">
              {board.kennels.map(({ unit, booking }) =>
                booking ? (
                  <KennelCard key={unit.id} unit={unit} booking={booking} today={board.today} vet={board.vetToday.get(booking.petId) ?? null} />
                ) : (
                  <EmptySlot key={unit.id} unit={unit} options={arrivalOptions("kennel")} />
                ),
              )}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4.5">
          {board.birthdays.map((b) => (
            <section key={b.id} aria-label={`${b.pet.name}'s birthday`} className="flex flex-col gap-3.5 rounded-[26px] bg-sun p-5">
              <div className="flex items-center gap-3.5">
                <PetPhoto src={b.pet.photo} alt={b.pet.name} className="size-21 shrink-0 rounded-full border-4 border-white" />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-[0.08em] text-[#5c3d00] uppercase">
                    <Cake className="size-3.5" aria-hidden="true" /> Birthday today
                  </div>
                  <h2 className="mt-0.5 font-display text-2xl leading-tight font-semibold">
                    {b.pet.name} turns {b.age}!
                  </h2>
                </div>
              </div>
              <p className="text-sm leading-relaxed font-semibold text-[#3a2a00]">
                Pupcake time in the play yard. Snap a photo for {b.pet.sex === "f" ? "her" : "his"} family.
              </p>
            </section>
          ))}

          {board.arrivals.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3.5 font-display text-xl font-semibold">Arriving today</h2>
              <ul className="flex flex-col gap-3">
                {[...board.arrivals]
                  .sort((a, b) => Number(!!b.arrivedAt) - Number(!!a.arrivedAt))
                  .map((b) => (
                    <li
                      key={b.id}
                      className={`flex flex-col gap-2.5 rounded-2xl p-2.5 text-sm ${b.arrivedAt ? "bg-coral-soft ring-2 ring-coral" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <PetPhoto src={b.pet.photo} alt="" className="size-11 shrink-0 rounded-[14px]" sizes="44px" />
                        <span className="min-w-0 flex-1">
                          <strong>{b.pet.name}</strong>
                          <br />
                          <span className="text-muted capitalize">
                            {b.service}
                            {b.dropoffTime ? ` · ${formatTime(b.dropoffTime)}` : ""}
                          </span>
                        </span>
                        {b.arrivedAt ? (
                          <Pill className="animate-pulse bg-coral text-ink">Here now ✓</Pill>
                        ) : (
                          <Pill className="bg-mint-soft text-mint-ink">Cleared</Pill>
                        )}
                      </div>
                      {b.arrivedAt && (
                        <QuickCheckIn
                          bookingId={b.id}
                          petName={b.pet.name}
                          units={(b.service === "grooming" ? board.tables : board.kennels).filter((k) => !k.booking).map((k) => ({ id: k.unit.id, label: k.unit.label }))}
                        />
                      )}
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-[13px] font-semibold text-muted">
                Owners tap &ldquo;I&apos;ve arrived&rdquo; in the app. Check them in here or from any empty spot.
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-3.5 font-display text-xl font-semibold">Medication schedule</h2>
            {board.meds.length === 0 ? (
              <p className="text-sm font-semibold text-muted">No meds due for pets in the building.</p>
            ) : (
              <ul className="flex flex-col gap-3.5">
                {board.meds.map((b) => (
                  <li key={b.id} className="flex items-center gap-3">
                    <PetPhoto src={b.pet.photo} alt="" className="size-11.5 shrink-0 rounded-[15px]" sizes="46px" />
                    <div className="min-w-0 flex-1 text-sm">
                      <strong>{b.pet.name}</strong> · {board.kennels.find((k) => k.unit.id === b.unitId)?.unit.label}
                      <br />
                      <span className="text-muted">{b.pet.meds}</span>
                    </div>
                    <Pill className="bg-lilac-soft text-[13px] text-lilac-ink">{formatTime(b.pet.medTime)}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3.5 font-display text-xl font-semibold">Pickups today</h2>
            {board.pickups.length === 0 ? (
              <p className="text-sm font-semibold text-muted">No more pickups today.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {board.pickups.map((b) => {
                  const stage = b.groomStage != null ? GROOM_STAGES[b.groomStage] : null;
                  return (
                    <li key={b.id} className="flex items-center gap-3 text-sm">
                      <PetPhoto src={b.pet.photo} alt="" className="size-10 shrink-0 rounded-full" sizes="40px" />
                      <span className="min-w-0 flex-1">
                        <strong>{b.pet.name}</strong>
                        <br />
                        <span className="text-muted">{formatTime(b.pickupTime)}</span>
                      </span>
                      {stage ? (
                        <Pill className={`${stage.soft} ${stage.ink}`}>{stage.short}</Pill>
                      ) : (
                        <Pill className="bg-sky-soft text-sky-ink">Daycare</Pill>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Link href="/updates" className="group block overflow-hidden rounded-[26px] bg-grape text-white">
            <PetPhoto src="/pets/pups.jpg" alt="" className="h-32 w-full" sizes="320px" />
            <div className="px-5 pt-4.5 pb-5">
              <div className="font-display text-[22px] font-semibold group-hover:underline">Send a Pawsitive Update</div>
              <div className="mt-1 text-sm font-semibold text-[#e3e0ff]">Photo + a few taps. Owners get it instantly.</div>
            </div>
          </Link>
        </aside>
      </div>
    </>
  );
}

function Stat({ value, label, tone, ink, icon }: { value: ReactNode; label: string; tone: string; ink: string; icon: ReactNode }) {
  return (
    <div className={`flex h-full items-center gap-3.5 rounded-[22px] px-5 py-4.5 ${tone}`}>
      <span className={`inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white ${ink}`}>{icon}</span>
      <div>
        <div className="font-display text-[32px] leading-none font-semibold">{value}</div>
        <div className={`mt-1 text-sm font-bold ${ink}`}>{label}</div>
      </div>
    </div>
  );
}

function GroomCard({ unit, booking }: { unit: Unit; booking: BookingWithPet }) {
  const stageIndex = booking.groomStage ?? 0;
  const stage = GROOM_STAGES[stageIndex];
  const ready = stageIndex === READY_STAGE;
  return (
    <article className="animate-pop flex flex-col overflow-hidden rounded-3xl bg-white shadow-card">
      <div className="relative h-[170px]">
        <PetPhoto src={booking.pet.photo} alt={`${booking.pet.name}, ${booking.pet.breed}`} className="h-full w-full" sizes="(min-width: 768px) 280px, 100vw" />
        <Pill className={`absolute top-3 left-3 text-[13px] shadow-md ${stage.soft} ${stage.ink}`}>{stage.label}</Pill>
        <Pill className="absolute top-3 right-3 bg-white text-ink">{unit.label}</Pill>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-4.5">
        <div>
          <div className="font-display text-2xl leading-tight font-semibold">{booking.pet.name}</div>
          <div className="mt-0.5 text-sm text-muted">{booking.pet.breed}</div>
          {booking.groomServices.length > 0 && (
            <div className="mt-1.5 text-xs font-extrabold text-sky-ink">
              {booking.groomServices.length === GROOM_SERVICES.length ? "Full groom" : booking.groomServices.map(groomLabel).join(" · ")}
            </div>
          )}
        </div>
        <ol className="grid grid-cols-4 gap-1.5" aria-label={`Grooming progress: ${stage.label}`}>
          {GROOM_STAGES.map((s, i) => (
            <li key={s.short} className="flex flex-col gap-1.5">
              <span className={`h-[7px] rounded ${i <= stageIndex ? stage.color : "bg-sand"}`} />
              <span className={`text-[11px] font-extrabold ${i <= stageIndex ? "text-ink" : "text-faint"}`}>{s.short}</span>
            </li>
          ))}
        </ol>
        {booking.pet.alert && (
          <Pill className="self-start bg-rose-soft text-rose-ink">{booking.pet.alert}</Pill>
        )}
        <div className="flex items-center justify-between text-[13px] font-semibold text-muted">
          <span>With {booking.groomer ?? "the team"}</span>
          {booking.pickupTime && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatTime(booking.pickupTime)}
            </span>
          )}
        </div>
        <ActionButton
          action={advanceGroom.bind(null, booking.id)}
          className={`min-h-12 w-full rounded-[14px] text-[15px] font-extrabold text-white ${ready ? "bg-mint hover:bg-mint-ink" : "bg-ink hover:bg-ink-2"}`}
        >
          {stage.action}
        </ActionButton>
      </div>
    </article>
  );
}

const TAG_STYLES = {
  alert: { pill: "bg-rose-soft text-rose-ink", ring: "border-[#ff9c85]" },
  med: { pill: "bg-lilac-soft text-lilac-ink", ring: "border-[#b9a2f7]" },
  fun: { pill: "bg-sun-soft text-sun-ink", ring: "border-sun" },
  note: { pill: "bg-mint-soft text-mint-ink", ring: "border-[#8fd9b4]" },
};

function KennelCard({
  unit,
  booking,
  today,
  vet,
}: {
  unit: Unit;
  booking: BookingWithPet;
  today: string;
  vet: { id: string; time: string } | null;
}) {
  const { pet } = booking;
  const birthday = !!pet.birthday && pet.birthday.slice(5) === today.slice(5);
  const [kind, tag] = pet.alert
    ? (["alert", pet.alert] as const)
    : pet.medTime
      ? (["med", `Meds at ${formatTime(pet.medTime)}`] as const)
      : birthday
        ? (["fun", "Birthday today"] as const)
        : (["note", pet.note ?? (booking.service === "daycare" ? "Daycare" : "Settled in")] as const);
  const goingHome = booking.endDate === today;

  return (
    <article className="animate-pop flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-card">
      <div className="flex items-center gap-3.5">
        <PetPhoto src={pet.photo} alt={pet.name} className={`size-17 shrink-0 rounded-[22px] border-[3px] ${TAG_STYLES[kind].ring}`} sizes="68px" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold tracking-[0.07em] text-muted uppercase">{unit.label}</div>
          <div className="font-display text-[22px] leading-tight font-semibold">{pet.name}</div>
          <div className="truncate text-[13px] text-muted">{pet.breed}</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
        <div className="flex items-center gap-2.5 rounded-xl bg-cream px-2.5 py-2">
          <Utensils className="size-4 shrink-0 text-coral-ink" aria-label="Food" />
          <span>{pet.food}</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-cream px-2.5 py-2">
          <PillIcon className="size-4 shrink-0 text-lilac-ink" aria-label="Medication" />
          <span>{pet.meds ?? "No meds"}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Pill className={TAG_STYLES[kind].pill}>{tag}</Pill>
        <span className="text-xs font-bold text-muted">{goingHome ? "Goes home today" : `Out ${formatShortDate(booking.endDate)}`}</span>
      </div>
      {vet ? (
        <Link href={`/vet/${vet.id}`} className="flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-mint-soft text-[13px] font-extrabold text-mint-ink hover:brightness-95">
          <Stethoscope className="size-4" aria-hidden="true" /> Vet check at {formatTime(vet.time)}
        </Link>
      ) : (
        <FlagForVet petId={pet.id} petName={pet.name} />
      )}
      {goingHome && (
        <ActionButton
          action={checkOut.bind(null, booking.id)}
          className="min-h-11 w-full rounded-full border-2 border-ink bg-white text-sm font-extrabold hover:bg-ink hover:text-white"
        >
          Check out
        </ActionButton>
      )}
    </article>
  );
}

function EmptySlot({ unit, options }: { unit: Unit; options: { bookingId: string; label: string }[] }) {
  return (
    <article className="flex min-h-[236px] flex-col items-center justify-center gap-2.5 rounded-[22px] border-2 border-dashed border-[#d8d0c4] p-4 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-coral-soft text-coral-ink">
        {options.length ? <Plus className="size-7" aria-hidden="true" /> : <PawIcon className="size-7" />}
      </span>
      <div>
        <div className="font-display text-xl font-semibold">{unit.label} is free</div>
        <div className="mt-0.5 text-[13px] text-muted">Cleaned and ready</div>
      </div>
      <AssignPet unitId={unit.id} unitLabel={unit.label} options={options} />
    </article>
  );
}
