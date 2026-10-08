import { MessagesSquare, Stethoscope, Users } from "lucide-react";
import Link from "next/link";
import type { Conversation, getThread } from "@/db/queries";
import type { Channel } from "@/db/schema";
import { formatStamp } from "@/lib/dates";
import { AutoRefresh } from "./AutoRefresh";
import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
import { MarkSeen } from "./MarkSeen";
import { Card, PetPhoto, Pill } from "./ui";

/**
 * The facility side of pet chats: every conversation on the left, the open
 * one on the right. Staff and the admin see both channels; doctors the vet one.
 */
export function InboxScreen({
  base,
  conversations,
  open,
  channel,
  filter,
  showFilter,
  title,
  subtitle,
}: {
  base: string;
  conversations: Conversation[];
  open: NonNullable<Awaited<ReturnType<typeof getThread>>> | null;
  channel: Channel;
  filter: "all" | Channel;
  showFilter: boolean;
  title: string;
  subtitle: string;
}) {
  const shown = conversations.filter((c) => filter === "all" || c.channel === filter);
  const openUnread = open ? (conversations.find((c) => c.pet.id === open.pet.id && c.channel === channel)?.unread ?? 0) : 0;

  return (
    <>
      <AutoRefresh seconds={6} />
      {open && <MarkSeen petId={open.pet.id} channel={channel} unread={openUnread} />}
      <h1 className="font-display text-[38px] font-semibold">{title}</h1>
      <p className="mt-1.5 mb-6 font-semibold text-muted">{subtitle}</p>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Conversations" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 lg:max-w-[400px]">
          {showFilter && (
            <div role="tablist" aria-label="Filter" className="grid grid-cols-3 gap-1 rounded-full bg-white p-1 shadow-card">
              {(
                [
                  ["all", "All"],
                  ["team", "Team"],
                  ["vet", "Vet"],
                ] as const
              ).map(([id, label]) => (
                <Link
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  href={`${base}?f=${id}${open ? `&pet=${open.pet.id}&c=${channel}` : ""}`}
                  className={`inline-flex min-h-10 items-center justify-center rounded-full text-sm font-extrabold ${filter === id ? "bg-ink text-white" : "text-muted"}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
          {shown.length === 0 ? (
            <Card className="p-8 text-center font-semibold text-muted">No conversations yet.</Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((c) => {
                const active = open?.pet.id === c.pet.id && channel === c.channel;
                return (
                  <li key={`${c.pet.id}-${c.channel}`}>
                    <Link
                      href={`${base}?f=${filter}&pet=${c.pet.id}&c=${c.channel}`}
                      aria-current={active ? "true" : undefined}
                      className={`flex items-center gap-3 rounded-[20px] p-3 transition ${
                        active ? "bg-ink text-white" : "bg-white shadow-card hover:-translate-y-0.5"
                      }`}
                    >
                      <span className="relative shrink-0">
                        <PetPhoto src={c.pet.photo} alt="" className="size-12 rounded-2xl" sizes="48px" />
                        <span
                          className={`absolute -right-1 -bottom-1 inline-flex size-6 items-center justify-center rounded-full border-2 ${
                            active ? "border-ink" : "border-white"
                          } ${c.channel === "vet" ? "bg-mint text-white" : "bg-coral text-ink"}`}
                        >
                          {c.channel === "vet" ? <Stethoscope className="size-3.5" aria-hidden="true" /> : <Users className="size-3.5" aria-hidden="true" />}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <strong className="truncate">
                            {c.pet.name} <span className={`text-xs font-bold ${active ? "text-[#d5d7ea]" : "text-muted"}`}>· {c.pet.owner.name}</span>
                          </strong>
                          <span className={`shrink-0 text-[11px] font-bold ${active ? "text-[#d5d7ea]" : "text-faint"}`}>{formatStamp(c.last.createdAt)}</span>
                        </span>
                        <span className={`block truncate text-sm ${c.unread ? "font-extrabold" : active ? "text-[#d5d7ea]" : "text-muted"}`}>
                          {c.last.author === "parent" ? `${c.last.authorName ?? "Owner"}: ` : ""}
                          {c.last.body}
                        </span>
                      </span>
                      {c.unread > 0 && !active && <Pill className="bg-coral text-ink">{c.unread}</Pill>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          aria-label={open ? `Chat about ${open.pet.name}` : "Chat"}
          className="flex h-[min(760px,calc(100vh-140px))] min-w-0 flex-[999_1_480px] flex-col overflow-hidden rounded-[28px] bg-cream shadow-card"
        >
          {open ? (
            <>
              <header className="flex items-center gap-3 bg-white px-5 py-3.5 shadow-[0_1px_0_var(--color-sand)]">
                <PetPhoto src={open.pet.photo} alt="" className="size-11 rounded-full" sizes="44px" />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-lg font-semibold">
                    {open.pet.name} · {channel === "vet" ? "Vet chat" : "Team chat"}
                  </div>
                  <div className="text-sm font-semibold text-muted">
                    {open.pet.owner.name}
                    {open.pet.owner.phone ? ` · ${open.pet.owner.phone}` : ""} · {open.pet.breed}
                  </div>
                </div>
              </header>
              <ChatThread thread={open.thread} pet={open.pet} viewer="facility" empty="No messages yet." />
              <ChatComposer
                key={`${open.pet.id}-${channel}`}
                petId={open.pet.id}
                channel={channel}
                placeholder={`Reply to ${open.pet.owner.name.split(" ")[0]} about ${open.pet.name}`}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center font-semibold text-muted">
              <MessagesSquare className="size-10 text-faint" aria-hidden="true" />
              Choose a conversation
            </div>
          )}
        </section>
      </div>
    </>
  );
}
