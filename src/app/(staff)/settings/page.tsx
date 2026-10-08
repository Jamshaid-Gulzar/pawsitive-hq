import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { getBusiness } from "@/db/business";
import { requireRole } from "@/lib/session";
import { BusinessForm } from "./BusinessForm";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("admin");
  const business = await getBusiness();
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-sand text-ink">
          <Settings className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Settings</h1>
          <p className="font-semibold text-muted">Your business details, location and opening hours. Admin only.</p>
        </div>
      </div>
      <BusinessForm initial={business} />
    </>
  );
}
