import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { todayISO } from "@/lib/dates";
import * as schema from "./schema";
import { SEED_VERSION, seedDemo } from "./seed";

export type Db = LibSQLDatabase<typeof schema>;

// Turso in production; a local SQLite file otherwise. On Vercel without Turso
// the only writable place is /tmp, which works but resets on cold starts.
//
// The Vercel Turso integration names its variables after a chosen prefix
// (TURSO_DATABASE_URL, TURSO_URL, STORAGE_URL…), so accept any libsql:// URL
// and the token that shares its prefix.
function tursoConfig(): { url: string; authToken?: string } | null {
  const env = process.env;
  const urlKey =
    ["TURSO_DATABASE_URL", "TURSO_URL", "STORAGE_URL", "DATABASE_URL"].find((k) => env[k]?.startsWith("libsql://")) ??
    Object.keys(env).find((k) => k.endsWith("_URL") && env[k]?.startsWith("libsql://"));
  if (!urlKey) return null;
  const prefix = urlKey.replace(/_(DATABASE_)?URL$/, "");
  const authToken = env[`${prefix}_AUTH_TOKEN`] ?? env[`${prefix}_TOKEN`] ?? env[`${prefix}_DATABASE_AUTH_TOKEN`] ?? env.TURSO_AUTH_TOKEN;
  return { url: env[urlKey]!, authToken };
}

function databaseUrl(): string {
  const turso = tursoConfig();
  if (turso) return turso.url;
  if (process.env.VERCEL) return "file:/tmp/pawsitive.db";
  return "file:local.db";
}

interface DbState {
  client: Client;
  db: Db;
  setup: Promise<void> | null;
  resetting: Promise<void> | null;
  seededOn: string | null;
  schemaVersion?: string;
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { pawsitiveDb?: DbState };

function state(): DbState {
  if (!globalForDb.pawsitiveDb) {
    const client = createClient({ url: databaseUrl(), authToken: tursoConfig()?.authToken });
    globalForDb.pawsitiveDb = { client, db: drizzle({ client, schema }), setup: null, resetting: null, seededOn: null };
  }
  return globalForDb.pawsitiveDb;
}

// The stored version includes a fingerprint of the table SQL, so any change to
// the layout rebuilds the tables, even if SCHEMA_VERSION wasn't bumped (or was
// bumped mid-edit during a hot reload).
function layoutVersion(): string {
  let h = 0;
  for (const ch of schema.CREATE_TABLES_SQL.join(";")) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return `${schema.SCHEMA_VERSION}:${(h >>> 0).toString(36)}`;
}

async function setup(s: DbState) {
  if (databaseUrl().startsWith("file:")) {
    // Wait for a busy database instead of failing, and let reads run while a
    // write is in progress.
    await s.client.execute("PRAGMA busy_timeout = 5000");
    await s.client.execute("PRAGMA journal_mode = WAL");
  }
  await s.client.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const version = await s.client.execute("SELECT value FROM meta WHERE key = 'schema_version'");
  if (version.rows[0]?.value !== layoutVersion()) {
    // New table layout: rebuild everything in one atomic batch (demo data only).
    await s.client.batch(
      [
        ...schema.TABLES.map((t) => `DROP TABLE IF EXISTS ${t}`),
        ...schema.CREATE_TABLES_SQL,
        "DELETE FROM meta WHERE key = 'seeded_on'",
        {
          sql: "INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          args: [layoutVersion()],
        },
      ],
      "write",
    );
  } else {
    for (const sql of schema.CREATE_TABLES_SQL) await s.client.execute(sql);
  }
  const row = await s.client.execute("SELECT value FROM meta WHERE key = 'seeded_on'");
  s.seededOn = (row.rows[0]?.value as string | undefined) ?? null;
}

// The demo data is reloaded once per day (so "today" on the floor board is
// always today) and whenever the table layout changes.
const seedStamp = () => `${todayISO()}#v${layoutVersion()}#s${SEED_VERSION}`;

/** The database, ready to query. */

export async function getDb(): Promise<Db> {
  const s = state();
  // Re-run setup if the table layout changed while the server was running
  // (hot reload keeps this state object, so setup wouldn't run again otherwise).
  if (s.schemaVersion !== layoutVersion()) {
    s.schemaVersion = layoutVersion();
    s.setup = setup(s);
  }
  s.setup ??= setup(s);
  await s.setup;
  if (s.seededOn !== seedStamp()) {
    s.setup = resetDemo();
    await s.setup;
  }
  return s.db;
}

/** Reloads the demo data. Overlapping calls share one reload instead of racing. */
export function resetDemo(): Promise<void> {
  const s = state();
  s.resetting ??= (async () => {
    const stamp = seedStamp();
    // Not wrapped in db.transaction(): on a local file that opens a second
    // connection, which locks out every other request until the reseed ends.
    await seedDemo(s.db);
    await s.client.execute({
      sql: "INSERT INTO meta (key, value) VALUES ('seeded_on', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      args: [stamp],
    });
    s.seededOn = stamp;
  })().finally(() => {
    s.resetting = null;
  });
  return s.resetting;
}
