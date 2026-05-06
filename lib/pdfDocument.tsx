/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image as PdfImage,
  StyleSheet,
} from "@react-pdf/renderer";
import type { FullAnalysis, PanelAnalysis, Severity } from "./schema";

const COLORS = {
  bg: "#FFFCF5",
  ink: "#1A0D04",
  ink2: "#5A3820",
  ink3: "#9A7656",
  line: "#E9D7BB",
  lineSoft: "#F2E5CC",
  accent: "#FF5B00",
  accent2: "#FFB800",
  accent3: "#FF2D7A",
  sevLow: "#18A96B",
  sevMedium: "#D49500",
  sevHigh: "#E64A00",
  sevCritical: "#C8102E",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    color: COLORS.ink,
    paddingTop: 42,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.5,
  },

  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  brandLogo: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginRight: 8,
  },
  brandWord: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 1.6,
  },
  brandMeta: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLORS.ink3,
    letterSpacing: 1.5,
  },

  hr: { height: 1, backgroundColor: COLORS.line, marginVertical: 10 },

  hero: { marginTop: 22, marginBottom: 28 },
  heroTick: { fontFamily: "Helvetica", fontSize: 9, letterSpacing: 1.6, color: COLORS.ink3, textTransform: "uppercase", marginBottom: 10 },
  heroH1: { fontFamily: "Times-Italic", fontSize: 56, lineHeight: 1.0, marginBottom: 6 },
  heroH2: { fontFamily: "Times-Roman", fontSize: 56, lineHeight: 1.0, color: COLORS.ink2 },

  kpiRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  kpi: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.line, backgroundColor: "#FFFFFF" },
  kpiLabel: { fontSize: 8.5, letterSpacing: 1.4, color: COLORS.ink3, textTransform: "uppercase", marginBottom: 6 },
  kpiValue: { fontFamily: "Times-Roman", fontSize: 34, lineHeight: 1.0 },
  kpiValueAccent: { color: COLORS.accent },

  h2: { fontFamily: "Times-Roman", fontSize: 28, marginTop: 8, marginBottom: 10, lineHeight: 1.05 },
  h3: { fontFamily: "Times-Roman", fontSize: 18, marginTop: 14, marginBottom: 8, lineHeight: 1.1 },
  tick: { fontSize: 8.5, letterSpacing: 1.6, color: COLORS.ink3, textTransform: "uppercase", marginBottom: 8 },

  body: { fontSize: 10.5, color: COLORS.ink, marginBottom: 6 },
  bodyDim: { fontSize: 10, color: COLORS.ink2 },
  bodyMono: { fontFamily: "Courier", fontSize: 9.5, color: COLORS.ink2 },

  pillRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, fontSize: 8.5, letterSpacing: 1.2, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },

  sevBarTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.lineSoft, overflow: "hidden", marginTop: 4, marginBottom: 8 },
  sevBarFill: { height: 6 },

  table: { borderTopWidth: 1, borderTopColor: COLORS.line },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 8 },
  tableHead: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.ink },
  tableHeadCell: { fontSize: 8, letterSpacing: 1.4, color: COLORS.ink3, textTransform: "uppercase" },
  tableCell: { fontSize: 10, color: COLORS.ink, paddingRight: 8 },

  panelCard: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.line },
  panelHeadRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  panelImg: { width: "100%", height: 260, objectFit: "cover", borderRadius: 8 },
  panelMetaRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  metaBlock: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.line, backgroundColor: "#FFFFFF" },

  pageFooter: { position: "absolute", left: 44, right: 44, bottom: 24, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 8 },
  footerText: { fontSize: 8.5, color: COLORS.ink3, fontFamily: "Helvetica" },
});

const SEV_BG: Record<Severity, string> = {
  low: "#DEF7EB",
  medium: "#FFEFC4",
  high: "#FFE0CB",
  critical: "#FFD7DC",
};
const SEV_FG: Record<Severity, string> = {
  low: COLORS.sevLow,
  medium: COLORS.sevMedium,
  high: COLORS.sevHigh,
  critical: COLORS.sevCritical,
};

function Pill({ children, severity }: { children: React.ReactNode; severity: Severity }) {
  return (
    <Text
      style={{
        ...styles.pill,
        backgroundColor: SEV_BG[severity],
        color: SEV_FG[severity],
      }}
    >
      {children}
    </Text>
  );
}

function PageFooter({ pageNumber, totalPages, sessionLabel }: { pageNumber: number; totalPages: number; sessionLabel: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.footerText}>SOLPOP · {sessionLabel}</Text>
      <Text style={styles.footerText}>{pageNumber} / {totalPages}</Text>
    </View>
  );
}

function BrandBar({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.brandBar} fixed>
      <View style={styles.brandLogo}>
        <View style={styles.brandDot} />
        <Text style={styles.brandWord}>SOLPOP</Text>
        <Text style={[styles.brandMeta, { marginLeft: 8 }]}>v1.0 · INSPECTION REPORT</Text>
      </View>
      <Text style={styles.brandMeta}>{new Date(generatedAt).toLocaleString()}</Text>
    </View>
  );
}

function severityCounts(panels: PanelAnalysis[]) {
  const c = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const p of panels) for (const d of p.defects) c[d.severity as Severity]++;
  return c;
}

export type ReportDocumentProps = {
  data: FullAnalysis;
  sessionId: string;
  sourceThumbnails?: Record<string, string>;
};

export function ReportDocument({ data, sessionId, sourceThumbnails = {} }: ReportDocumentProps) {
  const { panels, report } = data;
  const totalDefects = severityCounts(panels);
  const totalDefectCount = totalDefects.critical + totalDefects.high + totalDefects.medium + totalDefects.low;
  const sessionLabel = `Session ${sessionId.slice(0, 14)} · ${new Date(data.generatedAt).toLocaleDateString()}`;

  return (
    <Document title="Solpop Inspection Report" author="Solpop">
      {/* COVER */}
      <Page size="A4" style={styles.page}>
        <BrandBar generatedAt={data.generatedAt} />

        <View style={styles.hero}>
          <Text style={styles.heroTick}>EXECUTIVE INSPECTION REPORT</Text>
          <Text style={styles.heroH1}>Fleet</Text>
          <Text style={styles.heroH2}>diagnosis.</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>FLEET HEALTH</Text>
            <Text style={[styles.kpiValue, { color: scoreColor(report.fleetHealthScore) }]}>{Math.round(report.fleetHealthScore)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>EFF. LOSS</Text>
            <Text style={styles.kpiValue}>{report.fleetEfficiencyLossPct.toFixed(1)}%</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>PANELS</Text>
            <Text style={styles.kpiValue}>{report.panelsAnalyzed}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>NEXT IN</Text>
            <Text style={styles.kpiValue}>{report.nextInspectionInDays}d</Text>
          </View>
        </View>

        <View style={{ marginTop: 28 }}>
          <Text style={styles.tick}>EXECUTIVE SUMMARY</Text>
          <Text style={[styles.body, { fontSize: 12, lineHeight: 1.55 }]}>{report.executiveSummary}</Text>
        </View>

        <View style={{ marginTop: 22 }}>
          <Text style={styles.tick}>SEVERITY DISTRIBUTION · {totalDefectCount} FINDINGS</Text>
          <SeverityChart counts={{ critical: report.criticalCount, high: report.highCount, medium: report.mediumCount, low: report.lowCount }} />
        </View>

        <View style={{ flexDirection: "row", gap: 14, marginTop: 22 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tick}>MAINTENANCE WINDOW</Text>
            <Text style={[styles.body, { fontSize: 12 }]}>{report.maintenanceWindow}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tick}>REVENUE AT RISK</Text>
            <Text style={[styles.body, { fontSize: 12 }]}>{report.estimatedRevenueAtRisk}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tick}>ANNUAL LOSS</Text>
            <Text style={[styles.body, { fontSize: 12 }]}>~{Math.round(report.estimatedAnnualEnergyLossKwhPerKw)} kWh / kW</Text>
          </View>
        </View>

        <PageFooter pageNumber={1} totalPages={2 + Math.ceil(panels.length / 2)} sessionLabel={sessionLabel} />
      </Page>

      {/* RISKS + RECOMMENDATIONS */}
      <Page size="A4" style={styles.page}>
        <BrandBar generatedAt={data.generatedAt} />
        <Text style={styles.h2}>Top risks</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, { flex: 1.2 }]}>RISK</Text>
          <Text style={[styles.tableHeadCell, { width: 70 }]}>SEV</Text>
          <Text style={[styles.tableHeadCell, { flex: 1.6 }]}>RATIONALE</Text>
        </View>
        {report.topRisks.length === 0 && (
          <Text style={[styles.body, { paddingVertical: 8 }]}>No top risks recorded.</Text>
        )}
        {report.topRisks.map((r, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <View style={{ flex: 1.2, paddingRight: 8 }}>
              <Text style={[styles.body, { fontFamily: "Helvetica-Bold" }]}>{r.risk}</Text>
              {r.affectedPanelIds.length > 0 && (
                <Text style={[styles.bodyMono, { marginTop: 3 }]}>{r.affectedPanelIds.slice(0, 8).join(" · ")}</Text>
              )}
            </View>
            <View style={{ width: 70 }}>
              <Pill severity={r.severity as Severity}>{r.severity}</Pill>
            </View>
            <View style={{ flex: 1.6 }}>
              <Text style={[styles.body, { color: COLORS.ink2 }]}>{r.rationale}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.h2, { marginTop: 24 }]}>Prioritized actions</Text>
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, { width: 28 }]}>#</Text>
          <Text style={[styles.tableHeadCell, { flex: 1.4 }]}>ACTION</Text>
          <Text style={[styles.tableHeadCell, { width: 72 }]}>PRIORITY</Text>
          <Text style={[styles.tableHeadCell, { width: 78 }]}>TIMEFRAME</Text>
          <Text style={[styles.tableHeadCell, { flex: 1.2 }]}>IMPACT</Text>
        </View>
        {report.recommendations.length === 0 && (
          <Text style={[styles.body, { paddingVertical: 8 }]}>No recommendations recorded.</Text>
        )}
        {report.recommendations.map((rec, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <View style={{ width: 28 }}>
              <Text style={styles.bodyMono}>{String(i + 1).padStart(2, "0")}</Text>
            </View>
            <View style={{ flex: 1.4, paddingRight: 8 }}>
              <Text style={[styles.body, { fontFamily: "Helvetica-Bold" }]}>{rec.title}</Text>
              <Text style={[styles.body, { color: COLORS.ink2, marginTop: 3 }]}>{rec.action}</Text>
            </View>
            <View style={{ width: 72 }}>
              <Pill severity={rec.priority as Severity}>{rec.priority}</Pill>
            </View>
            <View style={{ width: 78 }}>
              <Text style={styles.bodyMono}>{rec.timeframe}</Text>
            </View>
            <View style={{ flex: 1.2 }}>
              <Text style={[styles.body, { color: COLORS.accent }]}>{rec.expectedImpact}</Text>
            </View>
          </View>
        ))}

        <PageFooter pageNumber={2} totalPages={2 + Math.ceil(panels.length / 2)} sessionLabel={sessionLabel} />
      </Page>

      {/* PER-PANEL APPENDIX */}
      {chunkPairs(panels).map((pair, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          <BrandBar generatedAt={data.generatedAt} />
          <Text style={styles.tick}>PANEL APPENDIX</Text>
          <Text style={styles.h2}>Per-panel findings</Text>

          {pair.map((panel) => (
            <PanelBlock key={panel.panelId} panel={panel} sourceThumbnails={sourceThumbnails} />
          ))}

          <PageFooter
            pageNumber={3 + pageIdx}
            totalPages={2 + Math.ceil(panels.length / 2)}
            sessionLabel={sessionLabel}
          />
        </Page>
      ))}

      {/* SIGN-OFF */}
      <Page size="A4" style={styles.page}>
        <BrandBar generatedAt={data.generatedAt} />
        <View style={{ marginTop: 36 }}>
          <Text style={styles.tick}>INSPECTOR SIGN-OFF</Text>
          <Text style={styles.h2}>Authorized review</Text>
          <Text style={[styles.body, { color: COLORS.ink2, marginBottom: 28 }]}>
            This report is decision-support generated by SOLPOP&apos;s multimodal pipeline (Gemini
            vision + Llama 3.3 synthesis on Groq). It is not a substitute for a licensed PV
            engineer. Findings should be field-verified before any warranty claim, replacement,
            or safety-critical action.
          </Text>

          <View style={{ flexDirection: "row", gap: 28, marginTop: 28 }}>
            <View style={{ flex: 1 }}>
              <View style={{ height: 1, backgroundColor: COLORS.ink, marginBottom: 6 }} />
              <Text style={styles.bodyMono}>INSPECTOR · NAME</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ height: 1, backgroundColor: COLORS.ink, marginBottom: 6 }} />
              <Text style={styles.bodyMono}>SIGNATURE</Text>
            </View>
            <View style={{ width: 120 }}>
              <View style={{ height: 1, backgroundColor: COLORS.ink, marginBottom: 6 }} />
              <Text style={styles.bodyMono}>DATE</Text>
            </View>
          </View>

          <View style={{ marginTop: 48 }}>
            <Text style={styles.tick}>RUN PROVENANCE</Text>
            <Text style={styles.bodyMono}>
              session    {sessionId}
              {"\n"}vision     {data.modelInfo.vision}
              {"\n"}synthesis  {data.modelInfo.synthesis}
              {"\n"}generated  {new Date(data.generatedAt).toISOString()}
            </Text>
          </View>
        </View>

        <PageFooter
          pageNumber={3 + Math.ceil(panels.length / 2)}
          totalPages={3 + Math.ceil(panels.length / 2)}
          sessionLabel={sessionLabel}
        />
      </Page>
    </Document>
  );
}

function PanelBlock({
  panel,
  sourceThumbnails,
}: {
  panel: PanelAnalysis;
  sourceThumbnails: Record<string, string>;
}) {
  const condColor = scoreColor(panel.conditionScore);
  const imgSrc =
    panel.imageDataUrl ||
    sourceThumbnails[panel.sourceFileName ?? panel.fileName] ||
    "";

  return (
    <View style={styles.panelCard} wrap={false}>
      <View style={styles.panelHeadRow}>
        <View style={{ flexDirection: "column", maxWidth: "70%" }}>
          <Text style={styles.bodyMono}>{panel.panelId} · {panel.fileName}</Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 22, lineHeight: 1.05, marginTop: 2 }}>
            {panel.panelTypeGuess}
            {panel.estimatedCellCount > 0 ? `, ${panel.estimatedCellCount} cells` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.tick}>CONDITION</Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 38, lineHeight: 1.0, color: condColor }}>
            {Math.round(panel.conditionScore)}
          </Text>
        </View>
      </View>

      {imgSrc ? <PdfImage src={imgSrc} style={styles.panelImg} /> : null}

      <View style={styles.panelMetaRow}>
        <View style={styles.metaBlock}>
          <Text style={styles.kpiLabel}>CLEANLINESS</Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.0 }}>{Math.round(panel.cleanlinessScore)}</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.kpiLabel}>EFF. LOSS</Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.0 }}>{panel.estimatedTotalEfficiencyLoss.toFixed(1)}%</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.kpiLabel}>CONFIDENCE</Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.0 }}>{Math.round(panel.confidence * 100)}%</Text>
        </View>
        <View style={styles.metaBlock}>
          <Text style={styles.kpiLabel}>QUALITY</Text>
          <Text style={{ fontFamily: "Times-Roman", fontSize: 20, lineHeight: 1.0, textTransform: "capitalize" }}>{panel.imageQuality}</Text>
        </View>
      </View>

      <Text style={[styles.body, { marginTop: 10, color: COLORS.ink2 }]}>{panel.observations}</Text>

      {panel.defects.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.tick}>DEFECTS</Text>
          {panel.defects.map((d, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                gap: 8,
                paddingVertical: 6,
                borderBottomWidth: i === panel.defects.length - 1 ? 0 : 1,
                borderBottomColor: COLORS.lineSoft,
              }}
            >
              <View style={{ width: 22 }}>
                <Text style={styles.bodyMono}>{String(i + 1).padStart(2, "0")}</Text>
              </View>
              <View style={{ width: 70 }}>
                <Pill severity={d.severity as Severity}>{d.severity}</Pill>
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={[styles.body, { fontFamily: "Helvetica-Bold" }]}>{d.type}</Text>
                <Text style={[styles.body, { color: COLORS.ink2 }]}>{d.location}</Text>
                {d.notes ? <Text style={[styles.body, { color: COLORS.ink3 }]}>{d.notes}</Text> : null}
              </View>
              <View style={{ width: 60, alignItems: "flex-end" }}>
                <Text style={styles.tick}>LOSS</Text>
                <Text style={{ fontFamily: "Times-Roman", fontSize: 14, color: SEV_FG[d.severity as Severity] }}>
                  {d.estimatedEfficiencyLoss.toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {panel.immediateActions.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.tick}>IMMEDIATE ACTIONS</Text>
          {panel.immediateActions.map((a, i) => (
            <Text key={i} style={[styles.body, { color: COLORS.ink2, marginTop: 2 }]}>
              {String(i + 1).padStart(2, "0")} · {a}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function SeverityChart({
  counts,
}: {
  counts: { critical: number; high: number; medium: number; low: number };
}) {
  const total = counts.critical + counts.high + counts.medium + counts.low;
  const rows: { sev: Severity; count: number }[] = [
    { sev: "critical", count: counts.critical },
    { sev: "high", count: counts.high },
    { sev: "medium", count: counts.medium },
    { sev: "low", count: counts.low },
  ];
  return (
    <View>
      {rows.map((r) => {
        const pct = total > 0 ? (r.count / total) * 100 : 0;
        return (
          <View key={r.sev} style={{ marginTop: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Pill severity={r.sev}>{r.sev}</Pill>
              <Text style={styles.bodyMono}>{r.count}</Text>
            </View>
            <View style={styles.sevBarTrack}>
              <View style={{ ...styles.sevBarFill, width: `${pct}%`, backgroundColor: SEV_FG[r.sev] }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

function scoreColor(s: number) {
  if (s >= 80) return COLORS.sevLow;
  if (s >= 60) return COLORS.sevMedium;
  if (s >= 35) return COLORS.sevHigh;
  return COLORS.sevCritical;
}
