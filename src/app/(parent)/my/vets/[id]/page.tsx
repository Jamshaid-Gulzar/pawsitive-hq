import { Award, CalendarCheck, ChevronLeft, Clock, GraduationCap, Languages, PawPrint, Stethoscope } from "lucide-react";
import { Availability } from "./Availability";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { VetAvatar } from "@/components/VetAvatar";
import { getTakenVetSlots, getVetProfile } from "@/db/queries";
import { nowStamp, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { CLINIC_HOURS, VET_COLORS, workDaysLabel } from "@/lib/vet";

export const metadata: Metadata = { title: "Doctor profile" };

export default async function VetProfilePage(props: PageProps<"/my/vets/[id]">) {
  await requireRole("parent");
  const { id } = await props.params;
  const { pet } = await props.searchParams;
  const [profile, taken] = await Promise.all([getVetProfile(id), getTakenVetSlots()]);
  if (!profile) notFound();
  const { vet, checkupsHere, petsSeen } = profile;
  const tone = VET_COLORS[vet.color] ?? VET_COLORS.mint;
  const today = todayISO();
  const petQuery = typeof pet === "string" ? `&pet=${pet}` : "";

  const stats = [
    { icon: Award, value: `${vet.experienceYears} yrs`, label: "Experience" },
    { icon: Stethoscope, value: String(checkupsHere), label: "Checkups here" },
    { icon: PawPrint, value: String(petsSeen), label: "Pets cared for" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-20">
      <Link href={`/my/vet?vet=${vet.id}${petQuery}`} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> Vet checkup
      </Link>

      <section className={`flex flex-col items-center gap-3 rounded-[30px] px-5 pt-7 pb-6 text-center ${tone.soft}`}>
        <VetAvatar name={vet.name} color={vet.color} size="size-28" text="text-4xl" />
        <div>
          <h1 className="font-display text-[30px] leading-tight font-semibold">{vet.name}</h1>
          <p className={`text-sm font-extrabold ${tone.ink}`}>{vet.title}</p>
          <p className="mt-1 font-semibold">{vet.specialty}</p>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        {stats.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 rounded-[20px] bg-white px-2 py-3.5 text-center shadow-card">
            <Icon className={`size-5 ${tone.ink}`} aria-hidden="true" />
            <span className="font-display text-xl leading-tight font-semibold">{value}</span>
            <span className="text-[11px] font-extrabold text-muted uppercase">{label}</span>
          </div>
        ))}
      </div>

      <section aria-labelledby="about-h">
        <h2 id="about-h" className="mb-2 font-display text-[22px] font-semibold">
          About
        </h2>
        <p className="text-[15px] leading-relaxed">{vet.bio}</p>
      </section>

      <section aria-labelledby="focus-h">
        <h2 id="focus-h" className="mb-2.5 font-display text-[22px] font-semibold">
          Specializes in
        </h2>
        <ul className="flex flex-wrap gap-2">
          {vet.focus.map((f) => (
            <li key={f} className={`rounded-full px-3.5 py-1.5 text-sm font-extrabold ${tone.soft} ${tone.ink}`}>
              {f}
            </li>
          ))}
        </ul>
      </section>

      <Card className="divide-y divide-sand">
        {[
          { icon: GraduationCap, label: "Education", value: vet.education },
          { icon: Languages, label: "Languages", value: vet.languages.join(", ") },
          { icon: CalendarCheck, label: "Works", value: workDaysLabel(vet.workDays) },
          { icon: Clock, label: "Hours", value: CLINIC_HOURS },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3.5 px-4 py-3.5">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-cream text-grape">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold tracking-[0.06em] text-muted uppercase">{label}</div>
              <div className="font-bold">{value}</div>
            </div>
          </div>
        ))}
      </Card>

      <Availability
        vet={{ id: vet.id, name: vet.name, workDays: vet.workDays }}
        today={today}
        nowTime={nowStamp().slice(11, 16)}
        taken={taken.filter((t) => t.startsWith(`${vet.id} `))}
        petId={typeof pet === "string" ? pet : undefined}
      />
    </div>
  );
}
