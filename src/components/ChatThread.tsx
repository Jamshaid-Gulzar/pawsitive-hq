import { ArrowRight, Stethoscope } from "lucide-react";
import Link from "next/link";
import type { Message, Pet } from "@/db/schema";
import { MOODS } from "@/lib/care";
import { formatStamp, formatTime } from "@/lib/dates";
import { PawIcon, PetPhoto } from "./ui";

/**
 * A pet's conversation. `viewer` decides which side is "me": the owner sees
 * their own messages on the right; staff and doctors see the facility's.
 */
export function ChatThread({ thread, pet, viewer, empty }: { thread: Message[]; pet: Pet; viewer: "owner" | "facility"; empty: string }) {
  if (thread.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm font-semibold text-muted">
        <PawIcon className="size-8 text-coral" />
        {empty}
      </div>
    );
  }
  return (
    <ol className="flex flex-1 flex-col-reverse gap-2.5 overflow-y-auto px-3.5 py-4">
      {[...thread].reverse().map((m) => {
        const mine = viewer === "owner" ? m.author === "parent" : m.author !== "parent" && m.author !== "system";
        // Plain chat lines are bubbles; photo updates, reports and automatic notices are cards.
        const rich = !!m.title || !!m.photo || m.author === "system";
        if (!rich) {
          return (
            <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              {(!mine || viewer === "facility") && (
                <span className={`inline-flex items-center gap-1 px-1 text-[11px] font-extrabold ${m.author === "vet" ? "text-mint-ink" : "text-muted"}`}>
                  {m.author === "vet" && <Stethoscope className="size-3.5" aria-hidden="true" />}
                  {m.authorName ?? "Owner"}
                  {m.author === "staff" ? " · Pawsitive team" : m.author === "parent" && viewer === "facility" ? " · Owner" : ""}
                </span>
              )}
              <div
                className={`max-w-[78%] px-3.5 py-2.5 text-[15px] leading-snug whitespace-pre-line ${
                  mine ? "rounded-[20px_20px_6px_20px] bg-grape text-white" : "rounded-[20px_20px_20px_6px] bg-white shadow-[0_2px_8px_rgb(27_31_59/0.06)]"
                }`}
              >
                {m.body}
              </div>
              <span className="text-[11px] font-bold text-faint">{formatStamp(m.createdAt)}</span>
            </li>
          );
        }
        const mood = MOODS.find((x) => x.id === m.mood);
        return (
          <li key={m.id} className="flex flex-col items-start gap-1">
            {m.author === "system" && <span className="px-1 text-[11px] font-extrabold text-muted">Pawsitive HQ · automatic</span>}
            <div className="max-w-[88%] overflow-hidden rounded-[22px_22px_22px_6px] bg-white shadow-[0_4px_14px_rgb(27_31_59/0.08)]">
              {m.photo && (
                <div className="relative">
                  <PetPhoto src={m.photo} alt={`Photo of ${pet.name}`} className="h-52 w-full" sizes="340px" />
                  {m.author === "staff" && m.title && (
                    <span className="absolute top-2.5 left-2.5 rounded-full bg-sun px-2.5 py-1 text-xs font-extrabold">Pawsitive Update</span>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2 px-3.5 py-3">
                {m.title && <div className="font-display text-[17px] font-semibold text-grape">{m.title}</div>}
                <p className="text-[15px] leading-normal whitespace-pre-line">{m.body}</p>
                {(mood || m.tags.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {mood && <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${mood.soft} ${mood.ink}`}>Mood: {mood.id}</span>}
                    {m.tags.map((t) => (
                      <span key={t} className="rounded-full bg-mint-soft px-2.5 py-1 text-xs font-extrabold text-mint-ink">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {m.linkHref && m.linkLabel && viewer === "owner" && (
                  <Link
                    href={m.linkHref}
                    // Maps and PDFs open in their own app / tab.
                    {...(/^https?:|^\/api\//.test(m.linkHref) ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="mt-1 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-grape-soft px-4 text-sm font-extrabold text-grape active:bg-lilac-soft"
                  >
                    {m.linkLabel} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                )}
                {m.author === "staff" && m.title && m.authorName && (
                  <div className="text-xs font-bold text-muted">
                    From {m.authorName} · {formatTime(m.createdAt.slice(11, 16))}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[11px] font-bold text-faint">{formatStamp(m.createdAt)}</span>
          </li>
        );
      })}
    </ol>
  );
}
