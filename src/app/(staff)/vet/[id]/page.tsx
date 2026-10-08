import { ChevronLeft, Clock, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmVetVisit } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { PatientVisit } from "@/components/PatientVisit";
import { getVetVisit } from "@/db/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Checkup" };

/** Staff and the owner can follow a checkup; only the booked doctor records the exam. */
export default async function CheckupPage(props: PageProps<"/vet/[id]">) {
  const user = await requireRole("staff", "admin");
  const { id } = await props.params;
  const data = await getVetVisit(id);
  if (!data) notFound();
  const { visit } = data;
  const doctor = visit.vet?.name ?? "the doctor";

  const action =
    visit.status === "requested" ? (
      <div className="flex flex-col gap-3 rounded-2xl bg-sun-soft p-4">
        <p className="flex items-center gap-2 font-bold text-sun-ink">
          <Hourglass className="size-5" aria-hidden="true" /> Waiting for the front desk to confirm this request.
        </p>
        {user.role === "admin" && (
          <ActionButton
            action={confirmVetVisit.bind(null, visit.id)}
            pendingLabel="Confirming…"
            className="min-h-12 w-full rounded-full bg-mint text-[15px] font-extrabold text-white"
          >
            Confirm appointment
          </ActionButton>
        )}
      </div>
    ) : (
      <p className="flex items-center gap-2 rounded-2xl bg-sky-soft p-4 font-bold text-sky-ink">
        <Clock className="size-5" aria-hidden="true" /> Confirmed — waiting for {doctor} to examine {visit.pet.name}. The report appears here when done.
      </p>
    );

  return (
    <div className="flex flex-col gap-6">
      <Link href="/vet" className="inline-flex items-center gap-1 self-start text-sm font-extrabold text-grape hover:underline">
        <ChevronLeft className="size-4" aria-hidden="true" /> Vet clinic
      </Link>
      <PatientVisit data={data} action={action} />
    </div>
  );
}
