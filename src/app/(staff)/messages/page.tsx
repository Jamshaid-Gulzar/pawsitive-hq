import type { Metadata } from "next";
import { InboxScreen } from "@/components/InboxScreen";
import { getConversations, getThread } from "@/db/queries";
import type { Channel } from "@/db/schema";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Messages" };

export default async function StaffMessagesPage(props: PageProps<"/messages">) {
  await requireRole("staff", "admin");
  const { pet, c, f } = await props.searchParams;
  const channel: Channel = c === "vet" ? "vet" : "team";
  const filter = f === "team" || f === "vet" ? f : "all";
  const conversations = await getConversations();
  const first = conversations.find((x) => filter === "all" || x.channel === filter);
  const petId = typeof pet === "string" ? pet : first?.pet.id;
  const open = petId ? await getThread(petId, typeof pet === "string" ? channel : (first?.channel ?? "team")) : null;

  return (
    <InboxScreen
      base="/messages"
      conversations={conversations}
      open={open}
      channel={typeof pet === "string" ? channel : (first?.channel ?? "team")}
      filter={filter}
      showFilter
      title="Messages"
      subtitle="Every pet's chat with their family. Vet chats are shared with the doctors."
    />
  );
}
