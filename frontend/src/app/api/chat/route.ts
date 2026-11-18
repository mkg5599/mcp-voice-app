import { z } from "zod";
import { runAgent } from "../../../lib/agent";
import { LIMITS, type ChatEvent } from "../../../lib/chatTypes";
import { config } from "../../../lib/config";
import { describeError } from "../../../lib/errors";
import { enforceLimits, parseLimit } from "../../../lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(LIMITS.maxCharsPerTurn),
      }),
    )
    .min(1)
    .max(LIMITS.maxTurns)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be from the user"),
});

/**
 * Streams the agent's work as NDJSON: text deltas, tool calls, tool results,
 * then a final `done` (or `error`) event.
 */
export async function POST(req: Request) {
  if (!config.geminiApiKey) {
    return Response.json({ code: "config_error", message: "Server is missing GEMINI_API_KEY" }, { status: 500 });
  }

  const limited = enforceLimits(
    req,
    "chat",
    parseLimit(config.limits.chatPerVisitor, { max: 20, windowMs: 600_000 }),
    parseLimit(config.limits.chatGlobal, { max: 300, windowMs: 3_600_000 }),
  );
  if (limited) return limited;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { code: "bad_request", message: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const t0 = Date.now();
      try {
        await runAgent(parsed.data.messages, emit, req.signal);
      } catch (err) {
        if (!req.signal.aborted) {
          const { code, message } = describeError(err);
          console.error(JSON.stringify({ evt: "chat_error", code, detail: String(err).slice(0, 500) }));
          emit({ type: "error", code, message });
        }
      } finally {
        console.log(JSON.stringify({ evt: "chat_turn", latency_ms: Date.now() - t0, model: config.chatModel }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
