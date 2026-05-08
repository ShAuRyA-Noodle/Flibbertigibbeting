/**
 * Run pending migrations on demand.
 *
 * Called once at server boot from any module that needs the DB to be ready.
 * Idempotent — Drizzle's migrator tracks applied migrations in a metadata table.
 */

import path from "node:path";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { db, isPostgres } from "./index";

declare global {
  // eslint-disable-next-line no-var
  var __solpop_migrated__: boolean | undefined;
}

let migrationPromise: Promise<void> | undefined;

export function ensureMigrated(): Promise<void> {
  if (globalThis.__solpop_migrated__) return Promise.resolve();
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    if (isPostgres()) {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      await migrate(db as unknown as PostgresJsDatabase, { migrationsFolder });
    } else {
      const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
      migrate(db as unknown as BetterSQLite3Database, { migrationsFolder });
    }
    globalThis.__solpop_migrated__ = true;
  })();

  return migrationPromise;
}
