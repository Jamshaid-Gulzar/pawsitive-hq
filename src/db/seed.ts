import type { BatchItem } from "drizzle-orm/batch";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { isOpen } from "@/lib/availability";
import { addDays, nowStamp, todayISO } from "@/lib/dates";
import {
  DEFAULT_DOCTOR_FEE,
  DEFAULT_ONLINE_DISCOUNT,
  DEFAULT_PRICES,
  doctorSplit,
  quoteBooking,
  quoteVet,
  sumItems,
  toPriceMap,
  withOnlineDiscount,
  type InvoiceItem,
} from "@/lib/pricing";
import { evaluateCompliance, type Service, type VaccineDates } from "@/lib/vaccines";

import { hashPassword } from "@/lib/password";

const DEMO_PASSWORD = "demo1234";

/** Bump when the demo data changes, so running servers reload it. */
export const SEED_VERSION = 9;

/** "2026-10-07T09:00" + 30 → "2026-10-07T09:30" */
function addMinutes(stamp: string, minutes: number) {
  const d = new Date(Date.parse(`${stamp}:00Z`) + minutes * 60_000);
  return d.toISOString().slice(0, 16);
}
import * as schema from "./schema";

type Db = LibSQLDatabase<typeof schema>;

const ADMIN = "Jo Morgan";

/**
 * Wipes every table and loads the demo facility. All dates are relative to
 * today, so the demo always shows a busy "today" no matter when it runs.
 */
export async function seedDemo(db: Db) {
  const T = todayISO();
  const d = (n: number) => addDays(T, n);
  const at = (dayOffset: number, hhmm: string) => `${d(dayOffset)}T${hhmm}`;
  const minutesAgo = (n: number) => nowStamp(new Date(Date.now() - n * 60_000));
  const yearsAgo = (years: number, dayOffset = 0) => {
    const [y, m, day] = d(dayOffset).split("-");
    return `${Number(y) - years}-${m}-${day}`;
  };
  const weekday = (n: number) => new Date(`${d(n)}T12:00:00Z`).getUTCDay();
  /** First day offset ≥ from when this service is open. */
  const openDay = (service: Service, from: number) => {
    for (let n = from; n < from + 7; n++) if (isOpen(service, d(n))) return n;
    return from;
  };
  const q: BatchItem<"sqlite">[] = [];

  for (const t of [
    schema.payouts, schema.invoices, schema.prices, schema.settings,
    schema.vaccineReminders, schema.dailyReports,
    schema.events, schema.vetVisits, schema.messages, schema.bookings, schema.vaccineRecords,
    schema.units, schema.vets, schema.pets, schema.users,
  ]) {
    q.push(db.delete(t));
  }

  // ── People ───────────────────────────────────────────────────────────────
  // Every sample account signs in with <first name>@pawsitive.demo / demo1234.
  // (Sessions aren't wiped, so "Reset demo" doesn't sign anyone out.)
  const demoHash = await hashPassword(DEMO_PASSWORD, Buffer.from("pawsitive-demo-salt"));
  const withLogin = (list: Omit<typeof schema.users.$inferInsert, "email" | "passwordHash" | "createdAt">[]) =>
    list.map((u) => ({
      ...u,
      email: `${u.name.replace(/^Dr\. /, "").split(" ")[0].toLowerCase()}@pawsitive.demo`,
      passwordHash: demoHash,
      createdAt: at(-400, "09:00"),
    }));
  q.push(db.insert(schema.users).values(withLogin([
    { id: "u_ana", name: "Anna Reed", role: "staff", title: "Lead groomer" },
    { id: "u_jo", name: ADMIN, role: "admin", title: "Owner" },
    { id: "u_vet_leo", name: "Dr. Thomas Hale", role: "vet", title: "Veterinarian", vetId: "vet_leo" },
    { id: "u_vet_aisha", name: "Dr. Sarah Mitchell", role: "vet", title: "Veterinarian", vetId: "vet_aisha" },
    { id: "u_vet_mei", name: "Dr. Rachel Cooper", role: "vet", title: "Veterinarian", vetId: "vet_mei" },
    { id: "u_vet_carlos", name: "Dr. Daniel Foster", role: "vet", title: "Veterinarian", vetId: "vet_carlos" },
    { id: "u_priya", name: "Emily Carter", role: "parent", phone: "(555) 014-2231" },
    { id: "u_alex", name: "Alex Turner", role: "parent", phone: "(555) 014-5520" },
    { id: "u_marcus", name: "Mark Lewis", role: "parent", phone: "(555) 014-7781" },
    { id: "u_nina", name: "Hannah Brooks", role: "parent", phone: "(555) 014-3302" },
    { id: "u_omar", name: "Oliver Hughes", role: "parent", phone: "(555) 014-9045" },
    { id: "u_riley", name: "Ryan Parker", role: "parent", phone: "(555) 014-1187" },
    { id: "u_lena", name: "Lucy Fisher", role: "parent", phone: "(555) 014-6610" },
    { id: "u_dana", name: "Grace Wells", role: "parent", phone: "(555) 014-2954" },
    { id: "u_chris", name: "Chris Walker", role: "parent", phone: "(555) 014-8873" },
    { id: "u_maya", name: "Sophie Bennett", role: "parent", phone: "(555) 014-4419" },
    { id: "u_taylor", name: "Taylor Ross", role: "parent", phone: "(555) 014-0567" },
    { id: "u_jordan", name: "Jack Kingsley", role: "parent", phone: "(555) 014-3728" },
    { id: "u_hugo", name: "Harry Lawson", role: "parent", phone: "(555) 014-6251" },
  ])));

  const pet = (
    id: string, ownerId: string, name: string, species: "dog" | "cat", breed: string, sex: "f" | "m",
    food: string, extra: Partial<schema.Pet> = {},
  ): schema.Pet => ({
    id, ownerId, name, species, breed, sex, food,
    birthday: null, photo: `/pets/${id}.jpg`, meds: null, medTime: null, alert: null, note: null, conditions: [],
    ...extra,
  });

  const petRows: schema.Pet[] = [
    pet("bella", "u_priya", "Bella", "dog", "French Bulldog", "f", "Own food, 1 cup twice a day", { birthday: yearsAgo(4, 40) }),
    pet("biscuit", "u_priya", "Biscuit", "dog", "Pug", "m", "Own food, ¾ cup twice a day", {
      meds: "Apoquel, 1 tablet", medTime: "18:00", note: "Snores loudly", birthday: yearsAgo(6, 90), conditions: ["Skin allergy"],
    }),
    pet("max", "u_alex", "Max", "dog", "Golden Retriever", "m", "2 cups kibble, 7am & 5pm", { note: "Loves fetch" }),
    pet("rocky", "u_marcus", "Rocky", "dog", "Jack Russell", "m", "1 cup grain-free", { alert: "Chicken allergy" }),
    pet("daisy", "u_nina", "Daisy", "dog", "Beagle", "f", "1½ cups, slow-feeder bowl", {
      meds: "Ear drops, both ears", medTime: "18:30", conditions: ["Ear infection"],
    }),
    pet("milo", "u_omar", "Milo", "dog", "Chocolate Lab", "m", "2 cups kibble", { note: "Walk at 4 PM" }),
    pet("shadow", "u_riley", "Shadow", "dog", "Siberian Husky", "m", "2½ cups kibble", { alert: "Escape artist", birthday: yearsAgo(3) }),
    pet("mochi", "u_lena", "Mochi", "cat", "Domestic Shorthair", "f", "Wet food, ½ can", { note: "Shy at first" }),
    pet("coco", "u_dana", "Coco", "dog", "Bichon Frise", "f", "Own food", {}),
    pet("buddy", "u_chris", "Buddy", "dog", "Cocker Spaniel", "m", "1 cup kibble", {}),
    pet("luna", "u_maya", "Luna", "dog", "Cockapoo", "f", "1 cup kibble", {}),
    pet("pepper", "u_taylor", "Pepper", "dog", "Miniature Schnauzer", "m", "¾ cup kibble", { alert: "Nervous of dryers" }),
    pet("teddy", "u_jordan", "Teddy", "dog", "Cavalier King Charles", "m", "1 cup kibble", { conditions: ["Heart murmur"] }),
    pet("bear", "u_hugo", "Bear", "dog", "Chow Chow", "m", "2 cups kibble", { note: "Wears sunglasses for photos" }),
  ];
  q.push(db.insert(schema.pets).values(petRows));

  const good: VaccineDates = { rabies: d(420), core: d(240), bordetella: d(150) };
  const vaccines: Record<string, VaccineDates> = Object.fromEntries(petRows.map((p) => [p.id, good]));
  vaccines.bella = { rabies: d(160), core: d(-34), bordetella: d(106) };
  vaccines.rocky = { rabies: d(14), core: d(200), bordetella: d(90) };
  vaccines.teddy = { rabies: null, core: d(260), bordetella: d(120) };
  vaccines.mochi = { rabies: d(300), core: d(300), bordetella: null };
  // Coming due soon, so the reminders have something to show.
  vaccines.biscuit = { rabies: d(380), core: d(210), bordetella: d(21) };
  vaccines.max = { rabies: d(5), core: d(335), bordetella: d(335) };

  q.push(db.insert(schema.vaccineRecords).values([
    ...petRows.map((p) => ({
      id: `vr_${p.id}`, petId: p.id, image: null,
      rabiesExp: vaccines[p.id].rabies, coreExp: vaccines[p.id].core, bordetellaExp: vaccines[p.id].bordetella,
      source: "seed" as const, ocrText: null, uploadedAt: at(-20, "10:00"),
    })),
    // Older records, so the history shows how the shots were renewed over time.
    { id: "vr_bella_2", petId: "bella", image: null, rabiesExp: d(160), coreExp: d(-34), bordetellaExp: d(-200),
      source: "scan" as const, ocrText: null, uploadedAt: at(-380, "11:20") },
    { id: "vr_biscuit_2", petId: "biscuit", image: null, rabiesExp: d(15), coreExp: d(-150), bordetellaExp: d(-160),
      source: "scan" as const, ocrText: null, uploadedAt: at(-350, "09:40") },
    { id: "vr_biscuit_3", petId: "biscuit", image: null, rabiesExp: d(15), coreExp: d(210), bordetellaExp: d(21),
      source: "staff" as const, ocrText: null, uploadedAt: at(-150, "14:05") },
  ]));

  q.push(db.insert(schema.units).values([
    ...["Run 1", "Run 2", "Run 3", "Run 4", "Run 5", "Run 6", "Run 7"].map((label, i) => ({
      id: `run${i + 1}`, kind: "run" as const, label, sort: i,
    })),
    { id: "suite", kind: "suite", label: "Cat suite", sort: 7 },
    ...["A", "B", "C", "D"].map((l, i) => ({ id: `table${l}`, kind: "table" as const, label: `Table ${l}`, sort: 10 + i })),
  ]));

  // ── Bookings ─────────────────────────────────────────────────────────────
  const eventRows: schema.Event[] = [];
  const ev = (ref: string, kind: schema.EventKind, when: string, note: string | null = null) =>
    eventRows.push({ id: `e_${eventRows.length}`, ref, kind, note, at: when });

  const booking = (
    id: string, petId: string, service: Service, start: number, end: number, time: string,
    extra: Partial<schema.Booking> = {},
  ): schema.Booking => {
    const p = petRows.find((x) => x.id === petId)!;
    const { status, issues } = evaluateCompliance(vaccines[petId], p.species, service, d(end), T);
    const row: schema.Booking = {
      id, petId, service, startDate: d(start), endDate: d(end), dropoffTime: time, pickupTime: null,
      groomServices: [], notes: null,
      status: status === "clear" ? "confirmed" : status === "blocked" ? "locked" : "review",
      issues, unitId: null, groomStage: null, groomer: null, approvedBy: null,
      confirmedBy: null, confirmedAt: null, declineReason: null, cancelReason: null, cancelledAt: null, cancelledBy: null,
      arrivedAt: null, reminderSent: false, activity: null, activityAt: null,
      createdAt: at(Math.min(start, 0) - 6, "09:00"),
      ...extra,
    };
    if (row.status !== "requested" && row.status !== "locked" && row.status !== "review") {
      row.confirmedBy ??= ADMIN;
      row.confirmedAt ??= at(Math.min(start, 0) - 5, "11:30");
    }
    // Timeline history that matches the booking's current state.
    ev(id, "requested", row.createdAt);
    if (row.status === "locked") ev(id, "vaccines_hold", row.createdAt, issues.map((i) => i.vaccine).join(","));
    else if (row.status === "review") ev(id, "vaccines_review", row.createdAt);
    else ev(id, "vaccines_ok", row.createdAt);
    if (row.confirmedAt) ev(id, "confirmed", row.confirmedAt, row.confirmedBy);
    if (row.status === "cancelled") ev(id, "cancelled", row.cancelledAt ?? row.createdAt, row.cancelReason);
    return row;
  };
  const inHouse = (unitId: string, checkedIn: string, extra: Partial<schema.Booking> = {}) =>
    ({ status: "checked_in" as const, unitId, ...extra, _checkedIn: checkedIn });

  const rows = [
    booking("b_max", "max", "boarding", -2, 2, "10:00", inHouse("run1", at(-2, "10:05"), { activity: "Nap time", activityAt: minutesAgo(35) })),
    booking("b_biscuit", "biscuit", "boarding", -1, 3, "08:00", inHouse("run2", at(-1, "09:05"), {
      pickupTime: "16:00", activity: "Playtime in the yard", activityAt: minutesAgo(15),
    })),
    booking("b_rocky", "rocky", "boarding", -3, 1, "12:00", inHouse("run3", at(-3, "12:10"))),
    booking("b_daisy", "daisy", "boarding", 0, 4, "08:00", inHouse("run4", minutesAgo(400))),
    booking("b_milo", "milo", "daycare", 0, 0, "07:30", inHouse("run5", minutesAgo(420), { pickupTime: "17:00" })),
    booking("b_shadow", "shadow", "boarding", -4, 6, "10:00", inHouse("run6", at(-4, "10:15"), { activity: "On a walk", activityAt: minutesAgo(10) })),
    booking("b_mochi", "mochi", "boarding", -1, 5, "16:00", inHouse("suite", at(-1, "16:20"))),
    booking("b_coco", "coco", "grooming", 0, 0, "15:00", inHouse("tableA", minutesAgo(25), {
      groomStage: 0, groomer: "Anna", pickupTime: "17:15", groomServices: ["bath", "haircut", "nails", "ears", "teeth", "deshed"],
    })),
    booking("b_buddy", "buddy", "grooming", 0, 0, "14:00", inHouse("tableB", minutesAgo(80), {
      groomStage: 1, groomer: "Sam", pickupTime: "16:00", groomServices: ["bath", "nails"],
    })),
    booking("b_luna", "luna", "grooming", 0, 0, "13:00", inHouse("tableC", minutesAgo(150), {
      groomStage: 3, groomer: "Anna", pickupTime: "15:30", groomServices: ["bath", "haircut", "nails"],
    })),
    booking("b_pepper", "pepper", "grooming", 0, 0, "13:00", inHouse("tableD", minutesAgo(110), {
      groomStage: 2, groomer: "Jo", pickupTime: "17:45", groomServices: ["bath", "haircut", "ears"],
    })),
    booking("b_bear", "bear", "daycare", 0, 0, "09:00", { pickupTime: "18:00" }),
    // Waiting on the vaccine check.
    booking("b_bella", "bella", "boarding", 4, 7, "10:00", { pickupTime: "16:00" }),
    booking("b_teddy", "teddy", "daycare", 3, 3, "08:00", { pickupTime: "17:00" }),
    booking("b_rocky_groom", "rocky", "grooming", openDay("grooming", 16), openDay("grooming", 16), "11:00", {
      pickupTime: "13:00", groomServices: ["bath", "nails"],
    }),
    // New requests waiting for the admin to confirm.
    booking("b_req_biscuit", "biscuit", "grooming", openDay("grooming", 4), openDay("grooming", 4), "09:00", {
      status: "requested", pickupTime: "11:00", groomServices: ["bath", "nails", "ears"],
      notes: "He's a bit nervous of the dryer — towel dry is fine.", createdAt: minutesAgo(35),
    }),
    booking("b_req_bear", "bear", "boarding", 5, 8, "10:00", {
      status: "requested", pickupTime: "16:00", notes: "Bringing his own bed.", createdAt: minutesAgo(70),
    }),
    // Other families, so the calendar shows full days and booked times.
    booking("b_luna_stay", "luna", "boarding", 2, 3, "12:00", { pickupTime: "18:00" }),
    booking("b_pepper_stay", "pepper", "boarding", 1, 3, "16:00", { pickupTime: "12:00" }),
    booking("b_coco_stay", "coco", "boarding", 2, 3, "08:00", { pickupTime: "10:00" }),
    booking("b_buddy_groom", "buddy", "grooming", openDay("grooming", 1), openDay("grooming", 1), "10:00", {
      pickupTime: "12:00", groomServices: ["bath", "haircut"],
    }),
    booking("b_max_groom", "max", "grooming", openDay("grooming", 1), openDay("grooming", 1), "10:00", {
      pickupTime: "12:00", groomServices: ["bath", "deshed"],
    }),
    booking("b_teddy_groom", "teddy", "grooming", openDay("grooming", 1), openDay("grooming", 1), "14:00", {
      pickupTime: "16:00", groomServices: ["bath", "nails"],
    }),
    // Cancelled by an owner, so the cancellations list has an example.
    booking("b_milo_cancel", "milo", "daycare", openDay("daycare", 2), openDay("daycare", 2), "08:00", {
      status: "cancelled", pickupTime: "17:00", cancelReason: "Change of plans", cancelledBy: "Oliver Hughes",
      cancelledAt: minutesAgo(240),
    }),
    booking("b_biscuit_past", "biscuit", "grooming", -12, -12, "10:00", {
      status: "completed", issues: [], pickupTime: "12:00", groomServices: ["bath", "nails"],
    }),
    // Emily's earlier visits, for the History tab.
    ...([
      ["b_hist_1", "bella", "boarding", -64, -60, "09:00", "15:00", "run2"],
      ["b_hist_2", "biscuit", "boarding", -64, -60, "09:00", "15:00", "run3"],
      ["b_hist_3", "bella", "grooming", -41, -41, "11:00", "13:00", "tableB"],
      ["b_hist_4", "bella", "daycare", -27, -27, "08:00", "17:30", "run1"],
      ["b_hist_5", "biscuit", "daycare", -27, -27, "08:00", "17:30", "run4"],
      ["b_hist_6", "bella", "daycare", -19, -19, "08:30", "17:00", "run5"],
    ] as const).map(([id, petId, service, start, end, drop, pick, unitId]) =>
      booking(id, petId, service, start, end, drop, {
        status: "completed", issues: [], pickupTime: pick, unitId,
        groomServices: service === "grooming" ? ["bath", "haircut", "nails"] : [],
        createdAt: at(start - 7, "19:10"), confirmedAt: at(start - 6, "09:30"),
      }),
    ),
    booking("b_hist_cancel", "biscuit", "daycare", -33, -33, "08:00", {
      status: "cancelled", pickupTime: "17:00", cancelReason: "My pet is unwell", cancelledBy: "Emily Carter",
      cancelledAt: at(-34, "20:15"), createdAt: at(-40, "10:00"), confirmedAt: at(-39, "09:00"),
    }),
  ];

  // Check-in, grooming progress and finish events for stays already under way.
  for (const r of rows as (schema.Booking & { _checkedIn?: string })[]) {
    if (r._checkedIn) {
      ev(r.id, "checked_in", r._checkedIn, r.unitId);
      for (let s = 1; s <= (r.groomStage ?? 0); s++) ev(r.id, `stage_${s}` as schema.EventKind, minutesAgo(70 - s * 20));
      delete r._checkedIn;
    }
    if (r.status === "completed") {
      ev(r.id, "checked_in", `${r.startDate}T${r.dropoffTime}`);
      ev(r.id, "completed", `${r.endDate}T${r.pickupTime}`);
    }
  }
  q.push(db.insert(schema.bookings).values(rows));

  // ── Vets ─────────────────────────────────────────────────────────────────
  // Fictional demo vets (initials avatars, no photos of real people).
  const vetRows: Omit<schema.Vet, "active">[] = [
    {
      id: "vet_leo", name: "Dr. Thomas Hale", title: "DVM · Lead Veterinarian", specialty: "General practice & preventive care",
      experienceYears: 12, education: "Doctor of Veterinary Medicine (DVM)", languages: ["English", "French"],
      focus: ["Wellness exams", "Vaccinations", "Puppy & kitten care", "Nutrition"],
      bio: "Thomas has led our clinic since it opened. He loves getting to know pets from their first puppy shots to their golden years, and believes a calm, treat-filled exam is the best exam.",
      workDays: [1, 2, 3, 4, 5], color: "mint", sort: 0,
    },
    {
      id: "vet_aisha", name: "Dr. Sarah Mitchell", title: "DVM · Veterinary Dermatology", specialty: "Skin, ears & allergies",
      experienceYears: 8, education: "DVM, with advanced training in veterinary dermatology", languages: ["English", "Spanish"],
      focus: ["Itchy skin", "Ear infections", "Food & seasonal allergies", "Coat problems"],
      bio: "Sarah helps itchy, scratchy pets feel comfortable in their own skin. She builds simple, step-by-step allergy plans that fit busy family routines.",
      workDays: [1, 3, 4, 6], color: "coral", sort: 1,
    },
    {
      id: "vet_mei", name: "Dr. Rachel Cooper", title: "DVM · Internal Medicine", specialty: "Heart health, cats & senior pets",
      experienceYears: 15, education: "DVM, residency in small-animal internal medicine", languages: ["English", "German"],
      focus: ["Heart murmurs", "Coughing & breathing", "Senior check-ups", "Cat-friendly visits"],
      bio: "Rachel is our go-to for complex cases and older pets. Her quiet, unhurried style makes her a favourite with nervous cats.",
      workDays: [2, 4, 5, 6], color: "lilac", sort: 2,
    },
    {
      id: "vet_carlos", name: "Dr. Daniel Foster", title: "DVM · Surgery & Orthopedics", specialty: "Injuries, limping & surgery",
      experienceYears: 10, education: "DVM, surgical internship in orthopedics", languages: ["English"],
      focus: ["Limping & joint pain", "Wounds & injuries", "Dental care", "Post-surgery check-ups"],
      bio: "Daniel fixes what's sore. From a limp after a zoomies session to a planned surgery, he explains every option clearly before anything happens.",
      workDays: [1, 2, 3, 4], color: "sky", sort: 3,
    },
  ];
  q.push(db.insert(schema.vets).values(vetRows.map((v) => ({ ...v, active: true }))));

  /** Day offset of the vet's next working day, starting `from` days out. */
  const vetDay = (vetId: string, from: number) => {
    const days = vetRows.find((v) => v.id === vetId)!.workDays;
    for (let n = from; n < from + 7; n++) if (days.includes(weekday(n))) return n;
    return from;
  };
  const vetName = (vetId: string) => vetRows.find((v) => v.id === vetId)!.name;

  const visit = (
    id: string, petId: string, vetId: string, reason: schema.VetReason, day: number, time: string,
    extra: Partial<schema.VetVisit> = {},
  ): schema.VetVisit => {
    const row: schema.VetVisit = {
      id, petId, vetId, reason, date: d(day), time, symptoms: null, status: "booked", requestedBy: "parent",
      createdAt: at(Math.min(day, 0) - 3, "10:00"), confirmedBy: ADMIN, confirmedAt: at(Math.min(day, 0) - 2, "09:15"),
      declineReason: null, cancelReason: null, cancelledAt: null, reminderSent: false, startedAt: null, vetName: null, weightKg: null, temperatureC: null, healthStatus: null, diagnosis: null,
      treatment: null, medication: null, followUpDate: null, completedAt: null,
      ...extra,
    };
    if (row.status === "requested") {
      row.confirmedBy = null;
      row.confirmedAt = null;
    }
    ev(id, "requested", row.createdAt);
    if (row.confirmedAt) ev(id, "confirmed", row.confirmedAt, row.confirmedBy);
    if (row.completedAt) ev(id, "completed", row.completedAt);
    return row;
  };
  const done = (vetId: string, day: number, report: Partial<schema.VetVisit>) => ({
    status: "completed" as const, vetName: vetName(vetId), completedAt: at(day, "11:20"), ...report,
  });

  const leoNext = vetDay("vet_leo", 1);
  const visitRows: schema.VetVisit[] = [
    visit("vv_biscuit", "biscuit", "vet_aisha", "checkup", -12, "11:00", done("vet_aisha", -12, {
      weightKg: "8.2", temperatureC: "38.5", healthStatus: "healthy",
      diagnosis: "Healthy pug. Skin allergy well controlled.",
      treatment: "Nails trimmed, ears cleaned.", medication: "Continue Apoquel, 1 tablet daily",
    })),
    visit("vv_bella_vax", "bella", "vet_leo", "vaccination", -205, "10:30", done("vet_leo", -205, {
      weightKg: "11.4", temperatureC: "38.4", healthStatus: "healthy",
      diagnosis: "Rabies booster given. Bright and healthy.", treatment: "Rabies vaccine (1 year).",
    })),
    visit("vv_max", "max", "vet_leo", "vaccination", -30, "09:30", done("vet_leo", -30, {
      weightKg: "31.0", temperatureC: "38.6", healthStatus: "healthy",
      diagnosis: "Annual vaccines given. In great shape.", treatment: "DHPP and Bordetella boosters.",
    })),
    // Today, for whichever doctors are working.
    visit("vv_daisy", "daisy", "vet_leo", "follow_up", 0, "11:00", {
      requestedBy: "Anna", symptoms: "Ear infection follow-up — check the drops are working. Still shaking her head a little.",
    }),
    visit("vv_teddy", "teddy", "vet_leo", "sick", 0, "14:30", { symptoms: "Coughing for 3 days and a bit tired after walks." }),
    visit("vv_milo", "milo", "vet_leo", "vaccination", 0, "16:30", { symptoms: "Due for rabies booster." }),
    // Requests waiting for the admin.
    visit("vv_bella", "bella", "vet_leo", "checkup", leoNext, "10:00", {
      status: "requested", symptoms: "Annual wellness check.", createdAt: minutesAgo(50),
    }),
    visit("vv_req_coco", "coco", "vet_aisha", "sick", vetDay("vet_aisha", 1), "13:30", {
      status: "requested", symptoms: "Red, itchy paws — licking them a lot.", createdAt: minutesAgo(15),
    }),
    // Other families, so each doctor's calendar shows booked times.
    visit("vv_shadow", "shadow", "vet_mei", "checkup", vetDay("vet_mei", 1), "11:00"),
    visit("vv_mochi", "mochi", "vet_mei", "checkup", vetDay("vet_mei", 1), "13:30"),
    visit("vv_rocky", "rocky", "vet_carlos", "follow_up", vetDay("vet_carlos", 1), "10:00"),
    visit("vv_pepper", "pepper", "vet_aisha", "checkup", vetDay("vet_aisha", 1), "10:00"),
    visit("vv_luna", "luna", "vet_leo", "checkup", leoNext, "09:00"),
    ...pastCheckups(),
  ];

  /**
   * Earlier finished checkups for every doctor, so their Earnings page has
   * real history: two months ago (already paid out), last month (owed, so the
   * automatic month-end payout credits it on first load) and this month.
   */
  function pastCheckups(): schema.VetVisit[] {
    const dom = Number(T.slice(8, 10));
    const plan: [string, string, string, schema.VetReason, string, schema.HealthStatus][] = [
      ["vet_leo", "max", "Annual wellness exam. Healthy weight, great coat.", "checkup", "31.2", "healthy"],
      ["vet_leo", "milo", "Rabies booster given.", "vaccination", "29.8", "healthy"],
      ["vet_leo", "luna", "Mild tummy upset — bland diet for 3 days.", "sick", "9.4", "monitor"],
      ["vet_aisha", "biscuit", "Skin flare settled, continue medicated shampoo weekly.", "follow_up", "8.3", "monitor"],
      ["vet_aisha", "coco", "Itchy paws from grass allergy; antihistamine started.", "sick", "6.1", "treatment"],
      ["vet_aisha", "pepper", "Ears clean, no infection.", "checkup", "7.5", "healthy"],
      ["vet_mei", "mochi", "Senior cat panel normal. Teeth good.", "checkup", "4.2", "healthy"],
      ["vet_mei", "teddy", "Murmur grade 2, stable. Recheck in 6 months.", "follow_up", "8.9", "monitor"],
      ["vet_mei", "shadow", "Healthy husky, lots of energy!", "checkup", "23.5", "healthy"],
      ["vet_carlos", "rocky", "Slight limp resolved after rest.", "follow_up", "7.1", "healthy"],
      ["vet_carlos", "buddy", "Small cut on paw cleaned and bandaged.", "sick", "13.4", "monitor"],
      ["vet_carlos", "bear", "Dental check — mild tartar, cleaning advised.", "checkup", "27.0", "healthy"],
    ];
    // Day offsets that fall two months ago, last month and earlier this month.
    const twoAgo = [-dom - 34, -dom - 40, -dom - 47];
    const lastMonth = [-dom - 4, -dom - 11, -dom - 19];
    const thisMonth = dom > 3 ? [-1, -2] : [];
    const rowsOut: schema.VetVisit[] = [];
    plan.forEach(([vetId, petId, diagnosis, reason, weightKg, healthStatus], i) => {
      const k = i % 3;
      const days = [twoAgo[k], lastMonth[k], ...(k < thisMonth.length ? [thisMonth[k]] : [])];
      days.forEach((day, j) => {
        const time = ["09:30", "11:00", "14:30"][j];
        rowsOut.push(
          visit(`vv_h_${vetId.slice(4)}_${petId}_${j}`, petId, vetId, reason, day, time, {
            ...done(vetId, day, { weightKg, temperatureC: "38.5", healthStatus, diagnosis }),
            completedAt: at(day, `${String(Number(time.slice(0, 2)) + 1).padStart(2, "0")}:00`),
          }),
        );
      });
    });
    return rowsOut;
  }
  q.push(db.insert(schema.vetVisits).values(visitRows));

  q.push(db.insert(schema.events).values(eventRows));

  // ── Prices, offers & invoices ────────────────────────────────────────────
  q.push(db.insert(schema.prices).values(DEFAULT_PRICES.map((p, i) => ({ ...p, sort: i, updatedAt: null, updatedBy: null }))));
  q.push(db.insert(schema.settings).values({ key: "online_discount_pct", value: String(DEFAULT_ONLINE_DISCOUNT), updatedAt: null, updatedBy: null }));
  const priceMap = toPriceMap(DEFAULT_PRICES);
  const ownerOf = (petId: string) => petRows.find((p) => p.id === petId)!.ownerId;
  // Paid online ahead of time, to show prepaid bookings (and a refund).
  const PREPAID = new Set(["b_biscuit", "b_req_bear", "vv_req_coco", "b_milo_cancel", "b_hist_3"]);
  // Finished but not paid yet: shows up as overdue.
  // (One of Dr. Thomas's checkups this month is unpaid, so he sees "waiting for the owner to pay".)
  const OVERDUE = new Set(["b_hist_6", "vv_max", "vv_h_leo_max_2"]);
  const invoiceRows: schema.Invoice[] = [];
  const addInvoice = (
    refKind: "booking" | "vet", refId: string, petId: string, service: schema.Invoice["service"], serviceDate: string,
    baseItems: InvoiceItem[], status: string, createdAt: string, finishedAt: string | null,
  ) => {
    const closed = status === "cancelled" || status === "declined";
    const prepaid = PREPAID.has(refId);
    const paidAtDesk = !prepaid && status === "completed" && !OVERDUE.has(refId);
    const items = prepaid ? withOnlineDiscount(baseItems, DEFAULT_ONLINE_DISCOUNT) : baseItems;
    const n = invoiceRows.length;
    const paidAt = prepaid ? addMinutes(createdAt, 4) : paidAtDesk ? finishedAt : null;
    invoiceRows.push({
      id: `inv_${refId}`, number: 0, petId, ownerId: ownerOf(petId), refKind, refId, service, serviceDate, items,
      totalCents: sumItems(items),
      status: closed ? (prepaid ? "refunded" : "void") : prepaid || paidAtDesk ? "paid" : "unpaid",
      createdAt, paidAt,
      paidMethod: prepaid ? "online" : paidAtDesk ? (n % 3 === 0 ? "cash" : "card") : null,
      paidBy: prepaid ? "Paid online by owner" : paidAtDesk ? (n % 2 ? "Anna Reed" : ADMIN) : null,
      cardLast4: prepaid ? "4242" : null,
      txnRef: prepaid ? `PAY-${refId.replace(/\W/g, "").slice(-8).toUpperCase()}` : paidAtDesk ? `DESK-${String(4100 + n)}` : null,
      voidReason: closed ? (prepaid ? "Cancelled by owner — refunded" : "Cancelled by owner") : null,
      refundedAt: closed && prepaid ? addMinutes(createdAt, 300) : null,
      payoutId: null,
    });
  };
  for (const b of rows) {
    if (b.status === "declined") continue;
    addInvoice("booking", b.id, b.petId, b.service, b.startDate, quoteBooking(b, priceMap), b.status, b.createdAt, `${b.endDate}T${b.pickupTime ?? "17:00"}`);
  }
  for (const v of visitRows) {
    addInvoice("vet", v.id, v.petId, "vet", v.date, quoteVet(v.reason, priceMap, vetName(v.vetId!)), v.status, v.createdAt, v.completedAt);
  }
  invoiceRows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((inv, i) => (inv.number = 1001 + i));

  // Doctors keep their share after the clinic's platform fee. Everything older
  // than last month is already on a (read) statement; last month's paid visits
  // are still owed, so the automatic month-end payout credits them — and each
  // doctor sees the "payout credited" notice — on the first page load.
  q.push(db.insert(schema.settings).values({ key: "doctor_fee_pct", value: String(DEFAULT_DOCTOR_FEE), updatedAt: null, updatedBy: null }));
  const lastMonthStart = `${addDays(`${T.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
  for (const v of vetRows) {
    const mine = invoiceRows.filter((inv) => {
      const visitRow = visitRows.find((x) => x.id === inv.refId);
      return inv.refKind === "vet" && inv.status === "paid" && visitRow?.vetId === v.id && visitRow.status === "completed" && inv.serviceDate < lastMonthStart;
    });
    // One statement per month, like a real monthly payout.
    for (const period of [...new Set(mine.map((inv) => inv.serviceDate.slice(0, 7)))].sort()) {
      const monthInv = mine.filter((inv) => inv.serviceDate.startsWith(period));
      const lines = monthInv.map((inv) => ({
        invoiceId: inv.id, number: inv.number, petName: petRows.find((p) => p.id === inv.petId)!.name, date: inv.serviceDate,
        grossCents: inv.totalCents, ...doctorSplit(inv.totalCents, DEFAULT_DOCTOR_FEE),
      }));
      const id = `po_${v.id.slice(4)}_${period.replace("-", "")}`;
      monthInv.forEach((inv) => (inv.payoutId = id));
      q.push(db.insert(schema.payouts).values({
        id, vetId: v.id, period, lines,
        grossCents: lines.reduce((s, l) => s + l.grossCents, 0),
        feeCents: lines.reduce((s, l) => s + l.feeCents, 0),
        netCents: lines.reduce((s, l) => s + l.netCents, 0),
        feePercent: DEFAULT_DOCTOR_FEE,
        createdAt: `${addDays(`${period}-01`, 32).slice(0, 7)}-01T06:00`,
        createdBy: "Automatic month-end payout",
        seenByDoctor: true,
      }));
    }
  }
  q.push(db.insert(schema.invoices).values(invoiceRows));

  // ── Daily reports ────────────────────────────────────────────────────────
  q.push(db.insert(schema.dailyReports).values([
    {
      id: "dr_biscuit_1", bookingId: "b_biscuit", petId: "biscuit", date: d(-1), meals: "Ate everything", potty: "Normal",
      mood: "Happy", activities: ["Morning walk", "Group play", "Cuddles", "Afternoon nap"],
      notes: "Settled in quickly and made friends with Max. Snored through movie night!", photo: "/pets/biscuit.jpg",
      staffName: "Anna", createdAt: at(-1, "18:30"),
    },
  ]));

  // ── Messages ─────────────────────────────────────────────────────────────
  // Anything from before today counts as already read, so the badge shows what's new.
  const seen = (rows: (typeof schema.messages.$inferInsert)[]) =>
    rows.map((m) => ({ ...m, seenByOwner: m.author === "parent" || !m.createdAt.startsWith(T), seenByStaff: true }));
  q.push(db.insert(schema.messages).values(seen([
    {
      id: "m_report", petId: "biscuit", author: "system" as const, authorName: null, title: "Daily report: Biscuit", mood: null, tags: [],
      photo: null, body: "Biscuit's report card for yesterday is ready: ate everything, happy, and made a new friend.",
      linkHref: "/my/pets/biscuit/live", linkLabel: "See the report", createdAt: at(-1, "18:31"),
    },
    {
      id: "m0", petId: "biscuit", author: "system", authorName: null, title: "Vet report: Healthy", mood: null, tags: [], photo: null, channel: "vet" as const,
      linkHref: "/api/vet-report/vv_biscuit", linkLabel: "Download PDF report",
      body: "Dr. Sarah Mitchell checked Biscuit: healthy, 8.2 kg, skin allergy well controlled. Keep giving Apoquel daily.",
      createdAt: at(-12, "11:25"),
    },
    {
      id: "m1", petId: "biscuit", author: "system", authorName: null, title: null, mood: null, tags: [], photo: null,
      body: "Biscuit is checked in to Run 2 and already making friends. We'll send photos soon!",
      createdAt: at(-1, "09:05"),
    },
    {
      id: "m2", petId: "biscuit", author: "staff", authorName: "Anna", title: "Pawsitive Update for Biscuit!",
      body: "Biscuit ate every bite of dinner, had a great walk and snored through movie night. Such a good boy!",
      photo: "/pets/biscuit.jpg", mood: "Happy", tags: ["Great walk", "Ate all dinner"],
      createdAt: at(-1, "19:40"),
    },
    {
      id: "m3", petId: "biscuit", author: "parent", authorName: "Emily", title: null, mood: null, tags: [], photo: null,
      body: "Love this! Thank you for taking such good care of him", createdAt: at(-1, "19:52"),
    },
    {
      id: "m4", petId: "bella", author: "system", authorName: null, title: "Booking on hold", mood: null, tags: [], photo: null,
      body: "Bella's stay needs one thing: her DHPP shot has expired. Upload her new vet record and we'll unlock the booking right away.",
      createdAt: minutesAgo(90),
    },
    {
      id: "m5", petId: "biscuit", author: "system", authorName: null, title: "Request received", mood: null, tags: [], photo: null,
      body: "Thanks! We've received Biscuit's grooming request and will confirm it shortly.",
      createdAt: minutesAgo(35),
    },
    {
      id: "m6", petId: "luna", author: "system", authorName: null, title: "Luna is ready!", mood: null, tags: [], photo: "/pets/luna.jpg",
      body: "Luna is all groomed and ready for pickup at 3:30 PM.", createdAt: minutesAgo(20),
    },
  ])));

  // One atomic batch: if two server processes reset at once, the database runs
  // them one after the other instead of interleaving deletes and inserts.
  await db.batch(q as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
}
