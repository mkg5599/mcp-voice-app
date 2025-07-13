
import json
from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse
from typing import List, Optional

app = FastAPI()

# Load products from the JSON file
with open("data/products.json") as f:
    products = json.load(f)

@app.get("/products")
def list_products(
    colors: Optional[List[str]] = Query(None),
    city: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
):
    """
    List products with optional filtering.
    """
    filtered_products = products
    if colors:
        filtered_products = [
            p for p in filtered_products if any(c in p["colors"] for c in colors)
        ]
    if city:
        filtered_products = [p for p in filtered_products if p["city"] == city]
    if min_price:
        filtered_products = [p for p in filtered_products if p["price"] >= min_price]
    if max_price:
        filtered_products = [p for p in filtered_products if p["price"] <= max_price]
    return filtered_products


@app.get("/.well-known/mcp.json")
def get_mcp():
    """
    MCP discovery file.
    """
    return {
        "name": "Product Catalog",
        "description": "Search and filter products.",
        "tools": [
            {
                "name": "list_products",
                "description": "List products with optional filtering.",
                "path": "/products",
                "method": "GET",
                "parameters": {
                    "colors": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of colors to filter by.",
                    },
                    "city": {"type": "string", "description": "City to filter by."},
                    "min_price": {
                        "type": "number",
                        "description": "Minimum price to filter by.",
                    },
                    "max_price": {
                        "type": "number",
                        "description": "Maximum price to filter by.",
                    },
                },
            }
        ],
    }

