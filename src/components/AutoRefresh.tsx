"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps a screen live by re-fetching it every few seconds while the tab is
 * visible. Polling works everywhere, including serverless hosts that can't
 * hold a socket open.
 */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
