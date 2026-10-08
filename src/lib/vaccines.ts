// Reads vaccine expiry dates out of OCR text from a vet record, and decides
// whether a booking can go ahead. Pure functions only, so they run the same in
// the browser (right after OCR) and on the server (when the booking is saved).

import { isoFromParts, todayISO } from "./dates";

export type Species = "dog" | "cat";
export type Service = "boarding" | "daycare" | "grooming";

/** "core" is DHPP for dogs and FVRCP for cats. */
export type VaccineKey = "rabies" | "core" | "bordetella";

export type VaccineDates = Record<VaccineKey, string | null>;

export type Confidence = "high" | "medium";

export interface ParsedVaccine {
  date: string | null;
  confidence: Confidence | null;
  line: string | null;
}

export type ParsedRecord = Record<VaccineKey, ParsedVaccine>;

const KEYWORDS: Record<VaccineKey, RegExp> = {
  rabies: /\brab(?:ies|v)\b/i,
  core: /\b(?:dhl?ppi?v?|da2ppv?|dappv?|distemper|fvrcp|feline\s+distemper)\b/i,
  bordetella: /\b(?:bordetel+a|bordatel+a|kennel\s+cough)\b/i,
};

const EXPIRY_HINT = /\b(?:exp|expires?|expiration|due|valid|until|next|thru|through)\b/i;

const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

const DATE_PATTERNS: { re: RegExp; toIso: (m: RegExpExecArray) => string | null }[] = [
  // 2027-03-14
  { re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, toIso: (m) => isoFromParts(+m[1], +m[2], +m[3]) },
  // 03/14/2027 or 3-14-27 (US month-first)
  { re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g, toIso: (m) => isoFromParts(fullYear(m[3]), +m[1], +m[2]) },
  // Mar 14, 2027
  {
    re: new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
    toIso: (m) => isoFromParts(+m[3], MONTH_INDEX[m[1].toLowerCase()], +m[2]),
  },
  // 14 Mar 2027
  {
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH},?\\s+(\\d{4})\\b`, "gi"),
    toIso: (m) => isoFromParts(+m[3], MONTH_INDEX[m[2].toLowerCase()], +m[1]),
  },
];

function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}

/** Fix the digit look-alikes OCR commonly produces inside numbers (O→0, l→1). */
export function cleanOcrText(text: string): string {
  return text
    .replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, "0")
    .replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, "1");
}

export function findDates(line: string): string[] {
  const found: { index: number; iso: string }[] = [];
  for (const { re, toIso } of DATE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const iso = toIso(m);
      if (iso && !found.some((f) => f.index === m!.index)) found.push({ index: m.index, iso });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.iso);
}

const latest = (dates: string[]) => dates.reduce((a, b) => (a > b ? a : b));

/**
 * Finds the expiry date for each vaccine. A vet record usually lists the date
 * given and the date due on the same line, so the latest date near the
 * vaccine's name is taken as its expiry.
 */
export function parseVaccineRecord(rawText: string): ParsedRecord {
  const lines = cleanOcrText(rawText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result = {} as ParsedRecord;
  for (const key of Object.keys(KEYWORDS) as VaccineKey[]) {
    let best: ParsedVaccine = { date: null, confidence: null, line: null };
    lines.forEach((line, i) => {
      if (!KEYWORDS[key].test(line)) return;
      let dates = findDates(line);
      let confidence: Confidence = dates.length >= 2 || EXPIRY_HINT.test(line) ? "high" : "medium";
      if (dates.length === 0 && lines[i + 1] && !Object.values(KEYWORDS).some((k) => k.test(lines[i + 1]))) {
        dates = findDates(lines[i + 1]);
        confidence = "medium";
      }
      if (dates.length === 0) return;
      const date = latest(dates);
      if (!best.date || date > best.date) best = { date, confidence, line };
    });
    result[key] = best;
  }
  return result;
}

export function vaccineLabel(key: VaccineKey, species: Species): string {
  if (key === "core") return species === "cat" ? "FVRCP" : "DHPP";
  return key === "rabies" ? "Rabies" : "Bordetella";
}

export function requiredVaccines(species: Species, service: Service): VaccineKey[] {
  const keys: VaccineKey[] = ["rabies", "core"];
  if (species === "dog" && service !== "grooming") keys.push("bordetella");
  return keys;
}

/** How soon a vaccine needs renewing. "ok" means more than 30 days left. */
export type DueStage = "ok" | "due_30" | "due_7" | "expired" | "missing";

export interface VaccineDue {
  key: VaccineKey;
  label: string;
  date: string | null;
  daysLeft: number | null;
  stage: DueStage;
}

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Every vaccine the pet needs for any service, with its due date and how urgent it is. Most urgent first. */
export function vaccineSchedule(dates: VaccineDates, species: Species, today: string = todayISO()): VaccineDue[] {
  const rank: Record<DueStage, number> = { expired: 0, missing: 1, due_7: 2, due_30: 3, ok: 4 };
  return requiredVaccines(species, "boarding")
    .map((key): VaccineDue => {
      const date = dates[key];
      if (!date) return { key, label: vaccineLabel(key, species), date: null, daysLeft: null, stage: "missing" };
      const daysLeft = dayDiff(today, date);
      const stage: DueStage = daysLeft < 0 ? "expired" : daysLeft <= 7 ? "due_7" : daysLeft <= 30 ? "due_30" : "ok";
      return { key, label: vaccineLabel(key, species), date, daysLeft, stage };
    })
    .sort((a, b) => rank[a.stage] - rank[b.stage] || (a.date ?? "").localeCompare(b.date ?? ""));
}

/** Short, human wording for a vaccine's due status. */
export function dueText(v: VaccineDue): string {
  switch (v.stage) {
    case "missing":
      return "No date on file";
    case "expired":
      return `Expired ${-v.daysLeft!} day${v.daysLeft === -1 ? "" : "s"} ago`;
    case "ok":
    case "due_30":
    case "due_7":
      return v.daysLeft === 0 ? "Due today" : `Due in ${v.daysLeft} day${v.daysLeft === 1 ? "" : "s"}`;
  }
}

export const DUE_TONE: Record<DueStage, string> = {
  ok: "bg-mint-soft text-mint-ink",
  due_30: "bg-sun-soft text-sun-ink",
  due_7: "bg-amber-soft text-amber-ink",
  expired: "bg-rose-soft text-rose-ink",
  missing: "bg-sand text-muted",
};

export type IssueKind = "missing" | "expired" | "expires_during_stay";

export interface ComplianceIssue {
  vaccine: VaccineKey;
  kind: IssueKind;
  date: string | null;
}

export type ComplianceStatus = "clear" | "blocked" | "review";

export interface ComplianceResult {
  status: ComplianceStatus;
  issues: ComplianceIssue[];
}

/**
 * Every required vaccine must stay valid until the last day of the visit.
 * Expired or expiring shots block the booking; unreadable ones send it to a
 * human for review.
 */
export function evaluateCompliance(
  dates: VaccineDates,
  species: Species,
  service: Service,
  visitEnd: string,
  today: string = todayISO(),
): ComplianceResult {
  const issues: ComplianceIssue[] = [];
  for (const key of requiredVaccines(species, service)) {
    const date = dates[key];
    if (!date) issues.push({ vaccine: key, kind: "missing", date: null });
    else if (date < today) issues.push({ vaccine: key, kind: "expired", date });
    else if (date < visitEnd) issues.push({ vaccine: key, kind: "expires_during_stay", date });
  }
  const status: ComplianceStatus = issues.some((i) => i.kind !== "missing")
    ? "blocked"
    : issues.length
      ? "review"
      : "clear";
  return { status, issues };
}

export function describeIssue(issue: ComplianceIssue, species: Species): string {
  const name = vaccineLabel(issue.vaccine, species);
  switch (issue.kind) {
    case "missing":
      return `${name} date couldn't be read`;
    case "expired":
      return `${name} expired`;
    case "expires_during_stay":
      return `${name} expires before the visit ends`;
  }
}
