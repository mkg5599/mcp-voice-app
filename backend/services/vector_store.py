"""In-memory vector store implementation."""
import math
from typing import Dict, List

class InMemoryVectorStore:
    """Lightweight in-memory vector store using OpenAI embeddings."""
    
    def __init__(self):
        self.embeddings_map: Dict[str, List[float]] = {}
        self.documents_map: Dict[str, str] = {}
        self.metadata_map: Dict[str, Dict] = {}
        
    def add_documents(self, ids: List[str], embeddings: List[List[float]], 
                    documents: List[str], metadatas: List[Dict]):
        """Add documents to the vector store."""
        for i, doc_id in enumerate(ids):
            self.embeddings_map[doc_id] = embeddings[i]
            self.documents_map[doc_id] = documents[i]
            self.metadata_map[doc_id] = metadatas[i]
        print(f"Added {len(ids)} documents to in-memory vector store")
    
    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude_a = math.sqrt(sum(a * a for a in vec1))
        magnitude_b = math.sqrt(sum(b * b for b in vec2))
        
        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0
        
        return dot_product / (magnitude_a * magnitude_b)
    
    def similarity_search(self, query_embedding: List[float], k: int = 5) -> List[Dict]:
        """Perform similarity search and return top k results."""
        if not self.embeddings_map:
            return []
        
        # Calculate similarities for all documents
        similarities = []
        for doc_id, doc_embedding in self.embeddings_map.items():
            similarity = self.cosine_similarity(query_embedding, doc_embedding)
            similarities.append({
                'id': doc_id,
                'similarity': similarity,
                'document': self.documents_map[doc_id],
                'metadata': self.metadata_map[doc_id]
            })
        
        # Sort by similarity (highest first) and return top k
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        return similarities[:k]
    
    def count(self) -> int:
        """Get total number of documents."""
        return len(self.embeddings_map)
    
    def clear(self):
        """Clear all documents from the vector store."""
        self.embeddings_map.clear()
        self.documents_map.clear()
        self.metadata_map.clear()