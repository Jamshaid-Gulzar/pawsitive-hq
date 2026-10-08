import { Stethoscope } from "lucide-react";
import { VET_COLORS } from "@/lib/vet";

/** Initials on the vet's colour, with a small stethoscope badge. */
export function VetAvatar({ name, color, size = "size-14", text = "text-lg" }: { name: string; color: string; size?: string; text?: string }) {
  const initials = name
    .replace(/^Dr\.?\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  const tone = VET_COLORS[color] ?? VET_COLORS.mint;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${size} ${text} ${tone.avatar}`}>
      {initials}
      <span className="absolute -right-0.5 -bottom-0.5 inline-flex size-[38%] items-center justify-center rounded-full border-2 border-white bg-white text-ink">
        <Stethoscope className="size-[70%]" aria-hidden="true" />
      </span>
    </span>
  );
}
