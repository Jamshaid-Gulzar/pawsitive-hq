import type { Metadata } from "next";
import { getPetsInHouse } from "@/db/queries";
import { requireRole } from "@/lib/session";
import { Composer } from "./Composer";

export const metadata: Metadata = { title: "Pawsitive Updates" };

export default async function UpdatesPage(props: PageProps<"/updates">) {
  await requireRole("staff", "admin");
  const { pet } = await props.searchParams;
  const inHouse = await getPetsInHouse();
  const pets = inHouse
    .map((b) => ({
      id: b.pet.id,
      name: b.pet.name,
      sex: b.pet.sex,
      photo: b.pet.photo,
      owner: b.pet.owner.name.split(" ")[0],
      where: b.service === "grooming" ? "Grooming" : b.service === "daycare" ? "Daycare" : "Boarding",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <h1 className="font-display text-[38px] font-semibold">New Pawsitive Update</h1>
      <p className="mt-1.5 mb-6 text-base font-semibold text-muted">
        Snap a photo, tap a few boxes, and the owner gets a cute text right away.
      </p>
      {pets.length === 0 ? (
        <p className="rounded-3xl bg-white p-10 text-center font-semibold text-muted shadow-card">
          No pets are checked in right now. Check one in from the floor board first.
        </p>
      ) : (
        <Composer pets={pets} initialPetId={typeof pet === "string" ? pet : undefined} />
      )}
    </>
  );
}
