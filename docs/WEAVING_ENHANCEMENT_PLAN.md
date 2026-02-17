# 🧶 Halı Dokuma Dönüşüm Geliştirme Planı

**Tarih:** 17 Şubat 2026  
**Versiyon:** v1.0  
**Durum:** Deep Research Tamamlandı — Uygulama Hazır

---

## 📋 Yönetici Özeti

Mevcut sistemde çizimler halıya yerleştirildiğinde **gerçek bir halı dokuma hissi vermiyor**. Kullanıcı Fred Çakmaktaş çizdiğinde, çizim ya orijinal halinde (dijital çizim gibi) kalıyor ya da AI pipeline tamamen farklı bir geometrik SVG üretiyor.

**Hedef:** Orijinal çizimin **şeklini ve anlamını koruyarak** gerçek bir Anadolu kiliminde dokunmuş gibi görünmesini sağlamak.

---

## 🔍 Mevcut Durum Analizi

### Sorunlar

| Katman | Mevcut Durum | Sorun |
|--------|-------------|-------|
| **Canvas Enhancement** | `applyWovenEnhancement` — 6px mozaik, HSL renk boost, Sobel kenar | Mozaik çok ince (6px), iplik hissi yok, sadece pikselleştirme |
| **AI Pipeline** | `transformToMotif` — Gemini ile yeni SVG üretimi | Orijinal çizimi **yok edip** yerine genel geometrik motif koyuyor |
| **3D Shader** | Fiber noise + renk varyasyonu + rim light | İyi ama canvas'taki çizim zaten "dijital" göründüğü için etkisiz |

### Temel Sorun

```
❌ Mevcut Akış:
Çizim → [6px mozaik + renk boost] → Hala dijital görünüyor
                                                    ↓
                                            AI → Tamamen farklı SVG (orijinal kayboldu)

✅ Hedef Akış:
Çizim → [Gerçekçi İplik Simülasyonu] → Orijinal şekil korunuyor AMA
         + Warp/Weft dokusu              halıda dokunmuş gibi görünüyor
         + Renk quantization
         + İlmek bazlı render
```

---

## 🎯 Strateji: 3 Katmanlı Halı Dokuma Pipeline

### Katman 1: Enhanced Canvas Processing (Anında — Client-Side)

**Konsept:** Mevcut `applyWovenEnhancement` fonksiyonunu tamamen yeniden yazarak gerçekçi bir kilim dokuma simülasyonu oluşturmak.

#### 1.1 İlmek Bazlı Render (Knot Simulation)

Gerçek bir Türk halısında her ilmek (düğüm) bireysel olarak bağlanır. Bu, piksel bazlı bir yaklaşımla simüle edilebilir:

```javascript
// Her "ilmek" 12-16px büyüklüğünde (mevcut 6px çok küçük)
const KNOT_SIZE = 14;

// Her ilmek:
// - Merkezde ana renk (çizimden alınan)
// - Kenarlarda koyu gölge (iplik büklümü)
// - Hafif asimetri (el yapımı hissi)
// - Yatay dokuma yönü belirgin
```

**Detaylar:**

| Parametre | Mevcut | Yeni | Etki |
|-----------|--------|------|------|
| Blok boyutu | 6px | 12-16px | Düğümler belirgin görünür |
| İplik yönü | Yok | Warp (dikey) + Weft (yatay) alternansı | Gerçek dokuma hissi |
| Renk varyasyonu | %3 | %8-12 per-knot | El boyaması iplik hissi |
| Kenar karartma | Düz çizgi | Gaussian blur gölge | 3D düğüm hissi |
| Doku overlay | Yok | Çapraz iplik deseni | Elyaf hissi |

#### 1.2 Warp-Weft Simülasyonu

```
Gerçek halıda:
═══╤═══╤═══╤═══   ← Weft (atkı — yatay iplikler)
   │   │   │
═══╪═══╪═══╪═══   ← Her kesişim noktası bir düğüm
   │   │   │
═══╧═══╧═══╧═══
   ↑           ↑
   Warp (çözgü — dikey iplikler)
```

Her ilmek bloğu içinde:

1. **Yatay iplik dokusu**: Bloğun üst ve alt %20'sinde yatay çizgiler
2. **Dikey iplik arası**: Bloklar arasında 1-2px dikey çözgü izi
3. **Kesişim karartması**: Warp-weft kesişim noktalarında hafif gölge
4. **İplik büklümü**: Her bloğun içinde sinüzoidal ton değişimi (iplik büklümünü simüle eder)

#### 1.3 Geliştirilmiş Renk İşleme

Gerçek halı ipliklerinde:

- **Renk sayısı sınırlıdır** (Doğal boyalar: ~20-30 ton)
- **Abrash efekti**: Aynı renkteki ipliklerde bile hafif ton farkı (farklı boyama partileri)
- **Doygunluk yüksektir**: Doğal boyalar canlıdır

```javascript
// Geleneksel Anadolu Kilim Renk Paleti (doğal boyalar)
const KILIM_PALETTE = {
  // Kırmızılar (kök boya — Rubia)
  reds: ['#8B0000', '#A52A2A', '#B22222', '#CD5C5C', '#DC143C'],
  // Maviler (çivit — Indigo)  
  blues: ['#191970', '#000080', '#1a3a6b', '#4169E1'],
  // Sarılar (cehri, zerdeçal)
  yellows: ['#DAA520', '#B8860B', '#CD853F', '#D2691E'],
  // Yeşiller (çivit + cehri karışımı)
  greens: ['#006400', '#228B22', '#2E8B57', '#556B2F'],
  // Toprak (ceviz kabuğu)
  earth: ['#3d2b1f', '#5c1a0a', '#8B4513', '#A0522D'],
  // Krem/Beyaz (doğal yün)
  cream: ['#F5F5DC', '#FAEBD7', '#FAF0E6', '#FFF8DC']
};
```

#### 1.4 Abrash Efekti (Renk Geçişi)

Gerçek el dokuması halılarda aynı renk bölgesi boyunca renk tonunda hafif kaymalar olur (farklı boyama lotlarından gelen iplikler):

```javascript
// Her 3-5 düğüm satırında renk tonu hafifçe değişir
// Bu, makinede üretilmiş halılardan ayırt edici en önemli özellik
const abrashIntensity = 0.08; // %8 ton varyasyonu
const abrashFrequency = 4;    // Her 4 satırda bir ton kayması
```

### Katman 2: Three.js Shader Pipeline (GPU-Accelerated)

Mevcut shader'ı geliştirelim. 3D thread texture simülasyonu shader'da çok daha gerçekçi yapılabilir:

#### 2.1 Gelişmiş Fragment Shader

```glsl
// 🧶 KATMAN 2: GPU Bazlı İplik Simülasyonu

// Warp-Weft grid pattern
float warpThread = smoothstep(0.45, 0.5, fract(vHighUv.x * 8.0));
float weftThread = smoothstep(0.45, 0.5, fract(vHighUv.y * 12.0));

// İplik kesişim karanlığı
float intersection = warpThread * weftThread * 0.08;
gl_FragColor.rgb -= intersection;

// İplik yüzey normal pertürbasyonu (3D iplik hissi)
float threadBump = sin(vHighUv.x * 80.0) * sin(vHighUv.y * 120.0) * 0.03;
gl_FragColor.rgb += threadBump;

// Pile direction (halı tüyü yönü — bakış açısına göre renk değişimi)
float pileAngle = dot(normalize(vViewPosition), vec3(0.0, 1.0, 0.0));
float pileShift = mix(0.95, 1.05, pileAngle);
gl_FragColor.rgb *= pileShift;
```

#### 2.2 Normal Map İyileştirmesi

Mevcut `createWoolNormalMap` fonksiyonu basit çizgiler çiziyor. Gerçek iplik normal'leri için:

```javascript
// Her iplik silindiriktir → normal map'te her thread bir "bump"
// Yatay ipliklerde: normal.x değişir, normal.y sabit
// Dikey ipliklerde: normal.y değişir, normal.x sabit
// Kesişimlerde: her iki yönde de bump
```

### Katman 3: AI Image-to-Image Style Transfer (Opsiyonel Premium)

**Bu katman en etkileyici sonucu verir ama süre + maliyet gerektirir.**

#### 3.1 Yaklaşım: Gemini Image Editing

Gemini 2.0 Flash (veya 2.5 Flash Image) `image-to-image` editing destekliyor. Çizimi **girdi olarak** verip, "bu çizimi Türk halısında dokunmuş gibi stilize et" diyebiliriz.

**Kritik Fark:** Mevcut AI pipeline çizimi **analiz edip yeni SVG üretiyordu** (orijinal kayboluyordu). Yeni yaklaşımda çizim **girdi olarak verilecek** ve AI orijinal şekli koruyarak stilize edecek.

```javascript
// Yeni AI Pipeline (Image-to-Image)
const prompt = `Transform this freehand drawing into a woven Turkish kilim carpet motif.
IMPORTANT RULES:
- PRESERVE the original shape and subject exactly
- Apply woven texture (visible thread/yarn pattern)
- Use traditional Anatolian carpet colors (deep red, navy, gold, cream)
- Add subtle warp-weft grid texture
- The result must look hand-woven, not digital
- Keep the same composition and proportions
- Output as PNG image`;

const result = await geminiImageEdit(drawingBase64, prompt);
```

#### 3.2 AI Model Seçenekleri

| Model | Yöntem | Süre | Maliyet | Kalite | Uygunluk |
|-------|--------|------|---------|--------|----------|
| **Gemini 2.5 Flash Image** | Native img2img | 3-5s | Düşük (ücretsiz tier) | ⭐⭐⭐⭐ | ✅ En uygun |
| **Gemini 2.0 Flash** | Chat + image edit | 5-8s | Düşük | ⭐⭐⭐ | ✅ Mevcut altyapıyla uyumlu |
| **DALL-E 3** | Image edit API | 5-10s | Orta ($0.04/img) | ⭐⭐⭐⭐ | ⚠️ Farklı API |
| **Stable Diffusion + ControlNet** | Self-hosted | 3-8s | Yok (GPU gerekli) | ⭐⭐⭐⭐⭐ | ❌ GPU server gerekli |
| **Flux** | img2img | 5-15s | Yüksek | ⭐⭐⭐⭐⭐ | ❌ Yavaş |

**Önerilen:** `gemini-2.5-flash-preview-image` veya `gemini-2.0-flash` img2img modunda. Antigravity Gateway üzerinden zaten erişim var.

#### 3.3 Hybrid Pipeline (Önerilen)

```
Çizim Geldi
    │
    ├─ [ANINDA] Katman 1: Canvas Enhancement (0ms)
    │   └─ İlmek bazlı render + warp/weft + abrash → GEÇİCİ GÖRÜNTÜ
    │
    ├─ [3D] Katman 2: Shader (sürekli)
    │   └─ GPU bazlı iplik dokusu + pile efekti → 3D GERÇEKÇİLİK
    │
    └─ [ASYNC 3-5s] Katman 3: AI Style Transfer (opsiyonel)
        └─ Orijinal çizim + prompt → WOVEN versiyonu
            └─ Canvas'a yerleştirilir (smooth fade transition)
```

---

## 🔬 Teknik Uygulama Detayları

### Faz 1: Canvas Enhancement Yenileme (2-3 saat)

**Dosya:** `src/components/3d/CarpetBoard.jsx` → `applyWovenEnhancement`

```javascript
// YENİ: applyWovenEnhancement v2
const KNOT_SIZE = 14;          // Düğüm boyutu (mevcut: 6)
const THREAD_LINES = 3;        // Her düğüm içi iplik sayısı
const ABRASH_INTENSITY = 0.08; // Abrash renk kayması
const ABRASH_ROWS = 4;         // Her N satırda ton değişimi

// Adımlar:
// 1. Renk quantization → Kilim paleti (max 12 renk)
// 2. Her KNOT_SIZE bloğu için:
//    a. Dominant renk belirleme
//    b. İplik yönü alternansı (tek satır: yatay vurgu, çift: dikey)
//    c. Abrash offset hesaplama
//    d. Düğüm iç çizimi:
//       - Merkez: ana renk
//       - 2-3 yatay iplik çizgisi (2px) — weft
//       - Kenar gölgesi (gaussian-approx darken)
//       - İplik büklüm tonu (sin wave)
// 3. Düğümler arası çözgü izleri (1px dikey çizgiler)
// 4. Kenar çerçevesi (korunacak — mevcut iyi)
```

### Faz 2: Shader İyileştirmesi (1-2 saat)

**Dosya:** `src/components/3d/CarpetBoard.jsx` → `createCarpetMaterial`

Mevcut shader'a eklenecekler:

- Daha belirgin warp-weft grid pattern
- Pile direction efekti (bakış açısına göre renk kayması)
- İplik kesişim gölgeleri
- Daha agresif normal map pertürbasyonu

### Faz 3: AI Image-to-Image (Opsiyonel — 2-3 saat)

**Dosya:** `server/ai-motif.js` → Tamamen yeniden yazılacak

```javascript
// YENİ: Image-to-Image Style Transfer
export async function transformToWoven(base64DataUrl) {
  // Çizimi Gemini'ye GİRDİ olarak ver
  // "Bu çizimi halıda dokunmuş gibi stilize et" de
  // Gemini orijinal şekli koruyarak woven versiyonu döndürür
  
  const response = await callGeminiImageEdit(
    base64DataUrl,
    `Transform this drawing into a hand-woven Turkish kilim carpet motif.
     Preserve the original shape exactly. Apply woven thread texture.
     Use traditional carpet colors. Make it look authentically handwoven.`
  );
  
  return response.imageBase64;
}
```

---

## 📊 Karşılaştırma

| Özellik | Mevcut Sistem | Faz 1 (Canvas) | Faz 1+2 (Canvas+Shader) | Faz 1+2+3 (Full) |
|---------|--------------|-----------------|--------------------------|-------------------|
| Halı hissi | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Orijinal korunma | ✅ | ✅ | ✅ | ✅ |
| Hız | Anında | Anında | Anında | +3-5s (AI) |
| Maliyet | $0 | $0 | $0 | ~$0 (ücretsiz tier) |
| Karmaşıklık | Düşük | Orta | Orta | Yüksek |
| Gerçekçilik | 20% | 75% | 90% | 98% |

---

## 🎯 Önerilen Yol Haritası

### Sprint 1: Canvas Enhancement v2 (Bugün)

1. `applyWovenEnhancement` yeniden yazılacak
2. Büyük ilmek boyutu (14px)
3. Warp-weft iplik simülasyonu
4. Abrash efekti
5. Geliştirilmiş kilim renk paleti

### Sprint 2: Shader Upgrade (İsteğe Bağlı)

1. Fragment shader'a warp-weft grid ekleme
2. Normal map güçlendirme
3. Pile direction efekti

### Sprint 3: AI Image-to-Image (İsteğe Bağlı)

1. `ai-motif.js` yeniden yazma (img2img)
2. Gemini image editing entegrasyonu
3. Smooth transition (canvas enhancement → AI result)

---

## ✅ Sonuç ve Öneri

**Faz 1 (Canvas Enhancement v2) tek başına büyük fark yaratacaktır.** Mevcut 6px mozaik + basit renk boost yerine, 14px ilmek bazlı render + warp-weft dokusu + abrash efekti ile çizim **gerçek bir halıda dokunmuş gibi** görünecek.

Faz 2 (Shader) 3D derinlik katacak, Faz 3 (AI) ise enterprise-level gerçekçilik sağlayacak — ama Faz 1 bile demo-ready kalite verecek.

**Önerim:** Faz 1 ile başlayalım, test edelim, beğenilirse Faz 2 ve 3'e geçelim.

---

*Hazırlayan: Antigravity Agent — Deep Research Module*
