"use client";

import { ChevronRight, LogOut, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { resetDemoData } from "@/app/actions";
import { switchRole } from "@/lib/leave";

export function AccountActions() {
  const [pending, startTransition] = useTransition();
  const row = "flex min-h-15 w-full items-center gap-3.5 px-4 text-left font-bold transition active:bg-sand disabled:opacity-60";
  return (
    <div className="divide-y divide-sand">
      <button
        type="button"
        disabled={pending}
        className={row}
        onClick={() => {
          if (confirm("Reset all demo data back to the start?")) startTransition(() => resetDemoData());
        }}
      >
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-sun-soft text-sun-ink">
          <RotateCcw className={`size-5 ${pending ? "animate-spin" : ""}`} aria-hidden="true" />
        </span>
        <span className="flex-1">
          {pending ? "Resetting…" : "Reset demo data"}
          <span className="block text-sm font-semibold text-muted">Put every pet and booking back to the start</span>
        </span>
        <ChevronRight className="size-5 text-faint" aria-hidden="true" />
      </button>
      <button type="button" className={row} onClick={() => startTransition(() => switchRole())}>
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-lilac-soft text-lilac-ink">
          <LogOut className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1">
          Sign out
          <span className="block text-sm font-semibold text-muted">The sign-in screen has a quick demo login for every role</span>
        </span>
        <ChevronRight className="size-5 text-faint" aria-hidden="true" />
      </button>
    </div>
  );
}
