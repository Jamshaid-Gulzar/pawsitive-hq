import type { Metadata } from "next";
import { InboxScreen } from "@/components/InboxScreen";
import { getConversations, getThread } from "@/db/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Patient messages" };

export default async function DoctorMessagesPage(props: PageProps<"/doctor/messages">) {
  const user = await requireRole("vet");
  const { pet } = await props.searchParams;
  const conversations = await getConversations({ channel: "vet", vetId: user.vetId ?? "" });
  const petId = typeof pet === "string" ? pet : conversations[0]?.pet.id;
  const open = petId && conversations.some((c) => c.pet.id === petId) ? await getThread(petId, "vet") : null;

  return (
    <InboxScreen
      base="/doctor/messages"
      conversations={conversations}
      open={open}
      channel="vet"
      filter="vet"
      showFilter={false}
      title="Patient messages"
      subtitle="Vet chats with the families of your patients. The front desk sees these too."
    />
  );
}
