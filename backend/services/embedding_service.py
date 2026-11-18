"""Gemini embeddings over plain HTTP (no SDK needed, keeps the serverless bundle small)."""
from typing import Any, Dict, List, Literal

import httpx

from config.settings import (
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    EMBEDDING_TIMEOUT_S,
    GEMINI_API_BASE,
    GEMINI_API_KEY,
)

TaskType = Literal["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]

# Gemini accepts up to 100 texts per batchEmbedContents call.
_MAX_BATCH = 100


class EmbeddingError(RuntimeError):
    """Raised when the embedding provider is unavailable or rejects a request."""


class EmbeddingService:
    """Creates vectors for products (documents) and user queries."""

    def __init__(self, api_key: str | None = GEMINI_API_KEY, model: str = EMBEDDING_MODEL) -> None:
        self.api_key = api_key
        self.model = model

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        vectors: List[List[float]] = []
        for i in range(0, len(texts), _MAX_BATCH):
            vectors.extend(await self._batch_embed(texts[i : i + _MAX_BATCH], "RETRIEVAL_DOCUMENT"))
        return vectors

    async def embed_query(self, text: str) -> List[float]:
        return (await self._batch_embed([text], "RETRIEVAL_QUERY"))[0]

    async def _batch_embed(self, texts: List[str], task_type: TaskType) -> List[List[float]]:
        if not self.api_key:
            raise EmbeddingError("GEMINI_API_KEY is not set")

        model_path = f"models/{self.model}"
        body: Dict[str, Any] = {
            "requests": [
                {
                    "model": model_path,
                    "content": {"parts": [{"text": t}]},
                    "taskType": task_type,
                    "outputDimensionality": EMBEDDING_DIMENSIONS,
                }
                for t in texts
            ]
        }
        url = f"{GEMINI_API_BASE}/{model_path}:batchEmbedContents"
        try:
            async with httpx.AsyncClient(timeout=EMBEDDING_TIMEOUT_S) as client:
                resp = await client.post(url, json=body, headers={"x-goog-api-key": self.api_key})
        except httpx.HTTPError as e:
            raise EmbeddingError(f"Gemini embeddings request failed: {type(e).__name__}") from e

        if resp.status_code != 200:
            raise EmbeddingError(f"Gemini embeddings failed ({resp.status_code}): {resp.text[:300]}")

        embeddings = resp.json().get("embeddings", [])
        if len(embeddings) != len(texts):
            raise EmbeddingError("Gemini returned an unexpected number of embeddings")
        return [e["values"] for e in embeddings]


embedding_service = EmbeddingService()
