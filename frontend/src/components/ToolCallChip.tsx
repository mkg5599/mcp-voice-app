import { AlertCircle, Check, Loader2, Wrench } from "lucide-react";
import type { ToolRun } from "../lib/useChat";

const LABELS: Record<string, string> = {
  list_products: "Browse catalog",
  search_products: "Filter products",
  semantic_product_search: "Semantic search",
  get_product: "Product details",
};

function summarizeArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
    .join(" · ");
}

/** Shows one MCP tool call the agent made: which tool, its arguments, and the outcome. */
export function ToolCallChip({ run, onSelect }: { run: ToolRun; onSelect?: (run: ToolRun) => void }) {
  const args = summarizeArgs(run.args);
  const clickable = run.status === "ok" && !!run.products?.length && !!onSelect;
  const Icon = run.status === "running" ? Loader2 : run.status === "error" ? AlertCircle : Check;

  const body = (
    <>
      <Wrench className="size-3.5 shrink-0" aria-hidden />
      <span className="shrink-0 whitespace-nowrap font-medium text-text">{LABELS[run.name] ?? run.name}</span>
      {args && <span className="min-w-0 truncate">{args}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {run.status === "ok" && run.count !== undefined && <span>{run.count} found</span>}
        {run.method === "keyword_fallback" && <span title="Embeddings unavailable; used keyword matching">(keyword)</span>}
        {run.status === "error" && <span className="text-danger">{run.error ?? "failed"}</span>}
        <Icon
          className={`size-3.5 ${run.status === "running" ? "animate-spin" : run.status === "error" ? "text-danger" : "text-ok"}`}
          aria-label={run.status}
        />
      </span>
    </>
  );

  const cls =
    "flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-left text-xs text-muted";
  return clickable ? (
    <button type="button" className={`${cls} hover:border-accent`} onClick={() => onSelect?.(run)} title="Show these results">
      {body}
    </button>
  ) : (
    <div className={cls} title={run.name}>
      {body}
    </div>
  );
}
