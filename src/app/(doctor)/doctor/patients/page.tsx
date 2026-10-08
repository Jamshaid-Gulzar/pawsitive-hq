import { ChevronRight, PawPrint, Search, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PetPhoto, Pill } from "@/components/ui";
import { getDoctorPatients } from "@/db/queries";
import { formatShortDate, formatTime, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { HEALTH_STATUS, VET_REASONS } from "@/lib/vet";

export const metadata: Metadata = { title: "My patients" };

const STATUS = {
  requested: { label: "Awaiting desk", className: "bg-sun-soft text-sun-ink" },
  booked: { label: "Booked", className: "bg-sky-soft text-sky-ink" },
  completed: { label: "Done", className: "bg-mint-soft text-mint-ink" },
} as Record<string, { label: string; className: string }>;

/** Every pet this doctor has seen or will see, with the full visit history. */
export default async function PatientsPage(props: PageProps<"/doctor/patients">) {
  const user = await requireRole("vet");
  const { q: qParam } = await props.searchParams;
  const q = typeof qParam === "string" ? qParam.trim().toLowerCase() : "";
  const all = await getDoctorPatients(user.vetId ?? "");
  const patients = q ? all.filter((p) => [p.pet.name, p.pet.breed, p.pet.owner.name].some((s) => s.toLowerCase().includes(q))) : all;
  const today = todayISO();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-lilac-soft text-lilac-ink">
          <PawPrint className="size-7" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[38px] leading-tight font-semibold">My patients</h1>
          <p className="font-semibold text-muted">
            {all.length} pet{all.length === 1 ? "" : "s"} and every visit you&apos;ve had with them.
          </p>
        </div>
        <form action="/doctor/patients" className="flex min-h-12 items-center gap-2 rounded-full border-2 border-line bg-white px-4">
          <Search className="size-4.5 text-muted" aria-hidden="true" />
          <label htmlFor="pt-q" className="sr-only">
            Search patients
          </label>
          <input id="pt-q" name="q" defaultValue={q} placeholder="Pet, breed or owner" className="w-48 bg-transparent font-semibold outline-none" />
        </form>
      </div>

      {patients.length === 0 ? (
        <Card className="p-12 text-center font-semibold text-muted">{q ? `No patients match "${q}".` : "No patients yet."}</Card>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,420px),1fr))] gap-4">
          {patients.map(({ pet, visits }) => {
            const last = visits.find((v) => v.status === "completed");
            const next = [...visits].reverse().find((v) => v.status !== "completed" && v.date >= today);
            return (
              <li key={pet.id} className="flex flex-col gap-3.5 rounded-[24px] bg-white p-5 shadow-card">
                <div className="flex items-start gap-3.5">
                  <PetPhoto src={pet.photo} alt={pet.name} className="size-16 shrink-0 rounded-[20px]" sizes="64px" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-display text-xl font-semibold">{pet.name}</strong>
                      {last?.healthStatus && <Pill className={HEALTH_STATUS[last.healthStatus].tone}>{HEALTH_STATUS[last.healthStatus].label}</Pill>}
                    </div>
                    <p className="text-sm font-semibold text-muted">
                      {pet.breed} · {pet.sex === "f" ? "Female" : "Male"} · {pet.owner.name}
                    </p>
                    {next && (
                      <p className="text-sm font-bold text-sky-ink">
                        Next: {formatShortDate(next.date)} at {formatTime(next.time)}
                      </p>
                    )}
                  </div>
                </div>
                {(pet.alert || pet.conditions.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {pet.alert && (
                      <Pill className="bg-rose-soft text-rose-ink">
                        <TriangleAlert className="size-3.5" aria-hidden="true" /> {pet.alert}
                      </Pill>
                    )}
                    {pet.conditions.map((c) => (
                      <Pill key={c} className="bg-rose-soft text-rose-ink">
                        {c}
                      </Pill>
                    ))}
                  </div>
                )}
                <ol className="flex flex-col divide-y divide-sand rounded-2xl bg-cream">
                  {visits.map((v) => {
                    const st = STATUS[v.status] ?? STATUS.booked;
                    return (
                      <li key={v.id}>
                        <Link href={`/doctor/visits/${v.id}`} className="flex items-center gap-3 px-3.5 py-2.5 text-sm transition hover:bg-sand/60">
                          <span className="w-16 shrink-0 font-extrabold">{formatShortDate(v.date)}</span>
                          <span className="min-w-0 flex-1 truncate font-semibold">
                            {VET_REASONS[v.reason].label}
                            {v.diagnosis ? ` — ${v.diagnosis}` : ""}
                          </span>
                          <Pill className={`${st.className} px-2 py-0.5 text-[10px]`}>{st.label}</Pill>
                          <ChevronRight className="size-4 text-faint" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
