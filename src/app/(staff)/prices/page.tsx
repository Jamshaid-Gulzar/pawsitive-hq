import { BadgePercent, Lock, Tags } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { getPriceList } from "@/db/queries";
import { formatStamp } from "@/lib/dates";
import { requireRole } from "@/lib/session";
import { DiscountEditor, PriceEditor } from "./PriceEditor";

export const metadata: Metadata = { title: "Prices & offers" };

export default async function PricesPage() {
  const user = await requireRole("staff", "admin");
  const { prices, discount, discountUpdatedBy, discountUpdatedAt } = await getPriceList();
  const isAdmin = user.role === "admin";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-coral-soft text-coral-ink">
          <Tags className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-[38px] leading-tight font-semibold">Prices & offers</h1>
          <p className="font-semibold text-muted">What customers see in the app and pay on their invoice.</p>
        </div>
      </div>

      <Card className="mb-7 flex flex-col gap-3 p-6">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <BadgePercent className="size-6 text-mint-ink" aria-hidden="true" /> Pay-online offer
        </h2>
        <p className="font-semibold text-muted">
          Customers who pay online in the app get this discount on the whole invoice. Paying at the front desk is full price.
        </p>
        <DiscountEditor current={discount} />
        {discountUpdatedBy && (
          <p className="text-xs font-bold text-faint">
            Last changed by {discountUpdatedBy}
            {discountUpdatedAt ? `, ${formatStamp(discountUpdatedAt)}` : ""}
          </p>
        )}
      </Card>

      {!isAdmin && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-sand px-4 py-3 text-sm font-bold text-muted">
          <Lock className="size-4" aria-hidden="true" /> Only the admin can change prices.
        </p>
      )}
      <PriceEditor prices={prices} canEdit={isAdmin} />
    </>
  );
}
