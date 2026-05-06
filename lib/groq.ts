import Groq from "groq-sdk";
import { SystemReportSchema, type PanelAnalysis, type SystemReport } from "./schema";
import { SYNTHESIS_SYSTEM, SYNTHESIS_USER } from "./prompts";

const apiKey = process.env.GROQ_API_KEY!;
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const groq = new Groq({ apiKey });

export type Persona = "engineer" | "junior" | "claims" | "investor";
export type SynthLocale = "en" | "es" | "pt" | "hi" | "fr" | "de" | "zh";

const PERSONA_NOTES: Record<Persona, string> = {
  engineer: "",
  junior:
    "\n\nWrite for a junior technician with 1-2 years of solar experience. Use plain language. Spell out acronyms on first mention. Walk through the *why* behind each recommendation, not just the action. Keep tone supportive and instructive.",
  claims:
    "\n\nWrite for an insurance/warranty claims adjuster. Lead with quantifiable damage and severity. Tie recommendations to evidence (which panel, which defect) suitable for a paper trail. Avoid speculation; flag confidence gaps.",
  investor:
    "\n\nWrite for an asset owner or investor. Lead with money. Translate efficiency loss into expected revenue impact bands. Group recommendations by ROI and time-to-payback. Skip deep technical jargon; favor decision-making clarity.",
};

const LOCALE_INSTRUCTIONS: Record<SynthLocale, string> = {
  en: "",
  es: "\n\nIMPORTANT: Output the entire JSON in fluent Spanish (Spain/Latin American neutral). Translate every string field. Keep enum values (severity: low/medium/high/critical) and panelIds in English exactly as given.",
  pt: "\n\nIMPORTANT: Output the entire JSON in fluent Portuguese (Brazil-leaning, neutral). Translate every string field. Keep enum values and panelIds in English exactly as given.",
  hi: "\n\nIMPORTANT: Output the entire JSON in fluent Hindi (Devanagari script). Translate every string field. Keep enum values and panelIds in English exactly as given.",
  fr: "\n\nIMPORTANT: Output the entire JSON in fluent French. Translate every string field. Keep enum values and panelIds in English exactly as given.",
  de: "\n\nIMPORTANT: Output the entire JSON in fluent German. Translate every string field. Keep enum values and panelIds in English exactly as given.",
  zh: "\n\nIMPORTANT: Output the entire JSON in fluent Simplified Chinese. Translate every string field. Keep enum values and panelIds in English exactly as given.",
};

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

export async function synthesizeReport(
  panels: PanelAnalysis[],
  opts: { persona?: Persona; locale?: SynthLocale } = {}
): Promise<SystemReport> {
  const persona = opts.persona ?? "engineer";
  const locale = opts.locale ?? "en";
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

  const systemPrompt = SYNTHESIS_SYSTEM + PERSONA_NOTES[persona] + LOCALE_INSTRUCTIONS[locale];

  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: SYNTHESIS_USER(JSON.stringify(compact, null, 2)) },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = safeParse<SystemReport>(raw);
  if (!parsed) throw new Error("Groq synthesis response not parseable JSON");
  return SystemReportSchema.parse(parsed);
}
