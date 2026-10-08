"use client";

import { useEffect } from "react";
import { markPayoutsSeen } from "@/app/actions";

/** Opening the earnings page clears the "payout credited" notice. */
export function MarkPayoutsSeen() {
  useEffect(() => {
    const t = setTimeout(() => void markPayoutsSeen(), 2500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
