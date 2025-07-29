"""Request models for API endpoints."""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class ProductSearch(BaseModel):
    """Model for product search parameters."""
    colors: Optional[List[str]] = None
    city: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None

class SemanticSearch(BaseModel):
    """Model for semantic search parameters."""
    query: str
    top_k: Optional[int] = 5

class RagRequest(BaseModel):
    """Model for RAG query parameters."""
    query: str
    context_size: Optional[int] = 5
    system_prompt: Optional[str] = None

class JsonRpcRequest(BaseModel):
    """Model for JSON-RPC requests."""
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None
    id: int | str | None = None