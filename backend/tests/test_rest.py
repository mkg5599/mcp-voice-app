from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_index_describes_mcp_server():
    data = client.get("/").json()
    assert data["mcp"]["endpoint"] == "/mcp"
    assert "semantic_product_search" in data["mcp"]["tools"]


def test_healthz():
    data = client.get("/healthz").json()
    assert data["ok"] is True
    assert data["products"] > 0
    assert data["semantic_search"]["api_key_configured"] is False


def test_list_products():
    data = client.get("/products").json()
    assert data["method"] == "catalog"
    assert data["count"] == len(data["products"]) > 0


def test_get_product_and_404():
    assert client.get("/products/1").json()["id"] == 1
    assert client.get("/products/9999").status_code == 404


def test_filter_search():
    data = client.post("/products/search", json={"colors": ["Red"], "max_price": 50}).json()
    assert data["count"] > 0
    assert all("red" in [c.lower() for c in p["colors"]] and p["price"] <= 50 for p in data["products"])

    data = client.post("/products/search", json={"city": "portland"}).json()
    assert data["count"] > 0 and all(p["city"] == "Portland" for p in data["products"])

    data = client.post("/products/search", json={"tags": ["hoodie"]}).json()
    assert data["count"] > 0 and all("hoodie" in p["tags"] for p in data["products"])


def test_semantic_search_falls_back_without_key():
    data = client.post("/products/semantic-search", json={"query": "black hoodie", "top_k": 3}).json()
    assert data["method"] == "keyword_fallback"
    assert 0 < data["count"] <= 3
    assert "Hoodie" in data["products"][0]["name"]


def test_invalid_price_rejected():
    assert client.post("/products/search", json={"min_price": -5}).status_code == 422
