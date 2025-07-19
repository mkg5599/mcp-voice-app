import json
import os
import tempfile
import time
from typing import Any, Dict, List, Optional

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_JSON_PATH = os.path.join(BACKEND_DIR, "data", "products.json")
PROMPTS_YAML_PATH = os.path.join(BACKEND_DIR, "prompts.yml")

# ----- Load config (single source) -----
with open(PROMPTS_YAML_PATH, "r") as f:
    PROMPTS_CONFIG = yaml.safe_load(f)

# Optional: assert presence
if "mcp_discovery" not in PROMPTS_CONFIG:
    raise RuntimeError("prompts.yml missing 'mcp_discovery' section")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not set")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://your-production-domain.example"
).split(",")

app = FastAPI(title="Product Tool Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- (Optional) In-memory cache -----
_products_cache: List[Dict[str, Any]] | None = None
_products_mtime: float | None = None

def load_products() -> List[Dict[str, Any]]:
    global _products_cache, _products_mtime
    try:
        stat = os.stat(PRODUCTS_JSON_PATH)
    except FileNotFoundError:
        raise RuntimeError("products.json not found")
    if _products_cache is None or _products_mtime != stat.st_mtime:
        with open(PRODUCTS_JSON_PATH) as f:
            _products_cache = json.load(f)
        _products_mtime = stat.st_mtime
    return _products_cache  # type: ignore

# ----- Models -----
class ProductSearch(BaseModel):
    colors: Optional[List[str]] = None
    city: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None

class JsonRpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    method: str
    params: Optional[Dict[str, Any]] = None
    id: int | str | None = None

# ----- Tool functions -----
def list_products_impl() -> List[Dict[str, Any]]:
    return load_products()

def search_products_impl(params: ProductSearch) -> List[Dict[str, Any]]:
    products = load_products()
    results = products

    if params.colors:
        want = {c.lower() for c in params.colors if c}
        results = [
            p for p in results
            if want & {c.lower() for c in p.get("colors", [])}
        ]

    if params.city:
        city_l = params.city.lower()
        results = [p for p in results if p.get("city", "").lower() == city_l]

    if params.min_price is not None:
        results = [p for p in results if p.get("price", 0) >= params.min_price]

    if params.max_price is not None:
        results = [p for p in results if p.get("price", 0) <= params.max_price]

    return results

# ----- REST Endpoints for tools -----
@app.get("/products")
def list_products():
    return list_products_impl()

@app.post("/products/search")
def search_products(search_params: ProductSearch):
    return search_products_impl(search_params)

# ----- JSON-RPC (MCP tool façade) -----
@app.post("/mcp")
def mcp_endpoint(req: JsonRpcRequest):
    if req.jsonrpc != "2.0":
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32600, "message": "Invalid JSON-RPC version"},
                "id": req.id,
            },
            status_code=400,
        )

    mapping = {
        "list_products": lambda p: list_products_impl(),
        "search_products": lambda p: search_products_impl(ProductSearch(**(p or {}))),
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

    t0 = time.time()
    try:
        result = mapping[req.method](req.params)
        duration_ms = int((time.time() - t0) * 1000)
        print(json.dumps({
            "evt": "json_rpc_request",
            "method": req.method,
            "params": req.params,
            "result_count": len(result) if isinstance(result, list) else None,
            "duration_ms": duration_ms
        }))
        return {"jsonrpc": "2.0", "result": result, "id": req.id}
    except Exception as exc:
        duration_ms = int((time.time() - t0) * 1000)
        print(json.dumps({
            "evt": "json_rpc_request_error",
            "method": req.method,
            "params": req.params,
            "duration_ms": duration_ms,
            "error": str(exc)
        }))
        return JSONResponse(
            {
                "jsonrpc": "2.0",
                "error": {"code": -32000, "message": str(exc)},
                "id": req.id,
            },
            status_code=500,
        )

# ----- Whisper Transcription -----
@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    MAX_MB = 10
    if file.size and file.size > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")

    allowed_ext = {".webm", ".mp3", ".wav", ".m4a", ".ogg"}
    suffix = os.path.splitext(file.filename or "")[-1].lower()
    if suffix and suffix not in allowed_ext:
        raise HTTPException(status_code=400, detail="Unsupported audio format")

    client = OpenAI(api_key=OPENAI_API_KEY)
    tmp_path = None
    t0 = time.time()
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix or ".webm") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Expand the YAML config explicitly (avoid hidden key surprises)
        transcribe_cfg = PROMPTS_CONFIG.get("transcribe", {}) or {}
        model = transcribe_cfg.get("model", "whisper-1")
        response_format = transcribe_cfg.get("response_format", "text")
        language = transcribe_cfg.get("language")

        with open(tmp_path, "rb") as audio_f:
            transcript = client.audio.transcriptions.create(
                model=model,
                file=audio_f,
                response_format=response_format,
                language=language,
            )

        text = transcript if isinstance(transcript, str) else getattr(transcript, "text", str(transcript))
        print(json.dumps({
            "evt": "transcribe",
            "filename": file.filename,
            "size_bytes": len(content),
            "duration_ms": int((time.time() - t0) * 1000)
        }))
        return {"text": text}
    except Exception as exc:
        print(json.dumps({
            "evt": "transcribe_error",
            "error": str(exc),
            "duration_ms": int((time.time() - t0) * 1000)
        }))
        return JSONResponse(status_code=500, content={"error": str(exc)})
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

# ----- Health -----
@app.get("/healthz")
def healthz():
    return {"ok": True}

# ----- Discovery -----
@app.get("/.well-known/mcp.json")
def get_mcp():
    # Could add cache headers
    return PROMPTS_CONFIG["mcp_discovery"]