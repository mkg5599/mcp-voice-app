"""Product catalog logic: filtering, lookup, and semantic search."""
import asyncio
import json
import re
import time
from typing import Any, Dict, List, Optional

from config.settings import IS_VERCEL, SEMANTIC_DEFAULT_TOP_K, SEMANTIC_MIN_SIMILARITY
from models.requests import ProductFilters, ProductResults, SemanticSearch
from services.embedding_service import EmbeddingError, EmbeddingService, embedding_service
from services.vector_store import InMemoryVectorStore
from utils.cache import load_products

_WORD = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "me", "show", "find",
    "some", "any", "i", "want", "need", "looking", "something", "items", "products", "under",
}


def _log(evt: str, **fields: Any) -> None:
    print(json.dumps({"evt": evt, "deployment": "vercel" if IS_VERCEL else "local", **fields}))


def product_document(product: Dict[str, Any]) -> str:
    """Text that represents a product in the embedding space."""
    specs = "; ".join(f"{k}: {v}" for k, v in product.get("specs", {}).items())
    return "\n".join(
        [
            f"Name: {product['name']}",
            f"Description: {product.get('description', '')}",
            f"Tags: {', '.join(product.get('tags', []))}",
            f"Colors: {', '.join(product.get('colors', []))}",
            f"Specs: {specs}",
            f"City: {product.get('city', '')}",
        ]
    )


def apply_filters(products: List[Dict[str, Any]], f: ProductFilters) -> List[Dict[str, Any]]:
    results = products
    if f.colors:
        want = {c.lower() for c in f.colors if c}
        results = [p for p in results if want & {c.lower() for c in p.get("colors", [])}]
    if f.tags:
        want_tags = {t.lower() for t in f.tags if t}
        results = [p for p in results if want_tags & {t.lower() for t in p.get("tags", [])}]
    if f.city:
        city = f.city.strip().lower()
        results = [p for p in results if p.get("city", "").lower() == city]
    if f.min_price is not None:
        results = [p for p in results if p.get("price", 0) >= f.min_price]
    if f.max_price is not None:
        results = [p for p in results if p.get("price", 0) <= f.max_price]
    return results


class ProductService:
    def __init__(
        self,
        vector_store: Optional[InMemoryVectorStore] = None,
        embeddings: EmbeddingService = embedding_service,
    ) -> None:
        self.vector_store = vector_store or InMemoryVectorStore()
        self.embeddings = embeddings
        self._index_lock = asyncio.Lock()
        self._index_error: Optional[str] = None

    # ---- Simple operations -------------------------------------------------

    def list_products(self) -> ProductResults:
        products = load_products()
        return ProductResults(count=len(products), products=products, method="catalog")  # type: ignore[arg-type]

    def search_products(self, filters: ProductFilters) -> ProductResults:
        results = apply_filters(load_products(), filters)
        return ProductResults(count=len(results), products=results, method="filter")  # type: ignore[arg-type]

    def get_product(self, product_id: int) -> Optional[Dict[str, Any]]:
        return next((p for p in load_products() if p["id"] == product_id), None)

    # ---- Semantic search ---------------------------------------------------

    @property
    def semantic_ready(self) -> bool:
        return self.vector_store.count() > 0

    @property
    def index_error(self) -> Optional[str]:
        return self._index_error

    async def ensure_index(self) -> bool:
        """Embed the catalog once per process (lazily, so cold starts stay fast)."""
        if self.semantic_ready:
            return True
        if not self.embeddings.is_configured():
            self._index_error = "GEMINI_API_KEY is not set"
            return False
        async with self._index_lock:
            if self.semantic_ready:
                return True
            t0 = time.time()
            products = load_products()
            try:
                vectors = await self.embeddings.embed_documents([product_document(p) for p in products])
            except EmbeddingError as e:
                self._index_error = str(e)
                _log("index_build_failed", error=str(e)[:300])
                return False
            self.vector_store.clear()
            self.vector_store.add_documents(
                ids=[str(p["id"]) for p in products],
                embeddings=vectors,
                documents=[product_document(p) for p in products],
                metadatas=[{"name": p["name"]} for p in products],
            )
            self._index_error = None
            _log("index_built", products=len(products), duration_ms=int((time.time() - t0) * 1000))
            return True

    async def semantic_search(self, params: SemanticSearch) -> ProductResults:
        top_k = params.top_k or SEMANTIC_DEFAULT_TOP_K
        candidates = apply_filters(load_products(), params)
        allowed = {str(p["id"]): p for p in candidates}
        t0 = time.time()

        if params.query.strip() and await self.ensure_index():
            try:
                query_vec = await self.embeddings.embed_query(params.query)
                ranked = self.vector_store.similarity_search(query_vec, k=self.vector_store.count())
                results: List[Dict[str, Any]] = []
                for doc in ranked:
                    if doc["id"] in allowed and doc["similarity"] >= SEMANTIC_MIN_SIMILARITY:
                        results.append({**allowed[doc["id"]], "similarity_score": round(max(0.0, doc["similarity"]), 4)})
                    if len(results) >= top_k:
                        break
                _log("semantic_search", query=params.query, results=len(results), duration_ms=int((time.time() - t0) * 1000))
                return ProductResults(count=len(results), products=results, method="semantic")  # type: ignore[arg-type]
            except EmbeddingError as e:
                _log("semantic_search_failed", error=str(e)[:300])

        results = keyword_search(params.query, candidates, top_k)
        return ProductResults(count=len(results), products=results, method="keyword_fallback")  # type: ignore[arg-type]


def keyword_search(query: str, products: List[Dict[str, Any]], top_k: int) -> List[Dict[str, Any]]:
    """Token-overlap ranking, used when embeddings are unavailable."""
    tokens = [t for t in _WORD.findall(query.lower()) if t not in _STOPWORDS]
    if not tokens:
        return [{**p, "similarity_score": 0.0} for p in products[:top_k]]

    scored = []
    for p in products:
        name = set(_WORD.findall(p.get("name", "").lower()))
        desc = set(_WORD.findall(p.get("description", "").lower()))
        tags = set(_WORD.findall(" ".join(p.get("tags", [])).lower()))
        colors = {c.lower() for c in p.get("colors", [])}
        score = 0.0
        for t in tokens:
            stem = t.rstrip("s")
            if t in name or stem in name:
                score += 3
            if t in tags or stem in tags:
                score += 2
            if t in colors:
                score += 2
            if t in desc or stem in desc:
                score += 1
        if score > 0:
            scored.append({**p, "similarity_score": round(min(1.0, score / (8 * len(tokens))), 4)})

    scored.sort(key=lambda x: x["similarity_score"], reverse=True)
    return scored[:top_k]


product_service = ProductService()
