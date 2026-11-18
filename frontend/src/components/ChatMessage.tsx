import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ToolRun, UiMessage } from "../lib/useChat";
import { ProductCard } from "./ProductCard";
import { ToolCallChip } from "./ToolCallChip";

export function ChatMessage({ message, onSelectRun }: { message: UiMessage; onSelectRun: (run: ToolRun) => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2 text-accent-text">
          {message.content}
        </p>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  // Prefer the latest search/list results over a single-item detail lookup.
  const withProducts = message.tools.filter((t) => t.products?.length);
  const latestProducts = (withProducts.findLast((t) => t.name !== "get_product") ?? withProducts.at(-1))?.products;

  return (
    <div className="space-y-2">
      {message.tools.length > 0 && (
        <div className="space-y-1.5">
          {message.tools.map((t) => (
            <ToolCallChip key={t.id} run={t} onSelect={onSelectRun} />
          ))}
        </div>
      )}

      {(message.content || (streaming && message.tools.every((t) => t.status !== "running"))) && (
        <div className={`prose-chat max-w-none text-[15px] leading-relaxed ${streaming ? "caret" : ""}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}

      {/* Small screens have no results panel, so show the cards inline. */}
      {latestProducts && (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 lg:hidden">
          {latestProducts.map((p) => (
            <ProductCard key={p.id} product={p} compact />
          ))}
        </div>
      )}

      {message.status === "error" && (
        <p role="alert" className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger">
          {message.error}
        </p>
      )}
      {message.status === "stopped" && <p className="text-xs text-muted">Stopped.</p>}
    </div>
  );
}
