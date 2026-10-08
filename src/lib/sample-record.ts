// Browser-only: draws a realistic vet certificate so visitors without a real
// record can try the scanner. Dates are relative to today, so the "current"
// sample always passes and the "expired" one always fails.

import { addDays, todayISO } from "./dates";
import type { Species } from "./vaccines";

const usDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};

export function drawSampleRecord(opts: { petName: string; ownerName: string; species: Species; breed: string; expired: boolean }): string {
  const today = todayISO();
  const rows: [string, number, number][] = [
    ["Rabies (3 year)", -320, 775],
    [opts.species === "cat" ? "FVRCP" : "DHPP", opts.expired ? -400 : -60, opts.expired ? -35 : 305],
  ];
  if (opts.species === "dog") rows.push(["Bordetella", -40, 325]);

  const W = 1200;
  const H = 820;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#1f5f8b";
  c.fillRect(0, 0, W, 130);
  c.fillStyle = "#ffffff";
  c.font = "bold 46px Arial";
  c.fillText("MAPLE STREET ANIMAL HOSPITAL", 50, 78);
  c.font = "24px Arial";
  c.fillText("Certificate of Vaccination", 52, 114);

  c.fillStyle = "#111111";
  c.font = "28px Arial";
  c.fillText(`Patient: ${opts.petName}`, 50, 200);
  c.fillText(`Species: ${opts.species === "cat" ? "Feline" : "Canine"}`, 620, 200);
  c.fillText(`Breed: ${opts.breed}`, 50, 245);
  c.fillText(`Owner: ${opts.ownerName}`, 620, 245);

  c.fillStyle = "#e8eef3";
  c.fillRect(40, 300, W - 80, 60);
  c.fillStyle = "#111111";
  c.font = "bold 30px Arial";
  c.fillText("Vaccine", 60, 342);
  c.fillText("Date Given", 520, 342);
  c.fillText("Expires", 860, 342);

  c.font = "32px Arial";
  rows.forEach(([name, given, expires], i) => {
    const y = 420 + i * 80;
    c.fillText(name, 60, y);
    c.fillText(usDate(addDays(today, given)), 520, y);
    c.fillText(usDate(addDays(today, expires)), 860, y);
    c.strokeStyle = "#d0d7de";
    c.beginPath();
    c.moveTo(40, y + 28);
    c.lineTo(W - 40, y + 28);
    c.stroke();
  });

  c.font = "italic 26px Arial";
  c.fillStyle = "#333333";
  c.fillText("Dr. R. Alvarez, DVM", 60, H - 70);
  c.font = "22px Arial";
  c.fillText(`Issued ${usDate(today)}  -  Sample record for demo use`, 60, H - 32);

  return canvas.toDataURL("image/jpeg", 0.9);
}
