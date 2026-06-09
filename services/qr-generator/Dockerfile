# ── Base ──────────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# ── System dependencies ───────────────────────────────────────────────────────
# fonts-dejavu-core : provides DejaVuSans-Bold.ttf used by the watermark layer
# libpng-dev        : Pillow PNG codec (write)
# libjpeg-dev       : Pillow JPEG codec (logo download may be JPEG)
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-dejavu-core \
        libpng-dev \
        libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
# Copy requirements first to leverage Docker layer cache on code-only changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Application source ────────────────────────────────────────────────────────
COPY main.py .

# ── Security: non-root user ───────────────────────────────────────────────────
RUN adduser --disabled-password --gecos "" --uid 1001 appuser
USER appuser

EXPOSE 8000

# ── Health check (Coolify reads this before marking the service healthy) ──────
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" \
    || exit 1

# ── Server ────────────────────────────────────────────────────────────────────
# 2 workers: image processing is CPU-bound; 2 workers handle concurrent n8n
# calls without over-subscribing a typical 2-vCPU / 8 GB Coolify VPS.
# Increase to 4 if you have 4+ vCPUs available.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
