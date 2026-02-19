"""
🎨 Self-Hosted Kilim Motif Generator — LCM + CPU (OpenVINO opsiyonel)
FastAPI server — Stable Diffusion LCM model ile hızlı image generation
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
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("image-gen")

MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
MODEL_ID = os.environ.get("MODEL_ID", "SimianLuo/LCM_Dreamshaper_v7")
NUM_THREADS = int(os.environ.get("NUM_THREADS", "0"))  # 0 = otomatik
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
symmetric composition, ornate decorative kilim border frame, museum quality Turkish rug design"""

NEGATIVE_PROMPT = """blurry, low quality, photorealistic, 3d render, gradient, shadow, 
modern art, abstract, watercolor, oil painting, sketch, pencil drawing, 
text, watermark, signature, frame, border outside image"""


def load_model():
    """Model yükle — ilk çalışmada indirir, sonraki seferlerde cache kullanır"""
    global pipe_t2i, pipe_i2i, model_ready
    import torch
    from diffusers import DiffusionPipeline, LCMScheduler, AutoPipelineForImage2Image

    logger.info(f"📦 Model yükleniyor: {MODEL_ID}")
    logger.info(f"📂 Cache dizini: {MODEL_DIR}")
    start = time.time()

    # CPU thread sayısını ayarla
    if NUM_THREADS > 0:
        torch.set_num_threads(NUM_THREADS)
        logger.info(f"🧵 Thread sayısı: {NUM_THREADS}")
    else:
        logger.info(f"🧵 Thread sayısı: otomatik ({torch.get_num_threads()})")

    # Text-to-image pipeline
    pipe_t2i = DiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float32,
        cache_dir=MODEL_DIR,
        safety_checker=None,
        requires_safety_checker=False,
    )
    pipe_t2i.scheduler = LCMScheduler.from_config(pipe_t2i.scheduler.config)

    # Img2Img pipeline (aynı model ağırlıklarını paylaşır)
    pipe_i2i = AutoPipelineForImage2Image.from_pipe(pipe_t2i)

    elapsed = time.time() - start
    model_ready = True
    logger.info(f"✅ Model hazır! ({elapsed:.1f}s)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup'ta model yükle"""
    load_model()
    yield


app = FastAPI(title="Kilim Motif Generator", lifespan=lifespan)


class GenerateRequest(BaseModel):
    prompt: Optional[str] = None
    image: Optional[str] = None       # base64 data URL (img2img için)
    strength: float = 0.95            # neredeyse tamamen yeniden çiz
    steps: int = 8                    # LCM adım sayısı (8 = kaliteli)
    guidance_scale: float = 2.0       # prompt'a bağlılık
    width: int = 512
    height: int = 512


def preprocess_drawing(img: Image.Image, size: int = 512) -> Image.Image:
    """
    Orijinal çizimi kilim-uyumlu bir referans görsele dönüştür:
    1. Kenar tespiti (edge detection)
    2. Kalın konturlar
    3. Krem zemin + koyu kırmızı konturlar → kilim renk paleti
    """
    from PIL import ImageFilter, ImageOps

    # Resize
    img = img.resize((size, size), Image.LANCZOS)

    # Grayscale → edge detection
    gray = img.convert("L")

    # Find edges — çizim hatlarını tespit et
    edges = gray.filter(ImageFilter.FIND_EDGES)

    # Konturları kalınlaştır
    edges = edges.filter(ImageFilter.MaxFilter(5))

    # Threshold — binary siyah-beyaz
    edges = edges.point(lambda x: 255 if x > 30 else 0)

    # Invert — çizgiler beyaz, zemin siyah olsun
    edges = ImageOps.invert(edges)

    # Kilim renk paleti uygula: krem zemin + koyu kırmızı konturlar
    kilim_base = Image.new("RGB", (size, size), (235, 220, 195))  # krem/ivory
    kilim_lines = Image.new("RGB", (size, size), (139, 0, 0))      # koyu kırmızı

    # Mask olarak edge kullan
    mask = edges.point(lambda x: 255 if x < 128 else 0)
    kilim_base.paste(kilim_lines, mask=mask)

    return kilim_base


@app.post("/generate")
def generate(req: GenerateRequest):
    """Image generation endpoint — text2img veya img2img"""
    if not model_ready:
        return {"error": "Model henüz yüklenmiyor"}, 503

    prompt = req.prompt or KILIM_PROMPT
    start = time.time()

    try:
        if req.image:
            # img2img — orijinal çizimi kilim motifine dönüştür
            logger.info(f"🖼️ img2img başlıyor (strength={req.strength}, steps={req.steps})")
            img_data = req.image.split(",")[1] if "," in req.image else req.image
            input_img = Image.open(io.BytesIO(base64.b64decode(img_data))).convert("RGB")

            # Preprocessing: çizimden kilim-uyumlu referans oluştur
            processed_img = preprocess_drawing(input_img, req.width)
            logger.info("🎨 Çizim preprocessed → kilim referans oluşturuldu")

            result = pipe_i2i(
                prompt=prompt,
                negative_prompt=NEGATIVE_PROMPT,
                image=processed_img,
                num_inference_steps=req.steps,
                guidance_scale=req.guidance_scale,
                strength=req.strength,
            )
        else:
            # text2img
            logger.info(f"✏️ text2img başlıyor (steps={req.steps})")
            result = pipe_t2i(
                prompt=prompt,
                negative_prompt=NEGATIVE_PROMPT,
                num_inference_steps=req.steps,
                guidance_scale=req.guidance_scale,
                width=req.width,
                height=req.height,
            )

        # Image → base64
        output_img = result.images[0]
        buf = io.BytesIO()
        output_img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()

        elapsed = time.time() - start
        logger.info(f"✅ Image üretildi ({elapsed:.1f}s)")

        return {
            "image": f"data:image/jpeg;base64,{b64}",
            "elapsed_seconds": round(elapsed, 1),
        }

    except Exception as e:
        logger.error(f"❌ Generation hatası: {e}")
        return {"error": str(e)}, 500


@app.get("/health")
def health():
    """Sağlık kontrolü"""
    import torch
    return {
        "status": "ready" if model_ready else "loading",
        "model": MODEL_ID,
        "threads": torch.get_num_threads() if model_ready else None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
