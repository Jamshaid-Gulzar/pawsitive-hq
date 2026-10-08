import { ChevronRight, CircleCheck, Clock, Hourglass } from "lucide-react";
import Link from "next/link";
import type { VetVisitWithPet } from "@/db/queries";
import { formatTime } from "@/lib/dates";
import { HEALTH_STATUS, VET_REASONS } from "@/lib/vet";
import { PetPhoto, Pill } from "./ui";

/** One appointment in a doctor's list, with who confirmed it. Doctors can't confirm; the front desk does. */
export function DoctorVisitCard({ visit, today }: { visit: VetVisitWithPet; today: string }) {
  const reason = VET_REASONS[visit.reason];
  const canExam = visit.status === "booked" && visit.date <= today;
  return (
    <Link
      href={`/doctor/visits/${visit.id}`}
      className={`group flex flex-wrap items-center gap-4 rounded-[22px] bg-white p-4 shadow-card transition hover:-translate-y-0.5 ${
        visit.status === "requested" ? "opacity-80" : ""
      }`}
    >
      <div className="flex w-20 shrink-0 flex-col items-center rounded-2xl bg-cream py-2.5">
        <Clock className="size-4 text-muted" aria-hidden="true" />
        <span className="font-display text-lg font-semibold">{formatTime(visit.time).replace(" ", " ")}</span>
      </div>
      <PetPhoto src={visit.pet.photo} alt={visit.pet.name} className="size-16 shrink-0 rounded-[20px]" sizes="64px" />
      <div className="min-w-0 flex-[1_1_220px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[21px] font-semibold">{visit.pet.name}</span>
          <Pill className={reason.tone}>{reason.label}</Pill>
        </div>
        <div className="text-sm font-semibold text-muted">
          {visit.pet.breed} · {visit.pet.owner.name}
        </div>
        {visit.symptoms && <p className="mt-1 line-clamp-2 text-sm">{visit.symptoms}</p>}
        <div className="mt-1.5 text-xs font-extrabold">
          {visit.status === "requested" ? (
            <span className="inline-flex items-center gap-1 text-sun-ink">
              <Hourglass className="size-3.5" aria-hidden="true" /> Awaiting front-desk confirmation
            </span>
          ) : (
            visit.confirmedBy && (
              <span className="inline-flex items-center gap-1 text-mint-ink">
                <CircleCheck className="size-3.5" aria-hidden="true" /> Confirmed by {visit.confirmedBy}
              </span>
            )
          )}
        </div>
      </div>
      {visit.status === "completed" && visit.healthStatus ? (
        <Pill className={HEALTH_STATUS[visit.healthStatus].tone}>Done · {HEALTH_STATUS[visit.healthStatus].label}</Pill>
      ) : canExam ? (
        <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-mint px-4 text-sm font-extrabold text-white group-hover:brightness-95">
          Start checkup <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      ) : (
        <ChevronRight className="size-5 text-faint" aria-hidden="true" />
      )}
    </Link>
  );
}
