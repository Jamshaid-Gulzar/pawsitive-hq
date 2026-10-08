import { CalendarDays, ChevronLeft, Clock, MapPin, PartyPopper, Scissors } from "lucide-react";
import { CancelWithReason } from "@/components/CancelWithReason";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { markArrived } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { BillCard } from "@/components/BillCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Timeline } from "@/components/Timeline";
import { PetPhoto, Pill } from "@/components/ui";
import { VaccineCards } from "@/components/VaccineCards";
import { BOOKING_STATUS } from "@/components/VisitRow";
import { getOwnedBooking, recordDates } from "@/db/queries";
import { GROOM_SERVICES, groomLabel } from "@/lib/availability";
import { formatLongDate, formatStamp, formatTime, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { bookingTimeline } from "@/lib/timeline";
import { UnlockBooking } from "./UnlockBooking";

export const metadata: Metadata = { title: "Booking timeline" };

export default async function BookingPage(props: PageProps<"/my/bookings/[id]">) {
  const user = await requireRole("parent");
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;
  const booking = await getOwnedBooking(user.id, id);
  if (!booking) notFound();
  const { pet } = booking;
  const status = BOOKING_STATUS[booking.status];
  const onHold = booking.status === "locked" || booking.status === "review";
  const cancellable = ["requested", "review", "locked", "confirmed"].includes(booking.status);
  const steps = bookingTimeline(booking, booking.events, booking.updates.length);
  const fullGroom = booking.groomServices.length === GROOM_SERVICES.length;

  const today = todayISO();
  const canArrive = booking.status === "confirmed" && booking.startDate === today && !booking.arrivedAt;
  const live = booking.status === "checked_in";

  // Photo updates appear right inside the "staying with us" step.
  const photos = (
    <>
      {booking.updates.length > 0 && (
        <ul className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {booking.updates.map((m) => (
            <li key={m.id} className="w-28 shrink-0">
              <Link href={`/my/inbox?pet=${pet.id}`} className="block">
                <PetPhoto src={m.photo} alt={m.title ?? `${pet.name} update`} className="aspect-square w-full rounded-2xl" sizes="112px" />
                <span className="mt-1 block text-[11px] font-bold text-faint">{formatStamp(m.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {live && (
        <Link
          href={`/my/pets/${pet.id}/live`}
          className="mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-full bg-sky-soft px-4 text-sm font-extrabold text-sky-ink"
        >
          <span className="size-2 animate-pulse rounded-full bg-mint" /> Watch {pet.name} live & daily reports
        </Link>
      )}
    </>
  );

  // Check-in day: the owner taps this when they drop the pet off.
  const arrive = canArrive ? (
    <div className="mt-2.5">
      <ActionButton
        action={markArrived.bind(null, booking.id)}
        pendingLabel="Letting the team know…"
        className="min-h-12 w-full rounded-full bg-coral px-5 text-[15px] font-extrabold text-ink shadow-float"
      >
        <MapPin className="size-5" aria-hidden="true" /> I&apos;ve arrived with {pet.name}
      </ActionButton>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={5} />
      <Link href="/my" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> Home
      </Link>

      {isNew && booking.status === "requested" && (
        <p role="status" className="animate-pop flex items-center gap-3 rounded-[20px] bg-mint p-4 font-bold text-white">
          <PartyPopper className="size-7 shrink-0" aria-hidden="true" />
          Request sent! You&apos;ll get a message as soon as our team confirms it.
        </p>
      )}

      <section className="overflow-hidden rounded-[28px] bg-white shadow-card">
        <div className="flex items-center gap-4 bg-coral-soft p-4">
          <PetPhoto src={pet.photo} alt={`${pet.name} the ${pet.breed}`} priority sizes="80px" className="size-20 shrink-0 rounded-full border-4 border-white" />
          <div className="min-w-0">
            <Pill className={status.className}>{status.label}</Pill>
            <h1 className="mt-1 font-display text-[26px] leading-tight font-semibold capitalize">
              {pet.name}&apos;s {booking.service}
            </h1>
            <p className="text-xs font-bold text-coral-ink">Ref {booking.id.toUpperCase()}</p>
          </div>
        </div>
        <dl className="grid gap-3 p-4 text-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-4.5 shrink-0 text-grape" aria-hidden="true" />
            <div>
              <dt className="sr-only">Dates</dt>
              <dd className="font-bold">
                {formatLongDate(booking.startDate)}
                {booking.endDate !== booking.startDate ? ` → ${formatLongDate(booking.endDate)}` : ""}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 size-4.5 shrink-0 text-grape" aria-hidden="true" />
            <div>
              <dt className="sr-only">Times</dt>
              <dd className="font-bold">
                {booking.service === "grooming" ? "Appointment" : "Drop-off"} {booking.dropoffTime ? formatTime(booking.dropoffTime) : "—"}
                {booking.pickupTime ? ` · ${booking.service === "grooming" ? "ready about" : "pickup"} ${formatTime(booking.pickupTime)}` : ""}
              </dd>
            </div>
          </div>
          {booking.service === "grooming" && booking.groomServices.length > 0 && (
            <div className="flex items-start gap-3">
              <Scissors className="mt-0.5 size-4.5 shrink-0 text-grape" aria-hidden="true" />
              <div>
                <dt className="sr-only">Grooming services</dt>
                <dd className="font-bold">{fullGroom ? "Full groom — all services" : booking.groomServices.map(groomLabel).join(", ")}</dd>
              </div>
            </div>
          )}
          {booking.notes && <p className="rounded-xl bg-cream px-3 py-2 font-semibold text-muted">&ldquo;{booking.notes}&rdquo;</p>}
        </dl>
      </section>

      <section aria-labelledby="tl-h" className="rounded-[28px] bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="tl-h" className="font-display text-[22px] font-semibold">
            Live timeline
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-mint-ink">
            <span className="size-2 animate-pulse rounded-full bg-mint" /> Live
          </span>
        </div>
        <Timeline steps={steps} extra={{ stay: photos, checked_in: arrive, bathing: live ? photos : null }} />
      </section>

      <BillCard refId={booking.id} closed={booking.status === "cancelled" || booking.status === "declined"} />

      {onHold && (
        <section aria-labelledby="vax-h" className="flex flex-col gap-4 rounded-[28px] bg-white p-4 shadow-card">
          <h2 id="vax-h" className="font-display text-[22px] font-semibold">
            {pet.name}&apos;s vaccines
          </h2>
          <VaccineCards species={pet.species} service={booking.service} dates={recordDates(booking.record ?? undefined)} issues={booking.issues} />
          <UnlockBooking pet={{ id: pet.id, name: pet.name, species: pet.species, breed: pet.breed }} ownerName={user.name} />
        </section>
      )}

      {cancellable && <CancelWithReason kind="booking" id={booking.id} label="Cancel booking" />}
      {booking.status === "cancelled" && booking.cancelReason && (
        <p className="rounded-2xl bg-sand px-4 py-3 text-sm font-bold text-muted">You cancelled this booking: {booking.cancelReason}</p>
      )}
    </div>
  );
}
