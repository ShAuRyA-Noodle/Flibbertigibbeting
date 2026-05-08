/**
 * Append-only audit log for every AI call.
 *
 * v0 implementation: JSON-lines on disk under .solpop-audit/<yyyy-mm-dd>.jsonl.
 * Same shape as the future Drizzle `audit_log` table, so the swap is trivial.
 *
 * Records what the call WAS (provider/model/promptHash/payloadHash), not the
 * raw payload, so logs stay small and don't leak user images/PII.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const DIR = path.join(process.cwd(), ".solpop-audit");

export type AuditEntry = {
  id: string;
  createdAt: number;
  orgId: string | null;
  userId: string | null;
  /** What happened. e.g. "vision.analyze", "synthesis.report", "share.create" */
  action: string;
  /** Optional target — panel id, inspection id, share id, etc. */
  targetType: string | null;
  targetId: string | null;
  /** Hash of the request payload (or relevant subset). NOT the payload itself. */
  payloadHash: string | null;
  /** Pinned model version reference id, if AI was involved. */
  modelVersionId: string | null;
  /** End-to-end latency in ms, if known at log time. */
  latencyMs: number | null;
  /** Outcome: "ok" | "error". */
  status: "ok" | "error";
  /** Optional short error message. Truncated to 500 chars. */
  error: string | null;
  /** Free-form metadata, JSON-serializable. Kept tight. */
  meta: Record<string, unknown> | null;
};

export type AuditInput = Omit<AuditEntry, "id" | "createdAt"> & {
  id?: string;
  createdAt?: number;
};

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}

function dailyFile(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return path.join(DIR, `${y}-${m}-${day}.jsonl`);
}

export async function audit(input: AuditInput): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: input.id ?? `aud_${randomUUID().slice(0, 14)}`,
    createdAt: input.createdAt ?? Date.now(),
    orgId: input.orgId ?? null,
    userId: input.userId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    payloadHash: input.payloadHash ?? null,
    modelVersionId: input.modelVersionId ?? null,
    latencyMs: input.latencyMs ?? null,
    status: input.status ?? "ok",
    error: input.error ? input.error.slice(0, 500) : null,
    meta: input.meta ?? null,
  };
  try {
    await ensureDir();
    await fs.appendFile(dailyFile(), JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    // Audit failures are NEVER fatal to the request flow.
    console.error("[audit] write failed:", e instanceof Error ? e.message : String(e));
  }
  return entry;
}

/**
 * Wrap an async fn with timing + audit logging. Logs once with the resolved
 * outcome. Re-throws on error so the caller's flow is unchanged.
 */
export async function withAudit<T>(
  base: Omit<AuditInput, "status" | "error" | "latencyMs">,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await fn();
    void audit({ ...base, status: "ok", latencyMs: Date.now() - t0, error: null });
    return out;
  } catch (e) {
    void audit({
      ...base,
      status: "error",
      latencyMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export function hashJson(payload: unknown): string {
  const s = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 32);
}
