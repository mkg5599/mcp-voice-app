"""Tiny in-memory vector store (cosine similarity). Plenty for a catalog of this size."""
import math
from typing import Any, Dict, List


class InMemoryVectorStore:
    def __init__(self) -> None:
        self.embeddings_map: Dict[str, List[float]] = {}
        self.documents_map: Dict[str, str] = {}
        self.metadata_map: Dict[str, Dict[str, Any]] = {}

    def add_documents(
        self,
        ids: List[str],
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: List[Dict[str, Any]],
    ) -> None:
        for i, doc_id in enumerate(ids):
            self.embeddings_map[doc_id] = embeddings[i]
            self.documents_map[doc_id] = documents[i]
            self.metadata_map[doc_id] = metadatas[i]

    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        dot = sum(a * b for a, b in zip(vec1, vec2))
        mag_a = math.sqrt(sum(a * a for a in vec1))
        mag_b = math.sqrt(sum(b * b for b in vec2))
        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot / (mag_a * mag_b)

    def similarity_search(self, query_embedding: List[float], k: int = 5) -> List[Dict[str, Any]]:
        scored: List[Dict[str, Any]] = [
            {
                "id": doc_id,
                "similarity": self.cosine_similarity(query_embedding, emb),
                "document": self.documents_map[doc_id],
                "metadata": self.metadata_map[doc_id],
            }
            for doc_id, emb in self.embeddings_map.items()
        ]
        scored.sort(key=lambda x: float(x["similarity"]), reverse=True)
        return scored[:k]

    def count(self) -> int:
        return len(self.embeddings_map)

    def clear(self) -> None:
        self.embeddings_map.clear()
        self.documents_map.clear()
        self.metadata_map.clear()
