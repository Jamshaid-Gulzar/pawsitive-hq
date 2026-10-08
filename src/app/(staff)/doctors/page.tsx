import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { getAllVets, getDoctorMoney } from "@/db/queries";
import { requireRole } from "@/lib/session";
import { DoctorsBoard, FeeEditor } from "./DoctorsBoard";

export const metadata: Metadata = { title: "Doctors" };

export default async function DoctorsPage() {
  await requireRole("admin");
  const [doctors, money] = await Promise.all([getAllVets(), getDoctorMoney()]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-mint-soft text-mint-ink">
          <Stethoscope className="size-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[38px] leading-tight font-semibold">Doctors</h1>
          <p className="font-semibold text-muted">
            Add the vets customers can book, give them a sign-in, and pay them their share. Turning a doctor off hides them from booking but keeps their history.
          </p>
        </div>
      </div>
      <FeeEditor current={money.feePercent} />
      <DoctorsBoard doctors={doctors} money={money.byVet} />
    </>
  );
}
