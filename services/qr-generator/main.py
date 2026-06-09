"""
Smart Resto — Artistic QR Code Generation Microservice
=======================================================

Triggered by n8n or the Next.js backend via POST /generate-qr.
Returns a PNG as a StreamingResponse, or as a base64 JSON for n8n.

Pipeline
--------
1.  Download logo (if provided) via async HTTP.
2.  Extract dominant brand color from logo (auto-branding).
3.  Generate QR with ERROR_CORRECT_H, circular dot modules, brand color.
4.  Embed resized logo (≤22 % of QR area) at center with white padding halo.
5.  If preview_mode=True  → tile a semi-transparent diagonal watermark.
6.  Serialise to PNG and return stream or base64 JSON.

n8n node setup
--------------
  Node type : HTTP Request (POST)
  URL       : http://<coolify-service>:8000/generate-qr
  Body JSON : { "url": "...", "logo_url": "...",
                "preview_mode": false, "response_format": "base64" }
  Output    : {{ $json.image }}  (data:image/png;base64,…) → upload to Cloudinary
"""

from __future__ import annotations

import base64
import io
import logging
import math
from collections import Counter
from typing import Literal, Optional

import httpx
import qrcode
import qrcode.constants
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, field_validator
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers.pil import CircleModuleDrawer
from qrcode.image.styledpil import StyledPilImage

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(message)s")
log = logging.getLogger("smartresto.qr")

# ── Application ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Resto — Artistic QR Generator",
    description="Generates branded artistic QR codes with circular modules, logo embedding, and optional preview watermark.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict to your Next.js origin in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Request Schema ────────────────────────────────────────────────────────────

class QRRequest(BaseModel):
    url: str
    logo_url: Optional[str] = None
    # True  = semi-transparent watermark drawn (preview / free tier)
    # False = clean final image           (paid / activated cafe)
    preview_mode: bool = True
    # 'stream'  → StreamingResponse PNG  (default, best for browser/Next.js)
    # 'base64'  → JSONResponse { image, brand_color, preview_mode } (best for n8n)
    response_format: Literal["stream", "base64"] = "stream"
    # Output image size in pixels (square)
    qr_size: int = 400

    @field_validator("url")
    @classmethod
    def url_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("url must not be empty")
        return v.strip()

    @field_validator("qr_size")
    @classmethod
    def size_in_range(cls, v: int) -> int:
        if not (200 <= v <= 1200):
            raise ValueError("qr_size must be between 200 and 1200")
        return v


# ── Helper: Download Image ────────────────────────────────────────────────────

async def download_image(url: str, timeout: float = 8.0) -> Image.Image:
    """Fetch an image over HTTP and return a PIL Image."""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content))
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Logo URL returned HTTP {exc.response.status_code}",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not download logo: {exc}")


# ── Helper: Brand Color Extraction ───────────────────────────────────────────

def extract_brand_color(logo: Image.Image) -> tuple[int, int, int]:
    """
    Analyse the logo and return the dominant dark accent color as an RGB tuple.

    Algorithm:
      • Resize to 100×100 for speed.
      • Flatten RGBA transparency onto white.
      • Posterise (bucket size = 24) and count pixel frequencies.
      • Score = frequency × darkness_weight  (prefers frequent + dark colors).
      • Skip near-white (unusable on white QR background).
      • Darken the winner if perceived luminance > 140 (WCAG AA contrast).

    The returned hex string is stored in Cafe.logoAccentColor by the n8n pipeline.
    """
    thumb = logo.copy().convert("RGBA")
    thumb.thumbnail((100, 100), Image.LANCZOS)

    # Flatten transparency onto white
    bg = Image.new("RGB", thumb.size, (255, 255, 255))
    bg.paste(thumb, mask=thumb.split()[3])
    thumb = bg

    BUCKET = 24
    buckets: Counter = Counter()
    for r, g, b in thumb.getdata():
        key = (
            round(r / BUCKET) * BUCKET,
            round(g / BUCKET) * BUCKET,
            round(b / BUCKET) * BUCKET,
        )
        buckets[key] += 1

    best_color: tuple[int, int, int] = (0, 0, 0)
    best_score = -1.0

    for (r, g, b), count in buckets.items():
        # Skip near-white — cannot read against a white QR background
        if r > 210 and g > 210 and b > 210:
            continue
        # Perceived luminance (ITU-R BT.601)
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        if lum < 10:
            continue  # Skip pure black — a brand color is more informative
        score = count * (1.0 - lum / 255.0)
        if score > best_score:
            best_score = score
            best_color = (r, g, b)

    # Darken if still too light for contrast
    r, g, b = best_color
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if lum > 140:
        best_color = (int(r * 0.55), int(g * 0.55), int(b * 0.55))

    log.info(f"Extracted brand color: RGB{best_color}")
    return best_color


# ── Helper: Logo Embedding ────────────────────────────────────────────────────

def embed_logo(qr_img: Image.Image, logo: Image.Image) -> Image.Image:
    """
    Resize the logo to ≤22 % of the QR image area and centre it.

    A white padding halo is added around the logo to ensure it reads cleanly
    against any QR module color. ERROR_CORRECT_H (~30 % recovery) handles
    the hidden modules underneath the logo.
    """
    qr_img = qr_img.convert("RGBA")
    qr_w, qr_h = qr_img.size

    # Max logo bounding box = side of a square that is 22 % of total QR area
    max_side = int(math.sqrt(0.22 * qr_w * qr_h))

    logo = logo.copy().convert("RGBA")
    logo.thumbnail((max_side, max_side), Image.LANCZOS)
    logo_w, logo_h = logo.size

    # White halo padding
    pad = max(4, int(max_side * 0.06))
    canvas = Image.new("RGBA", (logo_w + pad * 2, logo_h + pad * 2), (255, 255, 255, 255))
    canvas.paste(logo, (pad, pad), logo)

    pos = ((qr_w - canvas.width) // 2, (qr_h - canvas.height) // 2)
    qr_img.paste(canvas, pos, canvas)
    return qr_img


# ── Helper: Watermark ─────────────────────────────────────────────────────────

def apply_watermark(img: Image.Image, text: str = "SMART RESTO PRO") -> Image.Image:
    """
    Tile a semi-transparent diagonal "SMART RESTO PRO" watermark across the image.

    Called when preview_mode=True so non-paying cafes cannot use the output in
    production. Opacity (alpha=75/255 ≈ 30 %) is light enough to still evaluate
    the design, but clearly marks it as a preview.
    """
    img = img.convert("RGBA")
    w, h = img.size

    font_size = max(16, w // 18)
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont
    # DejaVuSans-Bold is installed via fonts-dejavu-core in the Dockerfile
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size
        )
    except OSError:
        try:
            font = ImageFont.load_default(size=font_size)  # Pillow ≥ 10.1
        except TypeError:
            font = ImageFont.load_default()

    # Build a large canvas so rotated tiles cover the full image after cropping
    diag = int(math.hypot(w, h)) + 120
    wm = Image.new("RGBA", (diag, diag), (255, 255, 255, 0))
    draw = ImageDraw.Draw(wm)

    bbox = draw.textbbox((0, 0), text, font=font)
    txt_w, txt_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    step_x, step_y = txt_w + 40, txt_h + 30

    for row, y in enumerate(range(-step_y, diag + step_y, step_y)):
        x_offset = (row % 2) * (step_x // 2)  # stagger alternate rows
        for x in range(-step_x + x_offset, diag + step_x, step_x):
            draw.text((x, y), text, font=font, fill=(110, 110, 110, 75))

    # Rotate 40° and crop back to image dimensions
    wm = wm.rotate(40, resample=Image.BICUBIC)
    left = (diag - w) // 2
    top  = (diag - h) // 2
    wm = wm.crop((left, top, left + w, top + h))

    return Image.alpha_composite(img, wm).convert("RGB")


# ── Core Generator (orchestrator) ─────────────────────────────────────────────

async def generate_qr_image(req: QRRequest) -> tuple[Image.Image, str]:
    """
    Full generation pipeline. Returns (PIL Image, brand_color_hex).

    Step 1: Download logo  → extract dominant brand color (fallback: black).
    Step 2: Build QR       → ERROR_CORRECT_H + circular modules + brand color.
    Step 3: Embed logo     → centered with white halo.
    Step 4: Watermark      → diagonal tiled overlay (preview_mode only).
    """
    # ── Step 1: Logo + color ────────────────────────────────────────────────
    logo: Optional[Image.Image] = None
    fill_color: tuple[int, int, int] = (0, 0, 0)

    if req.logo_url:
        log.info(f"Downloading logo from {req.logo_url}")
        logo = await download_image(req.logo_url)
        fill_color = extract_brand_color(logo)

    brand_hex = "#{:02x}{:02x}{:02x}".format(*fill_color)

    # ── Step 2: QR generation ───────────────────────────────────────────────
    qr = qrcode.QRCode(
        version=None,                                    # auto-select smallest version
        error_correction=qrcode.constants.ERROR_CORRECT_H,  # ≈30 % recovery — required for logo
        box_size=10,
        border=4,
    )
    qr.add_data(req.url)
    qr.make(fit=True)

    qr_raw = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=CircleModuleDrawer(),
        color_mask=SolidFillColorMask(
            back_color=(255, 255, 255),
            front_color=fill_color,
        ),
    )

    # StyledPilImage → PIL Image (version-safe path via buffer)
    buf = io.BytesIO()
    qr_raw.save(buf, format="PNG")
    buf.seek(0)
    pil_img = Image.open(buf).copy().convert("RGBA")

    # Normalise to requested output size
    pil_img = pil_img.resize((req.qr_size, req.qr_size), Image.LANCZOS)

    # ── Step 3: Logo embedding ──────────────────────────────────────────────
    if logo is not None:
        pil_img = embed_logo(pil_img, logo)

    # ── Step 4: Watermark ───────────────────────────────────────────────────
    if req.preview_mode:
        pil_img = apply_watermark(pil_img)

    return pil_img.convert("RGB"), brand_hex


# ── Privacy Image Processing ──────────────────────────────────────────────────

class ProcessImageRequest(BaseModel):
    image_base64: str
    mode: Literal["privacy_blur"] = "privacy_blur"
    blur_radius: int = 28

    @field_validator("blur_radius")
    @classmethod
    def clamp_blur(cls, v: int) -> int:
        return max(5, min(80, v))


@app.post(
    "/process-image",
    summary="Apply privacy filter to a review photo",
    responses={
        200: {"content": {"application/json": {}}},
        400: {"description": "Invalid or unreadable image"},
    },
)
async def process_image_endpoint(req: ProcessImageRequest):
    """
    Apply a privacy-preserving Gaussian blur to a base64-encoded image.

    Called by n8n W2 when `userConsentGranted = false`.
    Returns the processed image as a base64 data URI.

    | Field          | Description                                   |
    |----------------|-----------------------------------------------|
    | `image_base64` | `data:image/...;base64,...` or raw base64     |
    | `mode`         | `privacy_blur` — Gaussian blur whole image    |
    | `blur_radius`  | Blur strength, 5–80 (default 28)              |
    """
    try:
        # Strip the data URI prefix if present
        raw = req.image_base64
        if "," in raw:
            raw = raw.split(",", 1)[1]
        img_bytes = base64.b64decode(raw)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {exc}")

    from PIL import ImageFilter
    blurred = img.filter(ImageFilter.GaussianBlur(radius=req.blur_radius))

    output = io.BytesIO()
    blurred.save(output, format="PNG", optimize=True)
    b64 = base64.b64encode(output.getvalue()).decode()

    log.info(f"Privacy blur applied │ radius={req.blur_radius} │ size={img.size}")
    return JSONResponse(content={"processed_image": f"data:image/png;base64,{b64}"})


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post(
    "/generate-qr",
    summary="Generate an artistic branded QR code",
    responses={
        200: {"content": {"image/png": {}, "application/json": {}}},
        400: {"description": "Invalid input or unreachable logo URL"},
    },
)
async def generate_qr_endpoint(req: QRRequest):
    """
    Generate a premium artistic QR code.

    | Field             | Description                                                |
    |-------------------|------------------------------------------------------------|
    | `url`             | Target URL encoded in the QR (required)                    |
    | `logo_url`        | Restaurant logo URL — triggers auto color extraction       |
    | `preview_mode`    | `true` = watermarked (free); `false` = clean final (paid)  |
    | `response_format` | `stream` = PNG bytes (browser/Next.js); `base64` = n8n     |
    | `qr_size`         | Output pixel dimensions, 200–1200 (default 400)            |
    """
    log.info(
        f"QR request │ preview={req.preview_mode} │ format={req.response_format} │ url={req.url!r}"
    )

    img, brand_hex = await generate_qr_image(req)

    output = io.BytesIO()
    img.save(output, format="PNG", optimize=True)
    output.seek(0)

    if req.response_format == "base64":
        b64 = base64.b64encode(output.read()).decode()
        return JSONResponse(content={
            "image": f"data:image/png;base64,{b64}",
            "brand_color": brand_hex,
            "preview_mode": req.preview_mode,
        })

    return StreamingResponse(output, media_type="image/png")


@app.get("/health", summary="Liveness probe", tags=["ops"])
async def health():
    """Coolify / Docker health check endpoint."""
    return {"status": "ok", "service": "smartresto-qr-generator"}
