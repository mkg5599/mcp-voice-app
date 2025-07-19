// runtime hint (optional, keeps everything on Node not edge):
export const runtime = "nodejs";

import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  Part,
} from "@google/genai";
import type { Content, FunctionCall } from "@google/genai";
import { NextResponse } from "next/server";
import {
  getToolDeclarations,
  invokeTool, // your helper in lib/mcpHost
} from "../../../lib/mcpHost";

/**
 * Fail fast if key absent — prevents silent 401s at runtime.
 */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("[/api/chat] Missing GEMINI_API_KEY env var");
  // (Don’t throw here because Next might import during build; we check again in handler.)
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY ?? "" });

// ---- Constants ----
const MAX_INPUT_CHARS = 2000;

export async function POST(req: Request) {
  const t0 = Date.now();
  let toolCalled: string | undefined;
  let toolArgs: Record<string, unknown> | undefined;
  let productsCount = 0;

  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "config_error",
          detail: "Server missing GEMINI_API_KEY",
        },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return logAndRespond({
        status: 400,
        payload: { error: "No text" },
        meta: { t0, tool: "none", productsCount, error: "No text" },
      });
    }

    if (text.length > MAX_INPUT_CHARS) {
      return logAndRespond({
        status: 400,
        payload: {
          error: "input_too_long",
          detail: `Input exceeds ${MAX_INPUT_CHARS} characters`,
        },
        meta: {
          t0,
          tool: "none",
          productsCount,
          error: "input too long",
        },
      });
    }

    // Dynamically build functionDeclarations from discovery:
    const tools = await getToolDeclarations();

    // ---- First model call (allow function calling) ----
    const first = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: text,
      config: {
        tools,
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
        },
      },
    });

    const fc: FunctionCall | undefined = first.functionCalls?.[0];

    // If no tool chosen, just return the model text
    if (!fc || !fc.name) {
      return logAndRespond({
        status: 200,
        payload: {
          message: first.text ?? "",
          latency_ms: Date.now() - t0,
        },
        meta: {
          t0,
          tool: "none",
          productsCount,
        },
      });
    }

    toolCalled = fc.name;
    toolArgs = (fc.args ?? {}) as Record<string, unknown>;

    // ---- Invoke tool via JSON-RPC backend ----
    const toolResult = await invokeTool(fc.name, toolArgs);

    // If array => treat as product list
    if (Array.isArray(toolResult)) {
      productsCount = toolResult.length;
      return logAndRespond({
        status: 200,
        payload: {
          message: `Found ${productsCount} product(s).`,
          products: toolResult,
          tool_called: toolCalled,
          tool_call_args: toolArgs,
          latency_ms: Date.now() - t0,
        },
        meta: {
          t0,
          tool: toolCalled || "none",
          productsCount,
        },
      });
    }

    // ---- Second turn: feed functionResponse back (no more function calls) ----
    const conversation: Content[] = [
      { role: "user", parts: [{ text }] },
      { role: "model", parts: [{ functionCall: fc }] },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              name: fc.name,
              response: toolResult as Record<string, unknown>,
            },
          } as Part,
        ],
      },
    ];

    const second = await ai.models.generateContent({
      model: "gemini-2.0-flash-001",
      contents: conversation,
      config: {
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.NONE },
        },
      },
    });

    return logAndRespond({
      status: 200,
      payload: {
        message: second.text ?? "",
        result: toolResult, // you can rename or omit if not needed
        tool_called: toolCalled,
        tool_call_args: toolArgs,
        latency_ms: Date.now() - t0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      meta: {
        t0,
        tool: toolCalled || "none",
        productsCount,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return logAndRespond({
      status: 500,
      payload: { error: "chat_failed", detail: msg },
      meta: {
        t0,
        tool: toolCalled || "error",
        productsCount,
        error: msg,
      },
    });
  }
}

/**
 * Unified logging + response.
 */
function logAndRespond({
  status,
  payload,
  meta,
}: {
  status: number;
  payload: Record<string, unknown>;
  meta: {
    t0: number;
    tool: string;
    productsCount: number;
    error?: string;
  };
}) {
  const latency = Date.now() - meta.t0;
  console.log(
    JSON.stringify({
      evt: "chat_turn_complete",
      tool: meta.tool,
      products_count: meta.productsCount,
      latency_ms: latency,
      error: meta.error,
    }),
  );
  if (!("latency_ms" in payload)) {
    (payload as Record<string, unknown>)["latency_ms"] = latency;
  }
  return NextResponse.json(payload, { status });
}