import "server-only";

import {
  FunctionCallingConfigMode,
  ThinkingLevel,
  type Content,
  type FunctionCall,
  type Part,
} from "@google/genai";
import type { ChatEvent, ChatTurn } from "./chatTypes";
import { config } from "./config";
import { gemini } from "./gemini";
import { connectMcp, listMcpTools, toFunctionDeclarations, toolResultPayload } from "./mcpClient";
import type { Product } from "../types/product";

const SYSTEM_PROMPT = `You are a friendly, concise shopping assistant for a small apparel and accessories store.

How to work:
- Use the catalog tools for anything about products. Never invent products, prices, colors, sizes or stock locations.
- Prefer semantic_product_search for descriptive requests; add its filters (max_price, colors, city, tags) when the shopper states them.
- Use search_products for pure attribute filters, list_products for "show everything", and get_product for one item's details (sizes, materials).
- You may call several tools, e.g. search, then get_product for the top matches before comparing.
- If nothing matches, say so and suggest the closest alternatives the tools returned.

How to answer:
- The interface already shows product cards for every tool result, so don't repeat every field. Highlight the 1-3 best matches by name with price and why they fit.
- Keep replies short (2-6 sentences or a brief list) and use Markdown sparingly. Prices are in USD.
- Replies may be read aloud, so avoid tables and long lists.`;

/**
 * Agent loop: the model streams text and/or requests tool calls; tools run on the
 * MCP server; results go back to the model until it answers in plain text (or
 * the step cap is reached). Every step is emitted as an event for the UI.
 */
export async function runAgent(
  history: ChatTurn[],
  emit: (e: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const t0 = Date.now();
  const mcp = await connectMcp();
  try {
    const tools = await listMcpTools(mcp);
    const functionDeclarations = toFunctionDeclarations(tools);

    const contents: Content[] = history.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    }));

    let steps = 0;
    for (let step = 0; step < config.maxAgentSteps; step++) {
      steps = step + 1;
      const finalStep = step === config.maxAgentSteps - 1;
      const stream = await gemini().models.generateContentStream({
        model: config.chatModel,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations }],
          toolConfig: {
            functionCallingConfig: {
              mode: finalStep ? FunctionCallingConfigMode.NONE : FunctionCallingConfigMode.AUTO,
            },
          },
          ...(config.thinkingLevel ? { thinkingConfig: { thinkingLevel: config.thinkingLevel as ThinkingLevel } } : {}),
          abortSignal: signal,
        },
      });

      // Keep every part verbatim (including thought signatures) so multi-step
      // tool use works on models that require them.
      const modelParts: Part[] = [];
      const calls: FunctionCall[] = [];
      for await (const chunk of stream) {
        for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
          modelParts.push(part);
          if (part.functionCall) calls.push(part.functionCall);
          else if (part.text && !part.thought) emit({ type: "text", delta: part.text });
        }
      }
      contents.push({ role: "model", parts: modelParts });
      if (calls.length === 0) break;

      const responses: Part[] = [];
      for (const [i, call] of calls.entries()) {
        const name = call.name ?? "unknown";
        const id = call.id ?? `${step}-${i}-${name}`;
        const args = (call.args ?? {}) as Record<string, unknown>;
        emit({ type: "tool_call", id, name, args });

        let payload: Record<string, unknown>;
        try {
          const result = await mcp.callTool({ name, arguments: args }, undefined, { signal });
          payload = toolResultPayload(result);
          emit(toolResultEvent(id, name, payload));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          payload = { error: message };
          emit({ type: "tool_result", id, name, ok: false, error: message });
        }
        responses.push({ functionResponse: { id: call.id, name, response: payload } });
      }
      contents.push({ role: "user", parts: responses });
    }

    emit({ type: "done", model: config.chatModel, latency_ms: Date.now() - t0, steps });
  } finally {
    await mcp.close().catch(() => {});
  }
}

function toolResultEvent(id: string, name: string, payload: Record<string, unknown>): ChatEvent {
  if (typeof payload.error === "string") {
    return { type: "tool_result", id, name, ok: false, error: payload.error };
  }
  // Product tools return {count, products, method}; get_product returns one product.
  const products = Array.isArray(payload.products)
    ? (payload.products as Product[])
    : typeof payload.id === "number" && typeof payload.name === "string"
      ? [payload as unknown as Product]
      : undefined;
  return {
    type: "tool_result",
    id,
    name,
    ok: true,
    method: typeof payload.method === "string" ? payload.method : undefined,
    count: products?.length,
    products,
  };
}
