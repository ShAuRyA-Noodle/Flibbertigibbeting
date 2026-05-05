import { GoogleGenAI } from "@google/genai";
import { PanelAnalysisSchema, type PanelAnalysis } from "./schema";
import { VISION_SYSTEM, VISION_USER } from "./prompts";
import { uid } from "./utils";

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
    const m = raw.match(/\{[\s\S]*\}/);
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

async function callModel(model: string, b64: string, mimeType: string, fileName: string): Promise<string> {
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

export async function analyzePanelImage(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<PanelAnalysis> {
  const b64 = buffer.toString("base64");
  const candidates = [primaryModel, ...FALLBACK_MODELS.filter((m) => m !== primaryModel)];

  let lastErr: unknown;
  for (const model of candidates) {
    try {
      const text = await callModel(model, b64, mimeType, fileName);
      const parsed = safeParse<PanelAnalysis>(text);
      if (!parsed) throw new Error("Vision response not parseable JSON");
      if (!parsed.panelId) parsed.panelId = `PNL-${uid().toUpperCase()}`;
      parsed.fileName = fileName;
      const validated = PanelAnalysisSchema.parse(parsed);
      return validated;
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw new Error(
    `Gemini vision failed across models [${candidates.join(", ")}]: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}
