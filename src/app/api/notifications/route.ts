import { countNewUpdates, latestUnread } from "@/db/queries";
import { sendDueReminders } from "@/db/reminders";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Unread count for the owner's Updates badge, polled by the tab bar on every screen. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") return Response.json({ unread: 0, latest: null }, { status: 401 });
  // Polling doubles as the "scheduler": reminders that are due go out now.
  await sendDueReminders();
  const [unread, latest] = await Promise.all([countNewUpdates(user.id), latestUnread(user.id)]);
  return Response.json({ unread, latest }, { headers: { "Cache-Control": "no-store" } });
}
