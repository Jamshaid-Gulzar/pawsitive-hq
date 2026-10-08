import { ChevronRight, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, Initials, PetPhoto } from "@/components/ui";
import { getOwnerPets } from "@/db/queries";
import { requireRole } from "@/lib/session";
import { AccountActions } from "./AccountActions";
import { ChangePassword } from "./ChangePassword";
import { EditProfile } from "./EditProfile";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireRole("parent");
  const pets = await getOwnerPets(user.id);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <section className="flex flex-col items-center gap-3 rounded-[30px] bg-lilac-soft px-5 py-7 text-center">
        <Initials name={user.name} size="size-20" className="bg-white text-2xl text-lilac-ink" />
        <div>
          <h1 className="font-display text-[28px] font-semibold">{user.name}</h1>
          {user.phone && (
            <p className="inline-flex items-center gap-1.5 font-semibold text-lilac-ink">
              <Phone className="size-4" aria-hidden="true" /> {user.phone}
            </p>
          )}
        </div>
        <EditProfile name={user.name} phone={user.phone} />
      </section>

      <section aria-labelledby="pets-h">
        <h2 id="pets-h" className="mb-3 font-display text-[22px] font-semibold">
          My pets
        </h2>
        <Card className="divide-y divide-sand">
          {pets.map((p) => (
            <Link key={p.id} href={`/my/pets/${p.id}`} className="flex min-h-18 items-center gap-3.5 px-4 transition active:bg-sand">
              <PetPhoto src={p.photo} alt="" className="size-12 rounded-2xl" sizes="48px" />
              <span className="min-w-0 flex-1">
                <strong className="block font-display text-lg font-semibold">{p.name}</strong>
                <span className="block truncate text-sm text-muted">{p.breed}</span>
              </span>
              <ChevronRight className="size-5 text-faint" aria-hidden="true" />
            </Link>
          ))}
          <Link href="/my/pets/new" className="flex min-h-18 items-center gap-3.5 px-4 font-extrabold text-grape transition active:bg-sand">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl border-2 border-dashed border-grape/40">
              <Plus className="size-5.5" aria-hidden="true" />
            </span>
            Add a pet
          </Link>
        </Card>
      </section>

      <section aria-labelledby="demo-h">
        <h2 id="demo-h" className="mb-3 font-display text-[22px] font-semibold">
          Settings
        </h2>
        <Card className="divide-y divide-sand">
          <ChangePassword />
          <AccountActions />
        </Card>
        <p className="mt-3 px-1 text-sm leading-relaxed font-semibold text-muted">
          Tip: on your phone, use your browser&apos;s <strong className="text-ink">Add to Home Screen</strong> to open Pawsitive like an app.
        </p>
      </section>
    </div>
  );
}
