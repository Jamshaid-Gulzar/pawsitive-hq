import { getVets } from "@/db/queries";

/** Active doctors for the quick demo login dropdown. */
export async function demoDoctors() {
  return (await getVets()).map((v) => ({ id: v.id, name: v.name, specialty: v.specialty }));
}
