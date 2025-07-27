from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_semantic_search_endpoint():
    """Test the semantic search REST endpoint."""
    response = client.post(
        "/products/semantic-search",
        json={"query": "comfortable black hoodie", "top_k": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 3

def test_semantic_search_mcp():
    """Test semantic search via MCP JSON-RPC."""
    response = client.post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "method": "semantic_product_search",
            "params": {"query": "warm winter clothing", "top_k": 2},
            "id": 1
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["jsonrpc"] == "2.0"
    assert "result" in data
    assert isinstance(data["result"], list)
    assert len(data["result"]) <= 2

def test_semantic_search_with_similarity_scores():
    """Test that semantic search returns similarity scores."""
    response = client.post(
        "/products/semantic-search",
        json={"query": "streetwear fashion", "top_k": 5}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    
    # Check if products have similarity scores (may be from fallback)
    for product in data:
        assert "similarity_score" in product
        assert 0 <= product["similarity_score"] <= 1

def test_empty_semantic_search():
    """Test semantic search with empty query."""
    response = client.post(
        "/products/semantic-search",
        json={"query": "", "top_k": 3}
    )
    # Should still work, might return empty or all products depending on implementation
    assert response.status_code == 200

def test_semantic_search_large_top_k():
    """Test semantic search with large top_k value."""
    response = client.post(
        "/products/semantic-search",
        json={"query": "clothing", "top_k": 100}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should not exceed actual product count