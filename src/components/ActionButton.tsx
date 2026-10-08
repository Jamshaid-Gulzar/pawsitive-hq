"use client";

import { LoaderCircle } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/app/actions";

/**
 * A button that runs a server action, shows a spinner while it works, and
 * shows the error underneath if it fails.
 */
export function ActionButton({
  action,
  className,
  children,
  pendingLabel,
}: {
  action: () => Promise<ActionResult | void>;
  className: string;
  children: ReactNode;
  pendingLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await action();
            if (result && !result.ok) setError(result.error);
          })
        }
        className={`inline-flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-70 ${className}`}
      >
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {error && (
        <p role="alert" className="text-sm font-bold text-rose-ink">
          {error}
        </p>
      )}
    </div>
  );
}
