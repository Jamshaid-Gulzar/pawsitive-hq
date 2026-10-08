import { CalendarX, MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { getCancellations } from "@/db/queries";
import { formatLongDate, formatStamp, formatTime } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { VET_REASONS } from "@/lib/vet";

export const metadata: Metadata = { title: "Cancellations" };

export default async function CancellationsPage() {
  await requireRole("staff", "admin");
  const items = await getCancellations();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-rose-soft text-rose-ink">
          <CalendarX className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Cancellations</h1>
          <p className="font-semibold text-muted">Last 30 days. Reach out to help them rebook.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center font-semibold text-muted">No cancellations in the last 30 days.</Card>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-4">
          {items.map((c) => (
            <li key={c.id} className="flex flex-col gap-3.5 rounded-[24px] bg-white p-5 shadow-card">
              <div className="flex items-start gap-3.5">
                <PetPhoto src={c.pet.photo} alt={c.pet.name} className="size-14 shrink-0 rounded-[18px]" sizes="56px" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="font-display text-xl font-semibold">{c.pet.name}</strong>
                    <Pill className="bg-sand text-muted capitalize">{c.kind === "vet" ? "Vet checkup" : c.service}</Pill>
                  </div>
                  <p className="text-sm font-bold">
                    {c.pet.owner.name}
                    {c.pet.owner.phone && (
                      <span className="ml-2 inline-flex items-center gap-1 font-semibold text-muted">
                        <Phone className="size-3.5" aria-hidden="true" /> {c.pet.owner.phone}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-faint">{c.cancelledAt ? formatStamp(c.cancelledAt) : ""}</span>
              </div>
              <p className="text-sm font-semibold text-muted">
                Was booked for{" "}
                {c.kind === "vet"
                  ? `${formatLongDate(c.date)} at ${formatTime(c.time)} · ${VET_REASONS[c.reason].label}${c.vet ? ` with ${c.vet.name}` : ""}`
                  : `${formatLongDate(c.startDate)}${c.endDate !== c.startDate ? ` → ${formatLongDate(c.endDate)}` : ""}${c.dropoffTime ? ` · ${formatTime(c.dropoffTime)}` : ""}`}
              </p>
              <div className="rounded-2xl bg-rose-soft px-4 py-3">
                <div className="text-xs font-extrabold tracking-[0.06em] text-rose-ink uppercase">Reason</div>
                <p className="font-bold text-rose-ink">{c.cancelReason ?? "No reason given"}</p>
              </div>
              <Link
                href={`/messages?pet=${c.pet.id}&c=${c.kind === "vet" ? "vet" : "team"}`}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-ink text-sm font-extrabold transition hover:bg-ink hover:text-white"
              >
                <MessageCircle className="size-4.5" aria-hidden="true" /> Message {c.pet.owner.name.split(" ")[0]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
