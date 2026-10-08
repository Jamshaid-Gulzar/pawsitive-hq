"use server";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, resetDemo, type Db } from "@/db";
import { closeInvoice, ensureInvoice, getOnlineDiscount } from "@/db/billing";
import { createPayout } from "@/db/earnings";
import { getAvailability, latestRecord, recordDates } from "@/db/queries";
import {
  bookings,
  dailyReports,
  events,
  invoices,
  messages,
  payouts,
  pets,
  prices,
  sessions,
  settings,
  units,
  users,
  vaccineRecords,
  vaccineReminders,
  vetVisits,
  vets,
  type VaccineStage,
  type BookingStatus,
  type Channel,
  type EventKind,
  type HealthStatus,
  type Invoice,
  type PaymentMethod,
  type Pet,
  type Role,
  type VetReason,
} from "@/db/schema";
import { GROOM_SERVICES, SCHEDULE, groomLabel, groomPickup, isOpen, slotState, stayProblem } from "@/lib/availability";
import { ACTIVITIES, CARE_NOTES, GROOM_STAGES, MOODS, READY_STAGE, REPORT_OPTIONS, buildUpdateText, updateTags, type CareNoteId } from "@/lib/care";
import { formatShortDate, formatTime, nowStamp, todayISO } from "@/lib/dates";
import { DEMO_ACCOUNTS, getCurrentUser, homeFor, requireRole, signInAs, signOut } from "@/lib/session";
import { EMAIL_RE, hashPassword, normalizeEmail, passwordProblem, verifyPassword } from "@/lib/password";
import { describeIssue, evaluateCompliance, vaccineSchedule, type Service, type VaccineDates } from "@/lib/vaccines";
import { HEALTH_STATUS, PARENT_REASONS, VET_COLORS, VET_REASONS, VET_SLOTS, recommendVet, worksOn } from "@/lib/vet";
import { formatMoney, parseMoney, sumItems, withOnlineDiscount } from "@/lib/pricing";
import { DAY_NAMES, geocode, mapsUrl, type BusinessInfo } from "@/lib/business";
import { getBusiness } from "@/db/business";

const newId = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;
const firstName = (name: string) => name.split(" ")[0];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_IMAGE_CHARS = 2_500_000;

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function done() {
  revalidatePath("/", "layout");
}

function assertImage(image: string | null | undefined) {
  if (image == null) return;
  if (!image.startsWith("data:image/") || image.length > MAX_IMAGE_CHARS) {
    throw new Error("Please use a JPG or PNG photo under 2 MB.");
  }
}

function assertDates(dates: VaccineDates) {
  for (const v of Object.values(dates)) {
    if (v !== null && !ISO_DATE.test(v)) throw new Error("Vaccine dates must look like 2027-03-14.");
  }
}

/** "\nFind us at: 1 Ferry Building…" for confirmation messages. */
const whereNote = async () => `\nFind us at: ${(await getBusiness()).address}`;
const mapLink = async () => ({ href: mapsUrl(await getBusiness()), label: "Open map" });

/** The payment line in confirmation messages. */
const totalNote = (invoice: Invoice | null) =>
  !invoice ? "" : invoice.status === "paid" ? ` Paid in full (${formatMoney(invoice.totalCents)}) — thank you!` : ` Total: ${formatMoney(invoice.totalCents)} — pay online in the app or at the front desk.`;

/**
 * After a paid booking is cancelled or declined: the owner hears the request
 * was received (refund "within 30 minutes"), then that the refund went
 * through. The demo refunds instantly, so both arrive together.
 */
async function refundMessages(db: Db, pet: Pet, closed: Invoice | null, channel: Channel) {
  if (!closed || closed.status !== "refunded") return;
  const amount = formatMoney(closed.totalCents);
  await systemMessage(
    db,
    pet,
    `We've received your cancellation request. Your payment of ${amount} (invoice #${closed.number}) will be refunded within 30 minutes.`,
    { title: "Cancellation received", channel },
  );
  const where = closed.paidMethod === "online" ? `your card${closed.cardLast4 ? ` ending ${closed.cardLast4}` : ""}` : "your original payment method";
  await systemMessage(db, pet, `Refund complete: ${amount} has been added back to ${where}. Reference ${closed.txnRef ?? `INV-${closed.number}`}.`, {
    title: "Refund complete",
    channel,
    link: { href: `/api/invoice/${closed.id}`, label: "View refund receipt" },
  });
}

type MessageExtra ={ title?: string; photo?: string | null; channel?: Channel; link?: { href: string; label: string } };

/** An automatic message in the pet's chat (the team chat unless it's about the vet). */
async function systemMessage(db: Db, pet: Pet, body: string, extra: MessageExtra = {}) {
  await db.insert(messages).values({
    id: newId("m"),
    petId: pet.id,
    author: "system",
    authorName: null,
    title: extra.title ?? null,
    body,
    photo: extra.photo ?? null,
    mood: null,
    tags: [],
    channel: extra.channel ?? "team",
    linkHref: extra.link?.href ?? null,
    linkLabel: extra.link?.label ?? null,
    seenByStaff: true,
    createdAt: nowStamp(),
  });
}

/** A step on the customer's timeline for a booking or vet visit. */
async function logEvent(db: Db, ref: string, kind: EventKind, note: string | null = null) {
  await db.insert(events).values({ id: newId("e"), ref, kind, note, at: nowStamp() });
}

async function loadBooking(db: Db, bookingId: string) {
  const [row] = await db
    .select({ booking: bookings, pet: pets })
    .from(bookings)
    .innerJoin(pets, eq(bookings.petId, pets.id))
    .where(eq(bookings.id, bookingId));
  if (!row) throw new Error("That booking no longer exists. Try refreshing the page.");
  return row;
}

function stayLabel(b: { service: Service; startDate: string; endDate: string; dropoffTime?: string | null }) {
  const span = b.startDate === b.endDate ? formatShortDate(b.startDate) : `${formatShortDate(b.startDate)} – ${formatShortDate(b.endDate)}`;
  return `${b.service} on ${span}${b.dropoffTime && b.startDate === b.endDate ? ` at ${formatTime(b.dropoffTime)}` : ""}`;
}

const complianceStatus = (status: "clear" | "blocked" | "review"): BookingStatus =>
  status === "clear" ? "requested" : status === "blocked" ? "locked" : "review";

/**
 * Re-checks a pet's upcoming bookings against their newest vaccine record.
 * A booking that now passes goes back to the admin as a request.
 */
async function recheckPet(db: Db, pet: Pet) {
  const dates = recordDates(await latestRecord(db, pet.id));
  const upcoming = await db
    .select()
    .from(bookings)
    .where(
      and(eq(bookings.petId, pet.id), inArray(bookings.status, ["locked", "review", "requested", "confirmed"]), gte(bookings.endDate, todayISO())),
    );
  const results: { id: string; status: string }[] = [];
  for (const b of upcoming) {
    if (b.approvedBy) continue;
    const { status, issues } = evaluateCompliance(dates, pet.species, b.service, b.endDate);
    const wasHeld = b.status === "locked" || b.status === "review";
    const next: BookingStatus = status === "clear" ? (wasHeld ? "requested" : b.status) : complianceStatus(status);
    if (next === b.status && JSON.stringify(issues) === JSON.stringify(b.issues)) continue;
    await db.update(bookings).set({ status: next, issues }).where(eq(bookings.id, b.id));
    if (status === "clear" && wasHeld) {
      await logEvent(db, b.id, "vaccines_ok", "New record uploaded");
      await systemMessage(db, pet, `Great news! ${pet.name}'s vaccines all check out. Your ${stayLabel(b)} is now with our team to confirm.`, {
        title: "Vaccines approved",
      });
    } else if (status === "blocked" && !wasHeld) {
      await logEvent(db, b.id, "vaccines_hold", issues.map((i) => i.vaccine).join(","));
      await systemMessage(
        db,
        pet,
        `${pet.name}'s ${stayLabel(b)} is on hold: ${issues.map((i) => describeIssue(i, pet.species)).join(", ")}. Upload a current vet record to release it.`,
        { title: "Booking on hold", link: { href: `/my/bookings/${b.id}`, label: "Upload record" } },
      );
    }
    results.push({ id: b.id, status: next });
  }
  return results;
}

async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const value = await fn();
    done();
    return { ok: true, ...value };
  } catch (e) {
    // redirect() and notFound() throw on purpose; let them through.
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ── Session ────────────────────────────────────────────────────────────────

/** Quick demo login: signs in as the sample account for a role. */
export async function loginAs(role: Role) {
  const userId = DEMO_ACCOUNTS[role];
  if (!userId) redirect("/");
  await getDb();
  await signInAs(userId);
  redirect(homeFor(role));
}

// Which roles a sign-in accepts. The shared sign-in screen uses "any": the
// account itself says whether it's a customer, staff, doctor or admin.
const PORTAL_ROLES = {
  any: ["parent", "staff", "vet", "admin"],
  parent: ["parent"],
  team: ["staff", "vet"],
  admin: ["admin"],
} as const satisfies Record<string, readonly Role[]>;
export type Portal = keyof typeof PORTAL_ROLES;

// Slows down password guessing: 5 wrong tries locks that email for a minute.
const failedLogins = new Map<string, { count: number; until: number }>();

export async function signInWithPassword(portal: Portal, email: string, password: string): Promise<ActionResult> {
  const address = normalizeEmail(email);
  if (!EMAIL_RE.test(address)) return { ok: false, error: "Enter a valid email address." };
  if (!password) return { ok: false, error: "Enter your password." };
  const lock = failedLogins.get(address);
  if (lock && lock.until > Date.now()) return { ok: false, error: "Too many tries. Please wait a minute and try again." };

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, address));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    const count = (lock?.count ?? 0) + 1;
    failedLogins.set(address, { count, until: count >= 5 ? Date.now() + 60_000 : 0 });
    return { ok: false, error: "That email and password don't match." };
  }
  if (!(PORTAL_ROLES[portal] as readonly Role[]).includes(user.role)) {
    const where = user.role === "parent" ? "the pet parent sign-in" : user.role === "admin" ? "the admin sign-in" : "the team sign-in";
    return { ok: false, error: `This account uses ${where}.` };
  }
  if (user.role === "vet" && user.vetId) {
    const [vet] = await db.select({ active: vets.active }).from(vets).where(eq(vets.id, user.vetId));
    if (vet && !vet.active) return { ok: false, error: "This doctor account is turned off. Please contact the admin." };
  }
  failedLogins.delete(address);
  await signInAs(user.id);
  redirect(homeFor(user.role));
}

export type RegisterInput = { name: string; email: string; phone: string; password: string; confirm: string };

/** Pet parents create their own account. */
export async function registerCustomer(input: RegisterInput): Promise<ActionResult> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 60);
  const email = normalizeEmail(input.email);
  const phone = input.phone.trim().slice(0, 25);
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (phone && !/^[+\d\s().-]{7,25}$/.test(phone)) return { ok: false, error: "That phone number doesn't look right." };
  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, error: problem };
  if (input.password !== input.confirm) return { ok: false, error: "The two passwords don't match." };
  const db = await getDb();
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken) return { ok: false, error: "There's already an account with this email. Try signing in." };
  const id = newId("u");
  await db.insert(users).values({ id, name, role: "parent", phone: phone || null, email, passwordHash: await hashPassword(input.password), createdAt: nowStamp() });
  await signInAs(id);
  redirect("/my?welcome=1");
}

export async function changePassword(current: string, next: string, confirm: string) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Please sign in again.");
    if (!(await verifyPassword(current, user.passwordHash))) throw new Error("Your current password isn't right.");
    const problem = passwordProblem(next);
    if (problem) throw new Error(problem);
    if (next !== confirm) throw new Error("The two new passwords don't match.");
    const db = await getDb();
    await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
    return {};
  });
}

export async function loginAsVet(vetId: string) {
  // Doctors the admin added have their own login, found by their profile.
  const db = await getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(vets, eq(users.vetId, vets.id))
    .where(and(eq(users.role, "vet"), eq(users.vetId, vetId), eq(vets.active, true)));
  if (!user) redirect("/login?as=vet");
  await signInAs(user.id);
  redirect(homeFor("vet"));
}

/** Signs out without navigating, so the caller can choose where to go. */
export async function endSession() {
  await signOut();
}

export async function resetDemoData() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  await getDb();
  await resetDemo();
  done();
}

// ── Admin: booking requests ────────────────────────────────────────────────

export async function confirmBooking(bookingId: string) {
  return run(async () => {
    const admin = await requireRole("admin");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (booking.status !== "requested") throw new Error("Only new requests can be confirmed.");
    await db.update(bookings).set({ status: "confirmed", confirmedBy: admin.name, confirmedAt: nowStamp() }).where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "confirmed", admin.name);
    const invoice = await ensureInvoice(db, "booking", bookingId);
    await systemMessage(
      db,
      pet,
      `You're all set! ${pet.name}'s ${stayLabel(booking)} is confirmed. We can't wait to see ${pet.sex === "f" ? "her" : "him"}.${totalNote(invoice)}${await whereNote()}`,
      { title: "Booking confirmed", link: await mapLink() },
    );
    return {};
  });
}

export async function declineBooking(bookingId: string, reason: string) {
  return run(async () => {
    await requireRole("admin");
    const why = reason.trim().slice(0, 200);
    if (!why) throw new Error("Tell the owner why, so they can rebook.");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (!["requested", "locked", "review"].includes(booking.status)) throw new Error("This booking can't be declined anymore.");
    await db.update(bookings).set({ status: "declined", declineReason: why }).where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "declined", why);
    const closed = await closeInvoice(db, bookingId, `Declined: ${why}`);
    await systemMessage(db, pet, `Sorry, we can't take ${pet.name}'s ${stayLabel(booking)}: ${why} Please pick another time in the app.`, {
      title: "Booking declined",
    });
    await refundMessages(db, pet, closed, "team");
    return {};
  });
}

export async function confirmVetVisit(id: string) {
  return run(async () => {
    const admin = await requireRole("admin");
    const db = await getDb();
    const [row] = await db
      .select({ visit: vetVisits, pet: pets, vet: vets })
      .from(vetVisits)
      .innerJoin(pets, eq(vetVisits.petId, pets.id))
      .leftJoin(vets, eq(vetVisits.vetId, vets.id))
      .where(eq(vetVisits.id, id));
    if (!row) throw new Error("Appointment not found.");
    if (row.visit.status !== "requested") throw new Error("Only new requests can be confirmed.");
    await db.update(vetVisits).set({ status: "booked", confirmedBy: admin.name, confirmedAt: nowStamp() }).where(eq(vetVisits.id, id));
    await logEvent(db, id, "confirmed", admin.name);
    const invoice = await ensureInvoice(db, "vet", id);
    await systemMessage(
      db,
      row.pet,
      `${row.pet.name}'s vet visit with ${row.vet?.name ?? "our vet"} is confirmed for ${formatShortDate(row.visit.date)} at ${formatTime(row.visit.time)}.${totalNote(invoice)}${await whereNote()}`,
      { title: "Vet visit confirmed", channel: "vet", link: await mapLink() },
    );
    return {};
  });
}

export async function declineVetVisit(id: string, reason: string) {
  return run(async () => {
    await requireRole("admin");
    const why = reason.trim().slice(0, 200);
    if (!why) throw new Error("Tell the owner why, so they can rebook.");
    const db = await getDb();
    const [row] = await db.select({ visit: vetVisits, pet: pets }).from(vetVisits).innerJoin(pets, eq(vetVisits.petId, pets.id)).where(eq(vetVisits.id, id));
    if (!row) throw new Error("Appointment not found.");
    if (row.visit.status !== "requested") throw new Error("Only new requests can be declined.");
    await db.update(vetVisits).set({ status: "declined", declineReason: why }).where(eq(vetVisits.id, id));
    await logEvent(db, id, "declined", why);
    const closed = await closeInvoice(db, id, `Declined: ${why}`);
    await systemMessage(db, row.pet, `Sorry, we can't fit ${row.pet.name}'s vet visit on ${formatShortDate(row.visit.date)}: ${why}`, {
      title: "Vet visit declined",
      channel: "vet",
    });
    await refundMessages(db, row.pet, closed, "vet");
    return {};
  });
}

// ── Floor board ────────────────────────────────────────────────────────────

export async function assignUnit(bookingId: string, unitId: string) {
  return run(async () => {
    const staff = await requireRole("staff", "admin");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (booking.status !== "confirmed") throw new Error(`${pet.name}'s booking isn't confirmed yet.`);
    const [unit] = await db.select().from(units).where(eq(units.id, unitId));
    if (!unit) throw new Error("That spot doesn't exist.");
    if ((unit.kind === "table") !== (booking.service === "grooming")) {
      throw new Error(booking.service === "grooming" ? "Grooming pets go on a table." : "Boarding and daycare pets go in a run.");
    }
    const [taken] = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.unitId, unitId), eq(bookings.status, "checked_in")));
    if (taken) throw new Error(`${unit.label} is already taken.`);

    const grooming = booking.service === "grooming";
    await db
      .update(bookings)
      .set({ status: "checked_in", unitId, groomStage: grooming ? 0 : null, groomer: grooming ? firstName(staff.name) : null })
      .where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "checked_in", unit.label);
    await systemMessage(
      db,
      pet,
      grooming
        ? `${pet.name} is checked in at ${unit.label} with ${firstName(staff.name)}. Spa day has begun!`
        : `${pet.name} is checked in to ${unit.label} and settling in nicely. Photo updates are on the way!`,
    );
    return {};
  });
}

export async function advanceGroom(bookingId: string) {
  return run(async () => {
    await requireRole("staff", "admin");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (booking.status !== "checked_in" || booking.service !== "grooming") throw new Error("This pet isn't on a grooming table.");
    const stage = booking.groomStage ?? 0;

    if (stage >= READY_STAGE) {
      await db.update(bookings).set({ status: "completed", unitId: null }).where(eq(bookings.id, bookingId));
      await logEvent(db, bookingId, "completed");
      await systemMessage(db, pet, `${pet.name} is headed home looking fabulous. Thanks for visiting Pawsitive HQ!`);
      return { stage: null };
    }
    const next = stage + 1;
    await db.update(bookings).set({ groomStage: next }).where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, `stage_${next}` as EventKind);
    if (next === READY_STAGE) {
      const when = booking.pickupTime ? ` at ${formatTime(booking.pickupTime)}` : "";
      await systemMessage(db, pet, `${pet.name} is all groomed and ready for pickup${when}.`, {
        title: `${pet.name} is ready!`,
        photo: pet.photo,
      });
    }
    return { stage: next, label: GROOM_STAGES[next].label };
  });
}

export async function checkOut(bookingId: string) {
  return run(async () => {
    await requireRole("staff", "admin");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (booking.status !== "checked_in") throw new Error(`${pet.name} isn't checked in.`);
    await db.update(bookings).set({ status: "completed", unitId: null }).where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "completed");
    await systemMessage(db, pet, `${pet.name} is checked out. We loved having ${pet.sex === "f" ? "her" : "him"} — see you next time!`);
    return {};
  });
}

// ── Pawsitive Updates ──────────────────────────────────────────────────────

export async function sendUpdate(input: { petId: string; photo: string | null; mood: string; notes: CareNoteId[] }) {
  return run(async () => {
    const staff = await requireRole("staff", "admin");
    assertImage(input.photo);
    if (!MOODS.some((m) => m.id === input.mood)) throw new Error("Pick a mood.");
    const notes = input.notes.filter((n) => CARE_NOTES.some((c) => c.id === n));
    const db = await getDb();
    const [pet] = await db.select().from(pets).where(eq(pets.id, input.petId));
    if (!pet) throw new Error("Pick a pet first.");
    const [stay] = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.petId, pet.id), eq(bookings.status, "checked_in")));
    if (!stay) throw new Error(`${pet.name} isn't checked in right now.`);

    await db.insert(messages).values({
      id: newId("m"),
      petId: pet.id,
      author: "staff",
      authorName: firstName(staff.name),
      title: `Pawsitive Update for ${pet.name}!`,
      body: buildUpdateText(pet.name, pet.sex, notes),
      photo: input.photo ?? pet.photo,
      mood: input.mood,
      tags: updateTags(notes),
      seenByStaff: true,
      createdAt: nowStamp(),
    });
    return {};
  });
}

// ── Chat ───────────────────────────────────────────────────────────────────

/**
 * A message in one pet's chat. Owners write in their own pets' chats; staff
 * and the admin in any; doctors in the vet chat.
 */
export async function sendChatMessage(petId: string, channel: Channel, body: string) {
  return run(async () => {
    const user = await requireRole("parent", "staff", "admin", "vet");
    if (channel !== "team" && channel !== "vet") throw new Error("Pick a chat.");
    if (user.role === "vet" && channel !== "vet") throw new Error("Doctors reply in the vet chat.");
    const text = body.trim().slice(0, 1000);
    if (!text) throw new Error("Type a message first.");
    const db = await getDb();
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet || (user.role === "parent" && pet.ownerId !== user.id)) throw new Error("That pet isn't on your account.");
    const fromOwner = user.role === "parent";
    await db.insert(messages).values({
      id: newId("m"),
      petId,
      author: fromOwner ? "parent" : user.role === "vet" ? "vet" : "staff",
      authorName: user.role === "vet" ? user.name : firstName(user.name),
      title: null,
      body: text,
      photo: null,
      mood: null,
      tags: [],
      channel,
      seenByOwner: fromOwner,
      seenByStaff: !fromOwner,
      createdAt: nowStamp(),
    });
    return {};
  });
}

/** Read receipts: clears the unread badge for whoever opened the chat. */
export async function markChatSeen(petId: string, channel: Channel) {
  const user = await getCurrentUser();
  if (!user) return;
  const db = await getDb();
  if (user.role === "parent") {
    const [pet] = await db.select({ id: pets.id }).from(pets).where(and(eq(pets.id, petId), eq(pets.ownerId, user.id)));
    if (!pet) return;
    await db
      .update(messages)
      .set({ seenByOwner: true })
      .where(and(eq(messages.petId, petId), eq(messages.channel, channel), eq(messages.seenByOwner, false)));
  } else {
    await db
      .update(messages)
      .set({ seenByStaff: true })
      .where(and(eq(messages.petId, petId), eq(messages.channel, channel), eq(messages.seenByStaff, false)));
  }
  done();
}

// ── Vaccine compliance (staff) ─────────────────────────────────────────────

export async function remindOwner(bookingId: string) {
  return run(async () => {
    await requireRole("staff", "admin");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    const problems = booking.issues.map((i) => describeIssue(i, pet.species)).join(", ");
    await systemMessage(
      db,
      pet,
      `Friendly reminder: ${pet.name}'s ${stayLabel(booking)} is on hold (${problems}). Upload a current vet record in the app and we'll take it from there.`,
      { title: "Vaccine reminder" },
    );
    return {};
  });
}

/** Staff nudge from the "Vaccines due" list: a message in the pet's vet chat with a booking link. */
export async function remindVaccineDue(petId: string, vaccine: string) {
  return run(async () => {
    const staff = await requireRole("staff", "admin");
    const db = await getDb();
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) throw new Error("Pet not found.");
    const v = vaccineSchedule(recordDates(await latestRecord(db, petId)), pet.species).find((x) => x.key === vaccine);
    if (!v || v.stage === "ok") throw new Error("That vaccine isn't due yet.");
    const when = v.stage === "missing" ? "we don't have a date on file" : v.stage === "expired" ? `it expired on ${formatShortDate(v.date!)}` : `it's due on ${formatShortDate(v.date!)}`;
    await systemMessage(
      db,
      pet,
      `Hi from ${firstName(staff.name)} at Pawsitive! Just a reminder about ${pet.name}'s ${v.label} vaccine — ${when}. Book a quick vaccination with our vets, or upload the latest vet record.`,
      { title: "Vaccine reminder", channel: "vet", link: { href: `/my/vet?pet=${pet.id}&reason=vaccination`, label: "Book vaccination" } },
    );
    await db.insert(vaccineReminders).values({
      id: newId("vrm"), petId, vaccine: v.key, dueDate: v.date, stage: v.stage as VaccineStage, sentAt: nowStamp(),
    });
    return {};
  });
}

/** Manager override of a failed vaccine check: approves and confirms in one step. */
export async function approveBooking(bookingId: string) {
  return run(async () => {
    const admin = await requireRole("admin");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (booking.status !== "locked" && booking.status !== "review") throw new Error("This booking doesn't need approval.");
    await db
      .update(bookings)
      .set({ status: "confirmed", approvedBy: admin.name, confirmedBy: admin.name, confirmedAt: nowStamp() })
      .where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "vaccines_ok", `Approved by ${admin.name}`);
    await logEvent(db, bookingId, "confirmed", admin.name);
    await ensureInvoice(db, "booking", bookingId);
    await systemMessage(db, pet, `Good news! Our team reviewed ${pet.name}'s records, and the ${stayLabel(booking)} is confirmed.`, {
      title: "Booking confirmed",
    });
    return {};
  });
}

export async function correctVaccineDates(petId: string, dates: VaccineDates) {
  return run(async () => {
    await requireRole("staff", "admin");
    assertDates(dates);
    const db = await getDb();
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) throw new Error("Pet not found.");
    const previous = await latestRecord(db, petId);
    await db.insert(vaccineRecords).values({
      id: newId("vr"),
      petId,
      image: previous?.image ?? null,
      rabiesExp: dates.rabies,
      coreExp: dates.core,
      bordetellaExp: dates.bordetella,
      source: "staff",
      ocrText: previous?.ocrText ?? null,
      uploadedAt: nowStamp(),
    });
    const fmt = (d: string | null) => (d ? formatShortDate(d) : "not on file");
    await systemMessage(
      db,
      pet,
      `Our team updated ${pet.name}'s vaccine record: Rabies ${fmt(dates.rabies)} · ${pet.species === "cat" ? "FVRCP" : "DHPP"} ${fmt(dates.core)}${
        pet.species === "dog" ? ` · Bordetella ${fmt(dates.bordetella)}` : ""
      }.`,
      { title: "Vaccine record updated", channel: "vet", link: { href: `/my/history?pet=${pet.id}`, label: "See vaccines" } },
    );
    return { changes: await recheckPet(db, pet) };
  });
}

// ── Pet parents ────────────────────────────────────────────────────────────

type RecordInput = { image: string; dates: VaccineDates; ocrText: string };

async function saveScannedRecord(db: Db, petId: string, record: RecordInput) {
  assertImage(record.image);
  assertDates(record.dates);
  await db.insert(vaccineRecords).values({
    id: newId("vr"),
    petId,
    image: record.image,
    rabiesExp: record.dates.rabies,
    coreExp: record.dates.core,
    bordetellaExp: record.dates.bordetella,
    source: "scan",
    ocrText: record.ocrText.slice(0, 5000),
    uploadedAt: nowStamp(),
  });
}

async function ownedPet(db: Db, ownerId: string, petId: string) {
  const [pet] = await db.select().from(pets).where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)));
  if (!pet) throw new Error("That pet isn't on your account.");
  return pet;
}

export type BookingInput = {
  petId: string;
  service: Service;
  startDate: string;
  endDate: string;
  dropoffTime: string;
  pickupTime: string | null;
  groomServices: string[];
  notes: string;
  record: RecordInput | null;
};

export async function createBooking(input: BookingInput) {
  return run(async () => {
    const parent = await requireRole("parent");
    const { service } = input;
    if (!["boarding", "daycare", "grooming"].includes(service)) throw new Error("Pick a service.");
    if (!ISO_DATE.test(input.startDate) || !ISO_DATE.test(input.endDate)) throw new Error("Pick your dates.");
    const endDate = service === "boarding" ? input.endDate : input.startDate;
    const today = todayISO();
    if (input.startDate < today) throw new Error("That date has already passed.");
    if (service === "boarding" && endDate <= input.startDate) throw new Error("Boarding needs at least one night.");
    if (!isOpen(service, input.startDate)) throw new Error(`We don't offer ${service} on that day. Please choose another date.`);
    if (!SCHEDULE[service].slots.includes(input.dropoffTime)) throw new Error("Pick a time.");
    const groomServices = service === "grooming" ? [...new Set(input.groomServices)].filter((g) => GROOM_SERVICES.some((s) => s.id === g)) : [];
    if (service === "grooming" && groomServices.length === 0) throw new Error("Choose at least one grooming service.");
    const pickupTime =
      service === "grooming" ? groomPickup(input.dropoffTime) : SCHEDULE[service].pickupTimes.includes(input.pickupTime ?? "") ? input.pickupTime : null;
    if (service !== "grooming" && !pickupTime) throw new Error("Pick a pickup time.");

    const db = await getDb();
    const pet = await ownedPet(db, parent.id, input.petId);

    // Re-check availability on the server: someone may have just taken it.
    const availability = await getAvailability();
    const nowTime = nowStamp().slice(11, 16);
    const slot = slotState(service, input.startDate, input.dropoffTime, availability, today, nowTime);
    if (slot === "booked") throw new Error("This date and time is already booked. Please choose another time.");
    if (slot === "passed") throw new Error("That time has already passed. Please choose another time.");
    if (service !== "grooming") {
      const problem = stayProblem(input.startDate, endDate, availability);
      if (problem) throw new Error(problem);
    }

    if (input.record) await saveScannedRecord(db, pet.id, input.record);
    const dates = recordDates(await latestRecord(db, pet.id));
    const { status, issues } = evaluateCompliance(dates, pet.species, service, endDate);
    const id = newId("b");
    await db.insert(bookings).values({
      id,
      petId: pet.id,
      service,
      startDate: input.startDate,
      endDate,
      dropoffTime: input.dropoffTime,
      pickupTime,
      groomServices,
      notes: input.notes.trim().slice(0, 300) || null,
      status: complianceStatus(status),
      issues,
      createdAt: nowStamp(),
    });
    await logEvent(db, id, "requested");
    const stay = stayLabel({ service, startDate: input.startDate, endDate, dropoffTime: input.dropoffTime });
    const extras = groomServices.length ? ` (${groomServices.map(groomLabel).join(", ")})` : "";
    if (status === "clear") {
      await logEvent(db, id, "vaccines_ok");
      await systemMessage(db, pet, `Thanks! We've received ${pet.name}'s ${stay}${extras}. Vaccines check out — our team will confirm shortly.`, {
        title: "Request received",
      });
    } else if (status === "blocked") {
      await logEvent(db, id, "vaccines_hold", issues.map((i) => i.vaccine).join(","));
      const problems = issues.map((i) => describeIssue(i, pet.species)).join(", ");
      await systemMessage(db, pet, `${pet.name}'s ${stay} is on hold (${problems}). Upload a current vet record to unlock it.`, {
        title: "Booking on hold",
      });
    } else {
      await logEvent(db, id, "vaccines_review");
      await systemMessage(db, pet, `Thanks! We couldn't read every date on ${pet.name}'s record, so a team member will double-check it shortly.`, {
        title: "Checking your record",
      });
    }
    const invoice = await ensureInvoice(db, "booking", id);
    return { id, invoiceId: invoice?.id ?? null };
  });
}

function cleanReason(reason: string) {
  const why = reason.trim().slice(0, 200);
  if (!why) throw new Error("Please choose a reason so we can help.");
  return why;
}

export async function cancelBooking(bookingId: string, reason: string) {
  return run(async () => {
    const parent = await requireRole("parent");
    const why = cleanReason(reason);
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (pet.ownerId !== parent.id) throw new Error("That booking isn't on your account.");
    if (!["requested", "review", "locked", "confirmed"].includes(booking.status)) throw new Error("This booking can't be cancelled anymore.");
    await db
      .update(bookings)
      .set({ status: "cancelled", cancelReason: why, cancelledAt: nowStamp(), cancelledBy: parent.name })
      .where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "cancelled", why);
    const closed = await closeInvoice(db, bookingId, `Cancelled by owner: ${why}`);
    await systemMessage(
      db,
      pet,
      `We've cancelled ${pet.name}'s ${stayLabel(booking)}.\nReason: ${why}\nWe hope to see ${pet.sex === "f" ? "her" : "him"} soon — reply here if there's anything we can do.`,
      { title: "Booking cancelled", link: { href: `/my/book?pet=${pet.id}&service=${booking.service}`, label: "Book another time" } },
    );
    await refundMessages(db, pet, closed, "team");
    return {};
  });
}

export type NewPetInput = {
  name: string;
  species: "dog" | "cat";
  breed: string;
  sex: "f" | "m";
  birthday: string | null;
  photo: string | null;
  food: string;
  meds: string | null;
  medTime: string | null;
  alert: string | null;
  note: string | null;
  conditions: string[];
  record: RecordInput | null;
};

const cleanConditions = (list: string[]) => [...new Set(list.map((c) => c.trim().slice(0, 40)).filter(Boolean))].slice(0, 10);

export async function addPet(input: NewPetInput) {
  return run(async () => {
    const parent = await requireRole("parent");
    const clean = (v: string | null, max = 80) => (v ?? "").trim().slice(0, max) || null;
    const name = clean(input.name, 30);
    const breed = clean(input.breed, 50);
    const food = clean(input.food, 120);
    if (!name) throw new Error("What's your pet's name?");
    if (!breed) throw new Error(`What breed is ${name}? "Mixed" is fine.`);
    if (!food) throw new Error(`What does ${name} eat? This helps our staff at mealtime.`);
    if (input.species !== "dog" && input.species !== "cat") throw new Error("Choose dog or cat.");
    if (input.sex !== "f" && input.sex !== "m") throw new Error(`Please choose ${name}'s sex: female or male.`);
    if (input.birthday && (!ISO_DATE.test(input.birthday) || input.birthday > todayISO())) throw new Error("Birthday can't be in the future.");
    if (input.medTime && !/^\d{2}:\d{2}$/.test(input.medTime)) throw new Error("Pick a medication time.");
    assertImage(input.photo);

    const db = await getDb();
    const id = newId("pet");
    const meds = clean(input.meds, 120);
    await db.insert(pets).values({
      id,
      ownerId: parent.id,
      name,
      species: input.species,
      breed,
      sex: input.sex,
      birthday: input.birthday || null,
      photo: input.photo,
      food,
      meds,
      medTime: meds ? input.medTime || null : null,
      alert: clean(input.alert),
      note: clean(input.note),
      conditions: cleanConditions(input.conditions ?? []),
    });
    if (input.record) await saveScannedRecord(db, id, input.record);
    const [pet] = await db.select().from(pets).where(eq(pets.id, id));
    await healthAlerts(db, pet);
    return { id };
  });
}

/**
 * When a new pet arrives with a health condition or an out-of-date vaccine,
 * nudge the owner in the vet chat with a one-tap booking link.
 */
async function healthAlerts(db: Db, pet: Pet) {
  if (pet.conditions.length) {
    const list = pet.conditions.join(", ");
    const suggestion = recommendVet("checkup", "", pet.conditions, pet.species);
    const [vet] = suggestion ? await db.select().from(vets).where(eq(vets.id, suggestion)) : [];
    await systemMessage(
      db,
      pet,
      `We see ${pet.name} has ${list}. Our experienced in-house vets can help keep ${pet.sex === "f" ? "her" : "him"} comfortable${
        vet ? ` — ${vet.name} (${vet.specialty.toLowerCase()}) is a great match` : ""
      }. Book a checkup whenever you're ready.`,
      {
        title: `Health check for ${pet.name}`,
        channel: "vet",
        link: { href: `/my/vet?pet=${pet.id}&reason=checkup${vet ? `&vet=${vet.id}` : ""}`, label: "Book a vet checkup" },
      },
    );
  }
  const record = await latestRecord(db, pet.id);
  const today = todayISO();
  const dates = recordDates(record);
  const needed = (pet.species === "cat" ? ["rabies", "core"] : ["rabies", "core", "bordetella"]) as (keyof VaccineDates)[];
  const due = needed.filter((k) => !dates[k] || dates[k]! < today);
  if (due.length) {
    const names = due.map((k) => (k === "core" ? (pet.species === "cat" ? "FVRCP" : "DHPP") : k === "rabies" ? "Rabies" : "Bordetella"));
    await systemMessage(
      db,
      pet,
      `${pet.name}'s ${names.join(" and ")} ${record ? "vaccination is out of date" : "vaccination records are missing"}. Pets need current shots to stay with us — our vets can give boosters in one quick visit.`,
      {
        title: "Vaccines due",
        channel: "vet",
        link: { href: `/my/vet?pet=${pet.id}&reason=vaccination`, label: "Book a vaccination" },
      },
    );
  }
}

export async function updateProfile(name: string, phone: string) {
  return run(async () => {
    const user = await requireRole("parent");
    const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 60);
    const cleanPhone = phone.trim().slice(0, 25);
    if (cleanName.length < 2) throw new Error("Please enter your full name.");
    if (cleanPhone && !/^[+\d\s().-]{7,25}$/.test(cleanPhone)) throw new Error("That phone number doesn't look right.");
    const db = await getDb();
    await db.update(users).set({ name: cleanName, phone: cleanPhone || null }).where(eq(users.id, user.id));
    return {};
  });
}

// ── Check-in, live status and daily reports ───────────────────────────────

/** The owner tapped "I've arrived": staff see the pet waiting and assign a spot. */
export async function markArrived(bookingId: string) {
  return run(async () => {
    const parent = await requireRole("parent");
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, bookingId);
    if (pet.ownerId !== parent.id) throw new Error("That booking isn't on your account.");
    if (booking.status !== "confirmed") throw new Error("This booking isn't ready for check-in.");
    if (booking.startDate !== todayISO()) throw new Error(`Check-in opens on ${formatShortDate(booking.startDate)}.`);
    if (booking.arrivedAt) return {};
    await db.update(bookings).set({ arrivedAt: nowStamp() }).where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "arrived");
    await systemMessage(db, pet, `Thanks! We know ${pet.name} is here — a team member is getting ${pet.sex === "f" ? "her" : "his"} spot ready now.`, {
      title: "Arrived",
    });
    return {};
  });
}

export async function setActivity(bookingId: string, activity: string) {
  return run(async () => {
    await requireRole("staff", "admin");
    if (!ACTIVITIES.includes(activity as (typeof ACTIVITIES)[number])) throw new Error("Pick an activity.");
    const db = await getDb();
    const { booking } = await loadBooking(db, bookingId);
    if (booking.status !== "checked_in") throw new Error("This pet isn't here right now.");
    await db.update(bookings).set({ activity, activityAt: nowStamp() }).where(eq(bookings.id, bookingId));
    await logEvent(db, bookingId, "activity", activity);
    return {};
  });
}

export async function submitDailyReport(input: {
  bookingId: string;
  meals: string;
  potty: string;
  mood: string;
  activities: string[];
  notes: string;
  photo: string | null;
}) {
  return run(async () => {
    const staff = await requireRole("staff", "admin");
    const pick = (v: string, options: readonly string[], label: string) => {
      if (!options.includes(v)) throw new Error(`Choose ${label}.`);
      return v;
    };
    const meals = pick(input.meals, REPORT_OPTIONS.meals, "how they ate");
    const potty = pick(input.potty, REPORT_OPTIONS.potty, "potty");
    const mood = pick(input.mood, REPORT_OPTIONS.moods, "a mood");
    const activities = input.activities.filter((a) => (REPORT_OPTIONS.activities as readonly string[]).includes(a));
    assertImage(input.photo);
    const db = await getDb();
    const { booking, pet } = await loadBooking(db, input.bookingId);
    if (booking.status !== "checked_in") throw new Error(`${pet.name} isn't checked in.`);
    const today = todayISO();
    const [existing] = await db
      .select({ id: dailyReports.id })
      .from(dailyReports)
      .where(and(eq(dailyReports.bookingId, booking.id), eq(dailyReports.date, today)));
    const row = {
      bookingId: booking.id,
      petId: pet.id,
      date: today,
      meals,
      potty,
      mood,
      activities,
      notes: input.notes.trim().slice(0, 500) || null,
      photo: input.photo ?? null,
      staffName: firstName(staff.name),
      createdAt: nowStamp(),
    };
    if (existing) await db.update(dailyReports).set(row).where(eq(dailyReports.id, existing.id));
    else await db.insert(dailyReports).values({ id: newId("dr"), ...row });
    await logEvent(db, booking.id, "report", today);
    await systemMessage(
      db,
      pet,
      `${pet.name}'s report card for today is ready: ${meals.toLowerCase()}, feeling ${mood.toLowerCase()}${activities.length ? `, and enjoyed ${activities.slice(0, 3).join(", ").toLowerCase()}` : ""}.`,
      {
        title: `Daily report: ${pet.name}`,
        photo: input.photo,
        link: { href: `/my/pets/${pet.id}/live`, label: "See the full report" },
      },
    );
    return {};
  });
}

/** The doctor begins the exam: the owner's timeline shows "Checkup in progress". */
export async function startVetVisit(id: string) {
  return run(async () => {
    const doctor = await requireRole("vet");
    const db = await getDb();
    const [row] = await db.select({ visit: vetVisits, pet: pets }).from(vetVisits).innerJoin(pets, eq(vetVisits.petId, pets.id)).where(eq(vetVisits.id, id));
    if (!row) throw new Error("Appointment not found.");
    if (row.visit.vetId !== doctor.vetId) throw new Error("This checkup is booked with another doctor.");
    if (row.visit.status !== "booked") throw new Error("This visit isn't confirmed yet.");
    if (row.visit.startedAt) return {};
    await db.update(vetVisits).set({ startedAt: nowStamp() }).where(eq(vetVisits.id, id));
    await logEvent(db, id, "started", doctor.name);
    await systemMessage(db, row.pet, `${doctor.name} has started ${row.pet.name}'s checkup. We'll send the report as soon as it's done.`, {
      title: "Checkup started",
      channel: "vet",
    });
    return {};
  });
}

/** Confirms every waiting request for one pet (bookings and vet visits) in one go. */
export async function confirmAllForPet(petId: string) {
  return run(async () => {
    await requireRole("admin");
    const db = await getDb();
    const waiting = await db.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.petId, petId), eq(bookings.status, "requested")));
    const waitingVet = await db.select({ id: vetVisits.id }).from(vetVisits).where(and(eq(vetVisits.petId, petId), eq(vetVisits.status, "requested")));
    for (const b of waiting) {
      const r = await confirmBooking(b.id);
      if (!r.ok) throw new Error(r.error);
    }
    for (const v of waitingVet) {
      const r = await confirmVetVisit(v.id);
      if (!r.ok) throw new Error(r.error);
    }
    return { count: waiting.length + waitingVet.length };
  });
}

export async function uploadVaccineRecord(petId: string, record: RecordInput) {
  return run(async () => {
    const parent = await requireRole("parent");
    const db = await getDb();
    const pet = await ownedPet(db, parent.id, petId);
    await saveScannedRecord(db, pet.id, record);
    return { changes: await recheckPet(db, pet) };
  });
}

// ── In-house vet ───────────────────────────────────────────────────────────

export async function bookVetVisit(input: { petId: string; vetId: string; reason: VetReason; symptoms: string; date: string; time: string }) {
  return run(async () => {
    const parent = await requireRole("parent");
    if (!PARENT_REASONS.includes(input.reason)) throw new Error("Choose a reason for the visit.");
    if (!ISO_DATE.test(input.date) || input.date < todayISO()) throw new Error("Pick a date from today on.");
    if (!VET_SLOTS.includes(input.time)) throw new Error("Pick a time slot.");
    if (input.date === todayISO() && input.time <= nowStamp().slice(11, 16)) throw new Error("That time has already passed today.");
    const symptoms = input.symptoms.trim().slice(0, 500);
    if (input.reason === "sick" && !symptoms) throw new Error("Tell the vet what's wrong so they can prepare.");
    const db = await getDb();
    const pet = await ownedPet(db, parent.id, input.petId);
    const [vet] = await db.select().from(vets).where(and(eq(vets.id, input.vetId), eq(vets.active, true)));
    if (!vet) throw new Error("Choose a doctor.");
    if (!worksOn(vet, input.date)) throw new Error(`${vet.name} doesn't work that day. Please pick another date.`);
    const [clash] = await db
      .select({ id: vetVisits.id })
      .from(vetVisits)
      .where(
        and(
          eq(vetVisits.vetId, vet.id),
          eq(vetVisits.date, input.date),
          eq(vetVisits.time, input.time),
          inArray(vetVisits.status, ["requested", "booked"]),
        ),
      );
    if (clash) throw new Error("This date and time is already booked. Please choose another time.");

    const id = newId("vv");
    await db.insert(vetVisits).values({
      id,
      petId: pet.id,
      vetId: vet.id,
      reason: input.reason,
      symptoms: symptoms || null,
      date: input.date,
      time: input.time,
      status: "requested",
      requestedBy: firstName(parent.name),
      createdAt: nowStamp(),
    });
    await logEvent(db, id, "requested");
    await systemMessage(
      db,
      pet,
      `Thanks! We've received ${pet.name}'s ${VET_REASONS[input.reason].label.toLowerCase()} request with ${vet.name} for ${formatShortDate(input.date)} at ${formatTime(input.time)}. We'll confirm shortly.`,
      { title: "Vet visit requested", channel: "vet" },
    );
    const invoice = await ensureInvoice(db, "vet", id);
    return { id, invoiceId: invoice?.id ?? null };
  });
}

export async function cancelVetVisit(id: string, reason: string) {
  return run(async () => {
    const parent = await requireRole("parent");
    const why = cleanReason(reason);
    const db = await getDb();
    const [row] = await db
      .select({ visit: vetVisits, pet: pets })
      .from(vetVisits)
      .innerJoin(pets, eq(vetVisits.petId, pets.id))
      .where(and(eq(vetVisits.id, id), eq(pets.ownerId, parent.id)));
    if (!row) throw new Error("That appointment isn't on your account.");
    if (row.visit.status !== "booked" && row.visit.status !== "requested") throw new Error("This appointment can't be cancelled anymore.");
    await db.update(vetVisits).set({ status: "cancelled", cancelReason: why, cancelledAt: nowStamp() }).where(eq(vetVisits.id, id));
    await logEvent(db, id, "cancelled", why);
    const closed = await closeInvoice(db, id, `Cancelled by owner: ${why}`);
    await systemMessage(db, row.pet, `We've cancelled ${row.pet.name}'s vet appointment on ${formatShortDate(row.visit.date)}.\nReason: ${why}`, {
      title: "Vet visit cancelled",
      channel: "vet",
      link: { href: `/my/vet?pet=${row.pet.id}`, label: "Book another time" },
    });
    await refundMessages(db, row.pet, closed, "vet");
    return {};
  });
}

export async function updateConditions(petId: string, conditions: string[]) {
  return run(async () => {
    const parent = await requireRole("parent");
    const db = await getDb();
    await ownedPet(db, parent.id, petId);
    await db.update(pets).set({ conditions: cleanConditions(conditions) }).where(eq(pets.id, petId));
    return {};
  });
}

/** Staff noticed something during a stay: book a doctor on duty today and tell the owner. */
export async function flagForVet(petId: string, note: string) {
  return run(async () => {
    const staff = await requireRole("staff", "admin");
    const what = note.trim().slice(0, 300);
    if (!what) throw new Error("Describe what you noticed.");
    const db = await getDb();
    const [pet] = await db.select().from(pets).where(eq(pets.id, petId));
    if (!pet) throw new Error("Pet not found.");
    const today = todayISO();
    const [existing] = await db
      .select({ id: vetVisits.id })
      .from(vetVisits)
      .where(and(eq(vetVisits.petId, petId), inArray(vetVisits.status, ["requested", "booked"]), lte(vetVisits.date, today)));
    if (existing) throw new Error(`${pet.name} already has a vet check today.`);

    // First doctor on duty today with a free slot; if the day is full, the
    // first one on duty sees the pet as soon as possible.
    const taken = new Set(
      (
        await db
          .select({ vetId: vetVisits.vetId, time: vetVisits.time })
          .from(vetVisits)
          .where(and(eq(vetVisits.date, today), inArray(vetVisits.status, ["requested", "booked"])))
      ).map((r) => `${r.vetId} ${r.time}`),
    );
    const allVets = await db.select().from(vets).where(eq(vets.active, true)).orderBy(asc(vets.sort));
    const onDuty = allVets.filter((v) => worksOn(v, today));
    const candidates = onDuty.length ? onDuty : allVets;
    const now = nowStamp().slice(11, 16);
    let vet = candidates[0];
    let time = now;
    for (const slot of VET_SLOTS.filter((s) => s > now)) {
      const free = candidates.find((v) => !taken.has(`${v.id} ${slot}`));
      if (free) {
        vet = free;
        time = slot;
        break;
      }
    }
    const id = newId("vv");
    // Staff flags are urgent, so they skip the confirmation step.
    await db.insert(vetVisits).values({
      id,
      petId,
      vetId: vet?.id ?? null,
      reason: "staff_flag",
      symptoms: what,
      date: today,
      time,
      status: "booked",
      requestedBy: firstName(staff.name),
      confirmedBy: staff.name,
      confirmedAt: nowStamp(),
      createdAt: nowStamp(),
    });
    await logEvent(db, id, "requested", staff.name);
    await logEvent(db, id, "confirmed", staff.name);
    await ensureInvoice(db, "vet", id);
    await systemMessage(
      db,
      pet,
      `Our team noticed something with ${pet.name}: "${what}". To be safe, ${vet?.name ?? "our vet"} will check ${pet.sex === "f" ? "her" : "him"} today at ${formatTime(time)}. Nothing you need to do — we'll send the report right after.`,
      { title: "Vet check today", channel: "vet" },
    );
    return {};
  });
}

export type VetReport = {
  weightKg: string;
  temperatureC: string;
  healthStatus: HealthStatus;
  diagnosis: string;
  treatment: string;
  medication: string;
  followUpDate: string | null;
  addConditions: string[];
  resolvedConditions: string[];
};

/** Only the doctor the visit is booked with can record the exam. */
export async function completeVetVisit(id: string, report: VetReport) {
  return run(async () => {
    const doctor = await requireRole("vet");
    if (!(report.healthStatus in HEALTH_STATUS)) throw new Error("Choose a health status.");
    const diagnosis = report.diagnosis.trim().slice(0, 500);
    if (!diagnosis) throw new Error("Add the findings or diagnosis.");
    const num = (v: string, label: string, min: number, max: number) => {
      if (!v.trim()) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} looks off — check the number.`);
      return String(n);
    };
    const weightKg = num(report.weightKg, "Weight", 0.1, 120);
    const temperatureC = num(report.temperatureC, "Temperature", 30, 45);
    if (report.followUpDate && (!ISO_DATE.test(report.followUpDate) || report.followUpDate <= todayISO())) {
      throw new Error("Follow-up must be a future date.");
    }

    const db = await getDb();
    const [visit] = await db.select().from(vetVisits).where(eq(vetVisits.id, id));
    if (!visit) throw new Error("Appointment not found.");
    if (visit.vetId !== doctor.vetId) throw new Error("This checkup is booked with another doctor.");
    if (visit.status === "requested") throw new Error("This visit hasn't been confirmed by the front desk yet.");
    if (visit.status !== "booked") throw new Error("This checkup is already finished.");
    const [pet] = await db.select().from(pets).where(eq(pets.id, visit.petId));

    await db
      .update(vetVisits)
      .set({
        status: "completed",
        vetName: doctor.name,
        weightKg,
        temperatureC,
        healthStatus: report.healthStatus,
        diagnosis,
        treatment: report.treatment.trim().slice(0, 500) || null,
        medication: report.medication.trim().slice(0, 300) || null,
        followUpDate: report.followUpDate || null,
        completedAt: nowStamp(),
      })
      .where(eq(vetVisits.id, id));
    await logEvent(db, id, "completed", doctor.name);

    const conditions = cleanConditions([...pet.conditions.filter((c) => !report.resolvedConditions.includes(c)), ...report.addConditions]);
    await db.update(pets).set({ conditions }).where(eq(pets.id, pet.id));

    // The same doctor sees the follow-up, at their first free slot that day.
    // A doctor-ordered follow-up is confirmed straight away.
    let followUpTime = VET_SLOTS[0];
    if (report.followUpDate) {
      const busy = new Set(
        (
          await db
            .select({ time: vetVisits.time })
            .from(vetVisits)
            .where(and(eq(vetVisits.date, report.followUpDate), inArray(vetVisits.status, ["requested", "booked"]), eq(vetVisits.vetId, visit.vetId ?? "")))
        ).map((r) => r.time),
      );
      followUpTime = VET_SLOTS.find((s) => !busy.has(s)) ?? VET_SLOTS[0];
      const followId = newId("vv");
      await db.insert(vetVisits).values({
        id: followId,
        petId: pet.id,
        vetId: visit.vetId,
        reason: "follow_up",
        symptoms: `Follow-up: ${diagnosis}`.slice(0, 500),
        date: report.followUpDate,
        time: followUpTime,
        status: "booked",
        requestedBy: doctor.name,
        confirmedBy: doctor.name,
        confirmedAt: nowStamp(),
        createdAt: nowStamp(),
      });
      await logEvent(db, followId, "requested", doctor.name);
      await logEvent(db, followId, "confirmed", doctor.name);
      await ensureInvoice(db, "vet", followId);
    }

    const status = HEALTH_STATUS[report.healthStatus].label;
    const parts = [
      `${doctor.name} checked ${pet.name}: ${diagnosis}`,
      weightKg && `Weight ${weightKg} kg.`,
      report.medication.trim() && `Medication: ${report.medication.trim()}.`,
      report.followUpDate && `Follow-up booked for ${formatShortDate(report.followUpDate)} at ${formatTime(followUpTime)}.`,
    ].filter(Boolean);
    await systemMessage(db, pet, parts.join(" "), {
      title: `Vet report: ${status}`,
      channel: "vet",
      link: { href: `/api/vet-report/${id}`, label: "Download PDF report" },
    });
    return {};
  });
}

// ── Payments & invoices ────────────────────────────────────────────────────

async function loadInvoice(db: Db, invoiceId: string) {
  const [row] = await db.select({ invoice: invoices, pet: pets }).from(invoices).innerJoin(pets, eq(invoices.petId, pets.id)).where(eq(invoices.id, invoiceId));
  if (!row) throw new Error("Invoice not found.");
  return row;
}

/** Is the booking or visit behind this invoice still going ahead? */
async function refStillOn(db: Db, invoice: Invoice) {
  if (invoice.refKind === "booking") {
    const [b] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, invoice.refId));
    return !!b && !["cancelled", "declined"].includes(b.status);
  }
  const [v] = await db.select({ status: vetVisits.status }).from(vetVisits).where(eq(vetVisits.id, invoice.refId));
  return !!v && !["cancelled", "declined"].includes(v.status);
}

const channelFor = (invoice: Invoice): Channel => (invoice.refKind === "vet" ? "vet" : "team");

async function thankYouMessage(db: Db, pet: Pet, invoice: Invoice, total: number, how: string) {
  await systemMessage(db, pet, `Thank you for your payment! We received ${formatMoney(total)} for invoice #${invoice.number} (${how}). Your receipt is ready.`, {
    title: "Payment received",
    channel: channelFor(invoice),
    link: { href: `/api/invoice/${invoice.id}`, label: "Download receipt" },
  });
}

/** Luhn check, so the demo checkout behaves like a real card form. */
function validCardNumber(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export type CardInput = { name: string; number: string; expiry: string; cvc: string };

/**
 * The owner pays online and gets the online discount. This is a demo
 * checkout: no payment provider is connected and no money moves.
 */
export async function payOnline(invoiceId: string, card: CardInput) {
  return run(async () => {
    const parent = await requireRole("parent");
    const db = await getDb();
    const { invoice, pet } = await loadInvoice(db, invoiceId);
    if (invoice.ownerId !== parent.id) throw new Error("That invoice isn't on your account.");
    if (invoice.status === "paid") throw new Error("This invoice is already paid.");
    if (invoice.status !== "unpaid" || !(await refStillOn(db, invoice))) throw new Error("This booking was cancelled, so there's nothing to pay.");

    const name = card.name.trim();
    const digits = card.number.replace(/\D/g, "");
    if (name.length < 2) throw new Error("Enter the name on the card.");
    if (digits.length < 13 || digits.length > 19 || !validCardNumber(digits)) throw new Error("That card number doesn't look right.");
    const exp = card.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
    if (!exp || Number(exp[1]) < 1 || Number(exp[1]) > 12) throw new Error("Enter the expiry as MM/YY.");
    const expEnd = `20${exp[2]}-${exp[1]}`;
    if (expEnd < todayISO().slice(0, 7)) throw new Error("This card has expired.");
    if (!/^\d{3,4}$/.test(card.cvc.trim())) throw new Error("Enter the 3-digit security code.");

    const percent = await getOnlineDiscount(db);
    const items = withOnlineDiscount(invoice.items, percent);
    const total = sumItems(items);
    const paid: Partial<Invoice> = {
      items,
      totalCents: total,
      status: "paid",
      paidAt: nowStamp(),
      paidMethod: "online",
      paidBy: parent.name,
      cardLast4: digits.slice(-4),
      txnRef: `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
    };
    await db.update(invoices).set(paid).where(eq(invoices.id, invoiceId));
    await thankYouMessage(db, pet, { ...invoice, ...paid } as Invoice, total, `online, card ending ${digits.slice(-4)}`);
    return { total };
  });
}

/** Front desk takes payment in person (no online discount). */
export async function recordPayment(invoiceId: string, method: PaymentMethod) {
  return run(async () => {
    const staff = await requireRole("staff", "admin");
    if (method !== "cash" && method !== "card") throw new Error("Choose cash or card.");
    const db = await getDb();
    const { invoice, pet } = await loadInvoice(db, invoiceId);
    if (invoice.status !== "unpaid") throw new Error(`Invoice #${invoice.number} is already ${invoice.status}.`);
    if (!(await refStillOn(db, invoice))) throw new Error("This booking was cancelled — void the invoice instead.");
    await db
      .update(invoices)
      .set({ status: "paid", paidAt: nowStamp(), paidMethod: method, paidBy: staff.name, txnRef: `DESK-${randomUUID().slice(0, 6).toUpperCase()}` })
      .where(eq(invoices.id, invoiceId));
    await thankYouMessage(db, pet, invoice, invoice.totalCents, method === "cash" ? "cash at the front desk" : "card at the front desk");
    return {};
  });
}

/** Extras added during a stay (an extra walk, medication, a toy…). Unpaid invoices only. */
export async function addInvoiceItem(invoiceId: string, label: string, amount: string) {
  return run(async () => {
    await requireRole("staff", "admin");
    const what = label.trim().slice(0, 60);
    if (!what) throw new Error("Describe the extra charge.");
    const cents = parseMoney(amount);
    if (cents === null || cents === 0 || Math.abs(cents) > 500_000) throw new Error("Enter an amount like 15 or 12.50.");
    const db = await getDb();
    const { invoice } = await loadInvoice(db, invoiceId);
    if (invoice.status !== "unpaid") throw new Error("Only unpaid invoices can be changed.");
    const items = [...invoice.items, { label: what, qty: 1, unitCents: cents, cents }];
    if (sumItems(items) < 0) throw new Error("The total can't go below zero.");
    await db.update(invoices).set({ items, totalCents: sumItems(items) }).where(eq(invoices.id, invoiceId));
    return {};
  });
}

export async function removeInvoiceItem(invoiceId: string, index: number) {
  return run(async () => {
    await requireRole("staff", "admin");
    const db = await getDb();
    const { invoice } = await loadInvoice(db, invoiceId);
    if (invoice.status !== "unpaid") throw new Error("Only unpaid invoices can be changed.");
    if (index < 1 || index >= invoice.items.length) throw new Error("The main service line can't be removed.");
    const items = invoice.items.filter((_, i) => i !== index);
    if (sumItems(items) < 0) throw new Error("The total can't go below zero.");
    await db.update(invoices).set({ items, totalCents: sumItems(items) }).where(eq(invoices.id, invoiceId));
    return {};
  });
}

/** Admin only: cancel an unpaid invoice (e.g. a goodwill gesture). */
export async function voidInvoice(invoiceId: string, reason: string) {
  return run(async () => {
    await requireRole("admin");
    const why = reason.trim().slice(0, 200);
    if (!why) throw new Error("Add a reason for the records.");
    const db = await getDb();
    const { invoice } = await loadInvoice(db, invoiceId);
    if (invoice.status !== "unpaid") throw new Error("Only unpaid invoices can be voided. Refund a paid one instead.");
    await db.update(invoices).set({ status: "void", voidReason: why }).where(eq(invoices.id, invoiceId));
    return {};
  });
}

/** Admin only: refund a paid invoice in full. */
export async function refundInvoice(invoiceId: string, reason: string) {
  return run(async () => {
    await requireRole("admin");
    const why = reason.trim().slice(0, 200);
    if (!why) throw new Error("Add a reason for the records.");
    const db = await getDb();
    const { invoice, pet } = await loadInvoice(db, invoiceId);
    if (invoice.status !== "paid") throw new Error("Only paid invoices can be refunded.");
    await db.update(invoices).set({ status: "refunded", voidReason: why, refundedAt: nowStamp() }).where(eq(invoices.id, invoiceId));
    await refundMessages(db, pet, { ...invoice, status: "refunded" }, channelFor(invoice));
    return {};
  });
}

/** Staff and admin can change the online-payment offer. */
export async function setOnlineDiscount(percent: number) {
  return run(async () => {
    const user = await requireRole("staff", "admin");
    if (!Number.isInteger(percent) || percent < 0 || percent > 50) throw new Error("Choose a discount from 0% to 50%.");
    const db = await getDb();
    await db
      .insert(settings)
      .values({ key: "online_discount_pct", value: String(percent), updatedAt: nowStamp(), updatedBy: user.name })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(percent), updatedAt: nowStamp(), updatedBy: user.name } });
    return {};
  });
}

/** Admin only. New prices apply to new bookings; existing invoices keep theirs. */
export async function updatePrices(entries: { key: string; amount: string }[]) {
  return run(async () => {
    const admin = await requireRole("admin");
    const db = await getDb();
    const known = new Set((await db.select({ key: prices.key }).from(prices)).map((p) => p.key));
    const changes = entries.map((e) => {
      if (!known.has(e.key)) throw new Error("Unknown price.");
      const cents = parseMoney(e.amount);
      if (cents === null || cents < 0 || cents > 1_000_000) throw new Error(`"${e.amount}" isn't a valid price.`);
      return { key: e.key, cents };
    });
    for (const c of changes) await db.update(prices).set({ cents: c.cents, updatedAt: nowStamp(), updatedBy: admin.name }).where(eq(prices.key, c.key));
    return { count: changes.length };
  });
}

// ── Business settings & staff (admin) ──────────────────────────────────────

/** Admin: business name, logo, contact details, address and opening hours. */
export async function saveBusiness(input: BusinessInfo) {
  return run(async () => {
    const admin = await requireRole("admin");
    const t = (v: string, max: number) => (v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
    const name = t(input.name, 40);
    if (name.length < 2) throw new Error("Enter the business name.");
    const address = t(input.address, 160);
    if (address.length < 5) throw new Error("Enter the clinic address so customers can find you.");
    const email = t(input.email, 80);
    if (email && !EMAIL_RE.test(email)) throw new Error("That email doesn't look right.");
    const phone = t(input.phone, 25);
    if (phone && !/^[+\d\s().-]{7,25}$/.test(phone)) throw new Error("That phone number doesn't look right.");
    if (input.logo) assertImage(input.logo);
    if (!Array.isArray(input.hours) || input.hours.length !== 7) throw new Error("Set the hours for every day.");
    const hours = input.hours.map((h, i) => {
      if (!h) return null;
      if (!/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close) || h.open >= h.close) {
        throw new Error(`${DAY_NAMES[i]}: closing time must be after opening time.`);
      }
      return { open: h.open, close: h.close };
    });
    if (hours.every((h) => !h)) throw new Error("The clinic needs to be open at least one day.");
    const mapQuery = t(input.mapQuery, 160);
    // Place the clinic on the map. Only look it up again when the address changed.
    const before = await getBusiness();
    const sameSpot = before.address === address && before.mapQuery === mapQuery && before.lat != null;
    const pin = sameSpot ? { lat: before.lat!, lon: before.lon! } : ((await geocode(mapQuery || address)) ?? (mapQuery ? await geocode(address) : null));
    const value: BusinessInfo = { name, tagline: t(input.tagline, 80), logo: input.logo || null, phone, email, address, mapQuery, lat: pin?.lat ?? null, lon: pin?.lon ?? null, hours };
    const db = await getDb();
    await db
      .insert(settings)
      .values({ key: "business", value: JSON.stringify(value), updatedAt: nowStamp(), updatedBy: admin.name })
      .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value), updatedAt: nowStamp(), updatedBy: admin.name } });
    return { lat: value.lat, lon: value.lon };
  });
}

export type StaffInput = { name: string; title: string; email: string; phone: string; password: string; role: "staff" | "admin" };

/** Admin: give a new team member their own sign-in. */
export async function addStaff(input: StaffInput) {
  return run(async () => {
    await requireRole("admin");
    const name = input.name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (name.length < 2) throw new Error("Enter their full name.");
    const email = normalizeEmail(input.email);
    if (!EMAIL_RE.test(email)) throw new Error("Enter a valid email for their sign-in.");
    const phone = input.phone.trim().slice(0, 25);
    if (phone && !/^[+\d\s().-]{7,25}$/.test(phone)) throw new Error("That phone number doesn't look right.");
    const problem = passwordProblem(input.password);
    if (problem) throw new Error(`Starting password: ${problem}`);
    if (input.role !== "staff" && input.role !== "admin") throw new Error("Choose staff or admin.");
    const db = await getDb();
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (taken) throw new Error("Another account already uses this email.");
    await db.insert(users).values({
      id: newId("u"), name, role: input.role, title: input.title.trim().slice(0, 40) || (input.role === "admin" ? "Manager" : "Team member"),
      phone: phone || null, email, passwordHash: await hashPassword(input.password), createdAt: nowStamp(),
    });
    return {};
  });
}

/** Admin: remove a team member. They're signed out everywhere at once. */
export async function removeStaff(userId: string) {
  return run(async () => {
    const admin = await requireRole("admin");
    if (userId === admin.id) throw new Error("You can't remove your own account.");
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, userId));
    if (!target || (target.role !== "staff" && target.role !== "admin")) throw new Error("Team member not found.");
    if (target.role === "admin") {
      const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
      if (admins.length <= 1) throw new Error("Keep at least one admin.");
    }
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    return {};
  });
}

// ── Doctor earnings ────────────────────────────────────────────────────────

/** Admin: credit a doctor now with everything they've earned and not yet been paid. */
export async function sendDoctorPayout(vetId: string) {
  return run(async () => {
    const admin = await requireRole("admin");
    const db = await getDb();
    const payout = await createPayout(db, vetId, admin.name);
    if (!payout) throw new Error("Nothing to pay yet — no paid checkups since the last payout.");
    return { netCents: payout.netCents };
  });
}

/** Admin: the platform fee the clinic keeps from each vet visit. */
export async function setDoctorFee(percent: number) {
  return run(async () => {
    const admin = await requireRole("admin");
    if (!Number.isInteger(percent) || percent < 0 || percent > 80) throw new Error("Choose a fee from 0% to 80%.");
    const db = await getDb();
    await db
      .insert(settings)
      .values({ key: "doctor_fee_pct", value: String(percent), updatedAt: nowStamp(), updatedBy: admin.name })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(percent), updatedAt: nowStamp(), updatedBy: admin.name } });
    return {};
  });
}

/** Doctor opened their earnings: payout notifications are read. */
export async function markPayoutsSeen() {
  const user = await getCurrentUser();
  if (!user || user.role !== "vet" || !user.vetId) return;
  const db = await getDb();
  await db.update(payouts).set({ seenByDoctor: true }).where(and(eq(payouts.vetId, user.vetId), eq(payouts.seenByDoctor, false)));
  done();
}

// ── Doctors (admin) ────────────────────────────────────────────────────────

export type DoctorInput = {
  id: string | null;
  name: string;
  title: string;
  specialty: string;
  experienceYears: number;
  education: string;
  languages: string;
  focus: string;
  bio: string;
  workDays: number[];
  color: string;
  phone: string;
  email: string;
  /** Required for a new doctor; optional when editing (blank keeps the current one). */
  password: string;
};

const splitList = (s: string) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 8);

/** Adds or edits a doctor. A new doctor also gets their own login. */
export async function saveDoctor(input: DoctorInput) {
  return run(async () => {
    await requireRole("admin");
    const t = (v: string, max: number) => v.trim().replace(/\s+/g, " ").slice(0, max);
    const name = t(input.name, 60);
    if (name.length < 4) throw new Error("Enter the doctor's full name, e.g. Dr. Sam Lee.");
    const specialty = t(input.specialty, 60);
    if (!specialty) throw new Error("Add a specialty, e.g. General practice.");
    const years = Number(input.experienceYears);
    if (!Number.isInteger(years) || years < 0 || years > 60) throw new Error("Years of experience should be 0–60.");
    const workDays = [...new Set(input.workDays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
    if (workDays.length === 0) throw new Error("Pick at least one working day.");
    if (!(input.color in VET_COLORS)) throw new Error("Pick a colour.");
    const phone = t(input.phone, 25);
    if (phone && !/^[+\d\s().-]{7,25}$/.test(phone)) throw new Error("That phone number doesn't look right.");
    const row = {
      name,
      title: t(input.title, 60) || "DVM",
      specialty,
      experienceYears: years,
      education: t(input.education, 120) || "Doctor of Veterinary Medicine (DVM)",
      languages: splitList(input.languages).length ? splitList(input.languages) : ["English"],
      focus: splitList(input.focus),
      bio: input.bio.trim().slice(0, 600) || `${name} joined our in-house clinic team.`,
      workDays,
      color: input.color,
    };
    const email = normalizeEmail(input.email);
    if (!EMAIL_RE.test(email)) throw new Error("Enter the doctor's sign-in email.");
    if (input.password || !input.id) {
      const problem = passwordProblem(input.password);
      if (problem) throw new Error(`Starting password: ${problem}`);
    }
    const db = await getDb();
    const [emailOwner] = await db.select({ id: users.id, vetId: users.vetId }).from(users).where(eq(users.email, email));
    if (emailOwner && (!input.id || emailOwner.vetId !== input.id)) throw new Error("Another account already uses this email.");

    if (input.id) {
      const [existing] = await db.select({ id: vets.id }).from(vets).where(eq(vets.id, input.id));
      if (!existing) throw new Error("Doctor not found.");
      await db.update(vets).set(row).where(eq(vets.id, input.id));
      await db
        .update(users)
        .set({ name, phone: phone || null, email, ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}) })
        .where(eq(users.vetId, input.id));
      return { id: input.id };
    }
    const id = newId("vet");
    const [last] = await db.select({ sort: vets.sort }).from(vets).orderBy(desc(vets.sort)).limit(1);
    await db.insert(vets).values({ id, ...row, sort: (last?.sort ?? 0) + 1, active: true });
    await db.insert(users).values({
      id: newId("u"), name, role: "vet", title: "Veterinarian", phone: phone || null, vetId: id,
      email, passwordHash: await hashPassword(input.password), createdAt: nowStamp(),
    });
    return { id };
  });
}

/** Turns a doctor off for new bookings (their history stays). */
export async function setDoctorActive(vetId: string, active: boolean) {
  return run(async () => {
    await requireRole("admin");
    const db = await getDb();
    const [vet] = await db.select().from(vets).where(eq(vets.id, vetId));
    if (!vet) throw new Error("Doctor not found.");
    if (!active) {
      const upcoming = await db
        .select({ id: vetVisits.id })
        .from(vetVisits)
        .where(and(eq(vetVisits.vetId, vetId), inArray(vetVisits.status, ["requested", "booked"]), gte(vetVisits.date, todayISO())));
      if (upcoming.length) throw new Error(`${vet.name} still has ${upcoming.length} upcoming visit${upcoming.length === 1 ? "" : "s"}. Move or cancel them first.`);
      const left = await db.select({ id: vets.id }).from(vets).where(eq(vets.active, true));
      if (left.length <= 1) throw new Error("Keep at least one doctor available for bookings.");
    }
    await db.update(vets).set({ active }).where(eq(vets.id, vetId));
    return {};
  });
}
