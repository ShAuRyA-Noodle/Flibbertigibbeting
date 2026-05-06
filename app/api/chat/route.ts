import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { CHAT_SYSTEM, buildSessionContext } from "@/lib/chatPrompt";
import type { FullAnalysis } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const apiKey = process.env.GROQ_API_KEY!;
const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const groq = new Groq({ apiKey });

type ClientMessage = { role: "user" | "assistant"; content: string };

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type ChatRequestBody = { messages?: ClientMessage[]; session?: FullAnalysis };

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  const body = (raw ?? {}) as ChatRequestBody;
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError(400, "messages required");
  }
  const session = body.session;
  if (!session || !Array.isArray(session.panels) || !session.report) {
    return jsonError(400, "session payload missing");
  }

  const sessionContext = buildSessionContext(session);

  const messages = [
    { role: "system" as const, content: CHAT_SYSTEM(sessionContext) },
    ...body.messages.slice(-30).map((m: ClientMessage) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
    })),
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));

      try {
        const completion = await groq.chat.completions.create({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 1100,
          stream: true,
        });
        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) send({ type: "delta", text: delta });
          const finish = chunk.choices?.[0]?.finish_reason;
          if (finish) send({ type: "done", reason: finish });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
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
