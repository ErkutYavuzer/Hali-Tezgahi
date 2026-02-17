# Halı Tezgahı — Proje Hafızası

> Son güncelleme: 2026-02-17T17:24:00+03:00
> Mevcut versiyon: **v5.0.1** (web), **v4.7.0** (socket)
> Deployed: Kubernetes (`hali-mozaik` namespace)

---

## 📦 Proje Genel Bakış

**Halı Tezgahı** — Interaktif dijital halı dokuma deneyimi. Ziyaretçiler telefonla çizim yapıyor, çizimlerin pikselleri 3D animasyonla halıya uçarak konuyor ve AI bir kilim motifine dönüştürüyor.

### Mimari

```
[Telefon/Client]  ←→  [Socket.IO Server]  ←→  [Host/3D Halı Ekranı]
      ↓                     ↓
  Çizim yapar          AI Pipeline
                    (Gemini Flash)
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
│   ├── ai-motif.js           # AI motif pipeline (Gemini Flash)
│   ├── carpet_data.json      # Çizim verisi (persist)
│   └── carpet_latest.png     # Son halı screenshot
├── src/
│   ├── App.jsx               # Router (/, /host, /download)
│   ├── ClientPage.jsx        # Telefon çizim sayfası
│   ├── HostPage.jsx          # 3D halı host sayfası
│   ├── DownloadPage.jsx      # Halı indirme sayfası
│   ├── constants.js          # Konfigürasyon sabitleri
│   ├── audio/                # Ses efektleri
│   └── components/3d/
│       ├── CarpetBoard.jsx   # ⭐ ANA BİLEŞEN — 3D halı, canvas, flying pixels, AI motif
│       ├── CarpetBorder.jsx  # Halı kenarlık 3D mesh
│       ├── FlyingPixels.jsx  # 3D parçacık instanceleri
│       └── materials.js      # Three.js shader/material tanımları
├── Dockerfile.web            # Frontend build (nginx serve)
├── Dockerfile.socket         # Backend (Node.js)
├── vite.config.js            # Vite konfigürasyonu
└── package.json
```

---

## 🧶 CarpetBoard.jsx — Ana Bileşen Analizi (1057 satır)

Bu dosya tüm işin kalbinde. İçerdiği ana sistemler:

### 1. Canvas/Texture Sistemi

- **Offscreen Canvas** (`offscreenCanvasRef`): 2534x4224 çözünürlük
- Three.js `CanvasTexture` ile 3D mesh'e uygulanıyor
- **Halı zemin**: `#f0e4d0` (krem) + 4px aralıklı iplik grid
- `needsUpdateRef` → frame loop'ta texture güncelleme

### 2. Woven Enhancement Sistemi (satır ~320-551)

- `applyWovenEnhancement()`: Çizimi halı dokuma estetiğine dönüştürür
  - **Mozaik grid** (4px blok)
  - **Renk doygunluğu artırma** (+%60)
  - **Kilim paleti quantization** (%50 orijinal + %50 palette)
  - **Kenar algılama** (Sobel filtre)
  - **3-katmanlı kilim çerçeve**: koyu kahve + altın şerit + lacivert
  - **Köşe motifleri**: çift baklava dilimi
  - **Kenar göz motifleri** (nazarlık)
- `drawEye()`: Göz motifi helper

### 3. İsim Yazma (satır ~570-594)

- `renderWovenName()`: İsmi motifin **sağ alt köşesine** yazar
  - Georgia/serif font, altın-kahverengi renk
  - İplik dokusu efekti (üzerinden yatay çizgiler)
  - `textAlign: 'right'`, `textBaseline: 'bottom'`

### 4. drawWovenImage (satır ~597-634)

- `drawWovenImage()`: Initial-carpet yüklemesi için animasyonsuz direkt çizim
  - 1) `drawImage` → 2) `applyWovenEnhancement` → 3) `renderWovenName`
  - Bağımlılıklar: `[renderWovenName, applyWovenEnhancement]`

### 5. Uçan Piksel Sistemi (satır ~636-796)

- `canvasToWorld()`: Canvas koordinat → 3D world koordinat
- `launchFlyingPixels(drawing)`: Çizimi piksellere ayırıp 3D uçuş yörüngesine sokar
  - 3 uçuş stili: Spiral, Dalga, Kaskad
  - LAND_BLOCK = 12px bloklar
  - Pikseller `flyingQueueRef`'e ekleniyor
  - **Post-landing timer**: `pendingEnhancementsRef` ile pikseller konduktan sonra:
    - `applyWovenEnhancement()` çağrılıyor
    - `renderWovenName()` çağrılıyor
  - Bağımlılıklar: `[canvasToWorld, carpetWidth, carpetDepth, renderWovenName, applyWovenEnhancement]`

### 6. handleLand (satır ~798-838)

- `handleLand(item)`: Her piksel konduğunda canvas'a canlı renk + glow çizer
  - LAND_BLOCK = 12px blok olarak yazar
  - %30 opak glow efekti

### 7. AI Motif Dönüşümü (satır ~840-900)

- `morphToAIMotif()`: AI motif geldiğinde:
  - 1) `pendingEnhancementsRef` timer'ı iptal et
  - 1) Geniş alan temizle (%50 pad): `clearRect` → halı zemin → iplik grid
  - 1) `drawImage` ile AI motif yerleştir
  - 1) `renderWovenName` ile isim yaz
  - Bağımlılıklar: `[renderWovenName]`

### 8. Socket Event Handler'ları (satır ~935-1019)

```javascript
useEffect(() => {
    socket.on('initial-carpet', ({ drawings }) => {
        // AI olanlar → direkt drawImage (AI'ya gitmez)
        // AI olmayanlar → drawWovenImage (direkt göster)
    });
    
    socket.on('new-drawing', (drawing) => {
        launchFlyingPixels(drawing);  // Yeni çizim = flying pixels animasyonu
    });
    
    socket.on('ai-drawing-ready', (data) => {
        morphToAIMotif(data);  // AI geldi = replace
    });
    
    socket.on('carpet-reset', () => { ... });
    
    // Mount sonrası veri iste
    socket.emit('request-initial-carpet');
}, [socket, drawWovenImage, launchFlyingPixels, morphToAIMotif, renderWovenName]);
```

---

## 🤖 AI Motif Pipeline (server/ai-motif.js)

### Akış

```
1. Çizim geldi → transformToMotif(base64DataUrl)
2. STEP 1: gemini-3-flash ile çizimi ANALIZ et → "SUBJECT: sun, COLOR: yellow"
3. STEP 2: Aynı model ile kilim motifi SVG üret (256x256)
4. FALLBACK: Subject-specific hardcoded SVG motifler
5. SVG → base64 → data:image/svg+xml;base64,... olarak döner
```

### Konfigürasyon

- **API**: `https://antigravity2.mindops.net/v1/chat/completions`
- **Model**: `gemini-3-flash`
- **Timeout**: 90sn
- **Max concurrent**: 3
- **Retry**: 2 kez

### Subject-Specific Guide'lar

`sun`, `flower`, `heart`, `star`, `house`, `tree`, `cat`, `butterfly`, `fish`, `rainbow`, `moon`, `bird` için özel SVG kompozisyon talimatları var.

### Kilim Renk Paleti

```
yellow: #c8a951, red: #c41e3a, blue: #1a3a6b
green: #2d5a27, orange: #e8a23e, purple: #7b2d4f
Background: #f5f0e8, Border: #5c1a0a, Gold: #c8a951
```

---

## 🚀 Deployment

### Docker Images

| Image | Açıklama |
|-------|----------|
| `ghcr.io/ayavuzer/hali-mozaik-web:v5.0.1` | Frontend (Vite build + nginx) |
| `ghcr.io/ayavuzer/hali-mozaik-socket:v4.7.0` | Socket.IO server |

### Kubernetes (namespace: hali-mozaik)

| Resource | Image |
|----------|-------|
| `deployment/hali-mozaik-web` | `ghcr.io/ayavuzer/hali-mozaik-web:v5.0.1` |
| `deployment/hali-mozaik-socket` | `ghcr.io/ayavuzer/hali-mozaik-socket:v4.7.0` |

### Build & Deploy Komutları

```bash
# Web build + push
cd /Users/aliyavuzer/Hali-Tezgahi
npm run build
docker buildx build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-web:vX.X.X -t ghcr.io/ayavuzer/hali-mozaik-web:latest --push -f Dockerfile.web .

# Socket build + push
docker buildx build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-socket:vX.X.X -t ghcr.io/ayavuzer/hali-mozaik-socket:latest --push -f Dockerfile.socket .

# Deploy
kubectl set image deployment/hali-mozaik-web web=ghcr.io/ayavuzer/hali-mozaik-web:vX.X.X -n hali-mozaik
kubectl set image deployment/hali-mozaik-socket socket=ghcr.io/ayavuzer/hali-mozaik-socket:vX.X.X -n hali-mozaik
kubectl rollout status deployment/hali-mozaik-web -n hali-mozaik
```

---

## 🐛 MEVCUT BUG — ÖNCELİKLİ

### Bug: Hem orijinal hem AI motif görünmüyor (v5.0.1)

**Belirtiler:**

1. Yeni çizim gönderildiğinde orijinal çizim halıda görünmüyor
2. AI motifi de görünmüyor
3. Sayfa yenilendiğinde hiçbir çizim görünmüyor
4. Socket loglarında AI pipeline başarılı çalışıyor (✅ mesajları var)

**Olası Nedenler (araştırılmadı, sonraki oturumda debug edilecek):**

1. **`applyWovenEnhancement` veya `renderWovenName` exception fırlatıyor olabilir** — canvas context'i bozuyor, sonraki tüm drawImage çağrıları sessizce başarısız oluyor
2. **useCallback dependency chain sorunu** — `drawWovenImage` bağımlılığı `[renderWovenName, applyWovenEnhancement]`, bunlar her render'da yeniden oluşuyorsa infinite re-render veya stale closure
3. **Canvas context restore edilmiyor** — `ctx.save()/restore()` dengesizliği, globalAlpha veya compositeOperation kalıcı olarak bozuluyor
4. **`drawEye` fonksiyonu useCallback değil** — her render'da yeniden oluşuyor, dependency chain bozuluyor

**Debug Planı (sonraki oturum):**

1. Browser konsolunu kontrol et (`https://hali-mozaik.mindops.net/host`)
2. `drawWovenImage`, `morphToAIMotif` fonksiyonlarına try/catch ekle
3. `applyWovenEnhancement` etrafına try/catch ekle — hata varsa logla ama canvas'ı bozma
4. `drawEye` fonksiyonunu `useCallback` ile sar
5. Geçici olarak `applyWovenEnhancement`'ı tamamen devre dışı bırakıp sadece `drawImage` test et

**Hızlı Test:**

```javascript
// morphToAIMotif'dan applyWovenEnhancement'ı çıkarıp sadece şu kalsın:
ctx.drawImage(aiImg, x, y, width, height);
renderWovenName(ctx, userName, x, y, width, height);
```

---

## 📋 Tamamlanan İşler (Bu Oturum — 17 Şubat 2026)

### Başarılı

1. ✅ AI motif pipeline yeniden yazıldı (gemini-3-flash + subject analysis)
2. ✅ AI motif overlay → replace dönüşümü (clearRect + drawImage)
3. ✅ Orijinal çizim taşması düzeltmesi (%50 geniş alan clearRect)
4. ✅ Dönen ışık efekti eklendi (sonra kullanıcı beğenmediği için kaldırıldı)
5. ✅ initial-carpet: AI olanlar direkt göster (re-processing yok)
6. ✅ initial-carpet: AI olmayanlar drawWovenImage ile göster

### Kaldırılan

1. ❌ Dönen ışık efekti (`startSpinningLight`) — kullanıcı beğenmedi
2. ❌ Snapshot sistemi (`drawingSnapshotsRef`, `spinningLightsRef`) — karmaşıklık yarattı

### Mevcut Sorun

1. 🐛 Hiçbir çizim/motif görünmüyor — debug gerekiyor

---

## 📝 Tasarım Kararları ve Kurallar

1. **AI motifi orijinali TAM DEĞİŞTİRMELİ** — overlay/blend değil, replace
2. **Sayfa yenilenince AI tekrar çalışmamalı** — AI sonucu persist ediliyor, direkt gösterilmeli
3. **İsim sağ alt köşede** — Georgia serif, iplik dokusu efekti
4. **Dönen ışık efekti İSTENMİYOR** — kullanıcı beğenmedi, kaldırıldı
5. **Flying pixels sadece yeni çizimler için** — initial load'da direkt çizim
6. **Woven enhancement (cross-stitch efekti) orijinal çizimlerde OLMALI** — AI motifinde olmamalı
7. **AI motif tam kilim stili** — SVG, geometrik şekiller, 256x256

---

## 🔄 Git History (Son Commitler)

```
1fbb231 fix: woven enhancement geri eklendi + initial-carpet düzeltildi
dcb67ac refactor: dönen ışık tamamen kaldırıldı — basit ve temiz akış
a68ef80 fix: sayfa yenilenince AI'sı hazır çizimler direkt gösteriliyor
84971a6 fix: orijinal çizim taşması temizleniyor — %50 geniş alan clearRect
32bc01e feat: dönen ışık efekti + AI motif tam değiştirme
31d4b6c fix: AI motif artık orijinal çizimi tamamen DEĞİŞTİRİYOR
c220d62 fix: gemini-3-flash + subject-specific fallback motifler
53e0d63 feat: AI motif pipeline tamamen yeniden yazıldı
c590136 feat: profesyonel dokuma motif dönüşümü
d1a1604 feat: arka zemin kaldırıldı — halı siyah boşlukta
```

---

## 🔧 Sonraki Oturum İçin Yapılacaklar

### Öncelik 1: Bug Fix

- [ ] Browser console hatalarını kontrol et
- [ ] `applyWovenEnhancement` etrafına try/catch ekle
- [ ] `drawEye` fonksiyonunu useCallback ile sar
- [ ] Canvas context save/restore dengesini kontrol et
- [ ] Minimal test: sadece drawImage + renderWovenName (enhancement olmadan)

### Öncelik 2: İyileştirmeler

- [ ] AI motif transition efekti (fade-in veya progressive reveal)
- [ ] Birden fazla çizim çakışma kontrolü
- [ ] Kilim tamamlandığında kutlama ekranı iyileştirmesi

### Öncelik 3: Performans

- [ ] Canvas texture güncelleme optimizasyonu
- [ ] SVG motif caching (aynı subject tekrar gelirse)
- [ ] Flying pixels performans profiling
