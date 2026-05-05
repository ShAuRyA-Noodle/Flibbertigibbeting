import { z } from "zod";

export const SeverityEnum = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeverityEnum>;

export const DefectSchema = z.object({
  type: z.string().describe("e.g. microcrack, hotspot, soiling, delamination, corrosion, snail-trail, shading, bird-drop, vegetation, encapsulant-yellowing, junction-box-damage, frame-damage, glass-breakage, PID"),
  severity: SeverityEnum,
  location: z.string().describe("Cell/region within image, e.g. 'top-left quadrant, cell row 2'"),
  confidence: z.number().min(0).max(1),
  estimatedEfficiencyLoss: z.number().min(0).max(100).describe("Percent loss attributable to this defect"),
  notes: z.string().optional(),
});
export type Defect = z.infer<typeof DefectSchema>;

export const PanelAnalysisSchema = z.object({
  panelId: z.string(),
  fileName: z.string(),
  panelTypeGuess: z.string().describe("monocrystalline | polycrystalline | thin-film | bifacial | unknown"),
  estimatedCellCount: z.number().int().nonnegative(),
  orientation: z.string().describe("e.g. portrait, landscape; tilt estimate in degrees if visible"),
  cleanlinessScore: z.number().min(0).max(100),
  conditionScore: z.number().min(0).max(100).describe("0=replace, 100=pristine"),
  estimatedTotalEfficiencyLoss: z.number().min(0).max(100),
  defects: z.array(DefectSchema),
  observations: z.string(),
  immediateActions: z.array(z.string()),
  imageQuality: z.enum(["poor", "fair", "good", "excellent"]),
  confidence: z.number().min(0).max(1),
});
export type PanelAnalysis = z.infer<typeof PanelAnalysisSchema>;

export const SystemReportSchema = z.object({
  executiveSummary: z.string(),
  fleetHealthScore: z.number().min(0).max(100),
  fleetEfficiencyLossPct: z.number().min(0).max(100),
  panelsAnalyzed: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  mediumCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  topRisks: z.array(z.object({
    risk: z.string(),
    severity: SeverityEnum,
    affectedPanelIds: z.array(z.string()),
    rationale: z.string(),
  })),
  recommendations: z.array(z.object({
    title: z.string(),
    priority: SeverityEnum,
    timeframe: z.string().describe("e.g. immediate, 7 days, 30 days, 90 days"),
    action: z.string(),
    expectedImpact: z.string(),
  })),
  estimatedAnnualEnergyLossKwhPerKw: z.number().describe("Approx annual kWh loss per installed kW given findings"),
  estimatedRevenueAtRisk: z.string().describe("Qualitative band, since tariffs vary"),
  maintenanceWindow: z.string(),
  nextInspectionInDays: z.number().int().positive(),
});
export type SystemReport = z.infer<typeof SystemReportSchema>;

export const FullAnalysisSchema = z.object({
  panels: z.array(PanelAnalysisSchema),
  report: SystemReportSchema,
  generatedAt: z.string(),
  modelInfo: z.object({
    vision: z.string(),
    synthesis: z.string(),
  }),
});
export type FullAnalysis = z.infer<typeof FullAnalysisSchema>;
