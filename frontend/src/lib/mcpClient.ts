import "server-only";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { FunctionDeclaration } from "@google/genai";
import { config } from "./config";

/**
 * MCP host side: connects to the backend's MCP server over Streamable HTTP using
 * the official SDK, discovers its tools, and turns them into Gemini function
 * declarations. Nothing here is specific to this catalog. Point BACKEND_INTERNAL_URL
 * at any MCP server and the agent picks up its tools.
 */

type McpTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];
export type McpCallResult = Awaited<ReturnType<Client["callTool"]>>;

export async function connectMcp(): Promise<Client> {
  const client = new Client({ name: "voice-shopping-agent", version: "2.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${config.backendUrl}/mcp`));
  await client.connect(transport);
  return client;
}

const TOOLS_TTL_MS = 60_000;
let toolCache: { tools: McpTool[]; at: number } | null = null;

export async function listMcpTools(client: Client): Promise<McpTool[]> {
  if (toolCache && Date.now() - toolCache.at < TOOLS_TTL_MS) return toolCache.tools;
  const { tools } = await client.listTools();
  toolCache = { tools, at: Date.now() };
  return tools;
}

export function toFunctionDeclarations(tools: McpTool[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: [t.annotations?.title ?? t.title, t.description].filter(Boolean).join(": "),
    parametersJsonSchema: simplifySchema(t.inputSchema),
  }));
}

/**
 * Trim JSON Schema down to what function-calling models handle reliably:
 * collapse `anyOf: [X, {type: "null"}]` (how Pydantic writes Optional[X]) into X,
 * and drop noise like `title` and `default: null`.
 */
export function simplifySchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(simplifySchema);
  if (!schema || typeof schema !== "object") return schema;

  const s = { ...(schema as Record<string, unknown>) };
  if (Array.isArray(s.anyOf)) {
    const nonNull = (s.anyOf as Record<string, unknown>[]).filter((o) => o?.type !== "null");
    if (nonNull.length === 1) {
      const { anyOf: _drop, ...rest } = s;
      void _drop;
      return simplifySchema({ ...nonNull[0], ...rest });
    }
  }
  delete s.title;
  if (s.default === null) delete s.default;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    out[k] = k === "properties" && v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, simplifySchema(pv)]))
      : typeof v === "object" ? simplifySchema(v) : v;
  }
  return out;
}

/** Plain-object payload to hand back to the model as a function response. */
export function toolResultPayload(result: McpCallResult): Record<string, unknown> {
  if (result.isError) {
    return { error: textOf(result) || "Tool failed" };
  }
  if (result.structuredContent && typeof result.structuredContent === "object") {
    return result.structuredContent as Record<string, unknown>;
  }
  return { result: textOf(result) };
}

function textOf(result: McpCallResult): string {
  const content = (result.content ?? []) as { type: string; text?: string }[];
  return content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
}
