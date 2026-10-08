"use client";

import { LoaderCircle, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { sendChatMessage } from "@/app/actions";
import type { Channel } from "@/db/schema";

/** The message box under a chat. Used by owners, staff, the admin and doctors. */
export function ChatComposer({ petId, channel, placeholder }: { petId: string; channel: Channel; placeholder: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-1.5 bg-white px-3.5 pt-3 pb-3 shadow-[0_-1px_0_var(--color-sand)]"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await sendChatMessage(petId, channel, text);
          if (r.ok) setText("");
          else setError(r.error);
        });
      }}
    >
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            maxLength={1000}
            className="min-h-11.5 w-full rounded-full border-2 border-line bg-cream px-4.5 text-[15px]"
          />
        </label>
        <button
          type="submit"
          aria-label="Send"
          disabled={pending || !text.trim()}
          className="inline-flex size-11.5 shrink-0 items-center justify-center rounded-full bg-coral text-ink transition hover:brightness-95 disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
