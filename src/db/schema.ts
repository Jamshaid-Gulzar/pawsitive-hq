import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { InvoiceItem, PriceCategory } from "@/lib/pricing";
import type { ComplianceIssue, Service, Species } from "@/lib/vaccines";

export type Role = "staff" | "admin" | "parent" | "vet";
export type UnitKind = "run" | "suite" | "table";
/**
 * requested → (admin confirms) → confirmed → checked_in → completed.
 * A failed vaccine check parks it at locked/review until fixed; the admin can
 * also decline a request.
 */
export type BookingStatus = "requested" | "review" | "locked" | "confirmed" | "checked_in" | "completed" | "cancelled" | "declined";
export type MessageAuthor = "staff" | "parent" | "system" | "vet";
/** Each pet has two conversations: with the facility team, and with the vets. */
export type Channel = "team" | "vet";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").$type<Role>().notNull(),
  title: text("title"),
  phone: text("phone"),
  /** Set for role "vet": the doctor profile this login belongs to. */
  vetId: text("vet_id"),
  /** Sign-in email (stored lower-case) and scrypt password hash. */
  email: text("email"),
  passwordHash: text("password_hash"),
  createdAt: text("created_at"),
});

/**
 * A signed-in browser. The cookie holds only this random token. No foreign
 * key: resetting the demo re-creates users with the same ids, so sessions
 * survive it, and a session for a removed user simply stops matching.
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const pets = sqliteTable("pets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  species: text("species").$type<Species>().notNull(),
  breed: text("breed").notNull(),
  sex: text("sex").$type<"f" | "m">().notNull(),
  birthday: text("birthday"),
  photo: text("photo"),
  food: text("food").notNull(),
  meds: text("meds"),
  medTime: text("med_time"),
  alert: text("alert"),
  note: text("note"),
  conditions: text("conditions", { mode: "json" }).$type<string[]>().notNull().default([]),
});

export const vets = sqliteTable("vets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  specialty: text("specialty").notNull(),
  experienceYears: integer("experience_years").notNull(),
  education: text("education").notNull(),
  languages: text("languages", { mode: "json" }).$type<string[]>().notNull(),
  focus: text("focus", { mode: "json" }).$type<string[]>().notNull(),
  bio: text("bio").notNull(),
  /** 0 = Sunday … 6 = Saturday */
  workDays: text("work_days", { mode: "json" }).$type<number[]>().notNull(),
  color: text("color").notNull(),
  sort: integer("sort").notNull(),
  /** Inactive doctors keep their history but can't be booked. */
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const prices = sqliteTable("prices", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  category: text("category").$type<PriceCategory>().notNull(),
  unit: text("unit").notNull(),
  cents: integer("cents").notNull(),
  sort: integer("sort").notNull(),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
});

/**
 * unpaid → paid (online by the owner, or at the desk by staff). Cancelling an
 * unpaid booking voids its invoice; cancelling a paid one refunds it.
 */
export type InvoiceStatus = "unpaid" | "paid" | "void" | "refunded";
export type PaymentMethod = "online" | "cash" | "card";

/** Settings the team can change, e.g. the online payment discount. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
});

/** One invoice per booking or vet visit, created with the request. */
export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  number: integer("number").notNull(),
  petId: text("pet_id").notNull().references(() => pets.id),
  ownerId: text("owner_id").notNull().references(() => users.id),
  refKind: text("ref_kind").$type<"booking" | "vet">().notNull(),
  refId: text("ref_id").notNull(),
  service: text("service").$type<PriceCategory>().notNull(),
  /** The day the service starts, for "due" and revenue-by-day. */
  serviceDate: text("service_date").notNull(),
  items: text("items", { mode: "json" }).$type<InvoiceItem[]>().notNull(),
  totalCents: integer("total_cents").notNull(),
  status: text("status").$type<InvoiceStatus>().notNull(),
  createdAt: text("created_at").notNull(),
  paidAt: text("paid_at"),
  paidMethod: text("paid_method").$type<PaymentMethod>(),
  paidBy: text("paid_by"),
  /** Online payments: demo card's last 4 digits and a transaction reference. */
  cardLast4: text("card_last4"),
  txnRef: text("txn_ref"),
  voidReason: text("void_reason"),
  refundedAt: text("refunded_at"),
  /** Vet invoices: the doctor payout this visit's earnings were credited in. */
  payoutId: text("payout_id"),
});

export type PayoutLine = { invoiceId: string; number: number; petName: string; date: string; grossCents: number; feeCents: number; netCents: number };

/**
 * A doctor's earnings statement: their share of paid vet visits, after the
 * platform fee, credited to their account. Created automatically at month end
 * or sent early by the admin.
 */
export const payouts = sqliteTable("payouts", {
  id: text("id").primaryKey(),
  vetId: text("vet_id").notNull().references(() => vets.id),
  /** "2026-09": the month the visits happened in (the latest one, if several). */
  period: text("period").notNull(),
  lines: text("lines", { mode: "json" }).$type<PayoutLine[]>().notNull(),
  grossCents: integer("gross_cents").notNull(),
  feeCents: integer("fee_cents").notNull(),
  netCents: integer("net_cents").notNull(),
  feePercent: integer("fee_percent").notNull(),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
  seenByDoctor: integer("seen_by_doctor", { mode: "boolean" }).notNull().default(false),
});

export type VetReason = "checkup" | "sick" | "vaccination" | "follow_up" | "staff_flag";
/** "booked" means confirmed by the admin. */
export type VetStatus = "requested" | "booked" | "completed" | "cancelled" | "declined";
export type HealthStatus = "healthy" | "monitor" | "treatment";

export const vetVisits = sqliteTable("vet_visits", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull().references(() => pets.id),
  vetId: text("vet_id").references(() => vets.id),
  reason: text("reason").$type<VetReason>().notNull(),
  symptoms: text("symptoms"),
  date: text("date").notNull(),
  time: text("time").notNull(),
  status: text("status").$type<VetStatus>().notNull(),
  requestedBy: text("requested_by").notNull(),
  createdAt: text("created_at").notNull(),
  confirmedBy: text("confirmed_by"),
  confirmedAt: text("confirmed_at"),
  declineReason: text("decline_reason"),
  cancelReason: text("cancel_reason"),
  cancelledAt: text("cancelled_at"),
  reminderSent: integer("reminder_sent", { mode: "boolean" }).notNull().default(false),
  startedAt: text("started_at"),
  // Filled in by the vet when the checkup is done.
  vetName: text("vet_name"),
  weightKg: text("weight_kg"),
  temperatureC: text("temperature_c"),
  healthStatus: text("health_status").$type<HealthStatus>(),
  diagnosis: text("diagnosis"),
  treatment: text("treatment"),
  medication: text("medication"),
  followUpDate: text("follow_up_date"),
  completedAt: text("completed_at"),
});

export const vaccineRecords = sqliteTable("vaccine_records", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull().references(() => pets.id),
  image: text("image"),
  rabiesExp: text("rabies_exp"),
  coreExp: text("core_exp"),
  bordetellaExp: text("bordetella_exp"),
  source: text("source").$type<"scan" | "staff" | "seed">().notNull(),
  ocrText: text("ocr_text"),
  uploadedAt: text("uploaded_at").notNull(),
});

/** One row per vaccine reminder sent, so each stage (due soon, due this week, expired) goes out once. */
export const vaccineReminders = sqliteTable("vaccine_reminders", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull().references(() => pets.id),
  vaccine: text("vaccine").notNull(),
  dueDate: text("due_date"),
  stage: text("stage").$type<VaccineStage>().notNull(),
  sentAt: text("sent_at").notNull(),
});

export type VaccineStage = "due_30" | "due_7" | "expired" | "missing";

export const units = sqliteTable("units", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<UnitKind>().notNull(),
  label: text("label").notNull(),
  sort: integer("sort").notNull(),
});

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull().references(() => pets.id),
  service: text("service").$type<Service>().notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  /** Drop-off time for boarding and daycare; the appointment time for grooming. */
  dropoffTime: text("dropoff_time"),
  pickupTime: text("pickup_time"),
  groomServices: text("groom_services", { mode: "json" }).$type<string[]>().notNull().default([]),
  notes: text("notes"),
  status: text("status").$type<BookingStatus>().notNull(),
  issues: text("issues", { mode: "json" }).$type<ComplianceIssue[]>().notNull(),
  unitId: text("unit_id").references(() => units.id),
  groomStage: integer("groom_stage"),
  groomer: text("groomer"),
  approvedBy: text("approved_by"),
  confirmedBy: text("confirmed_by"),
  confirmedAt: text("confirmed_at"),
  declineReason: text("decline_reason"),
  cancelReason: text("cancel_reason"),
  cancelledAt: text("cancelled_at"),
  cancelledBy: text("cancelled_by"),
  /** The customer tapped "I've arrived". Staff then assign a run or table. */
  arrivedAt: text("arrived_at"),
  reminderSent: integer("reminder_sent", { mode: "boolean" }).notNull().default(false),
  /** What the pet is doing right now, set by staff (Playtime, Nap…). */
  activity: text("activity"),
  activityAt: text("activity_at"),
  createdAt: text("created_at").notNull(),
});

/** A staff-written report card for one day of a pet's stay. */
export const dailyReports = sqliteTable("daily_reports", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => bookings.id),
  petId: text("pet_id").notNull().references(() => pets.id),
  date: text("date").notNull(),
  meals: text("meals").notNull(),
  potty: text("potty").notNull(),
  mood: text("mood").notNull(),
  activities: text("activities", { mode: "json" }).$type<string[]>().notNull(),
  notes: text("notes"),
  photo: text("photo"),
  staffName: text("staff_name").notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * What happened to a booking or vet visit, and when: drives the customer's
 * live timeline. `ref` is a booking id or a vet visit id.
 */
export type EventKind =
  | "requested"
  | "vaccines_ok"
  | "vaccines_hold"
  | "vaccines_review"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "arrived"
  | "activity"
  | "started"
  | "report"
  | "checked_in"
  | "stage_1"
  | "stage_2"
  | "stage_3"
  | "completed";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  ref: text("ref").notNull(),
  kind: text("kind").$type<EventKind>().notNull(),
  note: text("note"),
  at: text("at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  petId: text("pet_id").notNull().references(() => pets.id),
  author: text("author").$type<MessageAuthor>().notNull(),
  authorName: text("author_name"),
  title: text("title"),
  body: text("body").notNull(),
  photo: text("photo"),
  mood: text("mood"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
  channel: text("channel").$type<Channel>().notNull().default("team"),
  /** Optional call to action shown under the message, e.g. "Book a checkup". */
  linkHref: text("link_href"),
  linkLabel: text("link_label"),
  /** Read receipts: the owner has seen a facility message / the facility has seen an owner message. */
  seenByOwner: integer("seen_by_owner", { mode: "boolean" }).notNull().default(false),
  seenByStaff: integer("seen_by_staff", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Pet = typeof pets.$inferSelect;
export type VaccineRecord = typeof vaccineRecords.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type VetVisit = typeof vetVisits.$inferSelect;
export type Vet = typeof vets.$inferSelect;
export type Event = typeof events.$inferSelect;
export type DailyReport = typeof dailyReports.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payout = typeof payouts.$inferSelect;

// Kept beside the table definitions above so the two stay in step. Bump
// SCHEMA_VERSION whenever these change: this is a demo database, so a new
// layout simply drops and recreates the tables, then reloads the demo data.
export const SCHEMA_VERSION = 8;

export const TABLES = ["payouts", "sessions", "settings", "invoices", "prices", "vaccine_reminders", "daily_reports", "events", "messages", "vet_visits", "bookings", "vaccine_records", "units", "vets", "pets", "users"];

export const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, title TEXT, phone TEXT, vet_id TEXT,
    email TEXT, password_hash TEXT, created_at TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
    species TEXT NOT NULL, breed TEXT NOT NULL, sex TEXT NOT NULL, birthday TEXT, photo TEXT,
    food TEXT NOT NULL, meds TEXT, med_time TEXT, alert TEXT, note TEXT, conditions TEXT NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS vets (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, specialty TEXT NOT NULL,
    experience_years INTEGER NOT NULL, education TEXT NOT NULL, languages TEXT NOT NULL, focus TEXT NOT NULL,
    bio TEXT NOT NULL, work_days TEXT NOT NULL, color TEXT NOT NULL, sort INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS prices (
    key TEXT PRIMARY KEY, label TEXT NOT NULL, category TEXT NOT NULL, unit TEXT NOT NULL,
    cents INTEGER NOT NULL, sort INTEGER NOT NULL, updated_at TEXT, updated_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY, number INTEGER NOT NULL, pet_id TEXT NOT NULL REFERENCES pets(id),
    owner_id TEXT NOT NULL REFERENCES users(id), ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL,
    service TEXT NOT NULL, service_date TEXT NOT NULL, items TEXT NOT NULL, total_cents INTEGER NOT NULL,
    status TEXT NOT NULL, created_at TEXT NOT NULL, paid_at TEXT, paid_method TEXT, paid_by TEXT,
    card_last4 TEXT, txn_ref TEXT, void_reason TEXT, refunded_at TEXT, payout_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY, vet_id TEXT NOT NULL REFERENCES vets(id), period TEXT NOT NULL, lines TEXT NOT NULL,
    gross_cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL, net_cents INTEGER NOT NULL, fee_percent INTEGER NOT NULL,
    created_at TEXT NOT NULL, created_by TEXT NOT NULL, seen_by_doctor INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT, updated_by TEXT)`,
  `CREATE INDEX IF NOT EXISTS invoices_ref ON invoices(ref_id)`,
  `CREATE TABLE IF NOT EXISTS vaccine_records (
    id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id), image TEXT,
    rabies_exp TEXT, core_exp TEXT, bordetella_exp TEXT, source TEXT NOT NULL,
    ocr_text TEXT, uploaded_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS vaccine_reminders (
    id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id), vaccine TEXT NOT NULL,
    due_date TEXT, stage TEXT NOT NULL, sent_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, sort INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id), service TEXT NOT NULL,
    start_date TEXT NOT NULL, end_date TEXT NOT NULL, dropoff_time TEXT, pickup_time TEXT,
    groom_services TEXT NOT NULL DEFAULT '[]', notes TEXT, status TEXT NOT NULL, issues TEXT NOT NULL,
    unit_id TEXT REFERENCES units(id), groom_stage INTEGER, groomer TEXT, approved_by TEXT,
    confirmed_by TEXT, confirmed_at TEXT, decline_reason TEXT, cancel_reason TEXT, cancelled_at TEXT,
    cancelled_by TEXT, arrived_at TEXT, reminder_sent INTEGER NOT NULL DEFAULT 0, activity TEXT,
    activity_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), pet_id TEXT NOT NULL REFERENCES pets(id),
    date TEXT NOT NULL, meals TEXT NOT NULL, potty TEXT NOT NULL, mood TEXT NOT NULL, activities TEXT NOT NULL,
    notes TEXT, photo TEXT, staff_name TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS vet_visits (
    id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id), vet_id TEXT REFERENCES vets(id),
    reason TEXT NOT NULL, symptoms TEXT, date TEXT NOT NULL, time TEXT NOT NULL, status TEXT NOT NULL,
    requested_by TEXT NOT NULL, created_at TEXT NOT NULL, confirmed_by TEXT, confirmed_at TEXT,
    decline_reason TEXT, cancel_reason TEXT, cancelled_at TEXT, reminder_sent INTEGER NOT NULL DEFAULT 0,
    started_at TEXT, vet_name TEXT, weight_kg TEXT, temperature_c TEXT, health_status TEXT,
    diagnosis TEXT, treatment TEXT, medication TEXT, follow_up_date TEXT, completed_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY, ref TEXT NOT NULL, kind TEXT NOT NULL, note TEXT, at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS events_ref ON events (ref)`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, pet_id TEXT NOT NULL REFERENCES pets(id), author TEXT NOT NULL,
    author_name TEXT, title TEXT, body TEXT NOT NULL, photo TEXT, mood TEXT, tags TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'team', link_href TEXT, link_label TEXT,
    seen_by_owner INTEGER NOT NULL DEFAULT 0, seen_by_staff INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS messages_pet ON messages (pet_id, channel)`,
];
