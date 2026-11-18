import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, AudioLines, Bot, Mic, Server, Wrench } from "lucide-react";

export const metadata: Metadata = {
  title: "How it works · Voice Shopping Agent",
  description:
    "How the voice shopping agent uses Gemini function calling and a Model Context Protocol server to search a product catalog.",
};

const REPO_URL = "https://github.com/mkg5599/mcp-voice-app";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Mic,
    title: "You type or speak",
    body: "Voice is recorded in the browser (up to 30 seconds) and sent to /api/transcribe, where Gemini’s audio understanding turns it into text. The transcript is sent like a typed message.",
  },
  {
    icon: Bot,
    title: "The agent plans",
    body: "/api/chat runs an agent loop on the server. It connects to the MCP server, lists its tools, converts them to Gemini function declarations, and lets the model decide whether to call any (function calling mode AUTO).",
  },
  {
    icon: Wrench,
    title: "Tools run on the MCP server",
    body: "Each tool call goes to the backend over Streamable HTTP with the official MCP SDK. Structured results go back to the model, which can call more tools (search, then fetch details) for up to five rounds by default.",
  },
  {
    icon: AudioLines,
    title: "The answer streams back",
    body: "Text, tool calls and tool results stream to the browser as NDJSON. The chips above each reply show which tool ran, with what arguments, and how many products it found. Replies can be read aloud with your browser’s speech synthesis.",
  },
];

const TOOLS: { name: string; args: string; does: string }[] = [
  { name: "list_products", args: "none", does: "Every product in the catalog." },
  {
    name: "search_products",
    args: "colors, city, min_price, max_price, tags",
    does: "Exact attribute filters, combined with AND.",
  },
  {
    name: "semantic_product_search",
    args: "query, top_k, plus the same filters",
    does: "Ranks by meaning with Gemini embeddings. Falls back to keyword matching if embeddings are unavailable.",
  },
  { name: "get_product", args: "product_id", does: "Full details for one item: specs, sizes, materials." },
];

const STACK: { area: string; items: string }[] = [
  { area: "Frontend", items: "Next.js 16, React 19, TypeScript, Tailwind CSS 4" },
  { area: "Agent", items: "Gemini via @google/genai, MCP TypeScript SDK" },
  { area: "Voice", items: "MediaRecorder, Gemini transcription, browser speechSynthesis" },
  { area: "Backend", items: "Python 3.13, FastAPI, MCP Python SDK" },
  { area: "Search", items: "gemini-embedding-001, in-memory cosine index" },
  { area: "Hosting", items: "Vercel (frontend and backend as separate projects)" },
];

const CONNECT_SNIPPET = `# Claude Code
claude mcp add --transport http product-catalog https://<your-backend>.vercel.app/mcp

# MCP Inspector (choose "Streamable HTTP")
npx @modelcontextprotocol/inspector

# Raw JSON-RPC
curl -s https://<your-backend>.vercel.app/mcp \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:py-14">
      <header className="space-y-3">
        <p className="text-sm font-medium text-accent">How it works</p>
        <h1 className="text-3xl font-semibold tracking-tight">A shopping assistant built on MCP</h1>
        <p className="max-w-2xl text-muted">
          The assistant answers questions about a small apparel catalog. It doesn’t know the products itself: it
          looks them up by calling tools on a Model Context Protocol server, and the chat shows every call it
          makes. Everything runs on one Gemini API key.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-text"
        >
          Try it <ArrowRight className="size-4" aria-hidden />
        </Link>
      </header>

      <Section title="What happens when you ask something">
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <h3 className="font-medium">
                  <span className="text-muted">{i + 1}.</span> {title}
                </h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="The MCP server">
        <p className="text-muted">
          The backend is a FastAPI app with an MCP server built on the official Python SDK, served over Streamable
          HTTP at <Code>/mcp</Code>. It runs stateless with JSON responses and a fresh session manager per request,
          so it works on serverless hosting. All tools are read-only and return typed, structured results.
        </p>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {TOOLS.map((t) => (
              <li key={t.name} className="grid gap-1 p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
                <div>
                  <p className="font-mono text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted">{t.args}</p>
                </div>
                <p className="text-sm text-muted">{t.does}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted">
          It also exposes the resource <Code>catalog://products</Code> (the full catalog as JSON) and the prompt{" "}
          <Code>shopping_assistant</Code>. The same logic is available as a REST API (<Code>/products</Code>,{" "}
          <Code>/products/search</Code>, <Code>/products/semantic-search</Code>) with Swagger docs at{" "}
          <Code>/docs</Code>.
        </p>
        <div className="rounded-xl border border-border bg-surface-2 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Server className="size-4 text-accent" aria-hidden /> Semantic search
          </p>
          <p className="mt-1.5 text-muted">
            Products are embedded with Gemini <Code>gemini-embedding-001</Code> (768 dimensions) the first time
            someone searches, and kept in an in-memory index. Queries are ranked by cosine similarity after the
            filters are applied. Without an API key or quota, the server switches to keyword matching, and the tool
            chip shows “(keyword)”.
          </p>
        </div>
      </Section>

      <Section title="Connect your own client">
        <p className="text-muted">
          Nothing about the server is tied to this site. Any MCP client that supports Streamable HTTP can use the
          same tools.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed">
          {CONNECT_SNIPPET}
        </pre>
      </Section>

      <Section title="Tech stack">
        <dl className="grid gap-3 sm:grid-cols-2">
          {STACK.map((s) => (
            <div key={s.area} className="rounded-xl border border-border bg-surface p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">{s.area}</dt>
              <dd className="mt-1 text-sm">{s.items}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted">
          Source and setup instructions are on{" "}
          <a href={REPO_URL} className="text-accent hover:underline" target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
