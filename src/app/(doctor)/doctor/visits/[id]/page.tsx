import { CalendarClock, ChevronLeft, Hourglass, Lock, Play } from "lucide-react";
import { startVetVisit } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamForm } from "@/components/ExamForm";
import { PatientVisit } from "@/components/PatientVisit";
import { getVetVisit } from "@/db/queries";
import { addDays, formatLongDate, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Patient" };

export default async function DoctorVisitPage(props: PageProps<"/doctor/visits/[id]">) {
  const user = await requireRole("vet");
  const { id } = await props.params;
  const data = await getVetVisit(id);
  if (!data) notFound();
  const { visit } = data;
  const today = todayISO();

  const action =
    visit.vetId !== user.vetId ? (
      <p className="flex items-center gap-2 rounded-2xl bg-sand p-4 font-bold text-muted">
        <Lock className="size-5" aria-hidden="true" /> This visit is booked with {visit.vet?.name ?? "another doctor"}.
      </p>
    ) : visit.status === "requested" ? (
      <p className="flex items-center gap-2 rounded-2xl bg-sun-soft p-4 font-bold text-sun-ink">
        <Hourglass className="size-5" aria-hidden="true" /> The front desk hasn&apos;t confirmed this booking yet. You&apos;ll be able to examine{" "}
        {visit.pet.name} once it&apos;s confirmed.
      </p>
    ) : visit.date > today ? (
      <p className="flex items-center gap-2 rounded-2xl bg-sky-soft p-4 font-bold text-sky-ink">
        <CalendarClock className="size-5" aria-hidden="true" /> Confirmed for {formatLongDate(visit.date)}. The exam form opens on the day.
      </p>
    ) : !visit.startedAt ? (
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-5 shadow-card">
        <p className="font-semibold text-muted">
          When {visit.pet.name} is with you, start the checkup. {visit.pet.owner.name.split(" ")[0]} gets a notification and sees it live on
          the timeline.
        </p>
        <ActionButton
          action={startVetVisit.bind(null, visit.id)}
          pendingLabel="Starting…"
          className="min-h-13 w-full rounded-full bg-mint text-base font-extrabold text-white"
        >
          <Play className="size-5" aria-hidden="true" /> Start checkup
        </ActionButton>
      </div>
    ) : (
      <ExamForm
        visitId={visit.id}
        petName={visit.pet.name}
        ownerName={visit.pet.owner.name.split(" ")[0]}
        conditions={visit.pet.conditions}
        minFollowUp={addDays(today, 1)}
      />
    );

  return (
    <div className="flex flex-col gap-6">
      <Link href="/doctor" className="inline-flex items-center gap-1 self-start text-sm font-extrabold text-grape hover:underline">
        <ChevronLeft className="size-4" aria-hidden="true" /> My day
      </Link>
      <PatientVisit data={data} action={action} />
    </div>
  );
}
