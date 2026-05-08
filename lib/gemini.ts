import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { PanelAnalysisSchema, type PanelAnalysis, type BBox } from "./schema";
import { VISION_SYSTEM, VISION_USER, DETECT_SYSTEM, DETECT_USER } from "./prompts";
import { uid } from "./utils";
import { normalizeUpload } from "./imageCrop";

const apiKey = process.env.GEMINI_API_KEY!;
const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const ai = new GoogleGenAI({ apiKey });

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function safeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(stripFences(raw)) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isRateLimit(e: unknown): { retryMs: number } | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (!/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return null;
  const m = msg.match(/retry(?:Delay)?["':\s]+(\d+(?:\.\d+)?)s/i);
  const sec = m ? parseFloat(m[1]) : 14;
  return { retryMs: Math.min(60000, Math.max(1500, sec * 1000 + 250)) };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  attempts = 2
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const rl = isRateLimit(e);
      if (rl && i < attempts - 1) {
        await sleep(rl.retryMs);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Intersection-over-union for two normalized bboxes [ymin, xmin, ymax, xmax] */
function iou(a: BBox, b: BBox): number {
  const ymin = Math.max(a[0], b[0]);
  const xmin = Math.max(a[1], b[1]);
  const ymax = Math.min(a[2], b[2]);
  const xmax = Math.min(a[3], b[3]);
  if (ymax <= ymin || xmax <= xmin) return 0;
  const inter = (ymax - ymin) * (xmax - xmin);
  const aArea = (a[2] - a[0]) * (a[3] - a[1]);
  const bArea = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / Math.max(1e-6, aArea + bArea - inter);
}

/** Greedy non-max suppression — keep higher-confidence boxes when overlap > threshold */
function nms<T extends { bbox: BBox; confidence: number }>(items: T[], iouThresh = 0.4): T[] {
  const sorted = [...items].sort((a, b) => b.confidence - a.confidence);
  const kept: T[] = [];
  for (const it of sorted) {
    if (kept.some((k) => iou(k.bbox, it.bbox) > iouThresh)) continue;
    kept.push(it);
  }
  return kept;
}

/**
 * Normalize a bbox returned by Gemini (which may use 0-1000 OR 0-1 OR 0-image-pixel).
 * We always store 0-1 normalized [ymin, xmin, ymax, xmax] internally.
 */
function normalizeBBox(raw: unknown): BBox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const arr = raw.map((n) => (typeof n === "number" ? n : Number(n)));
  if (arr.some((n) => !isFinite(n))) return null;

  const max = Math.max(...arr);
  let scale: number;
  if (max <= 1.0001) scale = 1;
  else if (max <= 1000) scale = 1000;
  else scale = max; // pixel coords; normalize to its own max

  let [ymin, xmin, ymax, xmax] = arr.map((n) => n / scale) as [number, number, number, number];
  ymin = Math.max(0, Math.min(1, ymin));
  xmin = Math.max(0, Math.min(1, xmin));
  ymax = Math.max(0, Math.min(1, ymax));
  xmax = Math.max(0, Math.min(1, xmax));
  if (ymax <= ymin || xmax <= xmin) return null;
  return [ymin, xmin, ymax, xmax];
}

// =============================================================================
// Per-panel inspection
// =============================================================================

async function callVisionModel(
  model: string,
  b64: string,
  mimeType: string,
  fileName: string
): Promise<string> {
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: VISION_SYSTEM },
          { inlineData: { mimeType, data: b64 } },
          { text: VISION_USER(fileName) },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });
  return res.text ?? "";
}

export async function analyzePanelImageWithMeta(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ data: PanelAnalysis; modelName: string }> {
  const b64 = buffer.toString("base64");
  const candidates = [primaryModel, ...FALLBACK_MODELS.filter((m) => m !== primaryModel)];

  let lastErr: unknown;
  for (const model of candidates) {
    try {
      const text = await withRateLimitRetry(() => callVisionModel(model, b64, mimeType, fileName));
      const parsed = safeParse<Record<string, unknown> & { defects?: Array<Record<string, unknown>> }>(
        text
      );
      if (!parsed) throw new Error("Vision response not parseable JSON");
      if (!parsed.panelId) parsed.panelId = `PNL-${uid().toUpperCase()}`;
      parsed.fileName = fileName;

      // Normalize defect bboxes
      if (Array.isArray(parsed.defects)) {
        for (const d of parsed.defects) {
          if (d && typeof d === "object") {
            const norm = normalizeBBox((d as { bbox?: unknown }).bbox);
            if (norm) (d as { bbox: BBox }).bbox = norm;
            else delete (d as { bbox?: unknown }).bbox;
          }
        }
      }

      const validated = PanelAnalysisSchema.parse(parsed);
      return { data: validated, modelName: model };
    } catch (e) {
      lastErr = e;
      // If we ran out of quota even on this model, the next fallback is likely also exhausted.
      // Still try once in case primary fails for non-quota reasons.
      continue;
    }
  }
  throw new Error(
    `Gemini vision failed across models [${candidates.join(", ")}]: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}

export async function analyzePanelImage(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<PanelAnalysis> {
  const { data } = await analyzePanelImageWithMeta(buffer, mimeType, fileName);
  return data;
}

// =============================================================================
// Multi-panel detection (preflight)
// =============================================================================

export type DetectedPanel = { bbox: BBox; confidence: number };

async function callDetectModel(model: string, b64: string, mimeType: string): Promise<string> {
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: DETECT_SYSTEM },
          { inlineData: { mimeType, data: b64 } },
          { text: DETECT_USER },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
  return res.text ?? "";
}

export async function detectPanelsWithMeta(
  buffer: Buffer,
  mimeType: string
): Promise<{ data: DetectedPanel[]; modelName: string | null }> {
  const b64 = buffer.toString("base64");
  const candidates = [primaryModel, ...FALLBACK_MODELS.filter((m) => m !== primaryModel)];

  let lastErr: unknown;
  for (const model of candidates) {
    try {
      const text = await withRateLimitRetry(() => callDetectModel(model, b64, mimeType));
      const parsed = safeParse<{
        panels?: Array<{ box_2d?: unknown; bbox?: unknown; confidence?: number }>;
      }>(text);
      if (!parsed || !Array.isArray(parsed.panels)) return { data: [], modelName: model };
      const out: DetectedPanel[] = [];
      for (const p of parsed.panels) {
        const raw = (p as { box_2d?: unknown; bbox?: unknown }).box_2d ?? (p as { bbox?: unknown }).bbox;
        const bbox = normalizeBBox(raw);
        if (!bbox) continue;
        const confidence =
          typeof p.confidence === "number" && isFinite(p.confidence) ? Math.max(0, Math.min(1, p.confidence)) : 0.85;
        out.push({ bbox, confidence });
      }
      // Drop tiny boxes (<0.5% area) — noise / spurious overlaps
      let filtered = out.filter(({ bbox }) => {
        const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
        return area > 0.005;
      });
      // De-duplicate overlapping boxes (Gemini sometimes returns nested cell-level + panel-level boxes)
      filtered = nms(filtered, 0.4);
      // If a giant "covers most of frame" box is present alongside many smaller boxes, drop it
      const giant = filtered.find(({ bbox }) => {
        const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
        return area > 0.85;
      });
      if (giant && filtered.length > 1) {
        filtered = filtered.filter((b) => b !== giant);
      }
      return { data: filtered, modelName: model };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  // Detection failed across all models — caller falls back to whole-image analysis
  console.error("detectPanels failed:", lastErr);
  return { data: [], modelName: null };
}

export async function detectPanels(
  buffer: Buffer,
  mimeType: string
): Promise<DetectedPanel[]> {
  const { data } = await detectPanelsWithMeta(buffer, mimeType);
  return data;
}

// =============================================================================
// Panel-gate preflight classifier
// =============================================================================

export const GATE_SYSTEM = `You are a vision classifier. Reply with strict JSON: { isSolarPanel: boolean, confidence: 0..1, reason: string, imageDescription: string }. A solar panel is a photovoltaic module with a visible cell grid (mono/poly/thin-film) — NOT a window, glass roof, screen, mirror, or anything tile/grid that merely resembles cells. If unsure, set isSolarPanel=false.`;

export const GATE_USER = `Classify the image. Return ONLY the JSON object — no prose, no markdown.

Schema:
{
  "isSolarPanel": boolean,
  "confidence": number,        // 0..1
  "reason": string,            // one short sentence
  "imageDescription": string   // one short sentence describing what you see
}`;

const GateResultSchema = z.object({
  isSolarPanel: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  imageDescription: z.string(),
});

export type PanelGateResult = z.infer<typeof GateResultSchema>;

async function callGateModel(model: string, b64: string, mimeType: string): Promise<string> {
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: GATE_SYSTEM },
          { inlineData: { mimeType, data: b64 } },
          { text: GATE_USER },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
  return res.text ?? "";
}

const GATE_FALLBACK: PanelGateResult = {
  isSolarPanel: false,
  confidence: 0,
  reason: "classifier output unparseable",
  imageDescription: "",
};

export async function gatePanelImageWithMeta(
  buffer: Buffer,
  mimeType: string
): Promise<{ data: PanelGateResult; modelName: string | null }> {
  // Cheap preflight: shrink to 768px long edge
  const small = await normalizeUpload(buffer, mimeType, { maxLongEdge: 768, quality: 82 });
  const b64 = small.buffer.toString("base64");
  const candidates = [primaryModel, ...FALLBACK_MODELS.filter((m) => m !== primaryModel)];

  let lastErr: unknown;
  for (const model of candidates) {
    try {
      const text = await withRateLimitRetry(() => callGateModel(model, b64, small.mimeType));
      const parsed = safeParse<unknown>(text);
      if (!parsed) {
        // Unparseable on this model — try next candidate
        lastErr = new Error("Gate response not parseable JSON");
        continue;
      }
      const validated = GateResultSchema.safeParse(parsed);
      if (!validated.success) {
        lastErr = validated.error;
        continue;
      }
      return { data: validated.data, modelName: model };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  console.error("gatePanelImage failed:", lastErr);
  return { data: GATE_FALLBACK, modelName: null };
}

export async function gatePanelImage(
  buffer: Buffer,
  mimeType: string
): Promise<PanelGateResult> {
  const { data } = await gatePanelImageWithMeta(buffer, mimeType);
  return data;
}
