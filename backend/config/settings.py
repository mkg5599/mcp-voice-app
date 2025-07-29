"""Application configuration and settings."""
import os
import yaml
from dotenv import load_dotenv

load_dotenv()

# File paths
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS_JSON_PATH = os.path.join(BACKEND_DIR, "data", "products.json")
PROMPTS_YAML_PATH = os.path.join(BACKEND_DIR, "prompts.yml")

# Environment detection
IS_VERCEL = os.getenv("VERCEL") == "1"

# API Keys
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# CORS settings
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Load MCP configuration
def load_mcp_config():
    """Load MCP configuration from YAML file."""
    with open(PROMPTS_YAML_PATH, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    
    if "mcp_discovery" not in config:
        raise RuntimeError("prompts.yml missing 'mcp_discovery' section")
    
    return config

PROMPTS_CONFIG = load_mcp_config()

# Vector store settings
EMBEDDING_BATCH_SIZE = 5 if IS_VERCEL else 10
EMBEDDING_MODEL = "text-embedding-ada-002"
EMBEDDING_TIMEOUT = 60
EMBEDDING_MAX_RETRIES = 3

# LLM Configuration for RAG
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.7"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "500"))

# RAG Configuration  
RAG_CONTEXT_SIZE = int(os.getenv("RAG_CONTEXT_SIZE", "5"))
RAG_SIMILARITY_THRESHOLD = float(os.getenv("RAG_SIMILARITY_THRESHOLD", "0.3"))