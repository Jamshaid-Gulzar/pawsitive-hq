import { BellRing, NotebookPen, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { getReportsBoard } from "@/db/queries";
import { formatLongDate, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { PetReportCard } from "./PetReportCard";

export const metadata: Metadata = { title: "Daily reports" };

export default async function ReportsPage() {
  await requireRole("staff", "admin");
  const pets = await getReportsBoard();
  const missing = pets.filter((p) => !p.report);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-lilac-soft text-lilac-ink">
          <NotebookPen className="size-7" aria-hidden="true" />
        </span>
        <div>
          <div className="text-[15px] font-bold text-muted">{formatLongDate(todayISO())}</div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Daily reports</h1>
        </div>
      </div>

      {missing.length > 0 ? (
        <p role="status" className="mb-6 flex items-center gap-3 rounded-[20px] bg-lilac-soft px-5 py-4 font-bold text-lilac-ink">
          <BellRing className="size-6 shrink-0" aria-hidden="true" />
          Reminder: {missing.length} pet{missing.length === 1 ? "" : "s"} still need{missing.length === 1 ? "s" : ""} today&apos;s report —{" "}
          {missing.map((m) => m.pet.name).join(", ")}. Families get notified as soon as you send it.
        </p>
      ) : pets.length > 0 ? (
        <p className="mb-6 flex items-center gap-3 rounded-[20px] bg-mint-soft px-5 py-4 font-bold text-mint-ink">
          <PartyPopper className="size-6" aria-hidden="true" /> Every report is done for today. Great work!
        </p>
      ) : null}

      {pets.length === 0 ? (
        <Card className="p-12 text-center font-semibold text-muted">No boarding or daycare pets on site right now.</Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,440px),1fr))] gap-4">
          {pets.map((b) => (
            <PetReportCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </>
  );
}
