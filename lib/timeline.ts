import type { Defect, PanelAnalysis, Severity } from "./schema";

export type DefectMatch = {
  before: Defect;
  after: Defect;
  /** Severity changed (e.g. medium -> high). */
  severityChanged: boolean;
  lossDeltaPct: number;
};

export type TimelineDiff = {
  conditionDelta: number;          // after - before (positive = better)
  effLossDelta: number;            // after - before (negative = better)
  cleanlinessDelta: number;
  newDefects: Defect[];
  healedDefects: Defect[];
  persistentDefects: DefectMatch[];
  /** Net change buckets for headline copy. */
  worseDefectCount: number;        // new + persistent that got more severe
  improvedDefectCount: number;     // healed + persistent that got less severe
  /** Verdict: "improved" | "worsened" | "stable" */
  verdict: "improved" | "worsened" | "stable";
};

const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Match by canonical defect type. If multiple of same type exist, pair greedily by
 * smallest difference in estimatedEfficiencyLoss to avoid false "new"/"healed".
 */
export function diffPanels(before: PanelAnalysis, after: PanelAnalysis): TimelineDiff {
  const beforeBuckets = bucketByType(before.defects);
  const afterBuckets = bucketByType(after.defects);

  const newDefects: Defect[] = [];
  const healedDefects: Defect[] = [];
  const persistentDefects: DefectMatch[] = [];

  const allTypes = new Set<string>([...beforeBuckets.keys(), ...afterBuckets.keys()]);
  for (const t of allTypes) {
    const b = (beforeBuckets.get(t) ?? []).slice();
    const a = (afterBuckets.get(t) ?? []).slice();
    while (b.length && a.length) {
      // Pair the closest by loss
      const [bIdx, aIdx] = closestPair(b, a);
      const bd = b.splice(bIdx, 1)[0];
      const ad = a.splice(aIdx, 1)[0];
      persistentDefects.push({
        before: bd,
        after: ad,
        severityChanged: bd.severity !== ad.severity,
        lossDeltaPct: ad.estimatedEfficiencyLoss - bd.estimatedEfficiencyLoss,
      });
    }
    healedDefects.push(...b);
    newDefects.push(...a);
  }

  const worseCount =
    newDefects.length +
    persistentDefects.filter((m) => SEVERITY_RANK[m.after.severity] > SEVERITY_RANK[m.before.severity]).length;
  const improvedCount =
    healedDefects.length +
    persistentDefects.filter((m) => SEVERITY_RANK[m.after.severity] < SEVERITY_RANK[m.before.severity]).length;

  const conditionDelta = after.conditionScore - before.conditionScore;
  const effLossDelta = after.estimatedTotalEfficiencyLoss - before.estimatedTotalEfficiencyLoss;
  const cleanlinessDelta = after.cleanlinessScore - before.cleanlinessScore;

  let verdict: TimelineDiff["verdict"] = "stable";
  if (conditionDelta > 4 || effLossDelta < -1.5 || improvedCount > worseCount + 1) verdict = "improved";
  else if (conditionDelta < -4 || effLossDelta > 1.5 || worseCount > improvedCount + 1) verdict = "worsened";

  return {
    conditionDelta,
    effLossDelta,
    cleanlinessDelta,
    newDefects,
    healedDefects,
    persistentDefects,
    worseDefectCount: worseCount,
    improvedDefectCount: improvedCount,
    verdict,
  };
}

function bucketByType(defects: Defect[]): Map<string, Defect[]> {
  const m = new Map<string, Defect[]>();
  for (const d of defects) {
    const k = d.type.toLowerCase().trim();
    const arr = m.get(k);
    if (arr) arr.push(d);
    else m.set(k, [d]);
  }
  return m;
}

/** Index of the closest pair (by absolute loss difference). */
function closestPair(b: Defect[], a: Defect[]): [number, number] {
  let bi = 0, ai = 0, best = Infinity;
  for (let i = 0; i < b.length; i++) {
    for (let j = 0; j < a.length; j++) {
      const d = Math.abs(b[i].estimatedEfficiencyLoss - a[j].estimatedEfficiencyLoss);
      if (d < best) {
        best = d;
        bi = i;
        ai = j;
      }
    }
  }
  return [bi, ai];
}

export function daysBetween(a: number, b: number): number {
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}
