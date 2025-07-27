from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Welcome to the MCP Product Tool Server (FastAPI)"
    assert "mcp" in data
    assert "rest_endpoints" in data
    assert "docs" in data

def test_list_products():
    response = client.get("/products")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_search_products():
    # Test with no parameters
    response = client.post("/products/search", json={})
    assert response.status_code == 200
    products = response.json()
    assert isinstance(products, list)
    assert len(products) > 0  # Should return all products

    # Test with color (case-insensitive)
    response = client.post("/products/search", json={"colors": ["Red"]})
    assert response.status_code == 200
    products = response.json()
    assert len(products) > 0
    assert all("red" in [c.lower() for c in p.get("colors", [])] for p in products)

    # Test with city (case-insensitive)
    response = client.post("/products/search", json={"city": "Portland"})
    assert response.status_code == 200
    products = response.json()
    assert len(products) > 0
    assert all(p.get("city", "").lower() == "portland" for p in products)

    # Test with price range
    response = client.post("/products/search", json={"min_price": 10, "max_price": 50})
    assert response.status_code == 200
    products = response.json()
    assert len(products) > 0
    assert all(10 <= p.get("price", 0) <= 50 for p in products)

def test_mcp_endpoint():
    # Test list_products
    response = client.post("/mcp", json={"jsonrpc": "2.0", "method": "list_products", "id": 1})
    assert response.status_code == 200
    assert response.json()["result"] is not None

    # Test search_products (case-insensitive)
    response = client.post("/mcp", json={"jsonrpc": "2.0", "method": "search_products", "params": {"city": "portland"}, "id": 2})
    assert response.status_code == 200
    products = response.json()["result"]
    assert len(products) > 0
    assert all(p.get("city", "").lower() == "portland" for p in products)

    # Test semantic_product_search
    response = client.post("/mcp", json={"jsonrpc": "2.0", "method": "semantic_product_search", "params": {"query": "comfortable hoodie"}, "id": 3})
    assert response.status_code == 200
    products = response.json()["result"]
    assert isinstance(products, list)

    # Test method not found
    response = client.post("/mcp", json={"jsonrpc": "2.0", "method": "non_existent_method", "id": 4})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == -32601

def test_get_mcp():
    response = client.get("/.well-known/mcp.json")
    assert response.status_code == 200
    discovery = response.json()
    assert "name" in discovery
    assert "tools" in discovery
    tool_names = [tool["name"] for tool in discovery["tools"]]
    assert "list_products" in tool_names
    assert "search_products" in tool_names
    assert "semantic_product_search" in tool_names

def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert "ok" in data
    assert "vector_store_ready" in data
