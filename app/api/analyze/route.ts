import { NextRequest } from "next/server";
import { analyzePanelImage } from "@/lib/gemini";
import { synthesizeReport } from "@/lib/groq";
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

      const concurrency = 3;
      let cursor = 0;
      const workers = Array.from({ length: Math.min(concurrency, files.length) }, async () => {
        while (true) {
          const i = cursor++;
          if (i >= files.length) break;
          const file = files[i];
          send({ type: "progress", fileName: file.name, status: "analyzing", index: i });
          try {
            const buf = Buffer.from(await file.arrayBuffer());
            const panel = await analyzePanelImage(buf, file.type, file.name);
            results.push(panel);
            send({ type: "panel", data: panel });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push({ fileName: file.name, error: msg });
            send({ type: "error", fileName: file.name, error: msg });
          }
        }
      });
      await Promise.all(workers);

      if (results.length === 0) {
        send({ type: "fatal", error: "All images failed analysis", errors });
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
