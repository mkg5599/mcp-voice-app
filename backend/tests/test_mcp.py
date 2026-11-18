"""Exercise the server through real MCP clients: in-process and over Streamable HTTP."""
import pytest
from fastapi.testclient import TestClient
from mcp import Client

from main import app
from mcp_server import TOOL_NAMES, mcp

pytestmark = pytest.mark.anyio


async def test_lists_tools_resources_prompts():
    async with Client(mcp) as c:
        tools = {t.name: t for t in (await c.list_tools()).tools}
        assert sorted(tools) == sorted(TOOL_NAMES)
        assert all(t.output_schema for t in tools.values())
        assert all(t.annotations and t.annotations.read_only_hint for t in tools.values())
        assert [str(r.uri) for r in (await c.list_resources()).resources] == ["catalog://products"]
        assert [p.name for p in (await c.list_prompts()).prompts] == ["shopping_assistant"]


async def test_tool_calls_return_structured_content():
    async with Client(mcp) as c:
        r = await c.call_tool("search_products", {"city": "Seattle"})
        assert not r.is_error
        assert r.structured_content["method"] == "filter"
        assert all(p["city"] == "Seattle" for p in r.structured_content["products"])

        r = await c.call_tool("get_product", {"product_id": 1})
        assert r.structured_content["id"] == 1

        r = await c.call_tool("get_product", {"product_id": 9999})
        assert r.is_error


def test_streamable_http_endpoint():
    """Raw JSON-RPC over HTTP, as any MCP client would send it (stateless: no handshake needed)."""
    client = TestClient(app)
    headers = {"accept": "application/json, text/event-stream"}

    init = client.post(
        "/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0", "id": 1, "method": "initialize",
            "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}},
        },
    )
    assert init.status_code == 200
    assert init.json()["result"]["serverInfo"]["name"] == "product-catalog"

    listed = client.post("/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    assert sorted(t["name"] for t in listed.json()["result"]["tools"]) == sorted(TOOL_NAMES)

    called = client.post(
        "/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "list_products", "arguments": {}}},
    )
    assert called.json()["result"]["structuredContent"]["count"] > 0


def test_get_returns_405_so_clients_skip_the_sse_stream():
    response = TestClient(app).get("/mcp", headers={"accept": "text/event-stream"})
    assert response.status_code == 405
