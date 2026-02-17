# Halı Tezgahı — Proje Hafızası

> Son güncelleme: 2026-02-17T20:06:00+03:00
> Mevcut versiyon: **v6.5.3** (web), **v6.5.1** (socket)
> Deployed: Kubernetes (`hali-mozaik` namespace)

---

## 📦 Proje Genel Bakış

**Halı Tezgahı** — Interaktif dijital halı dokuma deneyimi. Ziyaretçiler telefonla çizim yapıyor, çizimlerin pikselleri 3D animasyonla halıya uçarak konuyor ve Gemini AI çizimi kilim motifine dönüştürüyor.

### Mimari

```
[Telefon/Client]  ←→  [Socket.IO Server]  ←→  [Host/3D Halı Ekranı]
      ↓                     ↓
  Çizim yapar         AI Pipeline (img2img)
                    Antigravity Gateway
                  (gemini-3-pro-image-1x1)
```

### URL'ler

| Rol | URL |
|-----|-----|
| Host (3D Halı) | `https://hali-mozaik.mindops.net/host` |
| Client (Çizim) | `https://hali-mozaik.mindops.net/?role=client` |
| QR sayfası | `https://hali-mozaik.mindops.net/` |

---

## 🗂 Dosya Yapısı

```
Hali-Tezgahi/
├── server/
│   ├── index.js              # Socket.IO server (Express + Socket.IO)
│   ├── ai-motif.js           # 🤖 AI motif pipeline v4 (Antigravity Gateway img2img)
│   ├── carpet_data.json      # Çizim verisi (persist)
│   └── carpet_latest.png     # Son halı screenshot
├── src/
│   ├── App.jsx               # Router (/, /host, /download)
│   ├── ClientPage.jsx        # Telefon çizim sayfası
│   ├── HostPage.jsx          # 3D halı host sayfası
│   ├── DownloadPage.jsx      # Halı indirme sayfası
│   ├── constants.js          # Konfigürasyon sabitleri (CARPET_WIDTH=40, CARPET_DEPTH=24)
│   ├── audio/                # Ses efektleri
│   └── components/3d/
│       ├── CarpetBoard.jsx   # ⭐ ANA BİLEŞEN — 3D halı, canvas, flying pixels, AI motif
│       ├── CarpetBorder.jsx  # Halı kenarlık + püsküller (kısa kenarda)
│       ├── FlyingPixels.jsx  # 3D parçacık instanceleri
│       └── materials.js      # Three.js shader/material tanımları
├── Dockerfile.web            # Frontend build (nginx serve)
├── Dockerfile.socket         # Backend (Node.js + Antigravity Gateway env'leri)
├── vite.config.js            # Vite konfigürasyonu
└── package.json
```

---

## 🤖 AI Motif Pipeline v4 (server/ai-motif.js)

### Akış — Tek Adım img2img Dönüşümü

```
1. Çizim geldi → transformToMotif(base64DataUrl)
2. Orijinal çizim + TRANSFORM_PROMPT → gemini-3-pro-image-1x1
3. AI orijinal şekli GÖREREK kilim motifine dönüştürüyor
4. data:image/jpeg;base64,... olarak döner
```

### Önemli: Orijinal çizim DOĞRUDAN modele gönderiliyor (image_url)

Bu sayede:

- Ev çizilmişse → ev şeklinde kilim motifi
- Kedi çizilmişse → kedi şeklinde kilim motifi
- Yıldız çizilmişse → yıldız şeklinde kilim motifi

### Konfigürasyon

| Parametre | Değer |
|-----------|-------|
| **Gateway URL** | `https://antigravity2.mindops.net/v1/chat/completions` |
| **API Key** | `sk-antigravity-lejyon-2026` |
| **Image Model** | `gemini-3-pro-image-1x1` |
| **Max concurrent** | 2 |
| **Response format** | `![image](data:image/jpeg;base64,...)` (markdown içinde) |

### Transform Prompt (anahtar kurallar)

1. KEEP the same subject/shape from the drawing
2. Convert to geometric kilim style: stepped lines, diamonds, triangles, zigzag
3. Traditional Turkish kilim color palette
4. Add decorative kilim border frame
5. Flat, textile-like coloring — no gradients, no 3D effects
6. Square format, centered composition

### Önceki Denemeler ve Neden Bırakıldı

| Versiyon | Yaklaşım | Sorun |
|----------|----------|-------|
| v1 | Gemini text → SVG üretimi | Konu korunmuyordu, generic SVG |
| v2 | @google/genai SDK (gemini-2.5-flash-image) | Model ismi hatalı (404), sonra quota aşıldı (429) |
| v3 | Antigravity Gateway: 2 adım (analiz + üretim) | Çizimle alakasız motif çıkıyordu |
| **v4** | **Antigravity Gateway: tek adım img2img** | ✅ **Çalışıyor!** Orijinal şekli koruyor |

---

## 🧶 CarpetBoard.jsx — Ana Bileşen

### Halı Shader (minimal kumaş hissi)

- **Vertex**: Çok hafif fiber doku (0.3 intensity, 0.008 displacement)
- **Fragment**: Neredeyse görünmez iplik hissi (0.015), hafif saturation (1.3x), rim light
- ❌ **Kaldırılanlar**: Warp-weft grid, knot variation, abrash, pile direction (çok agresifti, damalı desen oluşturuyordu)

### applyWovenEnhancement — KALDIRILDI ❌

- Tüm `applyWovenEnhancement` çağrıları kaldırıldı
- Bu fonksiyon orijinal çizimi block-averaging ile bozuyordu
- Artık çizimler olduğu gibi gösteriliyor, dönüşüm tamamen AI'a bırakıldı

### morphToAIMotif (AI motif yerleştirme)

```javascript
// Sadece çizim alanını temizle — yanındaki motiflere DOKUNMA
const pad = 2; // Minimal padding (anti-alias artıkları)
ctx.clearRect(clearX, clearY, clearW, clearH);
ctx.fillStyle = '#f0e4d0'; // krem zemin
ctx.fillRect(clearX, clearY, clearW, clearH);
ctx.drawImage(aiImg, x, y, width, height);
```

**ÖNEMLİ**: Padding eskiden `width * 0.5` idi → yanındaki motifleri siliyordu. Şimdi `2px`.

### Canvas Zemin

- Düz krem `#f0e4d0` + çok hafif grid (opacity 0.025, 6px aralık)
- Grid shader'da değil, canvas init'te

---

## 🎨 CarpetBorder.jsx — Kenarlık ve Püsküller

### Püsküller (CarpetFringes)

- ✅ **Kısa kenarda** (sol ve sağ → X ekseni uçları)
- Depth boyunca diziliyor (Z ekseni)
- `FRINGE_GEO`: CylinderGeometry(0.005, 0.018, 0.7, 6)
- Rastgele pozisyon, rotasyon, ölçek varyasyonu

### Kenarlık (CarpetBorder)

- 4 kenar mesh (üst, alt, sol, sağ)
- 4 köşe süsü (altın metalik)
- `BORDER_WIDTH = 0.4`

---

## 🚀 Deployment

### Docker Images (Güncel)

| Image | Versiyon | Açıklama |
|-------|----------|----------|
| `ghcr.io/ayavuzer/hali-mozaik-web` | **v6.5.3** | Frontend (Vite build + nginx) |
| `ghcr.io/ayavuzer/hali-mozaik-socket` | **v6.5.1** | Socket.IO server + AI pipeline |

### Kubernetes (namespace: hali-mozaik)

| Resource | Image |
|----------|-------|
| `deployment/hali-mozaik-web` | `ghcr.io/ayavuzer/hali-mozaik-web:v6.5.3` |
| `deployment/hali-mozaik-socket` | `ghcr.io/ayavuzer/hali-mozaik-socket:v6.5.1` |

### Env Variables (Socket Pod)

```
AI_API_URL=https://antigravity2.mindops.net/v1/chat/completions
AI_API_KEY=sk-antigravity-lejyon-2026
```

### Build & Deploy Komutları

```bash
# Web build + push
cd /Users/aliyavuzer/Hali-Tezgahi
docker buildx build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-web:vX.X.X -t ghcr.io/ayavuzer/hali-mozaik-web:latest --push -f Dockerfile.web .

# Socket build + push
docker buildx build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-socket:vX.X.X -t ghcr.io/ayavuzer/hali-mozaik-socket:latest --push -f Dockerfile.socket .

# Deploy
kubectl set image deployment/hali-mozaik-web web=ghcr.io/ayavuzer/hali-mozaik-web:vX.X.X -n hali-mozaik
kubectl set image deployment/hali-mozaik-socket socket=ghcr.io/ayavuzer/hali-mozaik-socket:vX.X.X -n hali-mozaik

# Çizimleri sıfırla (bellek temizleme)
kubectl rollout restart deployment/hali-mozaik-socket -n hali-mozaik
```

---

## 📋 Tamamlanan İşler (17 Şubat 2026 — Bu Oturum)

### AI Motif Pipeline

1. ✅ @google/genai SDK ile Gemini native image generation denendi → quota sorunu
2. ✅ Model ismi düzeltildi: `gemini-2.5-flash-preview-04-17` → `gemini-2.5-flash-image`
3. ✅ Google AI Studio API quota aşıldı → Antigravity Gateway'e geçildi
4. ✅ 2 adımlı pipeline (analiz + üretim) → çizimle alakasız motif çıkıyordu
5. ✅ **Tek adım img2img pipeline** → orijinal çizim doğrudan modele gönderiliyor
6. ✅ `gemini-3-pro-image-1x1` ile kilim motifine dönüşüm **ÇALIŞIYOR** ✨
7. ✅ Rate limit sonsuz döngü düzeltildi (retry limiti eklendi)

### Görsel İyileştirmeler

1. ✅ `applyWovenEnhancement` tamamen kaldırıldı (çizimleri bozuyordu)
2. ✅ Shader grid (warp-weft, knot, abrash) kaldırıldı → temiz krem halı
3. ✅ AI motif padding %50 → 2px (yanındaki motifler artık silinmiyor)
4. ✅ Püsküller kısa kenara taşındı (gerçek halı gibi)

### Önceki Oturumlardan

1. ✅ Flying pixels 3D animasyon sistemi
2. ✅ AI motif → orijinali TAM DEĞİŞTİRME (overlay değil)
3. ✅ initial-carpet: AI olanlar direkt göster (re-processing yok)
4. ✅ İsim sağ alt köşede (Georgia serif, iplik doku efekti)

---

## 📝 Tasarım Kararları ve Kurallar

1. **AI motifi orijinali TAM DEĞİŞTİRMELİ** — overlay/blend değil, replace
2. **Orijinal çizim AI'a doğrudan gönderilmeli** — img2img yaklaşımı (şekil korunsun)
3. **applyWovenEnhancement KULLANILMAMALI** — kaldırıldı, çizimi bozuyor
4. **Shader minimal olmalı** — agresif grid desen oluşturuyor, hafif kumaş hissi yeterli
5. **morphToAIMotif padding minimal (2px)** — %50 padding yanındaki motifleri siliyor
6. **Püsküller kısa kenarda olmalı** — gerçek Anadolu halıları gibi
7. **Antigravity Gateway kullan, direkt Google API değil** — quota sorunu yok
8. **Sayfa yenilenince AI tekrar çalışmamalı** — AI sonucu persist ediliyor
9. **İsim sağ alt köşede** — Georgia serif, iplik dokusu efekti
10. **Dönen ışık efekti İSTENMİYOR** — kullanıcı beğenmedi, kaldırıldı

---

## 🔄 Git History (Son Commitler)

```
d6abac9 fix: püsküller kısa kenara taşındı — gerçek halı gibi
399977c fix: AI motif padding %50→2px — yanındaki motifler artık silinmeyecek
469d50f fix: img2img — orijinal çizim doğrudan modele gönderiliyor
d4029b2 feat: AI motif v3 — Antigravity Gateway ile çalışıyor
5b7f0a4 fix: AI retry limiti + detaylı hata loglaması
0633704 fix: model ismi düzeltildi → gemini-2.5-flash-image
52b9b1f fix: shader grid kaldırıldı — temiz krem halı zemini
0787927 fix: applyWovenEnhancement kaldırıldı — temiz halı + AI dönüşüm
eac3e9a feat: AI motif v2 — Gemini native image generation
```

---

## 🔧 Sonraki Oturum İçin Yapılacaklar

### Öncelik 1: UX İyileştirmeleri

- [ ] AI motif geliş animasyonu (fade-in veya progressive reveal)
- [ ] Çizim yapılırken "AI dönüştürülüyor..." loading göstergesi
- [ ] Birden fazla çizim güzel dizilim/grid optimizasyonu

### Öncelik 2: Visual Polish

- [ ] Halı kenarlığına zarif kilim border deseni (düz kırmızı yerine)
- [ ] Ambiyans ışığı ve gölge iyileştirmesi
- [ ] Kamera açısı/zoom ayarı

### Öncelik 3: Performans & Robustness

- [ ] AI motif caching (aynı çizim tekrar gelirse)
- [ ] Flying pixels performans profiling
- [ ] Error recovery: AI başarısız olursa orijinal çizimi koru ve göster
- [ ] Socket reconnection handling

### Öncelik 4: Yeni Özellikler

- [ ] Halı tamamlandığında kutlama ekranı
- [ ] Çizim silme/geri alma (host kontrolü)
- [ ] Farklı halı boyutları/şekilleri
