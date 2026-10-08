import { FileText, Lock, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { approveBooking, remindOwner } from "@/app/actions";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Card, Pill, PetPhoto } from "@/components/ui";
import { getComplianceQueue, recordDates } from "@/db/queries";
import { formatDate, formatShortDate, formatStamp } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { describeIssue, requiredVaccines, vaccineLabel, type VaccineKey } from "@/lib/vaccines";
import { EditDates } from "./EditDates";

export const metadata: Metadata = { title: "Vaccine check" };

export default async function VaccinesPage(props: PageProps<"/vaccines">) {
  const user = await requireRole("staff", "admin");
  const { b } = await props.searchParams;
  const { flagged, clearedCount } = await getComplianceQueue();
  const selected = flagged.find((f) => f.id === b) ?? flagged[0] ?? null;
  const locked = flagged.filter((f) => f.status === "locked").length;

  return (
    <>
      <AutoRefresh seconds={10} />
      <h1 className="font-display text-[38px] font-semibold">Vaccine check</h1>
      <p className="mt-1.5 mb-6 text-base font-semibold text-muted">
        The scanner reads every vet record. Anything expired or unclear lands here.
      </p>

      <section aria-label="Summary" className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        <Tile value={locked} label="Bookings locked" className="bg-rose-soft text-rose-ink" />
        <Tile value={flagged.length - locked} label="Need a human look" className="bg-sun-soft text-sun-ink" />
        <Tile value={clearedCount} label="Upcoming visits cleared" className="bg-mint-soft text-mint-ink" />
      </section>

      {!selected ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <PartyPopper className="size-12 text-mint" aria-hidden="true" />
          <h2 className="font-display text-2xl font-semibold">All clear!</h2>
          <p className="font-semibold text-muted">Every upcoming visit has up-to-date vaccines.</p>
        </Card>
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-labelledby="queue-h" className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
            <h2 id="queue-h" className="mb-1 font-display text-2xl font-semibold">
              Needs attention
            </h2>
            {flagged.map((f) => {
              const isSelected = f.id === selected.id;
              const first = f.issues[0];
              return (
                <Link
                  key={f.id}
                  href={`/vaccines?b=${f.id}`}
                  scroll={false}
                  aria-current={isSelected ? "true" : undefined}
                  className={`flex flex-wrap items-center gap-4 rounded-[22px] bg-white p-4 transition hover:-translate-y-0.5 ${
                    isSelected ? "shadow-[inset_0_0_0_3px_var(--color-grape),0_10px_26px_rgb(27_31_59/0.08)]" : "shadow-card"
                  }`}
                >
                  <PetPhoto src={f.pet.photo} alt={f.pet.name} className="size-16 shrink-0 rounded-[20px]" sizes="64px" />
                  <div className="min-w-0 flex-[1_1_180px]">
                    <div className="font-display text-[21px] font-semibold">{f.pet.name}</div>
                    <div className="text-sm font-semibold text-muted">
                      {f.pet.breed} · {f.pet.owner.name} · <span className="capitalize">{f.service}</span> {formatShortDate(f.startDate)}
                    </div>
                  </div>
                  {first && (
                    <div className="text-sm font-bold">
                      <span className="text-muted">{vaccineLabel(first.vaccine, f.pet.species)}</span>
                      <br />
                      <span className={first.kind === "missing" ? "text-ink" : "text-rose-ink"}>
                        {first.kind === "missing" ? "Unreadable" : first.kind === "expired" ? `Expired ${formatShortDate(first.date!)}` : `Ends ${formatShortDate(first.date!)}`}
                      </span>
                    </div>
                  )}
                  {f.status === "locked" ? (
                    <Pill className="bg-rose-soft text-[13px] text-rose-ink">
                      <Lock className="size-3.5" aria-hidden="true" /> Locked
                    </Pill>
                  ) : (
                    <Pill className="bg-sun-soft text-[13px] text-sun-ink">Check by hand</Pill>
                  )}
                </Link>
              );
            })}
          </section>

          <aside aria-labelledby="detail-h" className="flex min-w-0 flex-[1_1_340px] flex-col gap-4.5 rounded-[26px] bg-white p-5.5 shadow-card">
            <div className="flex items-center gap-3.5">
              <PetPhoto src={selected.pet.photo} alt="" className="size-14 shrink-0 rounded-full border-[3px] border-coral" sizes="56px" />
              <div>
                <h2 id="detail-h" className="font-display text-[22px] font-semibold">
                  {selected.pet.name}&apos;s record
                </h2>
                <div className="text-[13px] font-semibold text-muted">
                  {selected.record ? `Updated ${formatStamp(selected.record.uploadedAt)}` : "No record on file"}
                </div>
              </div>
            </div>

            {selected.record?.image ? (
              <a href={selected.record.image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[18px] border-2 border-line">
                <PetPhoto src={selected.record.image} alt={`${selected.pet.name}'s uploaded vet record`} className="h-48 w-full bg-white [&_img]:object-contain" sizes="360px" />
              </a>
            ) : (
              <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-[18px] bg-grape-soft text-sm font-bold text-grape">
                <FileText className="size-8" aria-hidden="true" />
                Record on file from a previous visit
              </div>
            )}

            <ul className="flex flex-col gap-2">
              {selected.issues.map((i) => (
                <li key={i.vaccine} className="rounded-xl bg-rose-soft px-3.5 py-2.5 text-sm font-bold text-rose-ink">
                  {describeIssue(i, selected.pet.species)}
                  {i.date ? ` · ${formatDate(i.date)}` : ""}
                </li>
              ))}
            </ul>

            <dl className="grid grid-cols-[1fr_auto] items-center gap-x-3.5 gap-y-2.5 text-[15px]">
              {requiredVaccines(selected.pet.species, selected.service).map((key) => {
                const date = recordDates(selected.record ?? undefined)[key];
                const bad = selected.issues.some((i) => i.vaccine === key);
                return (
                  <div key={key} className="contents">
                    <dt className="font-bold">{vaccineLabel(key, selected.pet.species)}</dt>
                    <dd className={`font-extrabold ${bad ? "text-rose-ink" : "text-mint-ink"}`}>{date ? formatDate(date) : "Not found"}</dd>
                  </div>
                );
              })}
            </dl>

            <div className="flex flex-wrap gap-2.5">
              <div className="flex-[1_1_160px]">
                <ActionButton
                  action={remindOwner.bind(null, selected.id)}
                  className="min-h-12 w-full rounded-full bg-grape px-5 text-[15px] font-extrabold text-white hover:bg-grape-dark"
                  pendingLabel="Sending…"
                >
                  Text {selected.pet.owner.name.split(" ")[0]} a reminder
                </ActionButton>
              </div>
              <div className="flex flex-[1_1_140px]">
              <EditDates
                key={`${selected.id}-${selected.record?.id}`}
                petId={selected.pet.id}
                dates={recordDates(selected.record ?? undefined)}
                labels={Object.fromEntries(
                  (["rabies", "core", "bordetella"] as VaccineKey[]).map((k) => [k, vaccineLabel(k, selected.pet.species)]),
                ) as Record<VaccineKey, string>}
              />
              </div>
            </div>

            {user.role === "admin" ? (
              <ActionButton
                action={approveBooking.bind(null, selected.id)}
                className="min-h-11 w-full text-sm font-extrabold text-grape underline hover:text-grape-dark"
              >
                Override and approve (manager)
              </ActionButton>
            ) : (
              <p className="text-center text-[13px] font-semibold text-muted">Only the owner can override a lock.</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function Tile({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`rounded-[22px] px-5 py-4.5 ${className}`}>
      <div className="font-display text-[34px] leading-none font-semibold">{value}</div>
      <div className="mt-1.5 text-sm font-extrabold">{label}</div>
    </div>
  );
}
