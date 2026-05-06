import type { FullAnalysis, PanelAnalysis, Severity } from "./schema";

export type DefectKey = string; // `${panelId}:${defectIndex}`

export function defectKey(panelId: string, idx: number): DefectKey {
  return `${panelId}:${idx}`;
}

export type SimulatedPanel = {
  panel: PanelAnalysis;
  baselineConditionScore: number;
  baselineEffLossPct: number;
  /** sum of "fixed" defect losses (only those toggled fixed) */
  recoveredLossPct: number;
  /** fraction of original loss budget recovered, in [0,1] */
  recoveryFraction: number;
  simulatedConditionScore: number;
  simulatedEffLossPct: number;
  /** number of fixed defects */
  fixedCount: number;
  /** number of active (still-broken) defects */
  activeCount: number;
};

export type SimulationResult = {
  panels: SimulatedPanel[];
  baseline: {
    fleetHealthScore: number;
    fleetEffLossPct: number;
    annualLossKwhPerKw: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  simulated: {
    fleetHealthScore: number;
    fleetEffLossPct: number;
    annualLossKwhPerKw: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  delta: {
    healthDelta: number;        // points (sim - baseline)
    effLossDelta: number;       // pct points (sim - baseline) — negative is good
    annualLossDelta: number;    // kWh/kW (sim - baseline) — negative is good
    outputRetainedPctDelta: number; // pct points gained back
    fixedDefectCount: number;
    fixedPanelCount: number;
  };
};

export function simulate(
  full: FullAnalysis,
  fixedKeys: ReadonlySet<DefectKey>
): SimulationResult {
  const baselineFleet = full.report;
  const panels = full.panels.map((panel) => simulatePanel(panel, fixedKeys));

  const simHealth = average(panels.map((p) => p.simulatedConditionScore));
  const simEffLoss = average(panels.map((p) => p.simulatedEffLossPct));

  const baselineLoss = baselineFleet.fleetEfficiencyLossPct;
  const annualBaseline = baselineFleet.estimatedAnnualEnergyLossKwhPerKw;
  // Linear scale annual loss by ratio of fleet loss reduction.
  const annualSim =
    baselineLoss > 0.001
      ? clamp(annualBaseline * (simEffLoss / baselineLoss), 0, annualBaseline * 4)
      : annualBaseline;

  const simSevCounts = countActiveSeverities(panels, fixedKeys);
  const baselineSevCounts = {
    criticalCount: baselineFleet.criticalCount,
    highCount: baselineFleet.highCount,
    mediumCount: baselineFleet.mediumCount,
    lowCount: baselineFleet.lowCount,
  };
  const simSev = {
    criticalCount: simSevCounts.critical,
    highCount: simSevCounts.high,
    mediumCount: simSevCounts.medium,
    lowCount: simSevCounts.low,
  };

  const fixedDefectCount = panels.reduce((a, p) => a + p.fixedCount, 0);
  const fixedPanelCount = panels.filter((p) => p.fixedCount > 0).length;

  return {
    panels,
    baseline: {
      fleetHealthScore: baselineFleet.fleetHealthScore,
      fleetEffLossPct: baselineFleet.fleetEfficiencyLossPct,
      annualLossKwhPerKw: annualBaseline,
      ...baselineSevCounts,
    },
    simulated: {
      fleetHealthScore: simHealth,
      fleetEffLossPct: simEffLoss,
      annualLossKwhPerKw: annualSim,
      ...simSev,
    },
    delta: {
      healthDelta: simHealth - baselineFleet.fleetHealthScore,
      effLossDelta: simEffLoss - baselineLoss,
      annualLossDelta: annualSim - annualBaseline,
      outputRetainedPctDelta: baselineLoss - simEffLoss,
      fixedDefectCount,
      fixedPanelCount,
    },
  };
}

function simulatePanel(panel: PanelAnalysis, fixed: ReadonlySet<DefectKey>): SimulatedPanel {
  const baselineLoss = panel.estimatedTotalEfficiencyLoss;
  const baselineCond = panel.conditionScore;

  let recovered = 0;
  let fixedCount = 0;
  let activeCount = 0;
  for (let i = 0; i < panel.defects.length; i++) {
    const d = panel.defects[i];
    if (fixed.has(defectKey(panel.panelId, i))) {
      recovered += d.estimatedEfficiencyLoss;
      fixedCount++;
    } else {
      activeCount++;
    }
  }
  // cap recovery at what the model originally claimed
  recovered = Math.min(recovered, baselineLoss);

  const recoveryFraction = baselineLoss > 0.001 ? recovered / baselineLoss : 0;
  const baselineDelta = 100 - baselineCond;
  const simulatedConditionScore = clamp(100 - baselineDelta * (1 - recoveryFraction), 0, 100);
  const simulatedEffLossPct = clamp(baselineLoss - recovered, 0, 100);

  return {
    panel,
    baselineConditionScore: baselineCond,
    baselineEffLossPct: baselineLoss,
    recoveredLossPct: recovered,
    recoveryFraction,
    simulatedConditionScore,
    simulatedEffLossPct,
    fixedCount,
    activeCount,
  };
}

function countActiveSeverities(panels: SimulatedPanel[], fixed: ReadonlySet<DefectKey>) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const sp of panels) {
    for (let i = 0; i < sp.panel.defects.length; i++) {
      if (fixed.has(defectKey(sp.panel.panelId, i))) continue;
      counts[sp.panel.defects[i].severity as Severity]++;
    }
  }
  return counts;
}

function average(arr: number[]) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// =============================================================================
// Presets
// =============================================================================

export function presetFixAll(panels: PanelAnalysis[]): Set<DefectKey> {
  const s = new Set<DefectKey>();
  for (const p of panels) {
    for (let i = 0; i < p.defects.length; i++) s.add(defectKey(p.panelId, i));
  }
  return s;
}

export function presetFixSeverity(
  panels: PanelAnalysis[],
  severities: Severity[]
): Set<DefectKey> {
  const set = new Set(severities);
  const s = new Set<DefectKey>();
  for (const p of panels) {
    for (let i = 0; i < p.defects.length; i++) {
      if (set.has(p.defects[i].severity)) s.add(defectKey(p.panelId, i));
    }
  }
  return s;
}

export function presetFixType(panels: PanelAnalysis[], substr: string): Set<DefectKey> {
  const needle = substr.toLowerCase();
  const s = new Set<DefectKey>();
  for (const p of panels) {
    for (let i = 0; i < p.defects.length; i++) {
      if (p.defects[i].type.toLowerCase().includes(needle)) {
        s.add(defectKey(p.panelId, i));
      }
    }
  }
  return s;
}

export function presetFixTopByLoss(panels: PanelAnalysis[], n: number): Set<DefectKey> {
  const all: { key: DefectKey; loss: number }[] = [];
  for (const p of panels) {
    for (let i = 0; i < p.defects.length; i++) {
      all.push({
        key: defectKey(p.panelId, i),
        loss: p.defects[i].estimatedEfficiencyLoss,
      });
    }
  }
  all.sort((a, b) => b.loss - a.loss);
  return new Set(all.slice(0, n).map((x) => x.key));
}
