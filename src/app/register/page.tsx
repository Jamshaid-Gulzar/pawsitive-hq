import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { QuickDemo } from "@/components/auth/QuickDemo";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { demoDoctors } from "@/components/auth/demoDoctors";
import { getCurrentUser, homeFor } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const doctors = await demoDoctors();

  return (
    <AuthShell title="Join the pack" subtitle="Create your free pet parent account, then add your pets in a minute.">
      <RegisterForm />
      <p className="text-center font-semibold text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-extrabold text-grape underline">
          Sign in
        </Link>
      </p>
      <QuickDemo doctors={doctors} first="parent" />
    </AuthShell>
  );
}
