"""
🎨 Self-Hosted Kilim Motif Generator v2 — SDXL Turbo (CPU)
Daha kaliteli image generation — SDXL tabanlı, 2-5dk/image
"""
import os
import io
import base64
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from PIL import Image, ImageFilter, ImageOps

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("image-gen")

MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
MODEL_ID = os.environ.get("MODEL_ID", "stabilityai/sdxl-turbo")
NUM_THREADS = int(os.environ.get("NUM_THREADS", "0"))
PORT = int(os.environ.get("PORT", "8080"))

# Global pipelines
pipe_t2i = None
pipe_i2i = None
model_ready = False

KILIM_PROMPT = """masterpiece, best quality, professional traditional Anatolian Turkish kilim carpet motif, 
highly detailed geometric folk art pattern, pixel-perfect stepped lines, diamond shapes, 
triangle borders, zigzag edges, elibelinde motif style, 
rich deep crimson red, royal navy blue, antique gold saffron, natural cream ivory wool, dark walnut brown, 
textured woven wool fabric surface, visible thread weave pattern, slight raised embossed relief texture,
authentic hand-woven kilim aesthetic, tactile textile feel,
symmetric composition, ornate decorative kilim border frame, museum quality Turkish rug design,
close-up macro photography of a real kilim rug showing fabric texture"""

NEGATIVE_PROMPT = """blurry, low quality, deformed, ugly, disfigured, photorealistic person, face, 
3d render, modern art, abstract expressionism, 
watercolor, oil painting, pencil sketch, cartoon, anime,
text, watermark, signature, logo"""


def load_model():
    """SDXL Turbo model yükle"""
    global pipe_t2i, pipe_i2i, model_ready
    import torch
    from diffusers import AutoPipelineForText2Image, AutoPipelineForImage2Image

    logger.info(f"📦 Model yükleniyor: {MODEL_ID}")
    logger.info(f"📂 Cache dizini: {MODEL_DIR}")
    start = time.time()

    if NUM_THREADS > 0:
        torch.set_num_threads(NUM_THREADS)
        logger.info(f"🧵 Thread sayısı: {NUM_THREADS}")
    else:
        logger.info(f"🧵 Thread sayısı: otomatik ({torch.get_num_threads()})")

    # SDXL Turbo — text-to-image
    pipe_t2i = AutoPipelineForText2Image.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float32,
        cache_dir=MODEL_DIR,
        variant="fp16" if torch.cuda.is_available() else None,
        safety_checker=None,
    )

    # SDXL Turbo — img2img (model ağırlıklarını paylaşır)
    pipe_i2i = AutoPipelineForImage2Image.from_pipe(pipe_t2i)

    elapsed = time.time() - start
    model_ready = True
    logger.info(f"✅ SDXL Turbo model hazır! ({elapsed:.1f}s)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Kilim Motif Generator v2 — SDXL Turbo", lifespan=lifespan)


class GenerateRequest(BaseModel):
    prompt: Optional[str] = None
    image: Optional[str] = None
    strength: float = 0.55            # orijinal deseni %45 koru
    steps: int = 6            # SDXL Turbo: strength*steps >= 4 olmalı
    guidance_scale: float = 0.0   # SDXL Turbo: 0.0 = en iyi
    width: int = 512
    height: int = 512


def preprocess_drawing(img: Image.Image, size: int = 512) -> Image.Image:
    """
    Minimal preprocessing — orijinal çizimi koru, sadece resize et.
    SDXL Turbo strength=0.65 ile orijinal şekli koruyup kilim stili uygulayacak.
    """
    return img.resize((size, size), Image.LANCZOS)


def add_emboss_texture(img: Image.Image) -> Image.Image:
    """
    Gerçek halı dokuma tekstürü — prosedürel iplik örüntüsü overlay.
    Yatay ve dikey iplik çizgileri oluşturup multiply blend ile bindirir.
    """
    from PIL import ImageEnhance, ImageDraw
    import numpy as np

    w, h = img.size

    # Dokuma tekstür pattern oluştur — gri tonlarda
    texture = Image.new("L", (w, h), 200)
    draw = ImageDraw.Draw(texture)

    # Yatay iplik çizgileri (kilim atkı iplikleri)
    for y in range(0, h, 4):
        brightness = 160 if (y // 4) % 2 == 0 else 220
        draw.line([(0, y), (w, y)], fill=brightness, width=1)
        draw.line([(0, y + 1), (w, y + 1)], fill=brightness - 30, width=1)

    # Dikey iplik çizgileri (kilim çözgü iplikleri) — daha ince
    for x in range(0, w, 6):
        brightness = 180 if (x // 6) % 2 == 0 else 210
        draw.line([(x, 0), (x, h)], fill=brightness, width=1)

    # Texture'ı RGB'ye çevir
    texture_rgb = Image.merge("RGB", [texture, texture, texture])

    # Multiply blend — orijinal renkleri koruyarak doku ekle
    import numpy as np
    img_arr = np.array(img, dtype=np.float32)
    tex_arr = np.array(texture_rgb, dtype=np.float32)

    # Multiply: (img * texture) / 255
    result_arr = (img_arr * tex_arr) / 255.0

    # Orijinal ile karıştır — %35 doku efekti
    blended_arr = img_arr * 0.65 + result_arr * 0.35
    blended_arr = np.clip(blended_arr, 0, 255).astype(np.uint8)

    result = Image.fromarray(blended_arr)

    # Hafif kontrast artır
    enhancer = ImageEnhance.Contrast(result)
    result = enhancer.enhance(1.15)

    # Sharpen — iplik detayları belirginleştir
    result = result.filter(ImageFilter.SHARPEN)

    return result


@app.post("/generate")
def generate(req: GenerateRequest):
    """Image generation — text2img veya img2img"""
    if not model_ready:
        return {"error": "Model henüz yüklenmiyor"}, 503

    prompt = req.prompt or KILIM_PROMPT
    start = time.time()

    try:
        if req.image:
            logger.info(f"🖼️ img2img başlıyor (strength={req.strength}, steps={req.steps})")
            img_data = req.image.split(",")[1] if "," in req.image else req.image
            input_img = Image.open(io.BytesIO(base64.b64decode(img_data))).convert("RGB")

            # Preprocessing
            processed_img = preprocess_drawing(input_img, req.width)
            logger.info("🎨 Preprocessing tamamlandı")

            result = pipe_i2i(
                prompt=prompt,
                image=processed_img,
                num_inference_steps=req.steps,
                guidance_scale=req.guidance_scale,
                strength=req.strength,
            )
        else:
            logger.info(f"✏️ text2img başlıyor (steps={req.steps})")
            result = pipe_t2i(
                prompt=prompt,
                num_inference_steps=req.steps,
                guidance_scale=req.guidance_scale,
                width=req.width,
                height=req.height,
            )

        output_img = result.images[0]

        # Kabartma/emboss efekti — gerçek halı dokusu hissi
        output_img = add_emboss_texture(output_img)

        buf = io.BytesIO()
        output_img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()

        elapsed = time.time() - start
        logger.info(f"✅ Image üretildi ({elapsed:.1f}s)")

        return {
            "image": f"data:image/png;base64,{b64}",
            "elapsed_seconds": round(elapsed, 1),
        }

    except Exception as e:
        logger.error(f"❌ Generation hatası: {e}")
        return {"error": str(e)}, 500


@app.get("/health")
def health():
    import torch
    return {
        "status": "ready" if model_ready else "loading",
        "model": MODEL_ID,
        "threads": torch.get_num_threads() if model_ready else None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
