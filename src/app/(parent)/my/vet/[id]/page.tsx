import { ChevronLeft, ChevronRight, FileDown, PartyPopper } from "lucide-react";
import { CancelWithReason } from "@/components/CancelWithReason";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BillCard } from "@/components/BillCard";
import { Timeline } from "@/components/Timeline";
import { PetPhoto, Pill } from "@/components/ui";
import { VetAvatar } from "@/components/VetAvatar";
import { VetReportCard } from "@/components/VetReportCard";
import { getOwnedVetVisit } from "@/db/queries";
import { requireRole } from "@/lib/session";
import { vetTimeline } from "@/lib/timeline";
import { VET_REASONS } from "@/lib/vet";

export const metadata: Metadata = { title: "Vet appointment" };

const STATUS = {
  requested: { label: "Awaiting confirmation", className: "bg-sun-soft text-sun-ink" },
  booked: { label: "Confirmed", className: "bg-mint-soft text-mint-ink" },
  completed: { label: "Report ready", className: "bg-sky-soft text-sky-ink" },
  cancelled: { label: "Cancelled", className: "bg-sand text-muted" },
  declined: { label: "Declined", className: "bg-sand text-muted" },
};

export default async function VetVisitPage(props: PageProps<"/my/vet/[id]">) {
  const user = await requireRole("parent");
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;
  const visit = await getOwnedVetVisit(user.id, id);
  if (!visit) notFound();
  const reason = VET_REASONS[visit.reason];
  const steps = vetTimeline(visit, visit.vet?.name ?? "our vet", visit.events);

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={5} />
      <Link href={`/my/pets/${visit.pet.id}`} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> {visit.pet.name}
      </Link>

      {isNew && visit.status === "requested" && (
        <p role="status" className="animate-pop flex items-center gap-3 rounded-[20px] bg-mint p-4 font-bold text-white">
          <PartyPopper className="size-7 shrink-0" aria-hidden="true" />
          Request sent! You&apos;ll get a message when the front desk confirms it.
        </p>
      )}

      <section className="flex items-center gap-4 rounded-[26px] bg-mint-soft p-4">
        <PetPhoto src={visit.pet.photo} alt={visit.pet.name} className="size-18 shrink-0 rounded-full border-4 border-white" sizes="72px" priority />
        <div className="min-w-0">
          <Pill className={STATUS[visit.status].className}>{STATUS[visit.status].label}</Pill>
          <h1 className="mt-1 font-display text-[26px] leading-tight font-semibold">{visit.pet.name}&apos;s vet visit</h1>
          <p className="text-sm font-bold text-mint-ink">{reason.label}</p>
        </div>
      </section>

      {visit.vet && (
        <Link href={`/my/vets/${visit.vet.id}`} className="flex items-center gap-3.5 rounded-[20px] bg-white p-3.5 shadow-card active:bg-sand">
          <VetAvatar name={visit.vet.name} color={visit.vet.color} size="size-12" text="text-base" />
          <span className="min-w-0 flex-1">
            <strong className="block font-display text-lg leading-tight font-semibold">{visit.vet.name}</strong>
            <span className="block truncate text-sm font-semibold text-muted">{visit.vet.specialty}</span>
          </span>
          <ChevronRight className="size-5 text-faint" aria-hidden="true" />
        </Link>
      )}

      <section aria-labelledby="tl-h" className="rounded-[28px] bg-white p-5 shadow-card">
        <h2 id="tl-h" className="mb-4 font-display text-[22px] font-semibold">
          Live timeline
        </h2>
        <Timeline steps={steps} />
      </section>

      {visit.symptoms && (
        <div className="rounded-[20px] bg-white p-4 shadow-card">
          <div className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">
            {visit.reason === "staff_flag" ? `Noticed by ${visit.requestedBy}` : "Your note"}
          </div>
          <p className="mt-1 font-semibold">{visit.symptoms}</p>
        </div>
      )}

      {visit.status === "completed" && (
        <>
          <VetReportCard visit={visit} />
          <a
            href={`/api/vet-report/${visit.id}`}
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-grape text-base font-extrabold text-white shadow-float active:scale-[0.98]"
          >
            <FileDown className="size-5" aria-hidden="true" /> Download PDF report
          </a>
        </>
      )}

      <BillCard refId={visit.id} closed={visit.status === "cancelled" || visit.status === "declined"} />

      {(visit.status === "booked" || visit.status === "requested") && <CancelWithReason kind="vet" id={visit.id} label="Cancel appointment" />}
      {visit.status === "cancelled" && visit.cancelReason && (
        <p className="rounded-2xl bg-sand px-4 py-3 text-sm font-bold text-muted">You cancelled this visit: {visit.cancelReason}</p>
      )}
    </div>
  );
}
