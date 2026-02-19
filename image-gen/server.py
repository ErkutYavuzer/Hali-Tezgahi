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

KILIM_PROMPT = """Traditional Anatolian Turkish kilim carpet motif, geometric style, 
stepped lines, diamonds, triangles, zigzag edges, 
deep red navy blue gold saffron cream colors, 
flat textile coloring, no gradients, hand-woven aesthetic, 
square format, centered composition, decorative border frame"""


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
    strength: float = 0.75            # img2img gücü (0.0-1.0)
    steps: int = 4                    # LCM adım sayısı (4-8)
    width: int = 512
    height: int = 512


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
            input_img = input_img.resize((req.width, req.height), Image.LANCZOS)

            result = pipe_i2i(
                prompt=prompt,
                image=input_img,
                num_inference_steps=req.steps,
                guidance_scale=1.0,
                strength=req.strength,
            )
        else:
            # text2img
            logger.info(f"✏️ text2img başlıyor (steps={req.steps})")
            result = pipe_t2i(
                prompt=prompt,
                num_inference_steps=req.steps,
                guidance_scale=1.0,
                width=req.width,
                height=req.height,
            )

        # Image → base64
        output_img = result.images[0]
        buf = io.BytesIO()
        output_img.save(buf, format="JPEG", quality=85)
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
