import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getOwnerPets, getPriceList, getTakenVetSlots, getVets } from "@/db/queries";
import { toPriceMap } from "@/lib/pricing";
import type { VetReason } from "@/db/schema";
import { nowStamp, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { VetBookingForm } from "./VetBookingForm";

export const metadata: Metadata = { title: "Vet checkup" };

export default async function VetBookingPage(props: PageProps<"/my/vet">) {
  const user = await requireRole("parent");
  const { pet, reason, vet, date, time } = await props.searchParams;
  const [pets, vets, taken, priceList] = await Promise.all([getOwnerPets(user.id), getVets(), getTakenVetSlots(), getPriceList()]);

  return (
    <div className="flex flex-col gap-2">
      <Link href="/my/book" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> Other services
      </Link>
      <VetBookingForm
        pets={pets.map((p) => ({ id: p.id, name: p.name, breed: p.breed, species: p.species, photo: p.photo, conditions: p.conditions }))}
        vets={vets.map((v) => ({
          id: v.id,
          name: v.name,
          title: v.title,
          specialty: v.specialty,
          experienceYears: v.experienceYears,
          color: v.color,
          workDays: v.workDays,
        }))}
        today={todayISO()}
        nowTime={nowStamp().slice(11, 16)}
        taken={taken}
        initialPetId={typeof pet === "string" ? pet : undefined}
        initialReason={typeof reason === "string" ? (reason as VetReason) : undefined}
        initialVetId={typeof vet === "string" ? vet : undefined}
        initialDate={typeof date === "string" ? date : undefined}
        initialTime={typeof time === "string" ? time : undefined}
        prices={toPriceMap(priceList.prices)}
        discount={priceList.discount}
      />
    </div>
  );
}
