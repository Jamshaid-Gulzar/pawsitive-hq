import { Check, Lock, X } from "lucide-react";
import type { ReactNode } from "react";
import { formatStamp } from "@/lib/dates";
import type { TimelineStep } from "@/lib/timeline";

/** Vertical live timeline: done steps in green, the current one pulsing. */
export function Timeline({ steps, extra }: { steps: TimelineStep[]; extra?: Record<string, ReactNode> }) {
  return (
    <ol className="relative flex flex-col">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const badge =
          s.state === "done" ? (
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-mint text-white">
              <Check className="size-4.5" strokeWidth={3} aria-hidden="true" />
            </span>
          ) : s.state === "current" ? (
            <span className="relative inline-flex size-8 items-center justify-center rounded-full bg-coral">
              <span className="absolute inset-0 animate-ping rounded-full bg-coral/50 motion-reduce:animate-none" />
              <span className="relative size-3 rounded-full bg-white" />
            </span>
          ) : s.state === "blocked" ? (
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-rose text-white">
              <Lock className="size-4" aria-hidden="true" />
            </span>
          ) : s.state === "declined" ? (
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-ink text-white">
              <X className="size-4.5" strokeWidth={3} aria-hidden="true" />
            </span>
          ) : (
            <span className="inline-flex size-8 items-center justify-center rounded-full border-2 border-line bg-white" />
          );
        return (
          <li key={s.key} className="relative flex gap-3.5 pb-5 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
            {!last && (
              <span
                className={`absolute top-8 bottom-0 left-[15px] w-0.5 ${s.state === "done" ? "bg-mint" : "bg-line"}`}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 shrink-0">{badge}</span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span
                  className={`font-display text-[17px] leading-tight font-semibold ${
                    s.state === "upcoming" ? "text-faint" : s.state === "blocked" ? "text-rose-ink" : s.state === "current" ? "text-coral-ink" : ""
                  }`}
                >
                  {s.title}
                </span>
                {s.at && <span className="text-xs font-bold text-faint">{formatStamp(s.at)}</span>}
              </div>
              {s.detail && <p className={`mt-0.5 text-sm font-semibold ${s.state === "upcoming" ? "text-faint" : "text-muted"}`}>{s.detail}</p>}
              {s.state === "current" && <span className="sr-only">In progress</span>}
              {extra?.[s.key]}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
