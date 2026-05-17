import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { FullAnalysis } from "./schema";

export type SessionRecord = {
  id: string;
  createdAt: number;
  label: string;
  panelCount: number;
  criticalCount: number;
  highCount: number;
  fleetHealthScore: number;
  fleetEfficiencyLossPct: number;
  /** Hero thumbnail (data URL, ~600px wide). */
  thumbnail: string;
  /** Full analysis payload (panels + system report). */
  data: FullAnalysis;
  /** Original-source thumbnails keyed by sourceFileName, used to render overview cards on detail page. */
  sourceThumbnails: Record<string, string>;
};

interface SolpopDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { byCreatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<SolpopDB>> | null = null;

function db() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB unavailable in this environment");
  }
  if (!dbPromise) {
    dbPromise = openDB<SolpopDB>("solpop", 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("sessions")) {
          const store = d.createObjectStore("sessions", { keyPath: "id" });
          store.createIndex("byCreatedAt", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSession(record: SessionRecord) {
  const d = await db();
  await d.put("sessions", record);
}

export async function getSession(id: string): Promise<SessionRecord | null> {
  const d = await db();
  return (await d.get("sessions", id)) ?? null;
}

export async function listSessions(): Promise<SessionRecord[]> {
  const d = await db();
  const all = await d.getAllFromIndex("sessions", "byCreatedAt");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSession(id: string) {
  const d = await db();
  await d.delete("sessions", id);
}

export async function clearSessions() {
  const d = await db();
  await d.clear("sessions");
}

export function newSessionId(): string {
  return `s-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}
