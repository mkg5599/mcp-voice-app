"""The product catalog as a standards-compliant MCP server.

Built with the official MCP Python SDK and served over Streamable HTTP at /mcp, so
any MCP client (this app's web agent, Claude, ChatGPT, Cursor, MCP Inspector...)
can connect to it.
"""
import json
from typing import Annotated, List, Optional

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import Field
from starlette.responses import PlainTextResponse
from starlette.types import Receive, Scope, Send

from config.settings import APP_VERSION
from models.requests import Product, ProductFilters, ProductResults, SemanticSearch
from services.product_service import product_service
from utils.cache import load_products

READ_ONLY = ToolAnnotations(read_only_hint=True, idempotent_hint=True, open_world_hint=False)

mcp = MCPServer(
    name="product-catalog",
    title="Product Catalog",
    version=APP_VERSION,
    instructions=(
        "Tools for browsing a small apparel and accessories catalog. Prefer "
        "semantic_product_search for descriptive requests ('something warm for hiking'), "
        "search_products for exact attribute filters (color, city, price, tags), and "
        "get_product for details about one item. Prices are in USD."
    ),
)

Colors = Annotated[Optional[List[str]], Field(description="Match ANY of these colors, e.g. ['red', 'black'].")]
City = Annotated[Optional[str], Field(description="City where the item is stocked, e.g. 'Portland'.")]
MinPrice = Annotated[Optional[float], Field(description="Minimum price in USD.", ge=0)]
MaxPrice = Annotated[Optional[float], Field(description="Maximum price in USD.", ge=0)]
Tags = Annotated[Optional[List[str]], Field(description="Match ANY of these tags, e.g. ['hoodie', 'outdoor'].")]


@mcp.tool(title="List all products", annotations=READ_ONLY)
def list_products() -> ProductResults:
    """Return every product in the catalog."""
    return product_service.list_products()


@mcp.tool(title="Filter products", annotations=READ_ONLY)
def search_products(
    colors: Colors = None,
    city: City = None,
    min_price: MinPrice = None,
    max_price: MaxPrice = None,
    tags: Tags = None,
) -> ProductResults:
    """Filter the catalog by exact attributes. All filters are optional and combined with AND."""
    return product_service.search_products(
        ProductFilters(colors=colors, city=city, min_price=min_price, max_price=max_price, tags=tags)
    )


@mcp.tool(title="Semantic product search", annotations=READ_ONLY)
async def semantic_product_search(
    query: Annotated[str, Field(description="What the shopper wants, in natural language.")],
    top_k: Annotated[int, Field(description="Maximum number of results.", ge=1, le=50)] = 5,
    colors: Colors = None,
    city: City = None,
    min_price: MinPrice = None,
    max_price: MaxPrice = None,
    tags: Tags = None,
) -> ProductResults:
    """Find products by meaning using vector embeddings, optionally narrowed by filters.

    Example: query='comfortable streetwear', max_price=40.
    """
    return await product_service.semantic_search(
        SemanticSearch(
            query=query, top_k=top_k, colors=colors, city=city,
            min_price=min_price, max_price=max_price, tags=tags,
        )
    )


@mcp.tool(title="Get product details", annotations=READ_ONLY)
def get_product(product_id: Annotated[int, Field(description="The product's numeric id.")]) -> Product:
    """Return full details (specs, sizes, materials) for one product."""
    product = product_service.get_product(product_id)
    if product is None:
        raise ToolError(f"No product with id {product_id}")
    return Product(**product)


@mcp.resource("catalog://products", name="catalog", title="Full catalog", mime_type="application/json")
def catalog_resource() -> str:
    """The complete product catalog as JSON."""
    return json.dumps(load_products())


@mcp.prompt(title="Shopping assistant")
def shopping_assistant(need: str) -> str:
    """Start a shopping conversation about a specific need."""
    return (
        f"I'm shopping for: {need}. Use the catalog tools to find the best matches, "
        "compare the top options on price and features, and recommend one."
    )


class MCPHttpEndpoint:
    """ASGI endpoint for Streamable HTTP, scoped to a single request.

    The server runs in stateless JSON mode with a fresh session manager per request.
    Nothing has to survive between requests, so it works on serverless platforms
    (Vercel) where app lifespan events and background tasks aren't guaranteed.
    """

    def __init__(self) -> None:
        # This is a public, read-only, unauthenticated server, so the localhost-only
        # DNS-rebinding protection doesn't apply. Browsers are restricted by CORS instead.
        self._security = TransportSecuritySettings(enable_dns_rebinding_protection=False)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("method") == "GET":
            # Stateless server: no server-initiated stream to offer. The spec allows 405 here,
            # and clients then skip the standalone SSE stream instead of holding it open.
            await PlainTextResponse("Method Not Allowed", status_code=405, headers={"Allow": "POST, DELETE"})(
                scope, receive, send
            )
            return
        manager = StreamableHTTPSessionManager(
            app=mcp._lowlevel_server,
            stateless=True,
            json_response=True,
            security_settings=self._security,
        )
        async with manager.run():
            await manager.handle_request(scope, receive, send)


mcp_http_endpoint = MCPHttpEndpoint()

TOOL_NAMES = ["list_products", "search_products", "semantic_product_search", "get_product"]
