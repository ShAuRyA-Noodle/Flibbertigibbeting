import { NextRequest } from "next/server";
import { analyzePanelImage, detectPanels, type DetectedPanel } from "@/lib/gemini";
import { synthesizeReport } from "@/lib/groq";
import { cropFromBBox, normalizeUpload, bufferToDataUrl } from "@/lib/imageCrop";
import type { PanelAnalysis } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 24;
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Invalid multipart form");

  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length === 0) return jsonError(400, "No images provided");
  if (files.length > MAX_FILES) return jsonError(400, `Max ${MAX_FILES} images per request`);

  for (const f of files) {
    if (!ALLOWED.has(f.type)) return jsonError(400, `Unsupported type: ${f.type || f.name}`);
    if (f.size > MAX_BYTES) return jsonError(400, `File too large: ${f.name}`);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      send({ type: "start", count: files.length });

      const results: PanelAnalysis[] = [];
      const errors: { fileName: string; error: string }[] = [];

      // Per-file: detect panels in image. If 2+ found, crop each and analyze.
      // If 0 or 1 found, analyze whole image.
      type Job = {
        sourceFileName: string;
        sourceIndex: number;
        sourceBBox?: [number, number, number, number];
        buffer: Buffer;
        mimeType: string;
        imageDataUrl?: string; // data URL only for cropped subimages (originals held by client)
      };
      const jobs: Job[] = [];

      // === Phase 1: detection (sequential per file, fast Gemini call) ===
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        send({ type: "progress", fileName: file.name, status: "detecting", index: i });
        let normalized: { buffer: Buffer; mimeType: string; width: number; height: number };
        try {
          const raw = Buffer.from(await file.arrayBuffer());
          normalized = await normalizeUpload(raw, file.type);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push({ fileName: file.name, error: `Pre-processing failed: ${msg}` });
          send({ type: "error", fileName: file.name, error: `Pre-processing failed: ${msg}` });
          continue;
        }

        let detected: DetectedPanel[] = [];
        try {
          detected = await detectPanels(normalized.buffer, normalized.mimeType);
        } catch (e) {
          // detection failure is non-fatal; we fall back to whole-image
          const msg = e instanceof Error ? e.message : String(e);
          send({ type: "detect_warn", fileName: file.name, message: msg });
        }

        send({
          type: "detected",
          fileName: file.name,
          index: i,
          count: detected.length,
          panels: detected.map((d, idx) => ({ index: idx, bbox: d.bbox, confidence: d.confidence })),
          width: normalized.width,
          height: normalized.height,
        });

        if (detected.length >= 2) {
          // Multi-panel split: crop each and queue
          for (let k = 0; k < detected.length; k++) {
            const det = detected[k];
            try {
              const crop = await cropFromBBox(normalized.buffer, det.bbox);
              jobs.push({
                sourceFileName: file.name,
                sourceIndex: k,
                sourceBBox: det.bbox,
                buffer: crop.buffer,
                mimeType: crop.mimeType,
                imageDataUrl: bufferToDataUrl(crop.buffer, crop.mimeType),
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              errors.push({ fileName: `${file.name}#${k}`, error: `Crop failed: ${msg}` });
              send({ type: "error", fileName: `${file.name}#${k}`, error: `Crop failed: ${msg}` });
            }
          }
        } else {
          // Single-panel: keep whole normalized image (no source bbox)
          jobs.push({
            sourceFileName: file.name,
            sourceIndex: 0,
            buffer: normalized.buffer,
            mimeType: normalized.mimeType,
          });
        }
      }

      if (jobs.length === 0) {
        send({ type: "fatal", error: "No analyzable panels in any uploaded image", errors });
        controller.close();
        return;
      }

      send({ type: "queue", total: jobs.length });

      // === Phase 2: per-job vision analysis (parallel, gentle on free-tier rate-limits) ===
      const concurrency = 2;
      const interJobStaggerMs = 350;
      let cursor = 0;
      let started = 0;
      const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
        while (true) {
          const i = cursor++;
          if (i >= jobs.length) break;
          if (started > 0) {
            await new Promise((r) => setTimeout(r, interJobStaggerMs));
          }
          started++;
          const j = jobs[i];
          const jobLabel =
            j.sourceBBox != null ? `${j.sourceFileName}#${j.sourceIndex + 1}` : j.sourceFileName;
          send({
            type: "progress",
            fileName: jobLabel,
            sourceFileName: j.sourceFileName,
            sourceIndex: j.sourceIndex,
            status: "analyzing",
            index: i,
          });
          try {
            const panel = await analyzePanelImage(j.buffer, j.mimeType, jobLabel);
            // Carry source provenance so client can route to the right thumbnail/overlay
            panel.sourceFileName = j.sourceFileName;
            panel.sourceIndex = j.sourceIndex;
            panel.sourceBBox = j.sourceBBox;
            panel.imageDataUrl = j.imageDataUrl; // only for cropped panels
            results.push(panel);
            send({ type: "panel", data: panel });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push({ fileName: jobLabel, error: msg });
            send({ type: "error", fileName: jobLabel, error: msg });
          }
        }
      });
      await Promise.all(workers);

      if (results.length === 0) {
        send({ type: "fatal", error: "All panels failed analysis", errors });
        controller.close();
        return;
      }

      send({ type: "synthesizing" });
      try {
        const report = await synthesizeReport(results);
        send({
          type: "report",
          data: {
            panels: results,
            report,
            generatedAt: new Date().toISOString(),
            modelInfo: {
              vision: process.env.GEMINI_MODEL || "gemini-flash",
              synthesis: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            },
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "synthesis_error", error: msg });
      }

      send({ type: "done", errors });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
