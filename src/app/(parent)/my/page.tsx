import { Bath, ChevronRight, Lock, Moon, Plus, ScanLine, Stethoscope, Sun } from "lucide-react";
import { VET_REASONS } from "@/lib/vet";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { VisitRow } from "@/components/VisitRow";
import { VisitUsCard } from "@/components/VisitUsCard";
import { getParentHome, recordDates } from "@/db/queries";
import { formatLongDate, formatShortDate, formatStamp, formatTime, greeting, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { requiredVaccines } from "@/lib/vaccines";

export const metadata: Metadata = { title: "Home" };

const QUICK_BOOK = [
  { href: "/my/book?service=boarding", label: "Boarding", icon: Moon, tone: "bg-lilac-soft text-lilac-ink" },
  { href: "/my/book?service=daycare", label: "Daycare", icon: Sun, tone: "bg-sun-soft text-sun-ink" },
  { href: "/my/book?service=grooming", label: "Grooming", icon: Bath, tone: "bg-sky-soft text-sky-ink" },
  { href: "/my/vet", label: "Vet", icon: Stethoscope, tone: "bg-mint-soft text-mint-ink" },
] as const;

export default async function HomePage() {
  const user = await requireRole("parent");
  const { pets, bookings, latestPhoto, vetVisits } = await getParentHome(user.id);
  const today = todayISO();
  const onHold = bookings.filter((b) => b.status === "locked" || b.status === "review");
  const hereNow = pets.filter((p) => p.hereNow);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-bold text-muted">{formatLongDate(today)}</p>
        <h1 className="font-display text-[30px] leading-tight font-semibold">
          {greeting()}, {user.name.split(" ")[0]}
        </h1>
      </div>

      {onHold.map((b) => (
        <Link key={b.id} href={`/my/bookings/${b.id}`} className="flex items-center gap-3.5 rounded-[22px] bg-ink p-4 text-white transition active:scale-[0.99]">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-coral text-ink">
            {b.status === "locked" ? <Lock className="size-5.5" aria-hidden="true" /> : <ScanLine className="size-5.5" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg leading-tight font-semibold">
              {b.pet.name}&apos;s {b.service} {b.status === "locked" ? "is on hold" : "is being checked"}
            </span>
            <span className="block text-sm text-[#d5d7ea]">
              {b.status === "locked" ? "Tap to upload the new vet record" : "We're double-checking a date"}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-sun" aria-hidden="true" />
        </Link>
      ))}

      {hereNow.map((p) => (
        <section key={p.id} aria-label={`${p.name} is here now`} className="overflow-hidden rounded-[26px] bg-sky-soft">
          <div className="flex items-center gap-3.5 p-4">
            <span className="relative shrink-0">
              <PetPhoto src={p.photo} alt="" className="size-14 rounded-full border-[3px] border-white" sizes="56px" />
              <span className="absolute right-0 bottom-0 size-4 rounded-full border-[3px] border-sky-soft bg-mint" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold tracking-[0.07em] text-sky-ink uppercase">Here with us now</div>
              <div className="font-display text-xl leading-tight font-semibold">
                {p.name} is in {p.hereNow!.unitLabel ?? "the play yard"}
              </div>
              <div className="text-sm font-semibold text-sky-ink">
                {p.hereNow!.activity ? `${p.hereNow!.activity} · ` : ""}
                {p.hereNow!.endDate === today ? "Going home today" : `Going home ${formatShortDate(p.hereNow!.endDate)}`}
              </div>
            </div>
          </div>
          <Link href={`/my/pets/${p.id}/live`} className="flex min-h-12 items-center justify-between bg-white/60 px-4 text-sm font-extrabold text-sky-ink">
            Watch {p.name} live & daily reports <ChevronRight className="size-4.5" aria-hidden="true" />
          </Link>
        </section>
      ))}

      <section aria-labelledby="pets-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="pets-h" className="font-display text-[22px] font-semibold">
            Your pets
          </h2>
          <Link href="/my/pets/new" className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-grape">
            <Plus className="size-4.5" aria-hidden="true" /> Add pet
          </Link>
        </div>
        <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {pets.map((p) => {
            const dates = recordDates(p.record ?? undefined);
            const vaccinesOk = requiredVaccines(p.species, "boarding").every((k) => dates[k] && dates[k]! >= today);
            return (
              <li key={p.id} className="w-[68%] shrink-0 snap-start">
                <Link href={`/my/pets/${p.id}`} className="block overflow-hidden rounded-[24px] bg-white shadow-card transition active:scale-[0.98]">
                  <div className="relative aspect-[4/5]">
                    <PetPhoto src={p.photo} alt={`${p.name} the ${p.breed}`} className="h-full w-full" sizes="300px" />
                    {p.hereNow ? (
                      <Pill className="absolute top-3 left-3 bg-white text-sky-ink">
                        <span className="size-2 rounded-full bg-mint" /> Here now
                      </Pill>
                    ) : (
                      <Pill className={`absolute top-3 left-3 ${vaccinesOk ? "bg-white text-mint-ink" : "bg-rose-soft text-rose-ink"}`}>
                        {vaccinesOk ? "Vaccines OK" : "Vaccine due"}
                      </Pill>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3.5">
                    <div className="min-w-0">
                      <div className="font-display text-xl leading-tight font-semibold">{p.name}</div>
                      <div className="truncate text-sm text-muted">{p.breed}</div>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
          <li className="w-[68%] shrink-0 snap-start">
            <Link
              href="/my/pets/new"
              className="flex h-full min-h-60 flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-[#d8d0c4] p-4 text-center transition active:scale-[0.98]"
            >
              <span className="inline-flex size-16 items-center justify-center rounded-full bg-coral-soft text-coral-ink">
                <Plus className="size-8" aria-hidden="true" />
              </span>
              <span className="font-display text-xl font-semibold">Add a pet</span>
              <span className="text-sm font-semibold text-muted">Register a new family member</span>
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="quick-h">
        <h2 id="quick-h" className="mb-3 font-display text-[22px] font-semibold">
          Book a visit
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_BOOK.map(({ href, label, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 rounded-[20px] bg-white py-3.5 text-[13px] font-extrabold shadow-card transition active:scale-[0.97]"
            >
              <span className={`inline-flex size-11 items-center justify-center rounded-2xl ${tone}`}>
                <Icon className="size-5.5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </section>

      {latestPhoto && (
        <Link href="/my/inbox" className="block overflow-hidden rounded-[26px] bg-white shadow-card transition active:scale-[0.99]">
          <div className="relative aspect-[4/3]">
            <PetPhoto src={latestPhoto.photo} alt={`Latest photo of ${latestPhoto.pet.name}`} className="h-full w-full" sizes="430px" />
            <Pill className="absolute top-3 left-3 bg-sun text-ink">Latest Pawsitive Update</Pill>
          </div>
          <div className="p-4">
            <div className="font-display text-lg font-semibold text-grape">{latestPhoto.title}</div>
            <p className="mt-1 line-clamp-2 text-[15px]">{latestPhoto.body}</p>
            <div className="mt-2 text-xs font-bold text-faint">
              From {latestPhoto.authorName} · {formatStamp(latestPhoto.createdAt)}
            </div>
          </div>
        </Link>
      )}

      <VisitUsCard />

      <Card className="p-3">
        <h2 className="px-2.5 pt-2 pb-1 font-display text-xl font-semibold">Upcoming visits</h2>
        {bookings.length + vetVisits.length === 0 ? (
          <p className="px-2.5 pb-3 text-sm font-semibold text-muted">Nothing booked yet.</p>
        ) : (
          <ul>
            {bookings.map((b) => (
              <li key={b.id}>
                <VisitRow visit={b} photo={b.pet.photo} petName={b.pet.name} />
              </li>
            ))}
            {vetVisits.map((v) => (
              <li key={v.id}>
                <Link href={`/my/vet/${v.id}`} className="flex items-center gap-3 rounded-2xl p-2.5 transition active:bg-sand">
                  <span className="relative shrink-0">
                    <PetPhoto src={v.pet.photo} alt="" className="size-12 rounded-2xl" sizes="48px" />
                    <span className="absolute -right-1 -bottom-1 inline-flex size-6 items-center justify-center rounded-full border-2 border-white bg-mint text-white">
                      <Stethoscope className="size-3.5" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[15px]">
                      {v.pet.name} · Vet
                    </strong>
                    <span className="block truncate text-sm text-muted">
                      {v.date === today ? "Today" : formatShortDate(v.date)} · {formatTime(v.time)}
                    </span>
                  </span>
                  {v.status === "requested" ? (
                    <Pill className="bg-sun-soft text-sun-ink">Awaiting</Pill>
                  ) : (
                    <Pill className="bg-mint-soft text-mint-ink">{VET_REASONS[v.reason].label.split(" ")[0]}</Pill>
                  )}
                  <ChevronRight className="size-4.5 shrink-0 text-faint" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
