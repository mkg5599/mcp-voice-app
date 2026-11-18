#!/usr/bin/env node
/**
 * Smoke test for the product catalog MCP server.
 *
 * Sends raw JSON-RPC over Streamable HTTP (initialize, tools/list, tools/call,
 * resources/read, prompts/get) to ${BACKEND_URL}/mcp. No dependencies; needs Node 18+.
 *
 *   node scripts/test_mcp.js
 *   BACKEND_URL=https://<your-backend>.vercel.app node scripts/test_mcp.js
 */
const BASE = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const ENDPOINT = `${BASE}/mcp`;
const EXPECTED_TOOLS = ["list_products", "search_products", "semantic_product_search", "get_product"];

let nextId = 1;
let failures = 0;

async function rpc(method, params) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params ? { params } : {}) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);

  // The server replies with JSON; accept an SSE-framed reply too, in case a deployment streams.
  const body = (res.headers.get("content-type") ?? "").includes("text/event-stream")
    ? JSON.parse(text.split("\n").filter((l) => l.startsWith("data:")).pop().slice(5))
    : JSON.parse(text);
  if (body.error) throw new Error(`JSON-RPC error ${body.error.code}: ${body.error.message}`);
  return body.result;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`PASS  ${name}${detail ? `: ${detail}` : ""}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

async function main() {
  console.log(`MCP endpoint: ${ENDPOINT}\n`);

  await check("initialize", async () => {
    const r = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test_mcp.js", version: "2.0.0" },
    });
    assert(r.serverInfo?.name === "product-catalog", `unexpected server ${JSON.stringify(r.serverInfo)}`);
    return `${r.serverInfo.name} ${r.serverInfo.version}, protocol ${r.protocolVersion}`;
  });

  await check("tools/list", async () => {
    const { tools } = await rpc("tools/list");
    const names = tools.map((t) => t.name);
    for (const expected of EXPECTED_TOOLS) assert(names.includes(expected), `missing tool ${expected}`);
    assert(tools.every((t) => t.outputSchema), "every tool should declare an outputSchema");
    assert(tools.every((t) => t.annotations?.readOnlyHint), "every tool should be read-only");
    return names.join(", ");
  });

  const call = async (name, args) => {
    const r = await rpc("tools/call", { name, arguments: args });
    assert(!r.isError, r.content?.[0]?.text ?? "tool returned isError");
    return r.structuredContent;
  };

  await check("tools/call list_products", async () => {
    const r = await call("list_products", {});
    assert(r.count > 0 && r.method === "catalog", JSON.stringify(r).slice(0, 200));
    return `${r.count} products`;
  });

  await check("tools/call search_products", async () => {
    const r = await call("search_products", { colors: ["red"], max_price: 50 });
    assert(r.method === "filter", `method ${r.method}`);
    assert(r.products.every((p) => p.price <= 50), "a product exceeds max_price");
    return `${r.count} red items under $50`;
  });

  await check("tools/call semantic_product_search", async () => {
    const r = await call("semantic_product_search", { query: "something warm for winter", top_k: 3 });
    assert(["semantic", "keyword_fallback"].includes(r.method), `method ${r.method}`);
    return `${r.count} results via ${r.method}: ${r.products.map((p) => p.name).join(", ")}`;
  });

  await check("tools/call get_product", async () => {
    const r = await call("get_product", { product_id: 1 });
    assert(r.id === 1, `got id ${r.id}`);
    return r.name;
  });

  await check("tools/call get_product (unknown id)", async () => {
    const r = await rpc("tools/call", { name: "get_product", arguments: { product_id: 999999 } });
    assert(r.isError === true, "expected isError: true");
    return "isError as expected";
  });

  await check("resources/read catalog://products", async () => {
    const r = await rpc("resources/read", { uri: "catalog://products" });
    const products = JSON.parse(r.contents[0].text);
    assert(Array.isArray(products) && products.length > 0, "empty catalog resource");
    return `${products.length} products`;
  });

  await check("prompts/get shopping_assistant", async () => {
    const r = await rpc("prompts/get", { name: "shopping_assistant", arguments: { need: "a rain jacket" } });
    assert(r.messages?.length > 0, "no prompt messages");
    return `${r.messages.length} message(s)`;
  });

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
