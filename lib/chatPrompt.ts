import type { FullAnalysis } from "./schema";

/**
 * Compact, tightly-typed view of the session injected into the chat system prompt.
 * Strips bulky fields (imageDataUrl, sourceBBox arrays) so the LLM gets pure facts.
 */
export function buildSessionContext(full: FullAnalysis): string {
  const panels = full.panels.map((p) => ({
    panelId: p.panelId,
    fileName: p.fileName,
    sourceFileName: p.sourceFileName,
    sourceIndex: p.sourceIndex,
    panelType: p.panelTypeGuess,
    cells: p.estimatedCellCount,
    orientation: p.orientation,
    cleanlinessScore: round(p.cleanlinessScore),
    conditionScore: round(p.conditionScore),
    estimatedTotalEfficiencyLossPct: round(p.estimatedTotalEfficiencyLoss, 1),
    imageQuality: p.imageQuality,
    confidence: round(p.confidence, 2),
    observations: p.observations,
    immediateActions: p.immediateActions,
    defects: p.defects.map((d) => ({
      type: d.type,
      severity: d.severity,
      location: d.location,
      confidence: round(d.confidence, 2),
      estimatedEfficiencyLossPct: round(d.estimatedEfficiencyLoss, 1),
      notes: d.notes ?? null,
    })),
  }));

  const report = {
    fleetHealthScore: round(full.report.fleetHealthScore),
    fleetEfficiencyLossPct: round(full.report.fleetEfficiencyLossPct, 1),
    panelsAnalyzed: full.report.panelsAnalyzed,
    severityCounts: {
      critical: full.report.criticalCount,
      high: full.report.highCount,
      medium: full.report.mediumCount,
      low: full.report.lowCount,
    },
    executiveSummary: full.report.executiveSummary,
    topRisks: full.report.topRisks,
    recommendations: full.report.recommendations,
    estimatedAnnualEnergyLossKwhPerKw: full.report.estimatedAnnualEnergyLossKwhPerKw,
    estimatedRevenueAtRisk: full.report.estimatedRevenueAtRisk,
    maintenanceWindow: full.report.maintenanceWindow,
    nextInspectionInDays: full.report.nextInspectionInDays,
  };

  return JSON.stringify({ panels, report, generatedAt: full.generatedAt }, null, 0);
}

function round(n: number, digits = 0) {
  const m = Math.pow(10, digits);
  return Math.round(n * m) / m;
}

export const CHAT_SYSTEM = (sessionJson: string) => `You are SOLPOP-CHAT, a senior solar O&M engineer with direct memory of one recent fleet inspection.

You have FULL ACCESS to the inspection JSON below. Treat every fact in it as ground truth. Don't speculate beyond it.

## Inspection data (single source of truth)
${sessionJson}

## How to answer
- Be concrete. Cite **panelIds** in bold (e.g. **PNL-A1B2**) when referring to a specific module.
- Use severity tags inline: \`critical\`, \`high\`, \`medium\`, \`low\`.
- Numbers should be honest: pull cleanliness/condition/loss values straight from the JSON, do not invent.
- If the user asks about something the JSON doesn't cover (e.g. tariff, weather, hardware not photographed), say so plainly and explain what additional input would resolve it.
- Default tone: tight, plain English. Bullets when you have 3+ items. Prose otherwise. No emojis unless the user uses one first.
- Never apologize. Never preface with "based on the inspection". Just answer.
- When asked for actions, return concrete, time-bound steps drawn from the recommendations array (or distilled from defects + immediateActions).
- When asked for ROI / impact, ground numbers in fleetEfficiencyLossPct and estimatedAnnualEnergyLossKwhPerKw — make it clear those are estimates.

## Output format
- Markdown is supported (bold, italic, lists, inline code). No fenced code blocks unless emitting JSON the user asked for.
- Keep responses under ~180 words unless the user asks for depth.
`;

export const SUGGESTED_PROMPTS = [
  "Which 3 panels need attention first?",
  "Walk me through the worst panel.",
  "If I clean every panel, how much output do I get back?",
  "Which defects are cosmetic vs costing me money?",
  "Build a 7-day action plan.",
  "What's the next inspection date and why?",
];
