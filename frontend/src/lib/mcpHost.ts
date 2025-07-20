import { ToolUnion, Type } from "@google/genai";

/* ---------- Types that mirror discovery ---------- */
interface McpTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<
      string,
      {
        type: string;
        items?: { type: string };
        description?: string;
      }
    >;
    required?: string[];
  };
}

interface McpDiscovery {
  name: string;
  version: string;
  description: string;
  tools: McpTool[];
}

/* ---------- Configuration ---------- */
const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";
if (!BACKEND_INTERNAL_URL) {
  throw new Error(
    "BACKEND_INTERNAL_URL is not defined. Set this env var on the server."
  );
}

// Relax how strict we are with missing / unknown args during early dev.
const RELAXED_VALIDATION = true;
const CACHE_TTL_MS = 60_000;

/* ---------- Cache ---------- */
let cachedDiscovery: McpDiscovery | null = null;
let cachedAt = 0;

/* ---------- Fetch & Cache ---------- */
async function fetchAndCacheDiscovery(): Promise<McpDiscovery> {
  const now = Date.now();
  if (cachedDiscovery && now - cachedAt < CACHE_TTL_MS) {
    return cachedDiscovery;
  }
  const response = await fetch(
    `${BACKEND_INTERNAL_URL}/.well-known/mcp.json`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch MCP discovery: ${response.status} ${response.statusText}`
    );
  }
  cachedDiscovery = (await response.json()) as McpDiscovery;
  cachedAt = now;
  return cachedDiscovery;
}

export function clearDiscoveryCache(): void {
  cachedDiscovery = null;
  cachedAt = 0;
}

/* ---------- Schema Conversion ---------- */

type SchemaProperty = {
  type: Type;
  items?: SchemaProperty;
};

function convertSchemaProperty(
  prop: { type: string; items?: { type: string } }
): SchemaProperty {
  switch (prop.type) {
    case "string":
      return { type: Type.STRING };
    case "number":
      return { type: Type.NUMBER };
    case "boolean":
      return { type: Type.BOOLEAN };
    case "array":
      return {
        type: Type.ARRAY,
        items: prop.items ? convertSchemaProperty(prop.items) : undefined,
      };
    case "object":
      return { type: Type.OBJECT };
    default:
      // Fail fast in dev; you can downgrade to a console.warn if desired.
      throw new Error(`Unsupported schema property type: ${prop.type}`);
  }
}

/* ---------- Tool Declarations for Gemini ---------- */
export async function getToolDeclarations(): Promise<ToolUnion[]> {
  const discovery = await fetchAndCacheDiscovery();

  return discovery.tools.map<ToolUnion>((tool) => {
    const propertiesEntries = Object.entries(
      tool.input_schema.properties || {}
    ).map(([key, prop]: [string, { type: string; items?: { type: string }; description?: string }]) => [key, convertSchemaProperty(prop)]);
    const properties = Object.fromEntries(propertiesEntries);

    // If the schema includes "required", we can pass it; the SDK doesn't
    // mandate it but it helps function call argument generation sometimes.
    const required = tool.input_schema.required ?? [];

    return {
      functionDeclarations: [
        {
          name: tool.name,
          description: tool.description,
          // The Gemini SDK parameter shape:
          parameters: {
            type: Type.OBJECT,
            properties,
            // Only include required if non-empty (avoid confusing model)
            ...(required.length ? { required } : {}),
          },
        },
      ],
    };
  });
}

/* ---------- Argument Validation ---------- */
export async function validateArgs(
  toolName: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const discovery = await fetchAndCacheDiscovery();
  const tool = discovery.tools.find((t) => t.name === toolName);
  if (!tool) throw new Error(`Tool '${toolName}' not found in discovery.`);

  const schema = tool.input_schema;
  const props = schema.properties || {};
  const requiredSet = new Set(schema.required ?? []); // empty means all optional

  const validated: Record<string, unknown> = {};

  // Validate provided args (and optionally drop unknown)
  for (const [argName, value] of Object.entries(args)) {
    const schemaProp = props[argName];
    if (!schemaProp) {
      if (RELAXED_VALIDATION) {
        // Ignore unknown in relaxed mode
        continue;
      } else {
        throw new Error(
          `Unknown argument '${argName}' for tool '${toolName}'.`
        );
      }
    }
    // Type checks
    if (!isValueTypeCompatible(schemaProp.type, value)) {
      throw new Error(
        `Argument '${argName}' expected type '${schemaProp.type}', got '${typeof value}'.`
      );
    }
    if (schemaProp.type === "array" && schemaProp.items?.type === "string") {
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
        throw new Error(
          `Argument '${argName}' must be an array of strings (schema items.type=string).`
        );
      }
    }
    validated[argName] = value;
  }

  // Check required properties if any
  if (requiredSet.size) {
    for (const reqName of requiredSet) {
      if (!(reqName in validated)) {
        throw new Error(
          `Missing required argument '${reqName}' for tool '${toolName}'.`
        );
      }
    }
  }

  // If STRICT (not relaxed) and arguments missing but schema marks none required
  // we allow empties (makes partial filter queries possible).

  return validated;
}

function isValueTypeCompatible(expected: string, value: unknown): boolean {
  switch (expected) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

/* ---------- Invoke Tool (JSON-RPC) ---------- */
export async function invokeTool<T = unknown>(
  name: string,
  rawArgs: Record<string, unknown>
): Promise<T> {
  // Validate / sanitize args
  const args = await validateArgs(name, rawArgs);

  const r = await fetch(`${BACKEND_INTERNAL_URL}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: name,
      params: args,
      id: Date.now(),
    }),
  });

  if (!r.ok) {
    throw new Error(`MCP HTTP error: ${r.status} ${r.statusText}`);
  }

  const body = await r.json();
  if (body.error) {
    throw new Error(
      `MCP tool error: ${body.error.message || "unknown error"}`
    );
  }
  return body.result as T;
}