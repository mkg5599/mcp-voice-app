# Chat agent and streaming protocol

The chat runs entirely on the Next.js server. The browser posts the conversation to `/api/chat`; the route
runs an agent loop that talks to Gemini and to the MCP server, and streams what happens back as
newline-delimited JSON (NDJSON).

Code: `frontend/src/app/api/chat/route.ts`, `frontend/src/lib/agent.ts`, `frontend/src/lib/mcpClient.ts`,
`frontend/src/lib/chatTypes.ts`, and on the client `frontend/src/lib/useChat.ts`.

## Request

```http
POST /api/chat
content-type: application/json

{ "messages": [ { "role": "user", "content": "Red items under $50" } ] }
```

Validated with zod (`LIMITS` in `chatTypes.ts`):

- 1 to 30 messages, each `role: "user" | "assistant"` with 1 to 4000 characters of content.
- The last message has to be from the user.

Errors before streaming starts come back as plain JSON with a `code` and `message`: `400 bad_request` for
an invalid body, `500 config_error` if `GEMINI_API_KEY` isn't set.

History is text only. The client sends user messages and completed assistant replies (most recent 30);
tool calls and results from earlier turns aren't replayed. If a follow-up needs data, the model calls the
tools again.

## The agent loop (`runAgent`)

1. **Connect.** Open an MCP client (`@modelcontextprotocol/sdk`, `StreamableHTTPClientTransport`) to
   `${BACKEND_INTERNAL_URL}/mcp`. One connection per chat request, closed when the request ends.
2. **Discover tools.** `tools/list`, cached for 60 seconds per server instance.
3. **Convert tools.** `toFunctionDeclarations()` turns each MCP tool into a Gemini function declaration:
   the name, a description built from the tool's title and description, and the input schema passed as
   `parametersJsonSchema`. `simplifySchema()` first collapses Pydantic's `anyOf: [X, {type: "null"}]`
   (how `Optional[X]` is written) into `X` and drops `title` and `default: null`, which function-calling
   models handle less reliably. Nothing in `mcpClient.ts` is specific to this catalog.
4. **Call the model.** `generateContentStream` with the system prompt, the conversation and the tools,
   function calling mode `AUTO`, so the model decides whether to call tools.
5. **Stream the output.** Visible text parts are emitted as `text` events right away. Every part, including
   thought parts and their thought signatures, is kept verbatim in the model turn so multi-step tool use
   keeps working on models that require the signatures to be sent back.
6. **Run tools.** If the model asked for function calls, each one runs on the MCP server with `tools/call`,
   in order. The agent emits `tool_call` before and `tool_result` after each call. The payload sent back to
   the model is the tool's `structuredContent` (or `{ error }` for a failed call), added as a
   `functionResponse` part.
7. **Repeat** from step 4 until the model replies without calling a tool. The loop runs at most
   `AGENT_MAX_STEPS` model calls (default 5). On the last allowed step the mode switches to `NONE`, so the
   model has to answer with what it already has.
8. **Finish** with a `done` event.

If the browser disconnects or the user presses stop, the request's `AbortSignal` cancels the in-flight
Gemini stream and MCP call, and no `error` event is sent.

## Stream format

Response headers: `content-type: application/x-ndjson; charset=utf-8`, `cache-control: no-cache, no-transform`.
Each line is one `ChatEvent`:

| `type` | Fields | Meaning |
|--------|--------|---------|
| `text` | `delta` | A chunk of the assistant's reply (Markdown). Concatenate the deltas. |
| `tool_call` | `id`, `name`, `args` | The model asked to run an MCP tool with these arguments. |
| `tool_result` | `id`, `name`, `ok`, `method?`, `count?`, `products?`, `error?` | The tool finished. `products` holds the returned products (a single-item array for `get_product`), `method` is the backend's `method` field (`semantic`, `keyword_fallback`, ...). |
| `error` | `code`, `message` | The turn failed. `message` is safe to show to visitors. |
| `done` | `model`, `latency_ms`, `steps` | The turn completed. `steps` is the number of model calls. |

`tool_call` and `tool_result` share the same `id` (Gemini's call id when it provides one, otherwise
`<step>-<index>-<name>`), which is how the UI matches a result to its chip.

Example:

```json
{"type":"tool_call","id":"0-0-semantic_product_search","name":"semantic_product_search","args":{"query":"warm jacket for hiking","max_price":120}}
{"type":"tool_result","id":"0-0-semantic_product_search","name":"semantic_product_search","ok":true,"method":"semantic","count":3,"products":[{"id":4,"name":"Forest Green Jacket","price":59.0,"...":"..."}]}
{"type":"text","delta":"The **Forest Green Jacket** is the best fit"}
{"type":"text","delta":": weather-resistant, with zippered pockets for trail essentials."}
{"type":"done","model":"gemini-flash-latest","latency_ms":2870,"steps":2}
```

### Error codes

`describeError()` in `frontend/src/lib/errors.ts` maps provider and network failures to:

| Code | Cause |
|------|-------|
| `quota_exhausted` | Gemini returned 402 or a "credits are depleted" / billing message (checked first) |
| `rate_limited` | Gemini returned 429 or a quota/rate-limit message (common on the free tier) |
| `bad_api_key` | The key is invalid or rejected (400 with "API key", 401, 403) |
| `model_not_found` | The configured model doesn't exist (404). Check `GEMINI_MODEL` |
| `provider_error` | Gemini 5xx |
| `catalog_unreachable` | The MCP server couldn't be reached |
| `internal_error` | Anything else |

`/api/transcribe` uses the same mapping and returns it as a JSON error response.

## Client side

`useChat()` reads the response body with a `ReadableStream` reader, splits it on newlines, and applies each
event to the in-progress assistant message: text is appended, `tool_call` adds a running chip, and
`tool_result` completes it and shows its products in the results panel (or as inline cards on small
screens). Clicking a finished chip shows that call's results again. The stop button aborts the fetch.
