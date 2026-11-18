# Changelog

## 2.0.0 — 2026-11-18

A rebuild around the official MCP SDKs, a multi-step agent, and a single AI provider (Gemini).

### Added

- Cost protection for the public site: per-visitor and site-wide rate limits on `/api/chat` and `/api/transcribe`
  (`RATE_LIMIT_*`), plus a query-embedding cache and hourly embedding budget on the backend
  (`EMBEDDING_QUERY_BUDGET_PER_HOUR`, `EMBEDDING_QUERY_CACHE_SIZE`) that falls back to keyword search.
- `GEMINI_THINKING_LEVEL` (default `low`) to trade reasoning depth for speed.
- A standards-compliant MCP server built with the official MCP Python SDK (`MCPServer`), served over
  Streamable HTTP at `/mcp` in stateless JSON mode, with a fresh session manager per request so it runs on
  Vercel serverless functions.
- MCP tools `list_products`, `search_products`, `semantic_product_search` and `get_product`. All are
  annotated read-only, with typed input and output schemas (structured content).
- MCP resource `catalog://products` and prompt `shopping_assistant`.
- REST endpoint `GET /products/{id}`. Filters on `semantic_product_search` / `POST /products/semantic-search`
  (colors, city, price range, tags).
- Keyword fallback for semantic search when embeddings are unavailable (`method: "keyword_fallback"`).
- Multi-step agent loop in the frontend (`src/lib/agent.ts`): Gemini function calling in `AUTO` mode,
  multi-turn history, thought signatures preserved, capped by `AGENT_MAX_STEPS`.
- MCP client using the official TypeScript SDK (`StreamableHTTPClientTransport`) that discovers the
  server's tools at runtime and converts them to Gemini function declarations.
- NDJSON streaming from `/api/chat` (`text`, `tool_call`, `tool_result`, `error`, `done` events).
- New chat UI: tool-call chips showing each MCP call, results panel and inline product cards, stop button,
  new chat, optional spoken replies (browser `speechSynthesis`), light/dark theme.
- `/api/products` catalog proxy for the browse panel.
- Backend tests for REST, semantic search (fake embedder) and MCP (official client in-process and raw HTTP).
- `docs/agent.md` and `docs/mcp.md`.

### Changed

- Embeddings: OpenAI via LangChain replaced by Gemini `gemini-embedding-001` (768 dimensions) over plain
  HTTP. The in-memory index is now built lazily on the first semantic search.
- Speech-to-text: OpenAI Whisper replaced by Gemini audio understanding (`GEMINI_TRANSCRIBE_MODEL`).
- Chat: the two-phase call that always forced a tool call (mode `ANY`) replaced by the agent loop.
- One provider and one key: everything runs on `GEMINI_API_KEY`.
- All model names come from environment variables (`GEMINI_MODEL`, `GEMINI_TRANSCRIBE_MODEL`,
  `EMBEDDING_MODEL`); defaults are `gemini-flash-latest` and `gemini-flash-lite-latest`.
- Dependency upgrades: React 19.1 → 19.3, Tailwind CSS 4.3, `@google/genai` 1.x → 3.x, FastAPI 0.116 → 0.165;
  added `mcp` 2.3 (backend) and `@modelcontextprotocol/sdk` (frontend).
- `/rag` now permanently redirects to `/`.
- README, SETUP, the About page and the docs rewritten for the new architecture.

### Removed

- The custom JSON-RPC endpoint with non-standard method names and the `/.well-known/mcp.json` discovery file.
- The separate RAG chatbot page (`/rag`), `RagChat`, `SearchPromptModal` and the `/api/rag` route, plus the
  backend `POST /products/rag` and `GET /products/health` routes.
- OpenAI and LangChain dependencies, and the backend LLM service and `prompts.yml`.
- Retired models `gemini-2.0-flash-001` and `gpt-3.5-turbo`.

### Security

- Next.js 15.3.5 → 16.4.6, which also moves off versions affected by the December 2025 React Server
  Components RCE advisory (CVE-2025-66478).

## 1.x

Earlier versions (July 2025) aren't itemized here. See the git history.
