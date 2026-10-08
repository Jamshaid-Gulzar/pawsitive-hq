import { ChevronRight, Syringe } from "lucide-react";
import Link from "next/link";
import { getVaccinesDue } from "@/db/queries";

/** Staff/admin alert: pets whose vaccines are expired or due within a week. */
export async function VaccinesDueBanner() {
  const urgent = (await getVaccinesDue()).filter((v) => v.stage !== "due_30");
  if (urgent.length === 0) return null;
  const names = [...new Set(urgent.map((v) => v.pet.name))];
  return (
    <Link
      href="/vaccines-due"
      className="mb-6 flex items-center gap-3.5 rounded-[20px] bg-sky-soft px-5 py-4 text-sky-ink transition hover:-translate-y-0.5"
    >
      <Syringe className="size-6 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 font-bold">
        Vaccine alert: {names.length} pet{names.length === 1 ? " has" : "s have"} a vaccine expired or due this week — {names.join(", ")}.
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-extrabold">
        See all <ChevronRight className="size-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
