import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { Role } from "@/db/schema";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginPanel } from "@/components/auth/LoginPanel";
import { QuickDemo } from "@/components/auth/QuickDemo";
import { demoDoctors } from "@/components/auth/demoDoctors";
import { getCurrentUser, homeFor } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

const ROLES: Role[] = ["parent", "staff", "vet", "admin"];

/** The single sign-in screen for every role. `?as=` only reorders the quick demo list. */
export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const { as } = await props.searchParams;
  const first = ROLES.find((r) => r === as) ?? "parent";
  const doctors = await demoDoctors();

  return (
    <AuthShell title="Welcome to Pawsitive" subtitle="Sign in with your email and password.">
      <LoginPanel />
      <QuickDemo doctors={doctors} first={first} />
    </AuthShell>
  );
}
