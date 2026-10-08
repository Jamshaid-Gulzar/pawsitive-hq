import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { AddPetForm } from "./AddPetForm";

export const metadata: Metadata = { title: "Add a pet" };

export default async function NewPetPage() {
  const user = await requireRole("parent");
  return (
    <div className="flex flex-col gap-2">
      <Link href="/my" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-grape">
        <ChevronLeft className="size-4.5" aria-hidden="true" /> Home
      </Link>
      <AddPetForm ownerName={user.name} />
    </div>
  );
}
