import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { sessions, users, type Role, type User } from "@/db/schema";
import { nowStamp } from "./dates";

// Real sign-in: email + password (scrypt-hashed), and a random session token
// in an http-only cookie. The "quick demo login" buttons create the same kind
// of session for the sample accounts, so visitors can try every role.
const COOKIE = "pawsitive_session";
const SESSION_DAYS = 7;

/** Sample accounts behind the quick demo login (all use the password demo1234). */
export const DEMO_ACCOUNTS: Record<Role, string> = {
  staff: "u_ana",
  admin: "u_jo",
  parent: "u_priya",
  vet: "u_vet_leo",
};
export const DEMO_PASSWORD = "demo1234";

/** Everyone uses the same sign-in screen; this preselects their role. */
export const LOGIN_PATH: Record<Role, string> = {
  parent: "/login",
  staff: "/login?as=staff",
  vet: "/login?as=vet",
  admin: "/login?as=admin",
};

export function homeFor(role: Role): string {
  if (role === "parent") return "/my";
  if (role === "vet") return "/doctor";
  if (role === "admin") return "/requests";
  return "/board";
}

const stampIn = (days: number) => nowStamp(new Date(Date.now() + days * 86_400_000));

export async function signInAs(userId: string) {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ id: token, userId, createdAt: nowStamp(), expiresAt: stampIn(SESSION_DAYS) });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  jar.delete(COOKIE);
}

/** The signed-in user, or null. Cached for the length of one request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, nowStamp())));
  return row?.user ?? null;
});

/**
 * The signed-in user if their role is allowed here. Otherwise: not signed in →
 * the sign-in page for this area; signed in with another role → their own home.
 */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH[roles[0]]);
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
