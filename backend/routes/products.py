"""Plain REST endpoints over the same catalog logic the MCP tools use."""
from fastapi import APIRouter, HTTPException

from models.requests import Product, ProductResults, ProductSearch, SemanticSearch
from services.product_service import product_service

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=ProductResults)
def list_products() -> ProductResults:
    return product_service.list_products()


@router.post("/search", response_model=ProductResults)
def search_products(params: ProductSearch) -> ProductResults:
    return product_service.search_products(params)


@router.post("/semantic-search", response_model=ProductResults)
async def semantic_search(params: SemanticSearch) -> ProductResults:
    return await product_service.semantic_search(params)


@router.get("/{product_id}", response_model=Product)
def get_product(product_id: int) -> Product:
    product = product_service.get_product(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail=f"No product with id {product_id}")
    return Product(**product)
