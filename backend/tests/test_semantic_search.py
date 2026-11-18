"""Semantic search ranking and filtering, using a deterministic fake embedder."""
import math
import re
from typing import List

import pytest

from models.requests import SemanticSearch
from services.embedding_service import EmbeddingError, EmbeddingService
from services.product_service import ProductService, keyword_search
from utils.cache import load_products

pytestmark = pytest.mark.anyio

VOCAB = ["hoodie", "streetwear", "winter", "warm", "running", "athletic", "leather", "bag", "summer", "hiking"]


class FakeEmbeddings(EmbeddingService):
    def __init__(self, fail: bool = False) -> None:
        super().__init__(api_key="test", model="fake")
        self.fail = fail
        self.document_calls = 0

    def _vec(self, text: str) -> List[float]:
        words = re.findall(r"[a-z]+", text.lower())
        v = [float(sum(w.startswith(term) for w in words)) for term in VOCAB]
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if self.fail:
            raise EmbeddingError("quota exhausted")
        self.document_calls += 1
        return [self._vec(t) for t in texts]

    async def embed_query(self, text: str) -> List[float]:
        return self._vec(text)


async def test_ranks_by_meaning_and_builds_index_once():
    fake = FakeEmbeddings()
    service = ProductService(embeddings=fake)
    r = await service.semantic_search(SemanticSearch(query="streetwear hoodie", top_k=3))
    assert r.method == "semantic"
    assert "Hoodie" in r.products[0].name
    assert r.products[0].similarity_score is not None
    scores = [p.similarity_score for p in r.products]
    assert scores == sorted(scores, reverse=True)

    await service.semantic_search(SemanticSearch(query="warm winter", top_k=3))
    assert fake.document_calls == 1


async def test_filters_apply_to_semantic_results():
    service = ProductService(embeddings=FakeEmbeddings())
    r = await service.semantic_search(SemanticSearch(query="hoodie", max_price=30, top_k=10))
    assert all(p.price <= 30 for p in r.products)


async def test_falls_back_to_keywords_when_embeddings_fail():
    service = ProductService(embeddings=FakeEmbeddings(fail=True))
    r = await service.semantic_search(SemanticSearch(query="black hoodie", top_k=2))
    assert r.method == "keyword_fallback"
    assert service.index_error == "quota exhausted"
    assert r.count > 0


def test_keyword_search_handles_plurals_and_stopwords():
    results = keyword_search("show me some hoodies", load_products(), 5)
    assert results and all("hoodie" in p["tags"] for p in results)
    assert all(0 <= p["similarity_score"] <= 1 for p in results)


async def test_network_errors_fall_back_to_keywords(monkeypatch):
    import httpx

    async def boom(*args, **kwargs):
        raise httpx.ConnectTimeout("timed out")

    monkeypatch.setattr(httpx.AsyncClient, "post", boom)
    service = ProductService(embeddings=EmbeddingService(api_key="test-key"))
    r = await service.semantic_search(SemanticSearch(query="hoodie", top_k=2))
    assert r.method == "keyword_fallback"
    assert "ConnectTimeout" in (service.index_error or "")
