import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont } from "pdf-lib";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getBusiness } from "@/db/business";
import { getInvoice } from "@/db/queries";
import { vetVisits } from "@/db/schema";
import { formatLongDate, formatStamp } from "@/lib/dates";
import { formatMoney, sumItems } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";

const INK = rgb(0.106, 0.122, 0.231);
const MUTED = rgb(0.357, 0.373, 0.478);
const CORAL = rgb(1, 0.478, 0.271);
const CREAM = rgb(0.984, 0.969, 0.949);
const LINE = rgb(0.902, 0.875, 0.827);
const MINT = rgb(0.133, 0.627, 0.42);
const LILAC = rgb(0.486, 0.369, 0.851);
const ROSE = rgb(0.761, 0.2, 0.102);

// Standard PDF fonts only cover Latin-1, so swap or drop anything else.
const pdfText = (s: string) =>
  s
    .replace(/[→]/g, "->")
    .replace(/[−]/g, "-")
    .replace(/[✓✔]/g, "")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "");

/**
 * The invoice as a PDF: a receipt once paid (with a PAID stamp), a refund
 * statement once refunded. Owners get their own; staff and the admin any.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/invoice/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });
  const inv = await getInvoice(id);
  if (!inv || (user.role === "parent" && inv.ownerId !== user.id)) return new Response("Invoice not found.", { status: 404 });
  // Doctors can open the invoices for their own checkups only.
  if (user.role === "vet") {
    const db = await getDb();
    const [visit] = inv.refKind === "vet" ? await db.select({ vetId: vetVisits.vetId }).from(vetVisits).where(eq(vetVisits.id, inv.refId)) : [];
    if (!visit || visit.vetId !== user.vetId) return new Response("Invoice not found.", { status: 404 });
  }
  const business = await getBusiness();

  const kind = inv.status === "paid" ? "RECEIPT" : inv.status === "refunded" ? "REFUND STATEMENT" : inv.status === "void" ? "VOID INVOICE" : "INVOICE";
  const doc = await PDFDocument.create();
  doc.setTitle(`${kind === "RECEIPT" ? "Receipt" : "Invoice"} #${inv.number} — ${inv.pet.name}`);
  doc.setAuthor(business.name);
  const page = doc.addPage([595, 842]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 48;
  const W = 595 - M * 2;
  const text = (s: string, x: number, y: number, size = 10.5, font: PDFFont = regular, color = INK) => page.drawText(pdfText(s), { x, y, size, font, color });
  const right = (s: string, xRight: number, y: number, size = 10.5, font: PDFFont = regular, color = INK) =>
    text(s, xRight - font.widthOfTextAtSize(pdfText(s), size), y, size, font, color);

  // Header
  page.drawRectangle({ x: 0, y: 842 - 110, width: 595, height: 110, color: CORAL });
  text(business.name, M, 842 - 50, 26, bold);
  text(business.address, M, 842 - 70, 10.5);
  text([business.email, business.phone].filter(Boolean).join(" · "), M, 842 - 86, 10);
  right(kind, 595 - M, 842 - 50, 16, bold);
  right(`No. INV-${inv.number}`, 595 - M, 842 - 70, 11, bold);
  right(`Issued ${formatLongDate(inv.createdAt.slice(0, 10))}`, 595 - M, 842 - 86, 10);

  // Billed to / service
  let y = 842 - 150;
  const block = (x: number, title: string, lines: string[]) => {
    text(title.toUpperCase(), x, y, 9, bold, MUTED);
    lines.forEach((l, i) => text(l, x, y - 18 - i * 15, i === 0 ? 12 : 10.5, i === 0 ? bold : regular));
  };
  block(M, "Billed to", [inv.pet.owner.name, inv.pet.owner.email ?? "", inv.pet.owner.phone ?? ""].filter(Boolean));
  block(M + W / 2, "Service", [`${inv.pet.name} · ${inv.title}`, inv.when, `${inv.pet.breed} · ${inv.pet.sex === "f" ? "Female" : "Male"}`]);
  y -= 90;

  // Line items
  page.drawRectangle({ x: M, y: y - 6, width: W, height: 24, color: CREAM });
  text("DESCRIPTION", M + 10, y + 2, 9, bold, MUTED);
  right("QTY", M + W - 170, y + 2, 9, bold, MUTED);
  right("UNIT", M + W - 90, y + 2, 9, bold, MUTED);
  right("AMOUNT", M + W - 10, y + 2, 9, bold, MUTED);
  y -= 28;
  for (const item of inv.items) {
    const discount = item.cents < 0;
    text(item.label, M + 10, y, 11, discount ? bold : regular, discount ? MINT : INK);
    right(String(item.qty), M + W - 170, y, 11);
    right(formatMoney(item.unitCents), M + W - 90, y, 11);
    right(formatMoney(item.cents), M + W - 10, y, 11, bold, discount ? MINT : INK);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: LINE });
    y -= 16;
  }

  // Totals
  const subtotal = sumItems(inv.items.filter((i) => i.cents >= 0));
  const savings = -sumItems(inv.items.filter((i) => i.cents < 0));
  const tx = M + W - 220;
  y -= 4;
  text("Subtotal", tx, y, 11, regular, MUTED);
  right(formatMoney(subtotal), M + W - 10, y, 11);
  if (savings) {
    y -= 18;
    text("Discounts", tx, y, 11, regular, MINT);
    right(`-${formatMoney(savings)}`, M + W - 10, y, 11, regular, MINT);
  }
  y -= 12;
  page.drawRectangle({ x: tx - 10, y: y - 30, width: 230, height: 34, color: INK });
  text(inv.status === "paid" ? "Total paid" : inv.status === "refunded" ? "Refunded" : "Total due", tx, y - 18, 12, bold, rgb(1, 1, 1));
  right(formatMoney(inv.totalCents), M + W - 10, y - 18, 15, bold, rgb(1, 1, 1));
  y -= 70;

  // Payment details
  text("PAYMENT", M, y, 9, bold, MUTED);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1, color: LINE });
  y -= 18;
  const rows: [string, string][] =
    inv.status === "paid"
      ? [
          ["Status", "Paid in full"],
          ["Paid on", inv.paidAt ? formatStamp(inv.paidAt) : "—"],
          ["Method", inv.paidMethod === "online" ? `Online · card ending ${inv.cardLast4 ?? "----"}` : inv.paidMethod === "cash" ? "Cash at front desk" : "Card at front desk"],
          ["Reference", inv.txnRef ?? "—"],
        ]
      : inv.status === "refunded"
        ? [
            ["Status", "Refunded in full"],
            ["Refunded on", inv.refundedAt ? formatStamp(inv.refundedAt) : "—"],
            ["Refunded to", inv.paidMethod === "online" ? `Card ending ${inv.cardLast4 ?? "----"}` : "Original payment method"],
            ["Reason", inv.voidReason ?? "—"],
          ]
        : inv.status === "void"
          ? [
              ["Status", "Void — nothing to pay"],
              ["Reason", inv.voidReason ?? "—"],
            ]
          : [
              ["Status", "Unpaid"],
              ["How to pay", "Online in the Pawsitive app, or at the front desk"],
            ];
  rows.forEach(([k, v], i) => {
    const x = M + (i % 2) * (W / 2);
    text(k, x, y, 9, regular, MUTED);
    text(v, x, y - 14, 11, bold);
    if (i % 2 === 1 || i === rows.length - 1) y -= 36;
  });

  // Stamp
  const stamp = inv.status === "paid" ? { t: "PAID", c: MINT } : inv.status === "refunded" ? { t: "REFUNDED", c: LILAC } : inv.status === "void" ? { t: "VOID", c: ROSE } : null;
  if (stamp) {
    const size = 46;
    const w = bold.widthOfTextAtSize(stamp.t, size);
    page.drawRectangle({ x: 595 - M - w - 34, y: 300, width: w + 28, height: 62, borderColor: stamp.c, borderWidth: 3, rotate: degrees(-12), opacity: 0 });
    page.drawText(stamp.t, { x: 595 - M - w - 20, y: 314, size, font: bold, color: stamp.c, rotate: degrees(-12), opacity: 0.85 });
  }

  text("Thank you for trusting us with your family member!", M, 110, 12, bold, CORAL);
  text("Questions about this bill? Message us in the app or call the front desk.", M, 92, 10, regular, MUTED);
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 36, color: CREAM });
  text(`${business.name} · portfolio demo — sample document, no real payment was taken.`, M, 14, 8.5, regular, MUTED);

  const bytes = await doc.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pawsitive-${inv.status === "paid" ? "receipt" : "invoice"}-${inv.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
