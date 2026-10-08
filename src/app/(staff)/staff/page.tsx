import { inArray } from "drizzle-orm";
import { Users } from "lucide-react";
import type { Metadata } from "next";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { StaffManager } from "./StaffManager";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const me = await requireRole("admin");
  const db = await getDb();
  const team = (await db.select().from(users).where(inArray(users.role, ["staff", "admin"])))
    .map((u) => ({ id: u.id, name: u.name, role: u.role as "staff" | "admin", title: u.title, email: u.email, phone: u.phone }))
    .sort((a, b) => Number(b.role === "admin") - Number(a.role === "admin") || a.name.localeCompare(b.name));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-coral-soft text-coral-ink">
          <Users className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Staff</h1>
          <p className="font-semibold text-muted">Give your team their own sign-in, or remove someone who has left. Doctors are managed on the Doctors page.</p>
        </div>
      </div>
      <StaffManager members={team} meId={me.id} />
    </>
  );
}
