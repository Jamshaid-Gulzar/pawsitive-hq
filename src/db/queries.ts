import { and, asc, desc, eq, inArray, lte, gte, ne, notInArray } from "drizzle-orm";
import { ACTIVE_STATUSES, kennelDays, type AvailabilityData } from "@/lib/availability";
import { addDays, formatShortDate, formatTime, todayISO } from "@/lib/dates";
import { vaccineSchedule, type VaccineDates, type VaccineDue } from "@/lib/vaccines";
import { doctorSplit } from "@/lib/pricing";
import { earningLines, getDoctorFee, type EarningLine } from "./earnings";
import { getDb, type Db } from ".";
import {
  bookings,
  dailyReports,
  events,
  messages,
  type Channel,
  pets,
  units,
  users,
  invoices,
  payouts,
  prices,
  settings,
  vaccineRecords,
  vaccineReminders,
  vetVisits,
  vets,
  type Invoice,
  type Payout,
  type Vet,
  type Booking,
  type Pet,
  type User,
  type VaccineRecord,
  type VetVisit,
} from "./schema";

export type VetVisitWithPet = VetVisit & { pet: PetWithOwner; vet: Vet | null };

async function attachPetsToVisits(db: Db, rows: VetVisit[]): Promise<VetVisitWithPet[]> {
  const map = await petsWithOwners(db, rows.map((v) => v.petId));
  const allVets = new Map((await db.select().from(vets)).map((v) => [v.id, v]));
  return rows.map((v) => ({ ...v, pet: map.get(v.petId)!, vet: (v.vetId && allVets.get(v.vetId)) || null }));
}

/** Doctors customers can book (the admin can switch a doctor off). */
export async function getVets(): Promise<Vet[]> {
  const db = await getDb();
  return db.select().from(vets).where(eq(vets.active, true)).orderBy(asc(vets.sort));
}

/** Every doctor, active or not, for the admin's Doctors page. */
export async function getAllVets() {
  const db = await getDb();
  const all = await db.select().from(vets).orderBy(asc(vets.sort));
  const logins = await db.select({ vetId: users.vetId, phone: users.phone, email: users.email }).from(users).where(eq(users.role, "vet"));
  const today = todayISO();
  const upcoming = await db
    .select({ vetId: vetVisits.vetId })
    .from(vetVisits)
    .where(and(inArray(vetVisits.status, ["requested", "booked"]), gte(vetVisits.date, today)));
  const done = await db.select({ vetId: vetVisits.vetId }).from(vetVisits).where(eq(vetVisits.status, "completed"));
  return all.map((v) => ({
    ...v,
    phone: logins.find((l) => l.vetId === v.id)?.phone ?? null,
    email: logins.find((l) => l.vetId === v.id)?.email ?? null,
    upcoming: upcoming.filter((u) => u.vetId === v.id).length,
    completed: done.filter((u) => u.vetId === v.id).length,
  }));
}

export async function getVetProfile(id: string) {
  const db = await getDb();
  const [vet] = await db.select().from(vets).where(and(eq(vets.id, id), eq(vets.active, true)));
  if (!vet) return null;
  const done = await db
    .select({ petId: vetVisits.petId })
    .from(vetVisits)
    .where(and(eq(vetVisits.vetId, id), eq(vetVisits.status, "completed")));
  return { vet, checkupsHere: done.length, petsSeen: new Set(done.map((d) => d.petId)).size };
}

/** Taken times per vet from today on (requested or confirmed), as "vetId date time" keys. No pet or owner details. */
export async function getTakenVetSlots(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ vetId: vetVisits.vetId, date: vetVisits.date, time: vetVisits.time })
    .from(vetVisits)
    .where(and(inArray(vetVisits.status, ["requested", "booked"]), gte(vetVisits.date, todayISO())));
  return rows.map((r) => `${r.vetId} ${r.date} ${r.time}`);
}

/** How full kennels and time slots are, for the booking calendar. Counts only. */
export async function getAvailability(): Promise<AvailabilityData> {
  const db = await getDb();
  const today = todayISO();
  const active = await db
    .select({ service: bookings.service, startDate: bookings.startDate, endDate: bookings.endDate, dropoffTime: bookings.dropoffTime })
    .from(bookings)
    .where(and(inArray(bookings.status, [...ACTIVE_STATUSES]), gte(bookings.endDate, today)));
  const kennelLoad: Record<string, number> = {};
  const slotLoad: Record<string, number> = {};
  for (const b of active) {
    if (b.service !== "grooming") for (const d of kennelDays(b.startDate, b.endDate)) kennelLoad[d] = (kennelLoad[d] ?? 0) + 1;
    if (b.dropoffTime) {
      const key = `${b.service} ${b.startDate} ${b.dropoffTime}`;
      slotLoad[key] = (slotLoad[key] ?? 0) + 1;
    }
  }
  return { kennelLoad, slotLoad };
}

export type RequestItem =
  | ({ kind: "booking" } & BookingWithPet)
  | ({ kind: "vet" } & VetVisitWithPet);

/** Everything waiting for the admin: new booking and vet requests, oldest first. */
export async function getRequests() {
  const db = await getDb();
  const newBookings = await attachPets(
    db,
    await db.select().from(bookings).where(eq(bookings.status, "requested")).orderBy(asc(bookings.createdAt)),
  );
  const newVisits = await attachPetsToVisits(
    db,
    await db.select().from(vetVisits).where(eq(vetVisits.status, "requested")).orderBy(asc(vetVisits.createdAt)),
  );
  const items: RequestItem[] = [
    ...newBookings.map((b) => ({ kind: "booking" as const, ...b })),
    ...newVisits.map((v) => ({ kind: "vet" as const, ...v })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const onHold = await attachPets(
    db,
    await db.select().from(bookings).where(inArray(bookings.status, ["locked", "review"])).orderBy(desc(bookings.createdAt)),
  );
  const today = todayISO();
  const confirmedToday = [
    ...(await db.select({ at: bookings.confirmedAt }).from(bookings).where(gte(bookings.confirmedAt, today))),
    ...(await db.select({ at: vetVisits.confirmedAt }).from(vetVisits).where(gte(vetVisits.confirmedAt, today))),
  ];
  // One card per pet: a pet with two services waiting shows both on the same card.
  const byPet = new Map<string, { pet: PetWithOwner; items: RequestItem[]; newest: string }>();
  for (const item of items) {
    const g = byPet.get(item.petId) ?? { pet: item.pet, items: [], newest: item.createdAt };
    g.items.push(item);
    if (item.createdAt > g.newest) g.newest = item.createdAt;
    byPet.set(item.petId, g);
  }
  const groups = [...byPet.values()].sort((a, b) => b.newest.localeCompare(a.newest));
  return { items, groups, onHold, onHoldCount: onHold.length, confirmedToday: confirmedToday.length };
}

export async function countRequests(): Promise<number> {
  const db = await getDb();
  const a = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.status, "requested"));
  const b = await db.select({ id: vetVisits.id }).from(vetVisits).where(eq(vetVisits.status, "requested"));
  return a.length + b.length;
}

/** A doctor's own appointments: today's list and the next two weeks. */
export async function getDoctorSchedule(vetId: string) {
  const db = await getDb();
  const today = todayISO();
  const rows = await attachPetsToVisits(
    db,
    await db
      .select()
      .from(vetVisits)
      .where(and(eq(vetVisits.vetId, vetId), inArray(vetVisits.status, ["requested", "booked", "completed"]), gte(vetVisits.date, addDays(today, -1))))
      .orderBy(asc(vetVisits.date), asc(vetVisits.time)),
  );
  const [vet] = await db.select().from(vets).where(eq(vets.id, vetId));
  return {
    vet: vet ?? null,
    today,
    todays: rows.filter((v) => v.date === today || (v.date < today && v.status === "booked")),
    upcoming: rows.filter((v) => v.date > today && v.date <= addDays(today, 14)),
  };
}

export async function getEvents(ref: string) {
  const db = await getDb();
  return db.select().from(events).where(eq(events.ref, ref)).orderBy(asc(events.at));
}

/** Today's clinic list (including anything overdue), what's coming up, and what's done today. */
export async function getVetClinic() {
  const db = await getDb();
  const today = todayISO();
  const booked = await attachPetsToVisits(
    db,
    await db.select().from(vetVisits).where(eq(vetVisits.status, "booked")).orderBy(asc(vetVisits.date), asc(vetVisits.time)),
  );
  const doneToday = await attachPetsToVisits(
    db,
    await db
      .select()
      .from(vetVisits)
      .where(and(eq(vetVisits.status, "completed"), gte(vetVisits.completedAt, today)))
      .orderBy(desc(vetVisits.completedAt)),
  );
  const allVets = await db.select().from(vets).where(eq(vets.active, true)).orderBy(asc(vets.sort));
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  return {
    today,
    queue: booked.filter((v) => v.date <= today),
    upcoming: booked.filter((v) => v.date > today),
    doneToday,
    onDuty: allVets.filter((v) => v.workDays.includes(day)),
  };
}

export async function getVetVisit(id: string) {
  const db = await getDb();
  const [visit] = await attachPetsToVisits(db, await db.select().from(vetVisits).where(eq(vetVisits.id, id)));
  if (!visit) return null;
  const history = await db
    .select()
    .from(vetVisits)
    .where(and(eq(vetVisits.petId, visit.petId), eq(vetVisits.status, "completed")))
    .orderBy(desc(vetVisits.date));
  const [stay] = await db
    .select({ unitLabel: units.label })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.petId, visit.petId), eq(bookings.status, "checked_in")));
  return { visit, history: history.filter((h) => h.id !== id), hereIn: stay?.unitLabel ?? null };
}

export async function getOwnedVetVisit(ownerId: string, id: string) {
  const db = await getDb();
  const [row] = await db
    .select({ visit: vetVisits, pet: pets, vet: vets })
    .from(vetVisits)
    .innerJoin(pets, eq(vetVisits.petId, pets.id))
    .leftJoin(vets, eq(vetVisits.vetId, vets.id))
    .where(and(eq(vetVisits.id, id), eq(pets.ownerId, ownerId)));
  return row ? { ...row.visit, pet: row.pet, vet: row.vet, events: await getEvents(id) } : null;
}

export type PetWithOwner = Pet & { owner: User };
export type BookingWithPet = Booking & { pet: PetWithOwner };

async function petsWithOwners(db: Db, petIds: string[]): Promise<Map<string, PetWithOwner>> {
  if (petIds.length === 0) return new Map();
  const rows = await db
    .select({ pet: pets, owner: users })
    .from(pets)
    .innerJoin(users, eq(pets.ownerId, users.id))
    .where(inArray(pets.id, [...new Set(petIds)]));
  return new Map(rows.map((r) => [r.pet.id, { ...r.pet, owner: r.owner }]));
}

async function attachPets(db: Db, rows: Booking[]): Promise<BookingWithPet[]> {
  const map = await petsWithOwners(db, rows.map((b) => b.petId));
  return rows.map((b) => ({ ...b, pet: map.get(b.petId)! }));
}

export function recordDates(record: VaccineRecord | undefined): VaccineDates {
  return {
    rabies: record?.rabiesExp ?? null,
    core: record?.coreExp ?? null,
    bordetella: record?.bordetellaExp ?? null,
  };
}

export async function latestRecord(db: Db, petId: string): Promise<VaccineRecord | undefined> {
  const [row] = await db
    .select()
    .from(vaccineRecords)
    .where(eq(vaccineRecords.petId, petId))
    .orderBy(desc(vaccineRecords.uploadedAt))
    .limit(1);
  return row;
}

export async function getBoard() {
  const db = await getDb();
  const today = todayISO();
  const allUnits = await db.select().from(units).orderBy(asc(units.sort));
  const inHouse = await attachPets(db, await db.select().from(bookings).where(eq(bookings.status, "checked_in")));
  const arrivals = await attachPets(
    db,
    await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.status, "confirmed"), lte(bookings.startDate, today), gte(bookings.endDate, today))),
  );
  const flagged = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.status, ["locked", "review"]));
  const vetToday = await db
    .select({ id: vetVisits.id, petId: vetVisits.petId, time: vetVisits.time })
    .from(vetVisits)
    .where(and(eq(vetVisits.status, "booked"), lte(vetVisits.date, today)));

  const byUnit = new Map(inHouse.map((b) => [b.unitId, b]));
  const slots = allUnits.map((unit) => ({ unit, booking: byUnit.get(unit.id) ?? null }));
  const birthdayToday = (p: Pet) => !!p.birthday && p.birthday.slice(5) === today.slice(5) && p.birthday < today;

  return {
    today,
    kennels: slots.filter((s) => s.unit.kind !== "table"),
    tables: slots.filter((s) => s.unit.kind === "table"),
    arrivals,
    meds: inHouse
      .filter((b) => b.pet.medTime)
      .sort((a, b) => a.pet.medTime!.localeCompare(b.pet.medTime!)),
    pickups: inHouse
      .filter((b) => b.endDate === today && b.pickupTime)
      .sort((a, b) => a.pickupTime!.localeCompare(b.pickupTime!)),
    birthdays: inHouse
      .filter((b) => birthdayToday(b.pet))
      .map((b) => ({ ...b, age: Number(today.slice(0, 4)) - Number(b.pet.birthday!.slice(0, 4)) })),
    petsInToday: inHouse.length,
    flaggedCount: flagged.length,
    vetToday: new Map(vetToday.map((v) => [v.petId, v])),
    vetCount: vetToday.length,
  };
}

export async function getComplianceQueue() {
  const db = await getDb();
  const today = todayISO();
  const flagged = await attachPets(
    db,
    await db
      .select()
      .from(bookings)
      .where(and(inArray(bookings.status, ["locked", "review"]), gte(bookings.endDate, today)))
      .orderBy(asc(bookings.startDate)),
  );
  const withRecords = await Promise.all(
    flagged.map(async (b) => ({ ...b, record: (await latestRecord(db, b.petId)) ?? null })),
  );
  const cleared = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(inArray(bookings.status, ["confirmed", "checked_in"]), gte(bookings.endDate, today)));
  return { flagged: withRecords, clearedCount: cleared.length };
}

export async function getPetsInHouse() {
  const db = await getDb();
  return attachPets(db, await db.select().from(bookings).where(eq(bookings.status, "checked_in")));
}

export async function getParentHome(ownerId: string) {
  const db = await getDb();
  const today = todayISO();
  const myPets = await db.select().from(pets).where(eq(pets.ownerId, ownerId)).orderBy(asc(pets.name));
  const petIds = myPets.map((p) => p.id);
  const myBookings = petIds.length
    ? await db
        .select({ booking: bookings, unitLabel: units.label })
        .from(bookings)
        .leftJoin(units, eq(bookings.unitId, units.id))
        .where(and(inArray(bookings.petId, petIds), gte(bookings.endDate, today), notInArray(bookings.status, ["cancelled", "completed", "declined"])))
        .orderBy(asc(bookings.startDate))
    : [];
  const visits = myBookings.map((r) => ({ ...r.booking, unitLabel: r.unitLabel, pet: myPets.find((p) => p.id === r.booking.petId)! }));
  const petsWithStatus = await Promise.all(
    myPets.map(async (p) => ({
      ...p,
      record: (await latestRecord(db, p.id)) ?? null,
      hereNow: visits.find((v) => v.petId === p.id && v.status === "checked_in") ?? null,
    })),
  );
  const [latestPhoto] = petIds.length
    ? await db
        .select()
        .from(messages)
        .where(and(inArray(messages.petId, petIds), eq(messages.author, "staff")))
        .orderBy(desc(messages.createdAt))
        .limit(1)
    : [];
  const vet = petIds.length
    ? await db
        .select()
        .from(vetVisits)
        .where(and(inArray(vetVisits.petId, petIds), inArray(vetVisits.status, ["requested", "booked"])))
        .orderBy(asc(vetVisits.date), asc(vetVisits.time))
    : [];
  return {
    pets: petsWithStatus,
    bookings: visits,
    vetVisits: vet.map((v) => ({ ...v, pet: myPets.find((p) => p.id === v.petId)! })),
    latestPhoto: latestPhoto ? { ...latestPhoto, pet: myPets.find((p) => p.id === latestPhoto.petId)! } : null,
  };
}

/** Unread messages from the facility: the badge on the Updates tab. Clears as chats are opened. */
export async function countNewUpdates(ownerId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .innerJoin(pets, eq(messages.petId, pets.id))
    .where(and(eq(pets.ownerId, ownerId), ne(messages.author, "parent"), eq(messages.seenByOwner, false)));
  return rows.length;
}

/** The newest unread message from the facility, for the "new message" pop-up. */
export async function latestUnread(ownerId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: messages.id, petId: messages.petId, petName: pets.name, channel: messages.channel, title: messages.title, body: messages.body })
    .from(messages)
    .innerJoin(pets, eq(messages.petId, pets.id))
    .where(and(eq(pets.ownerId, ownerId), ne(messages.author, "parent"), eq(messages.seenByOwner, false)))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row ?? null;
}

/** One pet's chat on one channel, plus unread counts for every pet/channel tab. */
export async function getOwnerChat(ownerId: string, petId: string | undefined, channel: Channel) {
  const db = await getDb();
  const myPets = await db.select().from(pets).where(eq(pets.ownerId, ownerId)).orderBy(asc(pets.name));
  const pet = myPets.find((p) => p.id === petId) ?? myPets[0] ?? null;
  const unreadRows = myPets.length
    ? await db
        .select({ petId: messages.petId, channel: messages.channel })
        .from(messages)
        .where(and(inArray(messages.petId, myPets.map((p) => p.id)), ne(messages.author, "parent"), eq(messages.seenByOwner, false)))
    : [];
  const unread: Record<string, number> = {};
  for (const r of unreadRows) {
    unread[r.petId] = (unread[r.petId] ?? 0) + 1;
    unread[`${r.petId} ${r.channel}`] = (unread[`${r.petId} ${r.channel}`] ?? 0) + 1;
  }
  const thread = pet
    ? await db
        .select()
        .from(messages)
        .where(and(eq(messages.petId, pet.id), eq(messages.channel, channel)))
        .orderBy(asc(messages.createdAt))
    : [];
  // The doctor most involved with this pet, to label the vet chat.
  const [lastVet] = pet
    ? await db
        .select({ name: vets.name, color: vets.color })
        .from(vetVisits)
        .innerJoin(vets, eq(vetVisits.vetId, vets.id))
        .where(eq(vetVisits.petId, pet.id))
        .orderBy(desc(vetVisits.date))
        .limit(1)
    : [];
  return { pets: myPets, pet, thread, unread, lastVet: lastVet ?? null };
}

export type Conversation = {
  pet: PetWithOwner;
  channel: Channel;
  last: { body: string; author: string; authorName: string | null; createdAt: string };
  unread: number;
};

/**
 * Every pet chat for the facility (or, for a doctor, the vet chats of their
 * patients), newest first, with how many owner messages are unread.
 */
export async function getConversations(opts: { channel?: Channel; vetId?: string } = {}) {
  const db = await getDb();
  let petFilter: string[] | null = null;
  if (opts.vetId) {
    petFilter = [
      ...new Set((await db.select({ petId: vetVisits.petId }).from(vetVisits).where(eq(vetVisits.vetId, opts.vetId))).map((r) => r.petId)),
    ];
    if (petFilter.length === 0) return [];
  }
  const rows = await db
    .select()
    .from(messages)
    .where(and(opts.channel ? eq(messages.channel, opts.channel) : undefined, petFilter ? inArray(messages.petId, petFilter) : undefined))
    .orderBy(asc(messages.createdAt));
  const map = new Map<string, { petId: string; channel: Channel; last: (typeof rows)[number]; unread: number }>();
  for (const m of rows) {
    const key = `${m.petId} ${m.channel}`;
    const c = map.get(key) ?? { petId: m.petId, channel: m.channel, last: m, unread: 0 };
    c.last = m;
    if (m.author === "parent" && !m.seenByStaff) c.unread++;
    map.set(key, c);
  }
  const owners = await petsWithOwners(db, [...map.values()].map((c) => c.petId));
  return [...map.values()]
    .map((c) => ({ pet: owners.get(c.petId)!, channel: c.channel, last: c.last, unread: c.unread }))
    .filter((c) => c.pet)
    .sort((a, b) => b.last.createdAt.localeCompare(a.last.createdAt)) as Conversation[];
}

export async function getThread(petId: string, channel: Channel) {
  const db = await getDb();
  const owners = await petsWithOwners(db, [petId]);
  const pet = owners.get(petId);
  if (!pet) return null;
  const thread = await db
    .select()
    .from(messages)
    .where(and(eq(messages.petId, petId), eq(messages.channel, channel)))
    .orderBy(asc(messages.createdAt));
  return { pet, thread };
}

export async function countUnreadForStaff(opts: { channel?: Channel; vetId?: string } = {}): Promise<number> {
  return (await getConversations(opts)).reduce((n, c) => n + c.unread, 0);
}

/** Cancelled bookings and vet visits from the last 30 days, newest first. */
export async function getCancellations() {
  const db = await getDb();
  const since = addDays(todayISO(), -30);
  const b = await attachPets(
    db,
    await db.select().from(bookings).where(and(eq(bookings.status, "cancelled"), gte(bookings.cancelledAt, since))),
  );
  const v = await attachPetsToVisits(
    db,
    await db.select().from(vetVisits).where(and(eq(vetVisits.status, "cancelled"), gte(vetVisits.cancelledAt, since))),
  );
  return [
    ...b.map((x) => ({ kind: "booking" as const, ...x })),
    ...v.map((x) => ({ kind: "vet" as const, ...x })),
  ].sort((x, y) => (y.cancelledAt ?? "").localeCompare(x.cancelledAt ?? ""));
}

// ── Invoices & revenue ───────────────────────────────────────────────────────

export type InvoiceDue = "overdue" | "today" | "upcoming" | "settled";

export type InvoiceRow = Invoice & {
  pet: PetWithOwner;
  /** "Boarding · Oct 10 → Oct 13" / "Vet visit · Dr. Thomas Hale · Oct 8, 10:00 AM" */
  title: string;
  when: string;
  refStatus: string;
  due: InvoiceDue;
};

async function describeInvoices(db: Db, rows: Invoice[]): Promise<InvoiceRow[]> {
  if (rows.length === 0) return [];
  const today = todayISO();
  const owners = await petsWithOwners(db, rows.map((r) => r.petId));
  const bIds = rows.filter((r) => r.refKind === "booking").map((r) => r.refId);
  const vIds = rows.filter((r) => r.refKind === "vet").map((r) => r.refId);
  const bs = bIds.length ? await db.select().from(bookings).where(inArray(bookings.id, bIds)) : [];
  const vs = vIds.length
    ? await db.select({ visit: vetVisits, doctor: vets.name }).from(vetVisits).leftJoin(vets, eq(vetVisits.vetId, vets.id)).where(inArray(vetVisits.id, vIds))
    : [];
  const fmtTime = (t: string | null) => (t ? formatTime(t) : "");
  return rows
    .map((inv) => {
      let title = "";
      let when = "";
      let refStatus = "";
      let ended = inv.serviceDate;
      if (inv.refKind === "booking") {
        const b = bs.find((x) => x.id === inv.refId);
        const svc = inv.service.charAt(0).toUpperCase() + inv.service.slice(1);
        title = svc;
        when = b
          ? `${formatShortDate(b.startDate)}${b.endDate !== b.startDate ? ` → ${formatShortDate(b.endDate)}` : ""}${b.dropoffTime ? ` · ${fmtTime(b.dropoffTime)}` : ""}`
          : formatShortDate(inv.serviceDate);
        refStatus = b?.status ?? "";
        ended = b?.endDate ?? inv.serviceDate;
      } else {
        const v = vs.find((x) => x.visit.id === inv.refId);
        title = `Vet visit${v?.doctor ? ` · ${v.doctor}` : ""}`;
        when = v ? `${formatShortDate(v.visit.date)} · ${fmtTime(v.visit.time)}` : formatShortDate(inv.serviceDate);
        refStatus = v?.visit.status ?? "";
      }
      const inProgress = refStatus === "checked_in" || refStatus === "completed";
      const due: InvoiceDue =
        inv.status !== "unpaid" ? "settled" : ended < today || refStatus === "completed" ? "overdue" : inv.serviceDate <= today || inProgress ? "today" : "upcoming";
      return { ...inv, pet: owners.get(inv.petId)!, title, when, refStatus, due };
    })
    .filter((r) => r.pet);
}

/** Every invoice for the front desk, newest first. */
export async function getInvoices(): Promise<InvoiceRow[]> {
  const db = await getDb();
  return describeInvoices(db, await db.select().from(invoices).orderBy(desc(invoices.createdAt)));
}

export async function getInvoice(id: string): Promise<InvoiceRow | null> {
  const db = await getDb();
  const rows = await db.select().from(invoices).where(eq(invoices.id, id));
  return (await describeInvoices(db, rows))[0] ?? null;
}

/** The most relevant invoice for a booking or vet visit (live first, then the latest closed one). */
export async function getInvoiceForRef(refId: string): Promise<Invoice | null> {
  const db = await getDb();
  const rows = await db.select().from(invoices).where(eq(invoices.refId, refId)).orderBy(desc(invoices.createdAt));
  return rows.find((r) => r.status === "unpaid" || r.status === "paid") ?? rows[0] ?? null;
}

export async function getOwnerInvoices(ownerId: string): Promise<InvoiceRow[]> {
  const db = await getDb();
  return describeInvoices(db, await db.select().from(invoices).where(eq(invoices.ownerId, ownerId)).orderBy(desc(invoices.createdAt)));
}

export async function getPriceList() {
  const db = await getDb();
  const list = await db.select().from(prices).orderBy(asc(prices.sort));
  const [discount] = await db.select().from(settings).where(eq(settings.key, "online_discount_pct"));
  return { prices: list, discount: Number(discount?.value ?? 0), discountUpdatedBy: discount?.updatedBy ?? null, discountUpdatedAt: discount?.updatedAt ?? null };
}

/** The admin's money view: collected, pending, overdue, refunds and a 14-day outlook. */
export async function getRevenue() {
  const all = await getInvoices();
  const today = todayISO();
  const month = today.slice(0, 7);
  const sum = (list: InvoiceRow[]) => list.reduce((s, i) => s + i.totalCents, 0);
  const paid = all.filter((i) => i.status === "paid" && i.paidAt);
  const unpaid = all.filter((i) => i.status === "unpaid");
  const refunded = all.filter((i) => i.status === "refunded");
  const paidMonth = paid.filter((i) => i.paidAt!.startsWith(month));
  const lastMonthKey = addDays(`${month}-01`, -1).slice(0, 7);

  const categories = ["boarding", "daycare", "grooming", "vet"] as const;
  const byService = categories.map((c) => ({
    service: c,
    collected: sum(paidMonth.filter((i) => i.service === c)),
    pending: sum(unpaid.filter((i) => i.service === c)),
  }));

  // Collected per day for the last 14 days, for the bar chart.
  const days = Array.from({ length: 14 }, (_, k) => addDays(today, k - 13));
  const daily = days.map((d) => ({ date: d, cents: sum(paid.filter((i) => i.paidAt!.startsWith(d))) }));

  return {
    collectedToday: sum(paid.filter((i) => i.paidAt!.startsWith(today))),
    collectedMonth: sum(paidMonth),
    collectedLastMonth: sum(paid.filter((i) => i.paidAt!.startsWith(lastMonthKey))),
    pending: sum(unpaid),
    pendingCount: unpaid.length,
    overdue: unpaid.filter((i) => i.due === "overdue"),
    upcoming14: sum(unpaid.filter((i) => i.serviceDate >= today && i.serviceDate <= addDays(today, 14))),
    refundedMonth: sum(refunded.filter((i) => (i.refundedAt ?? "").startsWith(month))),
    refunds: refunded.slice(0, 6),
    onlineShare: paidMonth.length ? Math.round((paidMonth.filter((i) => i.paidMethod === "online").length / paidMonth.length) * 100) : 0,
    discountsGiven: -paidMonth.flatMap((i) => i.items).filter((it) => it.label.startsWith("Online payment discount")).reduce((s, it) => s + it.cents, 0),
    byService,
    daily,
    recentPayments: paid.sort((a, b) => b.paidAt!.localeCompare(a.paidAt!)).slice(0, 8),
  };
}

// ── Doctor earnings & patients ──────────────────────────────────────────────

/** A doctor's money: this month so far, what's waiting to be paid out, and past statements. */
export async function getDoctorEarnings(vetId: string) {
  const db = await getDb();
  const month = todayISO().slice(0, 7);
  const lines = await earningLines(db, vetId);
  const paid = lines.filter((l) => l.paid);
  const thisMonth = paid.filter((l) => l.date.startsWith(month));
  const sum = (list: EarningLine[], k: "grossCents" | "feeCents" | "netCents") => list.reduce((s, l) => s + l[k], 0);
  const statements = await db.select().from(payouts).where(eq(payouts.vetId, vetId)).orderBy(desc(payouts.createdAt));
  const unpaidOut = paid.filter((l) => !l.payoutId);
  return {
    feePercent: await getDoctorFee(db),
    month,
    thisMonth: { gross: sum(thisMonth, "grossCents"), fee: sum(thisMonth, "feeCents"), net: sum(thisMonth, "netCents"), count: thisMonth.length },
    outstanding: { net: sum(unpaidOut, "netCents"), count: unpaidOut.length },
    awaitingPayment: lines.filter((l) => !l.paid),
    lines: paid,
    statements,
    lifetimeNet: statements.reduce((s, p) => s + p.netCents, 0),
  };
}

/** Admin's Doctors page: each doctor's earnings this month and what's due to them. */
export async function getDoctorMoney() {
  const db = await getDb();
  const month = todayISO().slice(0, 7);
  const lines = (await earningLines(db)).filter((l) => l.paid);
  const all = await db.select().from(payouts).orderBy(desc(payouts.createdAt));
  const byVet: Record<string, { monthNet: number; monthFee: number; monthCount: number; outstanding: number; lastPayout: Payout | null }> = {};
  for (const v of await db.select({ id: vets.id }).from(vets)) {
    const mine = lines.filter((l) => l.vetId === v.id);
    const inMonth = mine.filter((l) => l.date.startsWith(month));
    byVet[v.id] = {
      monthNet: inMonth.reduce((s, l) => s + l.netCents, 0),
      monthFee: inMonth.reduce((s, l) => s + l.feeCents, 0),
      monthCount: inMonth.length,
      outstanding: mine.filter((l) => !l.payoutId).reduce((s, l) => s + l.netCents, 0),
      lastPayout: all.find((p) => p.vetId === v.id) ?? null,
    };
  }
  return { feePercent: await getDoctorFee(db), byVet };
}

/** Every pet a doctor has seen or is booked to see, with their visits. */
export async function getDoctorPatients(vetId: string) {
  const db = await getDb();
  const visits = await db
    .select()
    .from(vetVisits)
    .where(and(eq(vetVisits.vetId, vetId), inArray(vetVisits.status, ["requested", "booked", "completed"])))
    .orderBy(desc(vetVisits.date), desc(vetVisits.time));
  const owners = await petsWithOwners(db, visits.map((v) => v.petId));
  const byPet = new Map<string, { pet: PetWithOwner; visits: VetVisit[] }>();
  for (const v of visits) {
    const pet = owners.get(v.petId);
    if (!pet) continue;
    const g = byPet.get(v.petId) ?? { pet, visits: [] };
    g.visits.push(v);
    byPet.set(v.petId, g);
  }
  return [...byPet.values()];
}

/** Staff/admin: how a vet invoice splits between the doctor and the clinic. */
export async function getVetInvoiceSplit(invoice: Invoice) {
  if (invoice.refKind !== "vet") return null;
  const db = await getDb();
  const [visit] = await db.select({ doctor: vets.name }).from(vetVisits).leftJoin(vets, eq(vetVisits.vetId, vets.id)).where(eq(vetVisits.id, invoice.refId));
  const fee = await getDoctorFee(db);
  return { doctor: visit?.doctor ?? "the doctor", feePercent: fee, ...doctorSplit(invoice.totalCents, fee), paidOut: !!invoice.payoutId };
}

export type DueVaccine = VaccineDue & { pet: PetWithOwner; reminderSentAt: string | null };

/**
 * Every vaccine that is missing, expired or due within 30 days, across all
 * pets, most urgent first, with when the owner was last reminded.
 */
export async function getVaccinesDue(): Promise<DueVaccine[]> {
  const db = await getDb();
  const today = todayISO();
  const records = await db.select().from(vaccineRecords).orderBy(desc(vaccineRecords.uploadedAt));
  const latest = new Map<string, VaccineRecord>();
  for (const r of records) if (!latest.has(r.petId)) latest.set(r.petId, r);
  const owners = await petsWithOwners(db, (await db.select({ id: pets.id }).from(pets)).map((p) => p.id));
  const sent = await db.select().from(vaccineReminders).orderBy(desc(vaccineReminders.sentAt));
  const rank = { expired: 0, missing: 1, due_7: 2, due_30: 3, ok: 4 };
  const out: DueVaccine[] = [];
  for (const pet of owners.values()) {
    for (const v of vaccineSchedule(recordDates(latest.get(pet.id)), pet.species, today)) {
      if (v.stage === "ok") continue;
      const last = sent.find((s) => s.petId === pet.id && s.vaccine === v.key && s.dueDate === v.date);
      out.push({ ...v, pet, reminderSentAt: last?.sentAt ?? null });
    }
  }
  return out.sort((a, b) => rank[a.stage] - rank[b.stage] || (a.date ?? "").localeCompare(b.date ?? "") || a.pet.name.localeCompare(b.pet.name));
}

/** Everything a family has done with us: past visits, vet checkups and vaccine records, per pet. */
export async function getOwnerHistory(ownerId: string) {
  const db = await getDb();
  const today = todayISO();
  const myPets = await db.select().from(pets).where(eq(pets.ownerId, ownerId)).orderBy(asc(pets.name));
  const ids = myPets.map((p) => p.id);
  if (ids.length === 0) return { pets: [], visits: [], records: [] };
  const books = await db
    .select({ booking: bookings, unitLabel: units.label })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(inArray(bookings.petId, ids))
    .orderBy(desc(bookings.startDate));
  const vet = await db
    .select({ visit: vetVisits, doctor: vets.name })
    .from(vetVisits)
    .leftJoin(vets, eq(vetVisits.vetId, vets.id))
    .where(inArray(vetVisits.petId, ids))
    .orderBy(desc(vetVisits.date));
  const records = await db.select().from(vaccineRecords).where(inArray(vaccineRecords.petId, ids)).orderBy(desc(vaccineRecords.uploadedAt));

  // Past = already happened, or closed (completed/cancelled/declined).
  const closed = ["completed", "cancelled", "declined"];
  const visits = [
    ...books
      .filter((r) => r.booking.endDate < today || closed.includes(r.booking.status))
      .map((r) => ({ kind: "booking" as const, id: r.booking.id, petId: r.booking.petId, date: r.booking.startDate, booking: { ...r.booking, unitLabel: r.unitLabel } })),
    ...vet
      .filter((r) => r.visit.date < today || closed.includes(r.visit.status))
      .map((r) => ({ kind: "vet" as const, id: r.visit.id, petId: r.visit.petId, date: r.visit.date, visit: { ...r.visit, doctor: r.doctor } })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    pets: myPets.map((p) => {
      const mine = records.filter((r) => r.petId === p.id);
      return { ...p, schedule: vaccineSchedule(recordDates(mine[0]), p.species, today), records: mine };
    }),
    visits,
    records,
  };
}

/** Pets in the building with their live activity and whether today's report is done. */
export async function getReportsBoard() {
  const db = await getDb();
  const today = todayISO();
  const inHouse = (
    await db
      .select({ booking: bookings, unitLabel: units.label })
      .from(bookings)
      .leftJoin(units, eq(bookings.unitId, units.id))
      .where(and(eq(bookings.status, "checked_in"), ne(bookings.service, "grooming")))
  ).map((r) => ({ ...r.booking, unitLabel: r.unitLabel }));
  const owners = await petsWithOwners(db, inHouse.map((b) => b.petId));
  const reports = inHouse.length
    ? await db
        .select()
        .from(dailyReports)
        .where(and(inArray(dailyReports.bookingId, inHouse.map((b) => b.id)), eq(dailyReports.date, today)))
    : [];
  return inHouse
    .map((b) => ({ ...b, pet: owners.get(b.petId)!, report: reports.find((r) => r.bookingId === b.id) ?? null }))
    .sort((a, b) => Number(!!a.report) - Number(!!b.report) || a.pet.name.localeCompare(b.pet.name));
}

/** The owner's live view of a pet staying with us: what it's doing now, today's log, and daily report cards. */
export async function getLiveStay(ownerId: string, petId: string) {
  const db = await getDb();
  const [pet] = await db.select().from(pets).where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)));
  if (!pet) return null;
  const [stay] = await db
    .select({ booking: bookings, unitLabel: units.label })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.petId, petId), inArray(bookings.status, ["checked_in", "completed"])))
    .orderBy(desc(bookings.startDate))
    .limit(1);
  if (!stay) return { pet, stay: null, log: [], reports: [], photos: [] };
  const booking = stay.booking;
  const log = (await getEvents(booking.id)).filter((e) => ["checked_in", "activity", "stage_1", "stage_2", "stage_3", "report", "completed"].includes(e.kind));
  const reports = await db.select().from(dailyReports).where(eq(dailyReports.bookingId, booking.id)).orderBy(desc(dailyReports.date));
  const checkedIn = log.find((e) => e.kind === "checked_in");
  const photos = checkedIn
    ? await db
        .select()
        .from(messages)
        .where(and(eq(messages.petId, petId), eq(messages.author, "staff"), gte(messages.createdAt, checkedIn.at)))
        .orderBy(desc(messages.createdAt))
    : [];
  return { pet, stay: { ...booking, unitLabel: stay.unitLabel }, log, reports, photos };
}

export async function getPetProfile(ownerId: string, petId: string) {
  const db = await getDb();
  const [pet] = await db.select().from(pets).where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)));
  if (!pet) return null;
  const visits = await db
    .select({ booking: bookings, unitLabel: units.label })
    .from(bookings)
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.petId, petId), ne(bookings.status, "cancelled")))
    .orderBy(desc(bookings.startDate));
  const photos = await db
    .select({ id: messages.id, photo: messages.photo, createdAt: messages.createdAt, title: messages.title })
    .from(messages)
    .where(and(eq(messages.petId, petId), eq(messages.author, "staff")))
    .orderBy(desc(messages.createdAt));
  const vet = (
    await db
      .select({ visit: vetVisits, doctor: vets.name })
      .from(vetVisits)
      .leftJoin(vets, eq(vetVisits.vetId, vets.id))
      .where(and(eq(vetVisits.petId, petId), ne(vetVisits.status, "cancelled")))
      .orderBy(desc(vetVisits.date), desc(vetVisits.time))
  ).map((r) => ({ ...r.visit, doctor: r.doctor }));
  return {
    pet,
    record: (await latestRecord(db, petId)) ?? null,
    visits: visits.map((v) => ({ ...v.booking, unitLabel: v.unitLabel })),
    photos: photos.filter((p) => p.photo),
    vetVisits: vet,
  };
}

/** A booking with everything its timeline needs: events, spot, and photo updates during the stay. */
export async function getOwnedBooking(ownerId: string, bookingId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ booking: bookings, pet: pets, unitLabel: units.label })
    .from(bookings)
    .innerJoin(pets, eq(bookings.petId, pets.id))
    .leftJoin(units, eq(bookings.unitId, units.id))
    .where(and(eq(bookings.id, bookingId), eq(pets.ownerId, ownerId)));
  if (!row) return null;
  const timeline = await getEvents(bookingId);
  const checkedIn = timeline.find((e) => e.kind === "checked_in");
  const finished = timeline.find((e) => e.kind === "completed");
  const updates = checkedIn
    ? (
        await db
          .select()
          .from(messages)
          .where(and(eq(messages.petId, row.pet.id), eq(messages.author, "staff"), gte(messages.createdAt, checkedIn.at)))
          .orderBy(asc(messages.createdAt))
      ).filter((m) => !finished || m.createdAt <= finished.at)
    : [];
  return {
    ...row.booking,
    pet: row.pet,
    unitLabel: row.unitLabel ?? checkedIn?.note ?? null,
    record: (await latestRecord(db, row.pet.id)) ?? null,
    events: timeline,
    updates,
  };
}

export async function getInbox(ownerId: string) {
  const db = await getDb();
  const rows = await db
    .select({ message: messages, pet: pets })
    .from(messages)
    .innerJoin(pets, eq(messages.petId, pets.id))
    .where(eq(pets.ownerId, ownerId))
    .orderBy(asc(messages.createdAt));
  return rows.map((r) => ({ ...r.message, pet: r.pet }));
}

export async function getOwnerPets(ownerId: string) {
  const db = await getDb();
  return db.select().from(pets).where(eq(pets.ownerId, ownerId)).orderBy(asc(pets.name));
}
