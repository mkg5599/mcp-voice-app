import type { Product } from "../types/product";

const price = (p: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(p);

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const score = product.similarity_score;
  return (
    <article
      className={`flex flex-col rounded-xl border border-border bg-surface p-4 ${compact ? "w-60 shrink-0" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent">
          {price(product.price)}
        </span>
      </div>

      {product.description && (
        <p className={`mt-2 text-sm text-muted ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{product.description}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 text-xs text-muted">
        <span className="flex items-center gap-1" aria-label={`Colors: ${product.colors.join(", ")}`}>
          {product.colors.map((c) => (
            <span
              key={c}
              title={c}
              className="size-3.5 rounded-full border border-border"
              style={{ backgroundColor: c }}
            />
          ))}
        </span>
        <span>{product.city}</span>
        {typeof score === "number" && score > 0 && <span className="text-ok">{Math.round(score * 100)}% match</span>}
      </div>

      {!compact && product.tags && product.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {product.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
              {t}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
