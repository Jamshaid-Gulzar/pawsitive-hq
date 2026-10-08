import { UserPlus } from "lucide-react";
import Link from "next/link";
import { SignInForm } from "./SignInForm";

/**
 * One sign-in for everyone. The account decides where you land: customers in
 * the app, staff on the floor board, doctors on their day, the admin on requests.
 */
export function LoginPanel() {
  return (
    <div className="flex flex-col gap-5">
      <SignInForm portal="any" />
      <Link
        href="/register"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-lilac/40 font-extrabold text-lilac-ink transition hover:bg-lilac-soft"
      >
        <UserPlus className="size-4.5" aria-hidden="true" /> New pet parent? Create an account
      </Link>
    </div>
  );
}
