"use client";

import { LogOut, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { resetDemoData } from "@/app/actions";
import { switchRole } from "@/lib/leave";

export function DemoControls({ dark = false }: { dark?: boolean }) {
  const [pending, startTransition] = useTransition();
  const btn = `inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${
    dark ? "text-[#d5d7ea] hover:bg-ink-2" : "text-ink hover:bg-sand"
  }`;
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className={btn}
        disabled={pending}
        onClick={() => {
          if (confirm("Reset all demo data back to the start?")) startTransition(() => resetDemoData());
        }}
      >
        <RotateCcw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
        {pending ? "Resetting…" : "Reset demo"}
      </button>
      <button type="button" className={btn} onClick={() => startTransition(() => switchRole())}>
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
