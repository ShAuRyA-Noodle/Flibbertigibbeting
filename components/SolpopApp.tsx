"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadZone, type StagedFile } from "./UploadZone";
import { AnalysisCard, type Pending } from "./AnalysisCard";
import { ReportDashboard } from "./ReportDashboard";
import { PanelReportSheet } from "./PanelReportSheet";
import type { FullAnalysis, PanelAnalysis } from "@/lib/schema";

type Phase = "idle" | "running" | "synthesizing" | "complete" | "error";

export function SolpopApp() {
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [panels, setPanels] = useState<PanelAnalysis[]>([]);
  const [report, setReport] = useState<FullAnalysis | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);

  const previewByName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of files) m[f.file.name] = f.previewUrl;
    return m;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const f of files) URL.revokeObjectURL(f.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setPending({});
    setPanels([]);
    setReport(null);
    setTopError(null);
  }, []);

  const onAnalyze = useCallback(async () => {
    if (files.length === 0) return;
    setPhase("running");
    setReport(null);
    setPanels([]);
    setTopError(null);
    const initial: Record<string, Pending> = {};
    for (const f of files) initial[f.file.name] = { fileName: f.file.name, status: "queued" };
    setPending(initial);

    const fd = new FormData();
    for (const f of files) fd.append("images", f.file, f.file.name);

    let res: Response;
    try {
      res = await fetch("/api/analyze", { method: "POST", body: fd });
    } catch (e) {
      setTopError(e instanceof Error ? e.message : "Network error");
      setPhase("error");
      return;
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      setTopError(text || `Request failed (${res.status})`);
      setPhase("error");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const evt = JSON.parse(line);
          handleEvent(evt);
        } catch {
          /* ignore malformed lines */
        }
      }
    }
    if (buf.trim()) {
      try { handleEvent(JSON.parse(buf)); } catch { /* noop */ }
    }

    function handleEvent(evt: { type: string; [k: string]: unknown }) {
      switch (evt.type) {
        case "progress": {
          const fileName = String(evt.fileName);
          setPending((p) => ({ ...p, [fileName]: { fileName, status: "analyzing" } }));
          break;
        }
        case "panel": {
          const panel = evt.data as PanelAnalysis;
          setPanels((arr) => [...arr, panel]);
          setPending((p) => ({
            ...p,
            [panel.fileName]: { fileName: panel.fileName, status: "done" },
          }));
          break;
        }
        case "error": {
          const fileName = String(evt.fileName);
          setPending((p) => ({
            ...p,
            [fileName]: { fileName, status: "failed", error: String(evt.error ?? "Failed") },
          }));
          break;
        }
        case "synthesizing":
          setPhase("synthesizing");
          break;
        case "report":
          setReport(evt.data as FullAnalysis);
          setPhase("complete");
          break;
        case "synthesis_error":
          setTopError(String(evt.error ?? "Synthesis failed"));
          setPhase("error");
          break;
        case "fatal":
          setTopError(String(evt.error ?? "Analysis failed"));
          setPhase("error");
          break;
      }
    }
  }, [files]);

  const downloadJson = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solaris-report-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [report]);

  const busy = phase === "running" || phase === "synthesizing";
  const hasResults = panels.length > 0 || phase === "synthesizing" || phase === "complete";

  return (
    <section id="analyze" className="relative">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-20 md:py-28 space-y-12">
        <div className="flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="tick mb-3">Inspection workspace</div>
            <h2 className="h-display text-[44px] md:text-[72px]">Inspect a fleet.</h2>
          </div>
          {(hasResults || files.length > 0) && (
            <button onClick={() => { reset(); setFiles((curr) => { for (const f of curr) URL.revokeObjectURL(f.previewUrl); return []; }); }} className="btn-ghost text-sm">
              Reset session
            </button>
          )}
        </div>

        <UploadZone files={files} setFiles={setFiles} onAnalyze={onAnalyze} busy={busy} />

        <AnimatePresence>
          {topError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card p-5 border-[rgba(239,35,60,0.4)]"
            >
              <div className="severity-pill critical mb-2">Error</div>
              <p className="text-[var(--fg-dim)] text-[14px]">{topError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasResults && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-block w-2 h-2 rounded-full ${phase === "complete" ? "bg-[var(--sev-low)]" : "bg-[var(--accent)] animate-pulse"}`} />
                <span className="tick">
                  {phase === "running" && "Running multimodal inspection"}
                  {phase === "synthesizing" && "Synthesizing executive report"}
                  {phase === "complete" && "Inspection complete"}
                  {phase === "error" && "Inspection halted"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {files.map((f, idx) => {
                  const pend = pending[f.file.name] ?? { fileName: f.file.name, status: "queued" as const };
                  const panel = panels.find((p) => p.fileName === f.file.name);
                  return (
                    <AnalysisCard
                      key={f.id}
                      pending={pend}
                      panel={panel}
                      previewUrl={previewByName[f.file.name]}
                      index={idx}
                      onOpen={panel ? () => setOpenPanelId(panel.panelId) : undefined}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {report && (
            <ReportDashboard
              data={report}
              onDownload={downloadJson}
              onOpenPanel={(id) => setOpenPanelId(id)}
            />
          )}
        </AnimatePresence>
      </div>

      <PanelReportSheet
        panel={openPanelId ? panels.find((p) => p.panelId === openPanelId) ?? null : null}
        previewUrl={(() => {
          if (!openPanelId) return undefined;
          const p = panels.find((x) => x.panelId === openPanelId);
          return p ? previewByName[p.fileName] : undefined;
        })()}
        index={Math.max(0, panels.findIndex((p) => p.panelId === openPanelId))}
        total={panels.length}
        onClose={() => setOpenPanelId(null)}
      />
    </section>
  );
}
