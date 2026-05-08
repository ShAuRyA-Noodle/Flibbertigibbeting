/**
 * Central model-version registry.
 *
 * Every AI call records which model version + prompt-hash produced it. This
 * is what makes inspections reproducible and audit-trail-clean.
 *
 * When you change a prompt, the prompt_hash changes -> new model_version row
 * -> downstream reports get a different ModelVersionRef. Nothing silently
 * drifts under your feet.
 */

import { createHash } from "node:crypto";

export type ModelRole = "vision" | "synthesis" | "explain" | "detect" | "panel-gate";

export type ModelVersionRef = {
  /** Stable, human-readable id used in audit log + UI. */
  id: string;
  role: ModelRole;
  provider: "google" | "groq" | "openai" | "anthropic";
  modelName: string;
  /** SHA-256 of (system + user) prompt template, first 16 hex chars. */
  promptHash: string;
};

function hashPrompt(...parts: string[]): string {
  return createHash("sha256").update(parts.join("\n---\n"), "utf8").digest("hex").slice(0, 16);
}

function envModel(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : fallback;
}

/**
 * Build a `ModelVersionRef` for any role, given the prompt template parts that
 * went into it. Call sites pass their actual templates so the hash is real.
 */
export function modelVersion(
  role: ModelRole,
  provider: ModelVersionRef["provider"],
  modelName: string,
  ...promptParts: string[]
): ModelVersionRef {
  const promptHash = hashPrompt(...promptParts);
  const id = `${role}_${provider}_${modelName.replace(/[^a-z0-9.-]+/gi, "")}_${promptHash}`;
  return { id, role, provider, modelName, promptHash };
}

export const MODELS = {
  visionPrimary: () => envModel("GEMINI_MODEL", "gemini-2.5-flash"),
  visionFallbacks: ["gemini-2.5-flash", "gemini-2.0-flash"] as const,
  synthesis: () => envModel("GROQ_MODEL", "llama-3.3-70b-versatile"),
};

/**
 * Stable hash for arbitrary JSON / string payloads. Used in audit log to
 * pin the exact input shape without dumping the full payload.
 */
export function payloadHash(payload: unknown): string {
  const s = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export function shortHash(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 16);
}
