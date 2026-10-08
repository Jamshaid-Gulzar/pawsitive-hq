// Turns a booking's (or vet visit's) status and event history into the steps
// the customer sees on its live timeline.

import type { BookingStatus, EventKind, VetStatus } from "@/db/schema";
import { daysBetween, formatShortDate, formatTime, todayISO } from "./dates";
import type { Service } from "./vaccines";

export type StepState = "done" | "current" | "upcoming" | "blocked" | "declined";

export interface TimelineStep {
  key: string;
  title: string;
  detail?: string;
  at?: string;
  state: StepState;
}

type Ev = { kind: EventKind; note: string | null; at: string };

const find = (events: Ev[], kind: EventKind) => events.filter((e) => e.kind === kind).at(-1);

/** Marks the first unfinished step as current; the rest wait. */
function settle(steps: Omit<TimelineStep, "state">[], doneKeys: Set<string>, stopped: TimelineStep | null): TimelineStep[] {
  const out: TimelineStep[] = [];
  let currentGiven = false;
  for (const s of steps) {
    if (doneKeys.has(s.key)) out.push({ ...s, state: "done" });
    else if (stopped && stopped.key === s.key) {
      out.push(stopped);
      currentGiven = true;
    } else if (!currentGiven && !stopped) {
      out.push({ ...s, state: "current" });
      currentGiven = true;
    } else out.push({ ...s, state: "upcoming" });
  }
  return out;
}

export function bookingTimeline(
  b: {
    service: Service;
    status: BookingStatus;
    startDate: string;
    endDate: string;
    dropoffTime: string | null;
    pickupTime: string | null;
    unitLabel: string | null;
    declineReason: string | null;
  },
  events: Ev[],
  photoCount = 0,
): TimelineStep[] {
  const today = todayISO();
  const ev = (k: EventKind) => find(events, k);
  const done = new Set<string>();
  const steps: Omit<TimelineStep, "state">[] = [];
  const add = (key: string, title: string, detail: string | undefined, kind: EventKind | null) => {
    const e = kind ? ev(kind) : undefined;
    steps.push({ key, title, detail, at: e?.at });
    if (e) done.add(key);
  };

  add("requested", "Request sent", undefined, "requested");

  const vaccinesOk = ev("vaccines_ok");
  steps.push({
    key: "vaccines",
    title: vaccinesOk ? "Vaccines approved" : "Vaccine check",
    detail: vaccinesOk?.note ?? undefined,
    at: vaccinesOk?.at,
  });
  if (vaccinesOk) done.add("vaccines");

  const confirmed = ev("confirmed");
  steps.push({
    key: "confirmed",
    title: confirmed ? "Booking confirmed" : "Waiting for confirmation",
    detail: confirmed ? `By ${confirmed.note ?? "our team"}` : "Our team usually confirms within a few hours.",
    at: confirmed?.at,
  });
  if (confirmed) done.add("confirmed");

  const checkedIn = ev("checked_in");
  const arrived = ev("arrived");
  steps.push({
    key: "checked_in",
    title: checkedIn ? `Checked in${b.unitLabel ? ` · ${b.unitLabel}` : ""}` : arrived ? "Arrived — getting a spot ready" : "Check-in",
    detail: checkedIn
      ? undefined
      : arrived
        ? "A team member is checking you in now."
        : `${b.startDate === today ? "Today" : formatShortDate(b.startDate)}${b.dropoffTime ? ` at ${formatTime(b.dropoffTime)}` : ""}`,
    at: checkedIn?.at ?? arrived?.at,
  });
  if (checkedIn) done.add("checked_in");

  if (b.service === "grooming") {
    add("bathing", "Bathing", undefined, "stage_1");
    add("drying", "Drying", undefined, "stage_2");
    add("styling", "Styling", undefined, "stage_3");
    add("ready", "Ready for pickup", b.pickupTime ? `Pickup around ${formatTime(b.pickupTime)}` : undefined, "completed");
    add("home", "Picked up — looking fabulous!", undefined, "completed");
  } else {
    const nights = Math.max(1, daysBetween(b.startDate, b.endDate));
    const night = Math.min(nights, Math.max(1, daysBetween(b.startDate, today) + 1));
    const stayDetail =
      b.service === "boarding"
        ? `${checkedIn && b.status === "checked_in" ? `Night ${night} of ${nights}` : `${nights} night${nights === 1 ? "" : "s"}`}${photoCount ? ` · ${photoCount} photo update${photoCount === 1 ? "" : "s"}` : ""}`
        : photoCount
          ? `${photoCount} photo update${photoCount === 1 ? "" : "s"}`
          : "Playtime, walks and naps";
    add("stay", b.service === "boarding" ? "Staying with us" : "Daycare fun", stayDetail, "completed");
    add(
      "home",
      b.service === "boarding" ? "Checked out — home time" : "Picked up",
      b.pickupTime ? `${formatShortDate(b.endDate)} at ${formatTime(b.pickupTime)}` : undefined,
      "completed",
    );
  }

  let stopped: TimelineStep | null = null;
  if (b.status === "locked") stopped = { key: "vaccines", title: "Vaccine needs updating", detail: "Upload a current vet record to continue.", state: "blocked" };
  else if (b.status === "review") stopped = { key: "vaccines", title: "Checking your vaccine record", detail: "A team member is double-checking a date.", state: "current" };
  else if (b.status === "declined") stopped = { key: "confirmed", title: "Booking declined", detail: b.declineReason ?? undefined, state: "declined", at: ev("declined")?.at };
  else if (b.status === "cancelled") stopped = { key: steps.find((s) => !done.has(s.key))?.key ?? "home", title: "Cancelled", state: "declined", at: ev("cancelled")?.at };

  // The first unfinished step is the one in progress (e.g. the grooming stage after the last one done).
  return settle(steps, done, stopped);
}

export function vetTimeline(
  v: { status: VetStatus; date: string; time: string; declineReason: string | null },
  doctor: string,
  events: Ev[],
): TimelineStep[] {
  const ev = (k: EventKind) => find(events, k);
  const today = todayISO();
  const done = new Set<string>();
  const requested = ev("requested");
  const confirmed = ev("confirmed");
  const completed = ev("completed");
  if (requested) done.add("requested");
  if (confirmed) done.add("confirmed");
  if (completed) {
    done.add("visit");
    done.add("report");
  }
  const steps: Omit<TimelineStep, "state">[] = [
    { key: "requested", title: "Request sent", at: requested?.at },
    {
      key: "confirmed",
      title: confirmed ? "Appointment confirmed" : "Waiting for confirmation",
      detail: confirmed ? `By ${confirmed.note ?? "our team"}` : "Our front desk confirms within a few hours.",
      at: confirmed?.at,
    },
    {
      key: "visit",
      title: ev("started") && !completed ? `Checkup in progress with ${doctor}` : `Checkup with ${doctor}`,
      detail: `${v.date === today ? "Today" : formatShortDate(v.date)} at ${formatTime(v.time)}`,
      at: ev("started")?.at,
    },
    { key: "report", title: "Vet report ready", at: completed?.at },
  ];
  let stopped: TimelineStep | null = null;
  if (v.status === "declined") stopped = { key: "confirmed", title: "Appointment declined", detail: v.declineReason ?? undefined, state: "declined", at: ev("declined")?.at };
  else if (v.status === "cancelled") stopped = { key: done.has("confirmed") ? "visit" : "confirmed", title: "Cancelled", state: "declined", at: ev("cancelled")?.at };
  return settle(steps, done, stopped);
}
