import Groq from "groq-sdk";
import { SystemReportSchema, type PanelAnalysis, type SystemReport } from "./schema";
import { SYNTHESIS_SYSTEM, SYNTHESIS_USER } from "./prompts";

const apiKey = process.env.GROQ_API_KEY!;
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const groq = new Groq({ apiKey });

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

export async function synthesizeReport(panels: PanelAnalysis[]): Promise<SystemReport> {
  const compact = panels.map((p) => ({
    panelId: p.panelId,
    fileName: p.fileName,
    panelTypeGuess: p.panelTypeGuess,
    conditionScore: p.conditionScore,
    cleanlinessScore: p.cleanlinessScore,
    estimatedTotalEfficiencyLoss: p.estimatedTotalEfficiencyLoss,
    defects: p.defects,
    immediateActions: p.immediateActions,
    observations: p.observations,
    confidence: p.confidence,
  }));

  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYNTHESIS_SYSTEM },
      { role: "user", content: SYNTHESIS_USER(JSON.stringify(compact, null, 2)) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = safeParse<SystemReport>(raw);
  if (!parsed) throw new Error("Groq synthesis response not parseable JSON");
  return SystemReportSchema.parse(parsed);
}
