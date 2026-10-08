"use client";

import { useEffect } from "react";
import { markChatSeen } from "@/app/actions";
import type { Channel } from "@/db/schema";

/** Marks a chat as read once it's on screen (and again when new messages arrive). */
export function MarkSeen({ petId, channel, unread }: { petId: string; channel: Channel; unread: number }) {
  useEffect(() => {
    if (unread > 0) void markChatSeen(petId, channel);
  }, [petId, channel, unread]);
  return null;
}
