FROM python:3.13-slim AS builder
WORKDIR /app

ENV POETRY_VERSION=1.8.3 \
    POETRY_VIRTUALENVS_CREATE=false \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip && pip install "poetry==$POETRY_VERSION"

# Copy dependency metadata
COPY pyproject.toml poetry.lock* ./

# (Optional) self-heal lock if out-of-sync
RUN (poetry lock --no-update || poetry lock)

# Install (exclude dev deps for runtime image)
RUN poetry install --no-root --without dev --no-interaction --no-ansi

FROM python:3.13-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.13 /usr/local/lib/python3.13
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy app source
COPY . /app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD \
    curl -fsS http://localhost:8000/healthz || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host","0.0.0.0","--port","8000"]