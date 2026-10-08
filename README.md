# Pawsitive HQ — Pet Care Command Center

A full pet-care business system: a **mobile app for pet parents**, a **front-desk dashboard for staff**, a **clinic app for in-house vets**, and an **owner console** for the admin. Built as a portfolio project using free tools only.

**Live demo:** https://pawsitive-hq.vercel.app · Use **Show quick demo login** on the sign-in screen to try any role in one tap, or sign in with `<first name>@pawsitive.demo` / `demo1234` (e.g. `emily@pawsitive.demo`).

## What it does

| Role | Highlights |
|---|---|
| **Pet parent** (mobile app) | Register pets · book boarding, daycare, grooming and vet checkups on a live availability calendar · upload a vet record and have vaccine dates read automatically (OCR in the browser) · pay online with a discount or pay at the center · live timeline, photo updates and daily report cards · per-pet chat with the team and the vets · vaccine reminders · full visit history |
| **Staff** | Live floor board of kennels and grooming tables · check-ins · vaccine compliance queue · daily reports · Pawsitive photo updates · invoices and desk payments · messages |
| **Doctor** | Today's patients · schedule · exam notes and PDF vet reports · patient history · earnings after the platform fee, with monthly payout statements |
| **Admin** | Confirm booking requests · revenue dashboard · prices and offers · add doctors and staff · business settings (name, logo, location, hours) |

## Tech

- **Next.js 16** (App Router, server actions) · **React 19** · **Tailwind CSS v4**
- **SQLite via libSQL** with **Drizzle ORM** — a local file in development, [Turso](https://turso.tech) in production
- Email + password auth with scrypt hashing and server-side sessions
- **Tesseract.js** OCR in the browser · **pdf-lib** for receipts and vet reports · OpenStreetMap embeds
- Vitest unit tests · Playwright end-to-end checks

No paid services: payments use a demo checkout (no card is charged), and messages stay inside the app.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The demo database (`local.db`) is created and filled automatically, and reloads every day so "today" is always busy. Use **Reset demo** in the app to start fresh.

## Deploy

Deployed on Vercel. Add a free Turso database (Vercel → Storage → Turso) so data is kept between requests, and optionally set `FACILITY_TIMEZONE` (see `.env.example`).
