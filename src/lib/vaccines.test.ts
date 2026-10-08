import { describe, expect, it } from "vitest";
import { dueText, evaluateCompliance, findDates, parseVaccineRecord, vaccineSchedule } from "./vaccines";

describe("vaccineSchedule", () => {
  const today = "2026-10-07";
  it("sorts by urgency and labels each stage", () => {
    const s = vaccineSchedule({ rabies: "2026-10-12", core: "2026-09-01", bordetella: "2026-11-01" }, "dog", today);
    expect(s.map((v) => [v.key, v.stage])).toEqual([
      ["core", "expired"],
      ["rabies", "due_7"],
      ["bordetella", "due_30"],
    ]);
    expect(dueText(s[0])).toBe("Expired 36 days ago");
    expect(dueText(s[1])).toBe("Due in 5 days");
  });

  it("flags missing dates and skips Bordetella for cats", () => {
    const s = vaccineSchedule({ rabies: null, core: "2027-06-01", bordetella: null }, "cat", today);
    expect(s.map((v) => [v.label, v.stage])).toEqual([
      ["Rabies", "missing"],
      ["FVRCP", "ok"],
    ]);
  });
});

describe("findDates", () => {
  it("reads the common date formats on a vet record", () => {
    expect(findDates("given 03/14/2026 due 03/14/2027")).toEqual(["2026-03-14", "2027-03-14"]);
    expect(findDates("Expires 2027-01-20")).toEqual(["2027-01-20"]);
    expect(findDates("Valid until Mar 14, 2027")).toEqual(["2027-03-14"]);
    expect(findDates("Due 2 September 2026")).toEqual(["2026-09-02"]);
    expect(findDates("Next due 9-2-26")).toEqual(["2026-09-02"]);
  });

  it("ignores impossible dates", () => {
    expect(findDates("13/45/2026")).toEqual([]);
  });
});

describe("parseVaccineRecord", () => {
  it("takes the latest date on each vaccine line as its expiry", () => {
    const text = `
      HAPPY TAILS VETERINARY CLINIC
      Patient: Bella   Species: Canine
      Vaccine        Given        Expires
      Rabies (3yr)   03/14/2024   03/14/2027
      DHPP           09/02/2025   09/02/2026
      Bordetella     01/20/2026   01/20/2027
    `;
    const parsed = parseVaccineRecord(text);
    expect(parsed.rabies).toMatchObject({ date: "2027-03-14", confidence: "high" });
    expect(parsed.core).toMatchObject({ date: "2026-09-02", confidence: "high" });
    expect(parsed.bordetella).toMatchObject({ date: "2027-01-20", confidence: "high" });
  });

  it("fixes O/0 and l/1 mix-ups from OCR", () => {
    const parsed = parseVaccineRecord("Rabies exp O3/l4/2O27");
    expect(parsed.rabies.date).toBe("2027-03-14");
  });

  it("recognises alternate vaccine names", () => {
    const parsed = parseVaccineRecord("Distemper/Parvo (DA2PP) due 2027-05-01\nKennel Cough due 2026-12-01");
    expect(parsed.core.date).toBe("2027-05-01");
    expect(parsed.bordetella.date).toBe("2026-12-01");
  });

  it("looks at the next line when the date wraps", () => {
    const parsed = parseVaccineRecord("Rabies vaccine, 3 year\nexpires Jun 1, 2027");
    expect(parsed.rabies).toMatchObject({ date: "2027-06-01", confidence: "medium" });
  });

  it("returns null when a vaccine is not on the record", () => {
    expect(parseVaccineRecord("Rabies 2027-01-01").bordetella.date).toBeNull();
  });
});

describe("evaluateCompliance", () => {
  const today = "2026-10-06";
  const valid = { rabies: "2027-03-14", core: "2027-09-02", bordetella: "2027-01-20" };

  it("clears a pet whose shots last past the visit", () => {
    expect(evaluateCompliance(valid, "dog", "boarding", "2026-10-13", today)).toEqual({ status: "clear", issues: [] });
  });

  it("blocks an expired shot", () => {
    const r = evaluateCompliance({ ...valid, core: "2026-09-02" }, "dog", "boarding", "2026-10-13", today);
    expect(r.status).toBe("blocked");
    expect(r.issues).toEqual([{ vaccine: "core", kind: "expired", date: "2026-09-02" }]);
  });

  it("blocks a shot that runs out during the stay", () => {
    const r = evaluateCompliance({ ...valid, rabies: "2026-10-10" }, "dog", "boarding", "2026-10-13", today);
    expect(r.issues[0].kind).toBe("expires_during_stay");
  });

  it("sends unreadable dates to review", () => {
    const r = evaluateCompliance({ ...valid, rabies: null }, "dog", "daycare", "2026-10-09", today);
    expect(r.status).toBe("review");
  });

  it("does not need Bordetella for grooming or cats", () => {
    const noBordetella = { ...valid, bordetella: null };
    expect(evaluateCompliance(noBordetella, "dog", "grooming", today, today).status).toBe("clear");
    expect(evaluateCompliance(noBordetella, "cat", "boarding", "2026-10-11", today).status).toBe("clear");
  });
});
