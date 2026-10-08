import { Stethoscope, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ChatComposer } from "@/components/ChatComposer";
import { ChatThread } from "@/components/ChatThread";
import { MarkSeen } from "@/components/MarkSeen";
import { PetPhoto } from "@/components/ui";
import { getOwnerChat } from "@/db/queries";
import type { Channel } from "@/db/schema";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Updates" };

export default async function InboxPage(props: PageProps<"/my/inbox">) {
  const user = await requireRole("parent");
  const { pet: petParam, c } = await props.searchParams;
  const channel: Channel = c === "vet" ? "vet" : "team";
  const { pets, pet, thread, unread, lastVet } = await getOwnerChat(user.id, typeof petParam === "string" ? petParam : undefined, channel);

  if (!pet) {
    return <p className="py-16 text-center font-semibold text-muted">Add a pet to start chatting with our team.</p>;
  }
  const here = `/my/inbox?pet=${pet.id}`;
  const unreadHere = unread[`${pet.id} ${channel}`] ?? 0;

  return (
    <>
      <AutoRefresh seconds={5} />
      <MarkSeen petId={pet.id} channel={channel} unread={unreadHere} />
      {/* A full-screen chat between the app bar and the tab bar. */}
      <section
        aria-label={`Chat about ${pet.name}`}
        className="fixed inset-x-0 top-[calc(64px+env(safe-area-inset-top))] bottom-[calc(65px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[430px] flex-col overflow-hidden bg-cream"
      >
        <h1 className="sr-only">Chat about {pet.name}</h1>
        <header className="flex flex-col gap-3 bg-white px-3.5 pt-3 pb-3 shadow-[0_1px_0_var(--color-sand)]">
          {/* One chat per pet: tap a face to switch. */}
          <nav aria-label="Choose a pet" className="relative -mx-3.5 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none]">
            {pets.map((p) => {
              const active = p.id === pet.id;
              const count = unread[p.id] ?? 0;
              return (
                <Link
                  key={p.id}
                  href={`/my/inbox?pet=${p.id}&c=${channel}`}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2 rounded-full border-2 py-1 pr-3.5 pl-1 text-sm font-extrabold transition ${
                    active ? "border-coral bg-coral-soft" : "border-line bg-white"
                  }`}
                >
                  <PetPhoto src={p.photo} alt="" className="size-8 rounded-full" sizes="32px" />
                  {p.name}
                  {count > 0 && !active && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] text-ink">{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div role="tablist" aria-label="Who to chat with" className="grid grid-cols-2 gap-1 rounded-full bg-cream p-1">
            {(
              [
                ["team", "Pawsitive team", Users],
                ["vet", "Vet team", Stethoscope],
              ] as const
            ).map(([id, label, Icon]) => {
              const active = id === channel;
              const count = unread[`${pet.id} ${id}`] ?? 0;
              return (
                <Link
                  key={id}
                  role="tab"
                  aria-selected={active}
                  href={`${here}&c=${id}`}
                  className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full text-sm font-extrabold transition ${
                    active ? "bg-white text-ink shadow-card" : "text-muted"
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" /> {label}
                  {count > 0 && !active && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] text-ink">{count}</span>
                  )}
                </Link>
              );
            })}
          </div>
          <p className="text-center text-xs font-bold text-muted">
            {channel === "team"
              ? `Updates, photos and questions about ${pet.name}'s stays and grooming`
              : `Health questions for our vets${lastVet ? ` · ${pet.name} last saw ${lastVet.name}` : ""}`}
          </p>
        </header>

        <ChatThread
          thread={thread}
          pet={pet}
          viewer="owner"
          empty={channel === "team" ? `No messages about ${pet.name} yet. Say hi to the team!` : `Ask our vets anything about ${pet.name}'s health.`}
        />

        <ChatComposer
          key={`${pet.id}-${channel}`}
          petId={pet.id}
          channel={channel}
          placeholder={channel === "team" ? `Message the team about ${pet.name}` : `Ask the vets about ${pet.name}`}
        />
      </section>
    </>
  );
}
