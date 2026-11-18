"""Request and result models shared by the REST API and the MCP tools."""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ProductFilters(BaseModel):
    """Structured filters. Every field is optional; omitted fields don't filter."""

    colors: Optional[List[str]] = Field(None, description="Match products available in ANY of these colors.")
    city: Optional[str] = Field(None, description="City where the product is stocked, e.g. 'Portland'.")
    min_price: Optional[float] = Field(None, ge=0, description="Minimum price in USD.")
    max_price: Optional[float] = Field(None, ge=0, description="Maximum price in USD.")
    tags: Optional[List[str]] = Field(None, description="Match products with ANY of these tags, e.g. 'hoodie'.")


class ProductSearch(ProductFilters):
    """Filter-only search."""


class SemanticSearch(ProductFilters):
    """Natural-language search, optionally narrowed by structured filters."""

    query: str = Field(..., description="What the shopper is looking for, in plain language.")
    top_k: Optional[int] = Field(5, ge=1, le=50, description="Maximum number of results.")


class Product(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    colors: List[str] = []
    tags: List[str] = []
    specs: Dict[str, Any] = {}
    price: float
    city: str
    updated_at: Optional[str] = None
    similarity_score: Optional[float] = Field(
        None, description="0-1 relevance score, present only on semantic search results."
    )


class ProductResults(BaseModel):
    """What every product tool returns."""

    count: int
    products: List[Product]
    method: Literal["catalog", "filter", "semantic", "keyword_fallback"] = Field(
        ..., description="How the results were produced. 'keyword_fallback' means embeddings were unavailable."
    )
