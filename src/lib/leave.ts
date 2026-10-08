// Browser-only: sign out, then load the sign-in page in the top-level window.
import { endSession } from "@/app/actions";

export async function switchRole() {
  await endSession();
  (window.top ?? window).location.href = "/";
}
