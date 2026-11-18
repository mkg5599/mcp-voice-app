# MCP server

The backend exposes the product catalog as a standard [Model Context Protocol](https://modelcontextprotocol.io)
server. It's built with the official MCP Python SDK (`mcp` 2.x, `MCPServer`) in `backend/mcp_server.py` and
mounted in the FastAPI app at `/mcp`. This app's web agent is one client; Claude, MCP Inspector or any other
MCP client can connect the same way.

## Transport

| Choice | Setting | Why |
|--------|---------|-----|
| Streamable HTTP | route `/mcp` | The current HTTP transport in the MCP spec. Works with a plain HTTPS URL, no separate SSE endpoint. |
| Stateless | `stateless=True` | No `Mcp-Session-Id` and no server-side session state. Any request can go to any instance. |
| JSON responses | `json_response=True` | Each POST gets a single `application/json` reply instead of an SSE stream. The tools are quick request/response calls, so streaming adds nothing. |
| Session manager per request | `MCPHttpEndpoint.__call__` | A fresh `StreamableHTTPSessionManager` is created, run and torn down inside every request. |
| DNS-rebinding protection off | `TransportSecuritySettings(enable_dns_rebinding_protection=False)` | The SDK's default protection only allows localhost hosts. This server is public, read-only and unauthenticated; browsers are limited by CORS (`ALLOWED_ORIGINS`) instead. |

**Why a manager per request?** The usual setup starts one session manager in the app's lifespan and keeps
it running. On Vercel's Python runtime, lifespan events and background tasks aren't guaranteed, and two
requests from the same client can land on different instances. Since the server is stateless, creating the
manager per request costs little and removes any dependency on process lifetime.

Behaviour that follows from this:

- `initialize` is optional. Each request is handled on its own, so a client can send `tools/list` or
  `tools/call` directly (the tests and the curl example below do).
- `DELETE /mcp` returns `405`, since there's no session to terminate.
- The FastAPI CORS middleware exposes the `Mcp-Session-Id` and `Mcp-Protocol-Version` headers to browsers.

## Tools

All four tools carry `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`, and declare an
output schema (the `ProductResults` or `Product` Pydantic model), so results come back as
`structuredContent` along with a JSON text copy in `content`.

| Tool | Title | Arguments | Result |
|------|-------|-----------|--------|
| `list_products` | List all products | none | `ProductResults`, `method: "catalog"` |
| `search_products` | Filter products | `colors?: string[]`, `city?: string`, `min_price?: number >= 0`, `max_price?: number >= 0`, `tags?: string[]` | `ProductResults`, `method: "filter"` |
| `semantic_product_search` | Semantic product search | `query: string`, `top_k: 1-50` (default 5), plus the filters above | `ProductResults`, `method: "semantic"` or `"keyword_fallback"` |
| `get_product` | Get product details | `product_id: integer` | `Product`; an unknown id returns `isError: true` |

`ProductResults` is `{ count, products: Product[], method }`. A `Product` has `id`, `name`, `description`,
`colors`, `tags`, `specs` (fabric, sizes, ...), `price` (USD), `city`, `updated_at`, and `similarity_score`
(semantic results only). Filter semantics and the fallback are covered in
[semantic_search.md](semantic_search.md).

The server's `instructions` (returned from `initialize`) tell clients when to use which search tool.

## Resources and prompts

- **Resource** `catalog://products` (`application/json`): the full catalog.
- **Prompt** `shopping_assistant(need: string)`: returns a user message asking the model to find, compare
  and recommend products for that need.

## Raw JSON-RPC examples

The `accept` header lists both types, as the Streamable HTTP spec requires of clients.

```bash
curl -s http://localhost:8000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Call a tool:

```bash
curl -s http://localhost:8000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_products","arguments":{"colors":["red"],"max_price":50}}}'
```

Read the resource, or render the prompt:

```bash
-d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"catalog://products"}}'
-d '{"jsonrpc":"2.0","id":4,"method":"prompts/get","params":{"name":"shopping_assistant","arguments":{"need":"a rain jacket"}}}'
```

`scripts/test_mcp.js` runs `initialize`, `tools/list` and a few `tools/call` requests against any backend
(`BACKEND_URL=https://<your-backend>.vercel.app node scripts/test_mcp.js`).

## Connecting clients

```bash
# Claude Code
claude mcp add --transport http product-catalog https://<your-backend>.vercel.app/mcp

# MCP Inspector: pick "Streamable HTTP" and enter the /mcp URL
npx @modelcontextprotocol/inspector
```

This app's agent connects with `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk`
(`frontend/src/lib/mcpClient.ts`); see [agent.md](agent.md).

## Adding a tool

1. Write the logic in `ProductService` (`backend/services/product_service.py`) so REST and MCP share it.
2. Add a function decorated with `@mcp.tool(title=..., annotations=READ_ONLY)` in `mcp_server.py`. Use
   `Annotated[..., Field(description=...)]` for arguments and return a Pydantic model so the SDK generates
   both schemas.
3. Add its name to `TOOL_NAMES` (used by `/`, `/healthz` and the tests).
4. Optionally add a REST route in `backend/routes/products.py`, a label in
   `frontend/src/components/ToolCallChip.tsx`, and a hint in the agent's system prompt
   (`frontend/src/lib/agent.ts`).

The agent discovers tools at runtime, so it can use a new tool without any other frontend change (after the
60-second tool cache expires).

## Tests

`backend/tests/test_mcp.py` checks the server with the official in-process client (`mcp.Client`): tools,
annotations, output schemas, the resource and the prompt, structured results and the error for an unknown
id. It also posts raw JSON-RPC (`initialize`, `tools/list`, `tools/call`) to `/mcp` through FastAPI's
`TestClient`.
