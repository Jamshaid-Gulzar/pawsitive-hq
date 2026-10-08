import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { addDays, formatLongDate, formatTime, nowStamp, todayISO } from "@/lib/dates";
import { dueText } from "@/lib/vaccines";
import { getDb } from ".";
import { mapsUrl } from "@/lib/business";
import { getBusiness } from "./business";
import { runMonthEndPayouts } from "./earnings";
import { getVaccinesDue } from "./queries";
import { bookings, messages, pets, vaccineReminders, type VaccineStage, vetVisits, vets } from "./schema";

// There's no background job runner in this free setup, so reminders go out
// the first time anyone opens the app after they become due (checked at most
// every 15 seconds per server process). Each reminder is sent once.
let lastRun = 0;

export async function sendDueReminders() {
  if (Date.now() - lastRun < 15_000) return;
  lastRun = Date.now();
  const db = await getDb();
  const tomorrow = addDays(todayISO(), 1);
  const insert = (petId: string, title: string, body: string, channel: "team" | "vet", linkHref: string, linkLabel: string) =>
    db.insert(messages).values({
      id: `m_${randomUUID().slice(0, 8)}`,
      petId,
      author: "system",
      title,
      body,
      tags: [],
      channel,
      linkHref,
      linkLabel,
      seenByStaff: true,
      createdAt: nowStamp(),
    });

  const due = await db
    .select({ booking: bookings, pet: pets })
    .from(bookings)
    .innerJoin(pets, eq(bookings.petId, pets.id))
    .where(and(eq(bookings.status, "confirmed"), eq(bookings.startDate, tomorrow), eq(bookings.reminderSent, false)));
  const business = await getBusiness();
  const where = `\nFind us at: ${business.address}`;
  const map = mapsUrl(business);
  for (const { booking: b, pet } of due) {
    const what = b.service === "grooming" ? "grooming appointment is" : b.service === "boarding" ? "stay starts" : "daycare day is";
    const time = b.dropoffTime ? ` — ${b.service === "grooming" ? "appointment" : "drop-off"} at ${formatTime(b.dropoffTime)}` : "";
    await insert(
      pet.id,
      "Reminder: see you tomorrow!",
      `${pet.name}'s ${what} tomorrow, ${formatLongDate(tomorrow)}${time}. Tap "I've arrived" on the timeline when you get here.${where}`,
      "team",
      map,
      "Get directions",
    );
    await db.update(bookings).set({ reminderSent: true }).where(eq(bookings.id, b.id));
  }

  const dueVet = await db
    .select({ visit: vetVisits, pet: pets, vet: vets })
    .from(vetVisits)
    .innerJoin(pets, eq(vetVisits.petId, pets.id))
    .leftJoin(vets, eq(vetVisits.vetId, vets.id))
    .where(and(eq(vetVisits.status, "booked"), eq(vetVisits.date, tomorrow), eq(vetVisits.reminderSent, false)));
  for (const { visit: v, pet, vet } of dueVet) {
    await insert(
      pet.id,
      "Reminder: vet visit tomorrow",
      `${pet.name} sees ${vet?.name ?? "our vet"} tomorrow, ${formatLongDate(tomorrow)} at ${formatTime(v.time)}. Bring any medicines ${pet.sex === "f" ? "she" : "he"} is taking.${where}`,
      "vet",
      map,
      "Get directions",
    );
    await db.update(vetVisits).set({ reminderSent: true }).where(eq(vetVisits.id, v.id));
  }

  // Month end: doctors are credited for last month's paid visits.
  await runMonthEndPayouts(db);

  // Vaccines: the owner hears once when a shot is 30 days out, again in its
  // last week, and once more if it expires (or if we have no date at all).
  const sentIds = new Set((await db.select({ id: vaccineReminders.id }).from(vaccineReminders)).map((r) => r.id));
  for (const v of await getVaccinesDue()) {
    const id = `${v.pet.id}:${v.key}:${v.date ?? "none"}:${v.stage}`;
    if (sentIds.has(id)) continue;
    const { pet } = v;
    const they = pet.sex === "f" ? "her" : "his";
    const title = v.stage === "expired" ? `${v.label} vaccine expired` : v.stage === "missing" ? `${v.label} date needed` : "Vaccine reminder";
    const body =
      v.stage === "missing"
        ? `We don't have a ${v.label} date for ${pet.name}. Upload ${they} latest vet record, or book a vaccination with our in-house vets.`
        : v.stage === "expired"
          ? `${pet.name}'s ${v.label} vaccine expired on ${formatLongDate(v.date!)}. Boarding, daycare and grooming are on hold until it's renewed — book a quick vaccination visit with our vets.`
          : `${pet.name}'s ${v.label} vaccine is due on ${formatLongDate(v.date!)} (${dueText(v).toLowerCase()}). Book a vaccination with our vets so ${they} visits aren't put on hold.`;
    await insert(pet.id, title, body, "vet", `/my/vet?pet=${pet.id}&reason=vaccination`, "Book vaccination");
    await db.insert(vaccineReminders).values({ id, petId: pet.id, vaccine: v.key, dueDate: v.date, stage: v.stage as VaccineStage, sentAt: nowStamp() });
  }
}
