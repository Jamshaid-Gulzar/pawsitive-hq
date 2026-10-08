import type { Metadata } from "next";
import { getDb } from "@/db";
import { getAvailability, getOwnerPets, getPriceList, latestRecord, recordDates } from "@/db/queries";
import { toPriceMap } from "@/lib/pricing";
import { nowStamp, todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import type { Service } from "@/lib/vaccines";
import { BookingWizard } from "./BookingWizard";

export const metadata: Metadata = { title: "Book a visit" };

const SERVICES: Service[] = ["boarding", "daycare", "grooming"];

export default async function BookPage(props: PageProps<"/my/book">) {
  const user = await requireRole("parent");
  const { pet, service } = await props.searchParams;
  const db = await getDb();
  const [owned, availability, priceList] = await Promise.all([getOwnerPets(user.id), getAvailability(), getPriceList()]);
  const pets = await Promise.all(
    owned.map(async (p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      breed: p.breed,
      sex: p.sex,
      photo: p.photo,
      onFile: recordDates(await latestRecord(db, p.id)),
    })),
  );

  return (
    <BookingWizard
      pets={pets}
      ownerName={user.name}
      today={todayISO()}
      nowTime={nowStamp().slice(11, 16)}
      availability={availability}
      initialPetId={typeof pet === "string" ? pet : undefined}
      initialService={SERVICES.find((s) => s === service)}
      prices={toPriceMap(priceList.prices)}
      discount={priceList.discount}
    />
  );
}
