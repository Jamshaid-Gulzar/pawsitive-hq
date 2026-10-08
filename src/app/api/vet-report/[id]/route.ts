import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getDb } from "@/db";
import { getBusiness } from "@/db/business";
import { pets, users, vetVisits, vets } from "@/db/schema";
import { formatLongDate, formatStamp, formatTime, todayISO } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";
import { HEALTH_STATUS, VET_REASONS } from "@/lib/vet";

const INK = rgb(0.106, 0.122, 0.231);
const MUTED = rgb(0.357, 0.373, 0.478);
const CORAL = rgb(1, 0.478, 0.271);
const CREAM = rgb(0.984, 0.969, 0.949);
const LINE = rgb(0.902, 0.875, 0.827);
const TONES = { healthy: rgb(0.133, 0.627, 0.42), monitor: rgb(0.949, 0.655, 0.106), treatment: rgb(0.761, 0.2, 0.102) };

// Standard PDF fonts only cover Latin-1, so swap or drop anything else.
const pdfText = (s: string) =>
  s
    .replace(/[→]/g, "->")
    .replace(/[✓✔]/g, "")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of pdfText(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

/** Downloads a completed vet visit as a PDF report. Owners get their own pets'; staff and doctors any. */
export async function GET(_req: Request, ctx: RouteContext<"/api/vet-report/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });

  const db = await getDb();
  const [row] = await db
    .select({ visit: vetVisits, pet: pets, owner: users, vet: vets })
    .from(vetVisits)
    .innerJoin(pets, eq(vetVisits.petId, pets.id))
    .innerJoin(users, eq(pets.ownerId, users.id))
    .leftJoin(vets, eq(vetVisits.vetId, vets.id))
    .where(eq(vetVisits.id, id));
  if (!row || (user.role === "parent" && row.pet.ownerId !== user.id)) return new Response("Report not found.", { status: 404 });
  if (row.visit.status !== "completed") return new Response("This checkup isn't finished yet.", { status: 409 });
  const { visit, pet, owner, vet } = row;
  const business = await getBusiness();

  const doc = await PDFDocument.create();
  doc.setTitle(`Vet report — ${pet.name}`);
  doc.setAuthor(business.name);
  const page = doc.addPage([595, 842]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 48;
  const W = 595 - M * 2;
  let y = 842;

  const text = (p: PDFPage, s: string, x: number, yy: number, size = 10.5, font = regular, color = INK) =>
    p.drawText(pdfText(s), { x, y: yy, size, font, color });

  // Header band
  page.drawRectangle({ x: 0, y: 842 - 96, width: 595, height: 96, color: CORAL });
  text(page, business.name, M, 842 - 46, 24, bold);
  text(page, "In-house Veterinary Clinic", M, 842 - 66, 11, regular);
  text(page, "VETERINARY REPORT", 595 - M - bold.widthOfTextAtSize("VETERINARY REPORT", 13), 842 - 46, 13, bold);
  const ref = `Ref ${visit.id.toUpperCase()}`;
  text(page, ref, 595 - M - regular.widthOfTextAtSize(ref, 10), 842 - 64, 10);
  y = 842 - 96 - 30;

  const heading = (title: string) => {
    text(page, title.toUpperCase(), M, y, 9.5, bold, MUTED);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1, color: LINE });
    y -= 16;
  };
  const pairs = (rows: [string, string][]) => {
    const colW = W / 2;
    rows.forEach(([k, v], i) => {
      const x = M + (i % 2) * colW;
      text(page, k, x, y, 9, regular, MUTED);
      text(page, v || "—", x, y - 13, 11, bold);
      if (i % 2 === 1 || i === rows.length - 1) y -= 34;
    });
  };
  const paragraph = (label: string, value: string | null) => {
    if (!value) return;
    text(page, label, M, y, 9, regular, MUTED);
    y -= 14;
    for (const line of wrap(value, regular, 11, W)) {
      text(page, line, M, y, 11);
      y -= 15;
    }
    y -= 8;
  };

  const age = pet.birthday ? `${Number(todayISO().slice(0, 4)) - Number(pet.birthday.slice(0, 4))} years` : "—";
  heading("Patient");
  pairs([
    ["Name", pet.name],
    ["Species & breed", `${pet.species === "cat" ? "Cat" : "Dog"} · ${pet.breed}`],
    ["Sex", pet.sex === "f" ? "Female" : "Male"],
    ["Age", age],
    ["Owner", owner.name],
    ["Phone", owner.phone ?? "—"],
  ]);

  heading("Visit");
  pairs([
    ["Date", formatLongDate(visit.date)],
    ["Time", formatTime(visit.time)],
    ["Doctor", visit.vetName ?? vet?.name ?? "—"],
    ["Specialty", vet?.specialty ?? "—"],
    ["Reason", VET_REASONS[visit.reason].label],
    ["Known conditions", pet.conditions.join(", ") || "None"],
  ]);
  paragraph("Concerns noted", visit.symptoms);

  heading("Vital signs");
  const status = visit.healthStatus ? HEALTH_STATUS[visit.healthStatus] : null;
  const boxes: [string, string][] = [
    ["Weight", visit.weightKg ? `${visit.weightKg} kg` : "—"],
    ["Temperature", visit.temperatureC ? `${visit.temperatureC} °C` : "—"],
    ["Overall health", status?.label ?? "—"],
  ];
  const bw = (W - 20) / 3;
  boxes.forEach(([k, v], i) => {
    const x = M + i * (bw + 10);
    page.drawRectangle({ x, y: y - 40, width: bw, height: 52, color: CREAM, borderColor: LINE, borderWidth: 1 });
    text(page, k, x + 12, y - 2, 9, regular, MUTED);
    const color = i === 2 && visit.healthStatus ? TONES[visit.healthStatus] : INK;
    text(page, v, x + 12, y - 26, 15, bold, color);
  });
  y -= 70;

  heading("Assessment");
  paragraph("Findings / diagnosis", visit.diagnosis);
  paragraph("Treatment given", visit.treatment);
  paragraph("Medication prescribed", visit.medication);
  paragraph("Follow-up", visit.followUpDate ? `Booked for ${formatLongDate(visit.followUpDate)}` : "No follow-up needed");

  // Sign-off
  y = Math.min(y, 150);
  page.drawLine({ start: { x: M, y: y - 20 }, end: { x: M + 220, y: y - 20 }, thickness: 1, color: INK });
  text(page, visit.vetName ?? vet?.name ?? "Veterinarian", M, y - 36, 11, bold);
  text(page, `Signed electronically · ${visit.completedAt ? formatStamp(visit.completedAt) : ""}`, M, y - 50, 9, regular, MUTED);

  page.drawRectangle({ x: 0, y: 0, width: 595, height: 36, color: CREAM });
  text(page, `${business.name} · portfolio demo — sample report, not a real medical record.`, M, 14, 8.5, regular, MUTED);

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vet-report-${pet.name.toLowerCase()}-${visit.date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
