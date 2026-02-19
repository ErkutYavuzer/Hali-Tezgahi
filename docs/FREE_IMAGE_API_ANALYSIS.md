# 🎨 Ücretsiz Image Generation API Araştırması — Halı Tezgahı Demo

> **Tarih:** 2026-02-19
> **Amaç:** Demo amaçlı kilim motifi üretimi için ücretsiz veya minimum maliyetli image generation API'ları
> **Gereksinim:** img2img (çizim → kilim motifi dönüşümü), OpenAI-compatible API tercih edilir

---

## 📊 Mevcut Durum ve Maliyet Problemi

| Parametre | Değer |
|-----------|-------|
| Mevcut Model | `gemini-3-pro-image-1x1` |
| Mevcut Gateway | `antigravity.mindops.net` → Google Cloud Code API |
| Sorun | `MODEL_CAPACITY_EXHAUSTED` (503) — Google sunucuları dolu |
| Maliyet Endişesi | Gateway hesapları ücretli Google Cloud hesapları kullanıyor |

---

## 🏆 ÖNERİLEN: Tier 1 — Tamamen Ücretsiz Seçenekler

### 1. ⭐ Google AI Studio (Direkt API Key) — EN İYİ SEÇİM

| Parametre | Değer |
|-----------|-------|
| **Endpoint** | `https://generativelanguage.googleapis.com/v1beta` |
| **Model** | `gemini-2.0-flash-exp` (image generation destekli) |
| **Ücretsiz Kota** | 100-500 istek/gün (model ve bölgeye göre değişir) |
| **Maliyet** | **$0 — Tamamen ücretsiz** |
| **API Key** | [aistudio.google.com](https://aistudio.google.com/apikey) adresinden ücretsiz alınır |
| **Kredi Kartı** | ❌ Gerekmiyor |
| **img2img** | ✅ Destekliyor (image input + text prompt) |
| **Format** | Google GenAI SDK veya REST API |

**Avantajlar:**

- Tamamen ücretsiz, kredi kartı gerektirmez
- img2img destekliyor (orijinal çizimi gönderebilirsin)
- Günde 100-500 image — demo için fazlasıyla yeterli
- Kaliteli çıktı (Gemini 2.0 Flash)

**Dezavantajlar:**

- OpenAI-compatible API değil — Google GenAI SDK veya REST format gerekir
- Kota midnight PST'de sıfırlanır
- Ücretsiz plan verisi Google tarafından model eğitimi için kullanılabilir
- Kapasite bazen dolu olabiliyor (şu anki sorun)

**Implementasyon:**

```javascript
// @google/genai SDK ile (zaten package.json'da var)
import { GoogleGenerativeAI } from '@google/genai';
const genai = new GoogleGenerativeAI('AI_STUDIO_API_KEY');
const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

const result = await model.generateContent({
  contents: [{
    parts: [
      { text: 'Transform this drawing into a kilim motif...' },
      { inlineData: { mimeType: 'image/png', data: base64Data } }
    ]
  }],
  generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
});
```

---

### 2. Hugging Face Inference API (FLUX.1 Schnell)

| Parametre | Değer |
|-----------|-------|
| **Endpoint** | `https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell` |
| **Model** | FLUX.1 Schnell (Apache 2.0 — ticari kullanım serbest) |
| **Ücretsiz Kota** | ~$0.10/ay referans kredi (yavaş, cold start var) |
| **Maliyet** | **$0 — Ücretsiz tier** |
| **API Key** | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) |
| **Kredi Kartı** | ❌ Gerekmiyor |
| **img2img** | ⚠️ Sınırlı — text-to-image güçlü, img2img için ek setup gerekir |
| **Format** | Basit REST API (POST + prompt → image binary) |

**Avantajlar:**

- Tamamen ücretsiz
- FLUX.1 Schnell çok hızlı (1-4 step)
- Basit REST API — çok kolay entegre edilir
- Apache 2.0 lisans — ticari kullanımda bile ücretsiz

**Dezavantajlar:**

- Cold start (ilk istek 30-60sn sürebilir)
- img2img doğrudan desteklemiyor (text-to-image)
- Rate limiting var (ücretsiz tier'da)
- SLA yok - üretim için uygun değil

**Implementasyon:**

```javascript
const response = await fetch(
  'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer hf_xxxxx',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: 'Traditional Turkish kilim motif of a [SUBJECT], geometric style...'
    })
  }
);
const imageBlob = await response.blob(); // Direkt image binary döner
```

---

### 3. Pollinations.ai (Sıfır Auth)

| Parametre | Değer |
|-----------|-------|
| **Endpoint** | `https://image.pollinations.ai/prompt/{prompt}` |
| **Model** | Flux, SDXL (otomatik seçim) |
| **Ücretsiz Kota** | Sınırsız (rate limiting var) |
| **Maliyet** | **$0** |
| **API Key** | ❌ Gerekmiyor — auth yok! |
| **Kredi Kartı** | ❌ Gerekmiyor |
| **img2img** | ❌ Hayır — sadece text-to-image |
| **Format** | GET request → image response |

**Avantajlar:**

- API key bile gerekmiyor — en kolay entegrasyon
- Sınırsız üretim
- URL tabanlı — `<img src="https://image.pollinations.ai/prompt/...">`

**Dezavantajlar:**

- img2img yok — orijinal çizimi koruyamaz
- Watermark olabilir (2025 Mart'tan itibaren)
- Kalite tutarsız
- Yavaş olabilir (queue sistemi)

**Implementasyon:**

```javascript
const prompt = encodeURIComponent('Traditional Turkish kilim carpet motif of a house, geometric, stepped lines');
const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512`;
// Direkt kullanılabilir — fetch ile indir veya img src olarak kullan
```

---

### 4. AI Horde (Dağıtık, Auth Yok)

| Parametre | Değer |
|-----------|-------|
| **Endpoint** | `https://stablehorde.net/api/v2/generate/async` |
| **Model** | Stable Diffusion, SDXL (topluluk GPU'ları) |
| **Ücretsiz Kota** | Sınırsız (düşük öncelik) |
| **Maliyet** | **$0** |
| **API Key** | ❌ Anonim kullanım mümkün (key ile öncelik artar) |
| **img2img** | ✅ Destekliyor |
| **Format** | REST API (async — submit → poll → result) |

**Avantajlar:**

- Tamamen ücretsiz ve açık kaynak
- img2img destekliyor!
- Auth gerektirmez
- Stable Diffusion modelleri

**Dezavantajlar:**

- Async — sonuç 30sn-5dk sürebilir (topluluk GPU'ları)
- Kalite tutarsız (farklı GPU'lar)
- Bazen çok yavaş (yoğun saatlerde)
- SLA yok

---

## 💰 Tier 2 — Çok Düşük Maliyetli Seçenekler ($5 altı/ay)

### 5. Together AI (FLUX.1 Schnell)

| Parametre | Değer |
|-----------|-------|
| **Maliyet** | İlk $25 ücretsiz kredi + $0.003/image |
| **img2img** | ⚠️ Sınırlı |
| **Tahmini Aylık** | ~370 image/$ → demo için $0-1/ay |

### 6. Replicate (FLUX, SDXL)

| Parametre | Değer |
|-----------|-------|
| **Maliyet** | İlk $5 ücretsiz + ~$0.003/image |
| **img2img** | ✅ Destekliyor |
| **Tahmini Aylık** | Demo için $0-2/ay |

### 7. Leonardo.ai

| Parametre | Değer |
|-----------|-------|
| **Maliyet** | $5 ücretsiz API kredi |
| **img2img** | ✅ Destekliyor |
| **Kalite** | Çok iyi (multiple model desteği) |

---

## ❌ Tier 3 — Pahalı / Uygun Değil

| Seçenek | Neden Uygun Değil |
|---------|-------------------|
| OpenAI DALL-E 3 | $0.04-0.08/image — demo için pahalı |
| Midjourney API | Aylık $10+ abonelik gerekli |
| Google Imagen (Vertex AI) | $0.02-0.04/image + Cloud billing gerekli |
| Stability AI (SD3.5) | $0.025/image — ücretsiz tier çok kısıtlı |

---

## 🎯 Halı Tezgahı İçin Tavsiye Sıralaması

### Demo Kullanımı (günde 10-50 motif)

| Sıra | Seçenek | img2img | Maliyet | Kalite | Hız | Entegrasyon |
|------|---------|---------|---------|--------|-----|-------------|
| 🥇 | **Google AI Studio** | ✅ | $0 | ⭐⭐⭐⭐⭐ | Hızlı | Orta (SDK) |
| 🥈 | **AI Horde** | ✅ | $0 | ⭐⭐⭐ | Yavaş | Kolay |
| 🥉 | **Hugging Face** | ⚠️ | $0 | ⭐⭐⭐⭐ | Orta | Kolay |
| 4 | **Pollinations** | ❌ | $0 | ⭐⭐⭐ | Yavaş | Çok Kolay |
| 5 | **Together AI** | ⚠️ | ~$0 | ⭐⭐⭐⭐ | Hızlı | Kolay |

---

## 🏗 Önerilen Implementasyon Planı

### Aşama 1: Google AI Studio (Hemen)

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) adresinden yeni API key al
2. `server/ai-motif.js`'i Google GenAI SDK formatına güncelle
3. `gemini-2.0-flash-exp` modeli ile img2img kullan
4. **Maliyet: $0**

### Aşama 2: Fallback Sistemi (Opsiyonel)

1. AI Studio kotası dolduğunda → Hugging Face'e fallback
2. Her ikisi de başarısız → orijinal çizimi koru (graceful degradation)

### Aşama 3: Hibrit (Prodüksiyon geçişinde)

1. Ana: Google AI Studio (ücretsiz, yüksek kalite)
2. Fallback 1: `antigravity.mindops.net` (ücretli ama güvenilir)
3. Fallback 2: Hugging Face FLUX.1 (ücretsiz, decent kalite)

---

## ⚠️ Önemli Notlar

1. **Ücretsiz tier'lar demo/prototyping içindir** — prodüksiyon için SLA yok
2. **Google AI Studio ücretsiz verisi** model eğitiminde kullanılabilir — hassas veri gönderme
3. **Kota sıfırlama** genelde midnight PST (Türkiye 10:00)
4. **img2img en kritik gereksinim** — orijinal çizimin şeklini korumalı
5. **Gemini 2.0 Flash Exp kapasitesi** de bazen dolu olabilir — aynı sorun

---

## 📌 Sonuç

**Google AI Studio ücretsiz API key** ile `gemini-2.0-flash-exp` modeli **en iyi seçim:**

- ✅ Tamamen ücretsiz ($0)
- ✅ img2img destekliyor
- ✅ Yüksek kalite
- ✅ Günde 100+ image yeterli
- ✅ @google/genai SDK zaten projede var
- ❌ Tek risk: kapasite outage (şu anki sorun tüm Gemini modellerini etkiliyor)

**Aksiyon:** Yeni bir Google AI Studio API key oluştur ve AI motif pipeline'ı bu key ile çalışacak şekilde güncelle.
