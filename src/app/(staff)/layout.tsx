import { and, eq, inArray, lte } from "drizzle-orm";
import {
  CalendarX,
  Camera,
  Inbox,
  LayoutGrid,
  MessagesSquare,
  NotebookPen,
  ReceiptText,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Tags,
  TrendingUp,
  UserRoundCog,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { DemoControls } from "@/components/DemoControls";
import { NavLink } from "@/components/NavLink";
import { BrandLogo } from "@/components/BrandLogo";
import { Initials } from "@/components/ui";
import { getDb } from "@/db";
import { countRequests, countUnreadForStaff, getInvoices, getReportsBoard, getVaccinesDue } from "@/db/queries";
import { sendDueReminders } from "@/db/reminders";
import { bookings, vetVisits } from "@/db/schema";
import { todayISO } from "@/lib/dates";
import { requireRole } from "@/lib/session";

type Item = { href: string; label: string; icon: LucideIcon; count?: number; badge?: string; adminOnly?: boolean };

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("staff", "admin");
  const isAdmin = user.role === "admin";
  const db = await getDb();
  await sendDueReminders();
  const flagged = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.status, ["locked", "review"]));
  const vetQueue = await db
    .select({ id: vetVisits.id })
    .from(vetVisits)
    .where(and(eq(vetVisits.status, "booked"), lte(vetVisits.date, todayISO())));
  const requests = isAdmin ? await countRequests() : 0;
  const unreadChats = await countUnreadForStaff();
  const missingReports = (await getReportsBoard()).filter((r) => !r.report).length;
  const vaccinesDue = new Set((await getVaccinesDue()).map((v) => v.pet.id)).size;
  const invoicesDue = (await getInvoices()).filter((i) => i.status === "unpaid" && (i.due === "overdue" || i.due === "today")).length;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Front desk",
      items: [
        { href: "/requests", label: "Booking requests", icon: Inbox, count: requests, badge: "bg-white text-coral-ink", adminOnly: true },
        { href: "/board", label: "Floor board", icon: LayoutGrid },
        { href: "/invoices", label: "Invoices", icon: ReceiptText, count: invoicesDue, badge: "bg-mint text-white" },
        { href: "/messages", label: "Messages", icon: MessagesSquare, count: unreadChats, badge: "bg-sky text-white" },
        { href: "/cancellations", label: "Cancellations", icon: CalendarX },
      ],
    },
    {
      title: "Care",
      items: [
        { href: "/vaccines", label: "Vaccine check", icon: ShieldCheck, count: flagged.length, badge: "bg-sun text-ink" },
        { href: "/vaccines-due", label: "Vaccines due", icon: Syringe, count: vaccinesDue, badge: "bg-sky text-white" },
        { href: "/vet", label: "Vet clinic", icon: Stethoscope, count: vetQueue.length, badge: "bg-mint text-white" },
        { href: "/reports", label: "Daily reports", icon: NotebookPen, count: missingReports, badge: "bg-lilac text-white" },
        { href: "/updates", label: "Pawsitive Updates", icon: Camera },
      ],
    },
    {
      title: "Business",
      items: [
        { href: "/revenue", label: "Revenue", icon: TrendingUp, adminOnly: true },
        { href: "/prices", label: "Prices & offers", icon: Tags },
        { href: "/doctors", label: "Doctors", icon: UserRoundCog, adminOnly: true },
        { href: "/staff", label: "Staff", icon: Users, adminOnly: true },
        { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
      ],
    },
  ];

  const link = "flex min-h-11 items-center gap-3 rounded-[14px] px-3.5 text-[15px] whitespace-nowrap transition";
  const active = "bg-coral font-extrabold text-ink";
  const inactive = "font-bold text-[#d5d7ea] hover:bg-ink-2";

  return (
    <div className="flex min-h-screen flex-wrap items-stretch">
      <aside className="flex max-w-full flex-[1_1_248px] flex-col gap-6 bg-ink px-4.5 py-7 text-white lg:sticky lg:top-0 lg:h-screen lg:max-w-[272px] lg:overflow-y-auto">
        <div className="px-2">
          <BrandLogo dark />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-4">
          {groups.map((g) => {
            const items = g.items.filter((i) => !i.adminOnly || isAdmin);
            if (items.length === 0) return null;
            return (
              <div key={g.title} className="flex flex-col gap-0.5">
                <p className="px-3.5 pb-1 text-[11px] font-extrabold tracking-[0.1em] text-[#8f93b5] uppercase">{g.title}</p>
                {items.map(({ href, label, icon: Icon, count, badge }) => (
                  <NavLink key={href} href={href} className={link} activeClassName={active} inactiveClassName={inactive}>
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                    {!!count && count > 0 && (
                      <span className={`ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-extrabold ${badge}`}>{count}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <DemoControls dark />
          <div className="flex items-center gap-3 rounded-[18px] bg-ink-2 p-3.5">
            <Initials name={user.name} className={isAdmin ? "bg-mint-soft text-ink" : "bg-sun text-ink"} />
            <div className="min-w-0">
              <div className="text-sm font-extrabold">{user.name}</div>
              <div className="text-[13px] text-[#b9bcd6]">
                {user.title} · {isAdmin ? "Admin" : "Staff"}
              </div>
            </div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-[999_1_760px] px-5 pt-8 pb-14 sm:px-9">{children}</main>
    </div>
  );
}
