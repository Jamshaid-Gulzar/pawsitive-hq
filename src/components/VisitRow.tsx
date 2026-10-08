import { Bath, ChevronRight, Moon, Sun } from "lucide-react";
import Link from "next/link";
import type { BookingStatus } from "@/db/schema";
import { formatShortDate, formatTime } from "@/lib/dates";
import type { Service } from "@/lib/vaccines";
import { PetPhoto, Pill } from "./ui";

export const BOOKING_STATUS: Record<BookingStatus, { label: string; className: string }> = {
  requested: { label: "Awaiting confirmation", className: "bg-sun-soft text-sun-ink" },
  declined: { label: "Declined", className: "bg-sand text-muted" },
  confirmed: { label: "Confirmed", className: "bg-mint-soft text-mint-ink" },
  checked_in: { label: "Here now", className: "bg-sky-soft text-sky-ink" },
  locked: { label: "On hold", className: "bg-rose-soft text-rose-ink" },
  review: { label: "Checking", className: "bg-sun-soft text-sun-ink" },
  completed: { label: "Done", className: "bg-sand text-muted" },
  cancelled: { label: "Cancelled", className: "bg-sand text-muted" },
};

export const SERVICE_ICON: Record<Service, typeof Moon> = { boarding: Moon, daycare: Sun, grooming: Bath };

export function visitWhen(v: { service: Service; startDate: string; endDate: string; pickupTime: string | null; dropoffTime?: string | null }) {
  if (v.service === "boarding") return `${formatShortDate(v.startDate)} – ${formatShortDate(v.endDate)}`;
  return `${formatShortDate(v.startDate)}${v.dropoffTime ? ` · ${formatTime(v.dropoffTime)}` : v.pickupTime ? ` · pickup ${formatTime(v.pickupTime)}` : ""}`;
}

export function VisitRow({
  visit,
  photo,
  petName,
}: {
  visit: { id: string; service: Service; startDate: string; endDate: string; pickupTime: string | null; dropoffTime?: string | null; status: BookingStatus };
  photo?: string | null;
  petName?: string;
}) {
  const Icon = SERVICE_ICON[visit.service];
  const status = BOOKING_STATUS[visit.status];
  return (
    <Link href={`/my/bookings/${visit.id}`} className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-cream active:bg-sand">
      {photo !== undefined ? (
        <PetPhoto src={photo} alt="" className="size-12 shrink-0 rounded-2xl" sizes="48px" />
      ) : (
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-grape-soft text-grape">
          <Icon className="size-5.5" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[15px] capitalize">
          {petName ? `${petName} · ` : ""}
          {visit.service}
        </strong>
        <span className="block truncate text-sm text-muted">{visitWhen(visit)}</span>
      </span>
      <Pill className={status.className}>{status.label}</Pill>
      <ChevronRight className="size-4.5 shrink-0 text-faint" aria-hidden="true" />
    </Link>
  );
}
