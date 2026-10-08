import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Initials } from "@/components/ui";
import { countNewUpdates } from "@/db/queries";
import { sendDueReminders } from "@/db/reminders";
import { requireRole } from "@/lib/session";
import { TabBar } from "./TabBar";

// The pet parent side is a mobile app only. On a wide screen the same app is
// shown as a phone-width column in the middle; there is no desktop layout.
// Fixed bars inside it (tab bar, action bars, chat) use the same max-w-[430px].
export default async function ParentLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("parent");
  await sendDueReminders();
  const unread = await countNewUpdates(user.id);

  return (
    <div className="min-h-dvh bg-sand">
      <div className="relative mx-auto min-h-dvh max-w-[430px] bg-cream shadow-[0_0_60px_rgb(27_31_59/0.12)]">
        <header className="sticky top-0 z-30 flex h-[calc(64px+env(safe-area-inset-top))] items-center justify-between gap-3 bg-cream/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
          <Link href="/my" className="min-w-0" aria-label="Home">
            <BrandLogo small />
          </Link>
          <Link href="/my/account" aria-label="Your account">
            <Initials name={user.name} className="bg-lilac-soft text-lilac-ink" />
          </Link>
        </header>

        <main className="px-4 pt-2 pb-[calc(88px+env(safe-area-inset-bottom))]">{children}</main>

        <TabBar unread={unread} />
      </div>
    </div>
  );
}
