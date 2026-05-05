"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, AlertTriangle, CheckCircle2, Compass, Sparkles, Layers, Ruler, Activity } from "lucide-react";
import type { PanelAnalysis } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { CountUp } from "./CountUp";
import { lenisStop, lenisStart } from "./SmoothScroll";

export function PanelReportSheet({
  panel,
  previewUrl,
  onClose,
  index,
  total,
}: {
  panel: PanelAnalysis | null;
  previewUrl?: string;
  onClose: () => void;
  index: number;
  total: number;
}) {
  useEffect(() => {
    if (panel) {
      lenisStop();
      return () => lenisStart();
    }
  }, [panel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (panel) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, onClose]);

  function downloadPanel() {
    if (!panel) return;
    const blob = new Blob([JSON.stringify(panel, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${panel.panelId}-${panel.fileName.replace(/\.[^.]+$/, "")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AnimatePresence>
      {panel && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 frosted no-print"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            data-lenis-prevent
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 32, mass: 0.9 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[680px] lg:w-[760px] bg-[var(--bg)] border-l hairline-strong overflow-y-auto no-print"
          >
            <SheetBody
              panel={panel}
              previewUrl={previewUrl}
              onClose={onClose}
              onDownload={downloadPanel}
              index={index}
              total={total}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SheetBody({
  panel,
  previewUrl,
  onClose,
  onDownload,
  index,
  total,
}: {
  panel: PanelAnalysis;
  previewUrl?: string;
  onClose: () => void;
  onDownload: () => void;
  index: number;
  total: number;
}) {
  const condColor = scoreColor(panel.conditionScore);
  return (
    <div className="relative">
      <div className="sticky top-0 z-10 frosted border-b hairline px-7 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[11px] tracking-[0.18em] text-[var(--fg-mute)]">
            PANEL {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="text-[var(--fg-mute)]">·</span>
          <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--fg-dim)] truncate">{panel.panelId}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onDownload} className="btn-ghost text-[13px] inline-flex items-center gap-2 !py-2 !px-4">
            <Download size={14} />
            Export
          </button>
          <button onClick={onClose} className="w-10 h-10 rounded-full grid place-items-center border hairline-strong hover:border-[var(--accent)] hover:bg-[var(--surface-2)] transition-all" aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="relative aspect-[16/9] overflow-hidden bg-black">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={panel.fileName} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 cell-pattern opacity-25 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-6 left-7 right-7 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono text-[11px] tracking-[0.18em] text-white/65 mb-2">{panel.fileName}</div>
            <h2 className="h-display text-white text-[40px] md:text-[56px] leading-[0.95]">
              {panel.panelTypeGuess}
            </h2>
            <div className="font-mono text-[12px] text-white/70 mt-2">
              {panel.estimatedCellCount > 0 ? `${panel.estimatedCellCount} cells · ` : ""}{panel.orientation}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="tick text-white/55">Condition</div>
            <div className="stat-num text-white" style={{ color: condColor, fontSize: "clamp(56px, 8vw, 96px)" }}>
              <CountUp to={Math.round(panel.conditionScore)} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-7 py-10 space-y-12">
        <Section title="Verdict" tick="Inspector narrative">
          <p className="body-lg max-w-[60ch] leading-[1.55]">{panel.observations}</p>
        </Section>

        <Section title="Diagnostics" tick="Calibrated metrics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric icon={Activity} label="Condition" value={Math.round(panel.conditionScore)} suffix="/100" color={condColor} />
            <Metric icon={Sparkles} label="Cleanliness" value={Math.round(panel.cleanlinessScore)} suffix="/100" />
            <Metric icon={Layers} label="Eff. loss" value={panel.estimatedTotalEfficiencyLoss} suffix="%" decimals={1} />
            <Metric icon={CheckCircle2} label="Confidence" value={panel.confidence * 100} suffix="%" decimals={0} />
          </div>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            <BarRow label="Output retained" value={100 - panel.estimatedTotalEfficiencyLoss} suffix="%" />
            <BarRow label="Cleanliness index" value={panel.cleanlinessScore} suffix="/100" />
          </div>
        </Section>

        <Section title="Defect ledger" tick={`${panel.defects.length} finding${panel.defects.length === 1 ? "" : "s"}`}>
          {panel.defects.length === 0 ? (
            <div className="card p-7 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full grid place-items-center" style={{ background: "rgba(128,237,153,0.12)" }}>
                <CheckCircle2 size={20} className="text-[var(--sev-low)]" />
              </div>
              <div>
                <div className="font-serif text-[22px] leading-tight">No defects detected</div>
                <div className="body-md mt-1">Panel passes baseline visual inspection. Continue regular cadence.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {panel.defects.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "card-elev p-5 md:p-6 ring-defect",
                    d.severity === "critical" && "border-[rgba(239,35,60,0.35)]"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className={cn("severity-pill", d.severity)}>{d.severity}</span>
                      <span className="font-serif text-[22px] md:text-[26px] leading-tight">{d.type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="tick">Loss</div>
                        <div className="font-serif text-[22px] leading-none mt-1" style={{ color: severityColorVar(d.severity) }}>
                          {d.estimatedEfficiencyLoss.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="tick">Conf.</div>
                        <div className="font-serif text-[22px] leading-none mt-1">{Math.round(d.confidence * 100)}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4 mt-4">
                    <div className="tick flex items-center gap-1.5"><Compass size={11} /> Location</div>
                    <div className="body-md text-[var(--fg)]">{d.location}</div>
                  </div>
                  {d.notes && (
                    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4 mt-3">
                      <div className="tick flex items-center gap-1.5"><Ruler size={11} /> Notes</div>
                      <p className="body-md">{d.notes}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Immediate actions" tick="O&M directives">
          {panel.immediateActions.length === 0 ? (
            <p className="body-md">None required.</p>
          ) : (
            <ol className="space-y-3">
              {panel.immediateActions.map((a, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="card p-5 flex items-start gap-4"
                >
                  <div className="font-mono text-[12px] tracking-[0.16em] text-[var(--accent)] pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <p className="body-md text-[var(--fg)] leading-relaxed">{a}</p>
                </motion.li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="Image quality" tick="Capture grade">
          <div className="card p-5 flex items-center gap-4">
            {panel.imageQuality === "poor" ? (
              <AlertTriangle size={20} className="text-[var(--sev-high)]" />
            ) : (
              <CheckCircle2 size={20} className="text-[var(--sev-low)]" />
            )}
            <div>
              <div className="font-serif text-[22px] capitalize leading-tight">{panel.imageQuality}</div>
              <div className="body-md mt-1">
                {panel.imageQuality === "excellent" && "Capture exceeds inspection standards."}
                {panel.imageQuality === "good" && "Capture sufficient for confident analysis."}
                {panel.imageQuality === "fair" && "Acceptable, recommend reshoot at next visit."}
                {panel.imageQuality === "poor" && "Re-capture advised, analysis confidence reduced."}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, tick, children }: { title: string; tick: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="h-display text-[28px] md:text-[36px]">{title}</h3>
        <span className="tick">{tick}</span>
      </div>
      {children}
    </motion.section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  suffix,
  decimals = 0,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  color?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <Icon size={14} className="text-[var(--fg-mute)]" />
        <span className="tick">{label}</span>
      </div>
      <div className="font-serif text-[40px] md:text-[44px] leading-none" style={{ color: color ?? "var(--fg)" }}>
        <CountUp to={value} decimals={decimals} />
        {suffix && <span className="text-[var(--fg-mute)] text-[24px] ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

function BarRow({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="tick">{label}</span>
        <span className="font-mono text-[13px] text-[var(--fg-dim)]">
          {value.toFixed(1)}{suffix}
        </span>
      </div>
      <div className="bar bar-lg"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--sev-low)";
  if (s >= 60) return "var(--sev-medium)";
  if (s >= 35) return "var(--sev-high)";
  return "var(--sev-critical)";
}
function severityColorVar(s: "low" | "medium" | "high" | "critical") {
  return {
    low: "var(--sev-low)",
    medium: "var(--sev-medium)",
    high: "var(--sev-high)",
    critical: "var(--sev-critical)",
  }[s];
}
