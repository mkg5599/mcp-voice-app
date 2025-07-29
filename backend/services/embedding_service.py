"""OpenAI embeddings service."""
from typing import Optional
from langchain_openai import OpenAIEmbeddings
from config.settings import (
    OPENAI_API_KEY, 
    EMBEDDING_MODEL, 
    EMBEDDING_TIMEOUT, 
    EMBEDDING_MAX_RETRIES
)

class EmbeddingService:
    """Service for managing OpenAI embeddings."""
    
    def __init__(self):
        self._embeddings: Optional[OpenAIEmbeddings] = None
    
    async def initialize(self) -> bool:
        """Initialize the OpenAI embeddings client."""
        if not OPENAI_API_KEY:
            print("CRITICAL: OPENAI_API_KEY not found. Semantic search will not work.")
            return False
        
        try:
            print("Initializing OpenAI embeddings...")
            self._embeddings = OpenAIEmbeddings(
                api_key=OPENAI_API_KEY,
                model=EMBEDDING_MODEL,
                request_timeout=EMBEDDING_TIMEOUT,
                max_retries=EMBEDDING_MAX_RETRIES
            )
            print("OpenAI embeddings initialized successfully")
            return True
        except Exception as e:
            print(f"Failed to initialize OpenAI embeddings: {e}")
            self._embeddings = None
            return False
    
    def is_ready(self) -> bool:
        """Check if embeddings service is ready."""
        return self._embeddings is not None
    
    def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of documents."""
        if not self._embeddings:
            raise RuntimeError("Embeddings service not initialized")
        return self._embeddings.embed_documents(documents)
    
    def embed_query(self, query: str) -> list[float]:
        """Generate embedding for a single query."""
        if not self._embeddings:
            raise RuntimeError("Embeddings service not initialized")
        return self._embeddings.embed_query(query)

# Global embedding service instance
embedding_service = EmbeddingService()