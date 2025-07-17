
from dotenv import load_dotenv
load_dotenv()

import os, tempfile, uuid, json
from fastapi import FastAPI, Query, UploadFile, File
from fastapi.responses import JSONResponse
from typing import List, Any, Dict, Optional
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI


app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProductSearch(BaseModel):
    colors: Optional[List[str]] = None
    city: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None

@app.get("/")
def read_root():
    return {"message": "Welcome to the FastAPI Backend!"}

with open("data/products.json") as f:
    products = json.load(f)

@app.get("/products")
def list_products():
    """
    List all products.
    """
    return products

@app.post("/products/search")
def search_products(search_params: ProductSearch):
    """
    Search and filter products based on criteria.
    """
    filtered_products = products
    if search_params.colors:
        filtered_products = [
            p for p in filtered_products if any(c in p["colors"] for c in search_params.colors)
        ]
    if search_params.city:
        filtered_products = [p for p in filtered_products if p["city"].lower() == search_params.city.lower()]
    if search_params.min_price:
        filtered_products = [p for p in filtered_products if p["price"] >= search_params.min_price]
    if search_params.max_price:
        filtered_products = [p for p in filtered_products if p["price"] <= search_params.max_price]
    return filtered_products

class JsonRpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None
    id: int | str | None = None
    
@app.post("/mcp")
def mcp_endpoint(req: JsonRpcRequest):
    """
    Expose list_products / search_products as a JSON-RPC 2.0 endpoint so
    multiple LLM “hosts” can call them through Model-Context-Protocol.
    """
    mapping = {
        "list_products": lambda p: list_products(),
        "search_products": lambda p: search_products(
            ProductSearch(**(p or {}))
        ),
    }

    if req.method not in mapping:
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": "Method not found"},
                "id": req.id,
            },
            status_code=404,
        )

    try:
        result = mapping[req.method](req.params)
        return {"jsonrpc": "2.0", "result": result, "id": req.id}
    except Exception as exc:
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32000, "message": str(exc)},
                "id": req.id,
            },
            status_code=500,
        )


client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Accepts multipart/form-data audio file and returns Whisper text.
    """
    try:
        suffix = os.path.splitext(file.filename or "")[-1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=open(tmp_path, "rb"),
            response_format="text",
            language="en",
        )
        return {"text": transcript}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        
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
                "description": "List all products.",
                "path": "/products",
                "method": "GET",
                "parameters": {},
            },
            {
                "name": "search_products",
                "description": "Search and filter products based on criteria.",
                "path": "/products/search",
                "method": "POST",
                "requestBody": {
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
            },
        ],
    }

