# Semantic search

`semantic_product_search` (MCP) and `POST /products/semantic-search` (REST) find products by meaning
("something warm for a winter hike") instead of exact attributes. Both call
`ProductService.semantic_search()` in `backend/services/product_service.py`.

The design keeps the backend small enough for a serverless function: no vector database and no ML
libraries. Gemini creates the embeddings over plain HTTP, and the vectors live in a Python dict.

## Embeddings

`backend/services/embedding_service.py` calls Gemini's `batchEmbedContents` REST endpoint with httpx (no
SDK, to keep the bundle small):

- Model: `EMBEDDING_MODEL`, default `gemini-embedding-001`.
- Dimensions: `EMBEDDING_DIMENSIONS`, default `768`, sent as `outputDimensionality`.
- Task types: products are embedded as `RETRIEVAL_DOCUMENT`, queries as `RETRIEVAL_QUERY`.
- Up to 100 texts per request. The key goes in the `x-goog-api-key` header.
- Any non-200 response (bad key, 429 quota, ...) raises `EmbeddingError`.

Each product is embedded as a short text document (`product_document()`):

```
Name: Classic Black Hoodie
Description: A mid-weight unisex hoodie with rib-knit cuffs ...
Tags: hoodie, streetwear, cotton-blend, unisex, casual
Colors: black
Specs: fabric: 80% cotton / 20% polyester; sizes: ['S', 'M', 'L', 'XL']
City: Portland
```

## Lazy in-memory index

`InMemoryVectorStore` (`backend/services/vector_store.py`) is a dict of id to vector with brute-force cosine
similarity, which is plenty for a catalog of this size.

The index is built lazily by `ensure_index()`, not at startup, so cold starts stay fast and the backend
boots without a key:

1. The first semantic search in a process embeds the whole catalog in one batch call.
2. An `asyncio.Lock` with a second check inside it makes concurrent first requests share a single build.
3. Later searches in the same warm process only embed the query (one API call per search).
4. If the build fails, the error is recorded and the search falls back to keywords. The next semantic
   search tries the build again.

`GET /healthz` reports the state:

```json
"semantic_search": {
  "embedding_model": "gemini-embedding-001",
  "api_key_configured": true,
  "index_size": 15,
  "last_error": null
}
```

`index_size` is `0` until the first semantic search in that instance.

## Search with filters

`semantic_product_search` takes `query`, `top_k` (1-50, default 5) and the same optional filters as
`search_products`:

| Filter | Matching |
|--------|----------|
| `colors` | Product has ANY of the colors (case-insensitive) |
| `tags` | Product has ANY of the tags (case-insensitive) |
| `city` | Exact city match (case-insensitive, trimmed) |
| `min_price`, `max_price` | Inclusive bounds in USD |

Filters run first and restrict the candidate set. Then the query vector is compared with every indexed
product, and the best candidates are returned in order until `top_k` is reached. A result is dropped if its
cosine similarity is below `SEMANTIC_MIN_SIMILARITY` (default `0.0`). Each product gets a
`similarity_score` between 0 and 1, shown as "% match" on product cards.

Example:

```bash
curl -s http://localhost:8000/products/semantic-search \
  -H 'content-type: application/json' \
  -d '{"query": "comfortable streetwear", "max_price": 40, "top_k": 3}'
```

```json
{ "count": 3, "method": "semantic", "products": [ { "id": 1, "name": "Classic Black Hoodie", "similarity_score": 0.71, "...": "..." } ] }
```

(Scores here are illustrative.)

## Keyword fallback

When embeddings aren't available, the search still answers, with `method: "keyword_fallback"`. That
happens when:

- `GEMINI_API_KEY` isn't set,
- building the index or embedding the query raises `EmbeddingError` (for example a 429 on the free tier),
- the query is empty or only whitespace.

`keyword_search()` tokenizes the query, drops stopwords ("show", "me", "some", "under", ...), and scores each
filtered candidate: +3 for a match in the name, +2 in the tags, +2 for a color, +1 in the description. A
trailing "s" is stripped as a simple plural stem. Scores are normalized to 0-1 and products with no match
are left out. If no tokens are left after stopwords, the first `top_k` candidates are returned with a score
of 0.

The `method` field reaches the UI: tool-call chips show "(keyword)" when the fallback was used.

## Tests

`backend/tests/test_semantic_search.py` uses a deterministic fake embedder (word counts over a small
vocabulary), so it runs offline. It checks that results are ranked by similarity, that the index is built
only once, that filters apply to semantic results, that a failing embedder falls back to keywords and
records the error, and that keyword search handles plurals and stopwords.
