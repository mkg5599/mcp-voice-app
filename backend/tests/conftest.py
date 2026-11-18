import os
import sys

import pytest

# Tests never call the real Gemini API. An empty value (rather than unset) also stops
# python-dotenv from loading a real key from backend/.env.
os.environ["GEMINI_API_KEY"] = ""
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def anyio_backend():
    return "asyncio"
