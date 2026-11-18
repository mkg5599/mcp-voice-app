"""Application configuration, read from environment variables.

Every model name is configurable so a provider retiring a model is a settings
change, not a code change.
"""
import os

from dotenv import load_dotenv

load_dotenv()

# File paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS_JSON_PATH = os.path.join(BACKEND_DIR, "data", "products.json")

# Environment detection
IS_VERCEL = os.getenv("VERCEL") == "1"

# Gemini (used only for embeddings on the backend; the chat agent runs in the frontend)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_BASE = os.getenv("GEMINI_API_BASE", "https://generativelanguage.googleapis.com/v1beta")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))
EMBEDDING_TIMEOUT_S = float(os.getenv("EMBEDDING_TIMEOUT_S", "30"))

# Semantic search
SEMANTIC_DEFAULT_TOP_K = int(os.getenv("SEMANTIC_DEFAULT_TOP_K", "5"))
SEMANTIC_MIN_SIMILARITY = float(os.getenv("SEMANTIC_MIN_SIMILARITY", "0.0"))

# CORS
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]

APP_VERSION = "2.0.0"
