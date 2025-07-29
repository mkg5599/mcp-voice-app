"""Product caching utilities."""
import json
import os
from typing import Any, Dict, List
from config.settings import PRODUCTS_JSON_PATH

# Optional in-memory cache
_products_cache: List[Dict[str, Any]] | None = None
_products_mtime: float | None = None

def load_products() -> List[Dict[str, Any]]:
    """Load products with caching."""
    global _products_cache, _products_mtime
    
    try:
        stat = os.stat(PRODUCTS_JSON_PATH)
    except FileNotFoundError as e:
        raise RuntimeError("products.json not found") from e
    
    if _products_cache is None or _products_mtime != stat.st_mtime:
        with open(PRODUCTS_JSON_PATH, "r", encoding="utf-8") as f:
            _products_cache = json.load(f)
        _products_mtime = stat.st_mtime
    
    return _products_cache  # type: ignore

def clear_cache():
    """Clear the products cache."""
    global _products_cache, _products_mtime
    _products_cache = None
    _products_mtime = None