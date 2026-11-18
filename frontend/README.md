# Frontend: voice shopping agent

Next.js 16 (App Router), React 19, Tailwind CSS 4. One chat page backed by a server-side agent that calls
the backend's MCP tools through Gemini function calling.

| Route | What it does |
|-------|--------------|
| `/` | Chat UI: text or voice input, tool-call chips, product results |
| `/about` | "How it works" page |
| `POST /api/chat` | Runs the agent loop and streams NDJSON events |
| `POST /api/transcribe` | Speech-to-text with Gemini audio understanding |
| `GET /api/products` | Proxies the backend catalog for the browse panel |

Key files: `src/lib/agent.ts` (agent loop), `src/lib/mcpClient.ts` (MCP client and schema conversion),
`src/lib/chatTypes.ts` (stream events), `src/lib/useChat.ts` (stream reader),
`src/components/ShoppingAgent.tsx` (UI).

## Run

```bash
npm ci
cp .env.example .env.local   # then set GEMINI_API_KEY
npm run dev
```

Optional: `GEMINI_MODEL` (default `gemini-flash-latest`), `GEMINI_TRANSCRIBE_MODEL` (default
`gemini-flash-lite-latest`), `GEMINI_THINKING_LEVEL` (default `low`), `AGENT_MAX_STEPS` (default `5`), `GEMINI_BASE_URL` (API base URL override).

## Check

```bash
npm run lint
npm run typecheck
npm run build
```

See the [root README](../README.md) for architecture and deployment, and [docs/agent.md](../docs/agent.md)
for the agent loop and stream format.
