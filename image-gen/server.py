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
flat woven textile texture, zero gradients, zero shadows, authentic hand-woven kilim aesthetic, 
symmetric composition, ornate decorative kilim border frame, museum quality Turkish rug design,
viewed from directly above, flat lay photography of a real kilim rug"""

NEGATIVE_PROMPT = """blurry, low quality, deformed, ugly, disfigured, photorealistic person, face, 
3d render, gradient lighting, shadow, modern art, abstract expressionism, 
watercolor, oil painting, pencil sketch, cartoon, anime,
text, watermark, signature, logo, frame"""


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
    strength: float = 0.90
    steps: int = 4            # SDXL Turbo: 1-4 step optimal
    guidance_scale: float = 0.0   # SDXL Turbo: 0.0 = en iyi
    width: int = 512
    height: int = 512


def preprocess_drawing(img: Image.Image, size: int = 512) -> Image.Image:
    """
    Çizimi kilim-uyumlu referans görsele dönüştür:
    1. Kenar tespiti
    2. Basamaklı geometrik şekillere quantize et
    3. Kilim renk paleti ile renklendir
    """
    img = img.resize((size, size), Image.LANCZOS)
    gray = img.convert("L")

    # Çizim hatlarını bul
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edges = edges.filter(ImageFilter.MaxFilter(3))
    edges = edges.point(lambda x: 255 if x > 25 else 0)
    edges = ImageOps.invert(edges)

    # Basamaklı geometrik quantize — pikselleri 8x8 bloklara böl
    block_size = 8
    quantized = edges.copy()
    pixels = quantized.load()
    w, h = quantized.size
    for y in range(0, h, block_size):
        for x in range(0, w, block_size):
            # Blok ortalaması
            total = 0
            count = 0
            for dy in range(min(block_size, h - y)):
                for dx in range(min(block_size, w - x)):
                    total += pixels[x + dx, y + dy]
                    count += 1
            avg = total // count
            val = 0 if avg < 128 else 255
            for dy in range(min(block_size, h - y)):
                for dx in range(min(block_size, w - x)):
                    pixels[x + dx, y + dy] = val

    # Kilim renk paleti
    kilim_colors = [
        (180, 40, 30),    # koyu kırmızı
        (25, 40, 100),    # lacivert
        (200, 160, 50),   # altın sarı
        (235, 220, 195),  # krem
        (80, 50, 30),     # koyu kahve
    ]

    # Renkli kilim referansı oluştur
    kilim_img = Image.new("RGB", (size, size), kilim_colors[3])  # krem zemin
    mask = quantized.point(lambda x: 255 if x < 128 else 0)
    motif_layer = Image.new("RGB", (size, size), kilim_colors[0])  # kırmızı motif
    kilim_img.paste(motif_layer, mask=mask)

    # Çerçeve ekle — kilim bordur
    border = 16
    for i in range(border):
        color_idx = (i // 4) % len(kilim_colors)
        c = kilim_colors[color_idx]
        for x in range(size):
            kilim_img.putpixel((x, i), c)
            kilim_img.putpixel((x, size - 1 - i), c)
        for y in range(size):
            kilim_img.putpixel((i, y), c)
            kilim_img.putpixel((size - 1 - i, y), c)

    return kilim_img


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
