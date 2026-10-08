import { and, eq } from "drizzle-orm";
import { BadgeDollarSign, CalendarDays, MessagesSquare, PawPrint, Stethoscope, Wallet } from "lucide-react";
import Link from "next/link";
import { countUnreadForStaff } from "@/db/queries";
import { sendDueReminders } from "@/db/reminders";
import { formatMoney, monthName } from "@/lib/pricing";
import type { ReactNode } from "react";
import { DemoControls } from "@/components/DemoControls";
import { NavLink } from "@/components/NavLink";
import { BrandLogo } from "@/components/BrandLogo";
import { VetAvatar } from "@/components/VetAvatar";
import { getDb } from "@/db";
import { payouts, vets } from "@/db/schema";
import { requireRole } from "@/lib/session";

export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("vet");
  const db = await getDb();
  const [vet] = user.vetId ? await db.select().from(vets).where(eq(vets.id, user.vetId)) : [];
  await sendDueReminders();
  const unread = await countUnreadForStaff({ channel: "vet", vetId: user.vetId ?? "" });
  const newPayouts = user.vetId
    ? await db.select().from(payouts).where(and(eq(payouts.vetId, user.vetId), eq(payouts.seenByDoctor, false)))
    : [];

  const link = "flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 text-[15px] transition";
  const active = "bg-mint font-extrabold text-white";
  const inactive = "font-bold text-[#d5d7ea] hover:bg-ink-2";

  return (
    <div className="flex min-h-screen flex-wrap items-stretch">
      <aside className="flex max-w-full flex-[1_1_248px] flex-col gap-7 bg-ink px-4.5 py-7 text-white lg:sticky lg:top-0 lg:h-screen lg:max-w-[272px]">
        <div className="px-2">
          <BrandLogo dark />
          <p className="mt-2 pl-14 text-xs font-extrabold tracking-[0.08em] text-mint uppercase">Vet clinic</p>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          <NavLink href="/doctor" exact className={link} activeClassName={active} inactiveClassName={inactive}>
            <Stethoscope className="size-5" aria-hidden="true" />
            My day
          </NavLink>
          <NavLink href="/doctor/schedule" className={link} activeClassName={active} inactiveClassName={inactive}>
            <CalendarDays className="size-5" aria-hidden="true" />
            My schedule
          </NavLink>
          <NavLink href="/doctor/messages" className={link} activeClassName={active} inactiveClassName={inactive}>
            <MessagesSquare className="size-5" aria-hidden="true" />
            Patient messages
            {unread > 0 && (
              <span className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-coral px-1.5 text-xs font-extrabold text-ink">
                {unread}
              </span>
            )}
          </NavLink>
          <NavLink href="/doctor/patients" className={link} activeClassName={active} inactiveClassName={inactive}>
            <PawPrint className="size-5" aria-hidden="true" />
            My patients
          </NavLink>
          <NavLink href="/doctor/earnings" className={link} activeClassName={active} inactiveClassName={inactive}>
            <Wallet className="size-5" aria-hidden="true" />
            Earnings
            {newPayouts.length > 0 && (
              <span className="ml-auto inline-flex h-6 items-center justify-center rounded-full bg-sun px-2 text-xs font-extrabold text-ink">New</span>
            )}
          </NavLink>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <DemoControls dark />
          <div className="flex items-center gap-3 rounded-[18px] bg-ink-2 p-3.5">
            <VetAvatar name={user.name} color={vet?.color ?? "mint"} size="size-11" text="text-sm" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold">{user.name}</div>
              <div className="text-[13px] text-[#b9bcd6]">{vet?.specialty ?? "Veterinarian"}</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-[999_1_760px] px-5 pt-8 pb-14 sm:px-9">
        {newPayouts.map((p) => (
          <Link
            key={p.id}
            href="/doctor/earnings"
            className="mb-6 flex items-center gap-3.5 rounded-[20px] bg-mint px-5 py-4 font-bold text-white shadow-card transition hover:-translate-y-0.5"
          >
            <BadgeDollarSign className="size-7 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              Payout credited: {formatMoney(p.netCents)} for {p.lines.length} checkup{p.lines.length === 1 ? "" : "s"} ({monthName(p.period)}). Your statement is ready.
            </span>
            <span className="text-sm font-extrabold">View →</span>
          </Link>
        ))}
        {children}
      </main>
    </div>
  );
}
