/**
 * Single import entry for the data layer.
 *
 * Selects driver from DATABASE_URL:
 *   - postgres:// or postgresql://  -> drizzle-orm/postgres-js
 *   - anything else (or unset)      -> drizzle-orm/better-sqlite3 against ./solpop.db
 *
 * The schema in ./schema.ts is authored against drizzle-orm/sqlite-core; the
 * postgres swap path stays runtime-compatible because the column types we use
 * (text/integer/real) round-trip across both dialects, and the query builder
 * surface our app calls (insert/select/update/delete with eq/and/lt/etc.) is
 * dialect-agnostic. When a real postgres deploy is required we can either keep
 * sqlite-core (drizzle's pg adapter accepts equivalent SQL via the migrator
 * output, regenerated under `dialect: "postgresql"`) or fork ./schema.ts into
 * a pg-core variant — neither change touches consumer code.
 */

import path from "node:path";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

declare global {
  // Cache across HMR reloads so we don't open a new sqlite handle per request.
  // eslint-disable-next-line no-var
  var __solpop_db__: DB | undefined;
}

function isPostgresUrl(url: string | undefined): url is string {
  return !!url && (url.startsWith("postgres://") || url.startsWith("postgresql://"));
}

function buildDb(): DB {
  const url = process.env.DATABASE_URL;
  if (isPostgresUrl(url)) {
    // Lazy require so postgres driver isn't loaded in sqlite-only sessions.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/postgres-js") as typeof import("drizzle-orm/postgres-js");
    // postgres ships as `export = postgres` (CJS), so require() returns the
    // callable factory directly — no `.default` indirection.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres") as typeof import("postgres");
    const client = postgres(url, { max: 5, prepare: false });
    // Cast: schema is authored sqlite-core; consumer queries use only the
    // shared dialect-agnostic surface. When swapping for real, regenerate
    // migrations under postgresql dialect or fork the schema file.
    return drizzle(client, { schema }) as unknown as DB;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3") as typeof import("drizzle-orm/better-sqlite3");
  // better-sqlite3 ships as `export = Database` (CJS), so require() returns
  // the constructor directly — no `.default` indirection.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  const dbFile = process.env.SQLITE_PATH ?? path.join(process.cwd(), "solpop.db");
  const sqlite = new Database(dbFile);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db: DB = globalThis.__solpop_db__ ?? buildDb();
if (process.env.NODE_ENV !== "production") {
  globalThis.__solpop_db__ = db;
}

export { schema };
export function isPostgres(): boolean {
  return isPostgresUrl(process.env.DATABASE_URL);
}
