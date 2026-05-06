import { promises as fs } from "node:fs";
import path from "node:path";
import type { FullAnalysis } from "./schema";

/**
 * Server-side filesystem store for shareable read-only reports.
 * Lives at <cwd>/.solpop-shares/<id>.json. Not designed for prod-scale, fine for self-host demos.
 */

const DIR = path.join(process.cwd(), ".solpop-shares");
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export type SharePayload = {
  id: string;
  createdAt: number;
  data: FullAnalysis;
  /** Smallish thumbs only: keys are sourceFileName, values are data URLs */
  sourceThumbnails: Record<string, string>;
  label?: string;
};

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}

export async function writeShare(payload: SharePayload): Promise<void> {
  await ensureDir();
  const file = path.join(DIR, `${payload.id}.json`);
  await fs.writeFile(file, JSON.stringify(payload), "utf8");
}

export async function readShare(id: string): Promise<SharePayload | null> {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) return null;
  const file = path.join(DIR, `${safe}.json`);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs > TTL_MS) {
      // expired — delete and return null
      await fs.unlink(file).catch(() => undefined);
      return null;
    }
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as SharePayload;
  } catch {
    return null;
  }
}

export function newShareId(): string {
  // 16-char nanoid-ish, URL-safe
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 16; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}
