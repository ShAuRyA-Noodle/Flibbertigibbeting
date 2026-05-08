import { and, eq, lt } from "drizzle-orm";
import { db } from "./db";
import { newId } from "./db/id";
import { ensureMigrated } from "./db/migrate";
import { shares } from "./db/schema";
import type { FullAnalysis } from "./schema";

/**
 * DB-backed share store. Replaces the previous filesystem implementation.
 * Public API (writeShare / readShare / newShareId) is unchanged so existing
 * route handlers continue to work without modification.
 */

const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SharePayload = {
  id: string;
  createdAt: number;
  data: FullAnalysis;
  /** Smallish thumbs only: keys are sourceFileName, values are data URLs */
  sourceThumbnails: Record<string, string>;
  label?: string;
};

type StoredShape = {
  data: FullAnalysis;
  sourceThumbnails: Record<string, string>;
  label?: string;
};

export async function writeShare(payload: SharePayload): Promise<void> {
  await ensureMigrated();
  const stored: StoredShape = {
    data: payload.data,
    sourceThumbnails: payload.sourceThumbnails,
    label: payload.label,
  };
  await db.insert(shares).values({
    id: payload.id,
    payloadJson: JSON.stringify(stored),
    createdAt: payload.createdAt,
    expiresAt: payload.createdAt + TTL_MS,
  });
}

export async function readShare(id: string): Promise<SharePayload | null> {
  // Conservative input validation — share IDs come from newShareId() below.
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) return null;

  await ensureMigrated();
  const now = Date.now();

  const rows = await db
    .select()
    .from(shares)
    .where(eq(shares.id, safe))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt < now) {
    // Expired — best-effort GC and return null.
    await db
      .delete(shares)
      .where(and(eq(shares.id, safe), lt(shares.expiresAt, now)))
      .catch(() => undefined);
    return null;
  }

  let parsed: StoredShape;
  try {
    parsed = JSON.parse(row.payloadJson) as StoredShape;
  } catch {
    return null;
  }

  return {
    id: row.id,
    createdAt: row.createdAt,
    data: parsed.data,
    sourceThumbnails: parsed.sourceThumbnails ?? {},
    label: parsed.label,
  };
}

export function newShareId(): string {
  // Strip the "share_" prefix from newId so callers/URLs stay short and the
  // existing /r/<id> route + URL regex (alphanumeric + - + _) still matches.
  return newId("share").slice("share_".length);
}
