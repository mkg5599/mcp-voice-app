import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_semantic_search_endpoint():
    """Test the semantic search REST endpoint."""
    response = client.post("/products/semantic-search", json={
        "query": "black hoodie",
        "top_k": 3
    })
    assert response.status_code == 200
    products = response.json()
    assert isinstance(products, list)
    assert len(products) >= 1
    
    # Check that results have similarity scores
    for product in products:
        assert "similarity_score" in product
        assert isinstance(product["similarity_score"], float)

def test_semantic_search_mcp():
    """Test semantic search via MCP endpoint."""
    response = client.post("/mcp", json={
        "jsonrpc": "2.0",
        "method": "semantic_product_search",
        "params": {"query": "streetwear hoodie", "top_k": 2},
        "id": 1
    })
    assert response.status_code == 200
    data = response.json()
    assert "result" in data
    products = data["result"]
    assert isinstance(products, list)
    assert len(products) >= 1

def test_semantic_search_empty_query():
    """Test semantic search with empty query."""
    response = client.post("/products/semantic-search", json={
        "query": "",
        "top_k": 5
    })
    # Should still work but may return fewer results
    assert response.status_code == 200

def test_semantic_search_discovery():
    """Test that semantic search tool is in discovery."""
    response = client.get("/.well-known/mcp.json")
    assert response.status_code == 200
    discovery = response.json()
    tool_names = [tool["name"] for tool in discovery["tools"]]
    assert "semantic_product_search" in tool_names