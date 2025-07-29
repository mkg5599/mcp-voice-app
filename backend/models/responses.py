"""Response models for API endpoints."""
from typing import Any, Dict, List
from pydantic import BaseModel

class HealthResponse(BaseModel):
    """Model for health check response."""
    ok: bool
    deployment: str
    vector_store: Dict[str, Any]
    products_loaded: bool
    available_methods: List[str]
    approach: str
    bundle_optimized: bool
    estimated_size: str

class IndexResponse(BaseModel):
    """Model for index endpoint response."""
    message: str
    purpose: str
    deployment: str
    vector_store: Dict[str, Any]
    optimization: Dict[str, Any]
    mcp: Dict[str, Any]
    rest_endpoints: Dict[str, str]
    notes: List[str]
    docs: Dict[str, str]
    version: str