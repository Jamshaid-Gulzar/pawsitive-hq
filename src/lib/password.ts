import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Password hashing with Node's built-in scrypt: no extra service or package.
// Stored as "scrypt$<salt hex>$<hash hex>".

const KEY_LEN = 32;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string, salt: Buffer = randomBytes(16)): Promise<string> {
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, saltHex, hashHex] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const key = await derive(password, Buffer.from(saltHex, "hex"));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Basic rules shown on the register form too. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 128) return "That password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use letters and at least one number.";
  return null;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
