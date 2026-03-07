# Halı Tezgahı — Proje Hafızası

> Son güncelleme: 2026-03-07T20:20:00+03:00
> Mevcut versiyon: **v15.0.8** (web + socket)
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
| Download | `https://hali-mozaik.mindops.net/?role=download` |
| QR sayfası | `https://hali-mozaik.mindops.net/` |

---

## 🗂 Dosya Yapısı

```
Hali-Tezgahi/
├── server/
│   ├── index.js              # Socket.IO server (Express + Socket.IO)
│   │                         # Endpoint'ler: /api/upload-celebration-video,
│   │                         #   /api/celebration-video, /api/carpet-image,
│   │                         #   /api/carpet-image-upload (POST)
│   ├── ai-motif.js           # 🤖 AI motif pipeline v4 (Antigravity Gateway img2img)
│   ├── carpet_data.json      # Çizim verisi (persist)
│   └── carpet_latest.png     # Son halı screenshot
├── src/
│   ├── App.jsx               # Router (/, /host, /download)
│   ├── ClientPage.jsx        # Telefon çizim sayfası
│   ├── HostPage.jsx          # 3D halı host sayfası + QR/celebration overlay
│   ├── DownloadPage.jsx      # Halı indirme sayfası (HTTP /api/carpet-image)
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

### Konfigürasyon

| Parametre | Değer |
|-----------|-------|
| **Gateway URL** | `https://antigravity2.mindops.net/v1/chat/completions` |
| **API Key** | `sk-antigravity-lejyon-2026` |
| **Image Model** | `gemini-3-pro-image-1x1` |
| **Max concurrent** | 2 |
| **Response format** | `![image](data:image/jpeg;base64,...)` (markdown içinde) |

---

## 🧶 CarpetBoard.jsx — Ana Bileşen

### Kutlama Animasyonu (Celebration Replay)

Halı tamamlanınca (`carpet-complete` event):

1. Server `celebration-replay` event'i emitler (tüm çizimlerle)
2. `celebrationModeRef.current = true` — initial-carpet engellenir
3. Canvas temizlenir, 500ms beklenir
4. Tüm pikseller sırayla havadan uçarak halıya konur:
   - **Hız**: `0.5 + Math.random() * 0.2` (hızlı, doğal)
   - **İç stagger**: `pixelIndex * 0.5` ms
   - **Dış stagger**: `drawingIndex * 80` ms (STAGGER_MS)
5. `totalFlyTime = resolvedDrawings.length * 80 + 4000` ms
6. totalFlyTime sonra `celebrationModeRef.current = false`
7. QR timer ayrı: `onCelebrationDone` çağrısı (CarpetBoard'da, 500ms'te)

### QR / Celebration Overlay Zamanlaması

```
t=0:   carpet-complete geldi → video kaydı başlar
t=32s: QR overlay + celebration gösterilir (HostPage setTimeout)
       + 3D canvas snapshot → /api/carpet-image-upload (HTTP POST)
```

> **ÖNEMLİ**: QR delay HostPage.jsx'te `setTimeout(..., 32000)` ile kontrol ediliyor.
> Bu değer `carpet-complete` event'inden itibaren sayılır.

### Halı Resmi (Download Page)

- **Kaynak**: HostPage QR timer'ı içinde 3D canvas (`document.querySelector('canvas')`) snapshot'ı alınıyor
- **İşlem**: 1200px'e küçültülüyor → PNG blob → HTTP POST `/api/carpet-image-upload`
- **Sunucu**: `carpet_latest.png` olarak kaydediyor
- **Download**: DownloadPage `GET /api/carpet-image` ile yüklüyor
- **Eski yöntem (KULLANILMIYOR)**: socket.io `carpet-image-save` event'i (1MB limit aşılıyordu)

### Halı Shader (minimal kumaş hissi)

- **Vertex**: Çok hafif fiber doku (0.3 intensity, 0.008 displacement)
- **Fragment**: Neredeyse görünmez iplik hissi (0.015), hafif saturation (1.3x), rim light
- ❌ **Kaldırılanlar**: Warp-weft grid, knot variation, abrash, pile direction

---

## 🎨 CarpetBorder.jsx — Kenarlık ve Püsküller

- Püsküller **kısa kenarda** (sol ve sağ → X ekseni uçları)
- Kenarlık: 4 kenar mesh + 4 köşe süsü (altın metalik)
- `BORDER_WIDTH = 0.4`

---

## 🚀 Deployment

### Docker Images (Güncel)

| Image | Versiyon | Açıklama |
|-------|----------|----------|
| `ghcr.io/ayavuzer/hali-mozaik-web` | **v15.0.8** | Frontend (Vite build + nginx) |
| `ghcr.io/ayavuzer/hali-mozaik-socket` | **v15.0.7-fix** | Socket.IO server + AI pipeline |

### Kubernetes (namespace: hali-mozaik)

| Resource | Image |
|----------|-------|
| `deployment/hali-mozaik-web` | `ghcr.io/ayavuzer/hali-mozaik-web:v15.0.8` |
| `deployment/hali-mozaik-socket` | `ghcr.io/ayavuzer/hali-mozaik-socket:v15.0.7-fix` |

### API Endpoint'leri (Server — Express)

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/upload-celebration-video` | POST | Video yükleme (webm) |
| `/api/celebration-video` | GET | Video indirme |
| `/api/carpet-image-upload` | POST | Halı snapshot yükleme (PNG blob) |
| `/api/carpet-image` | GET | Halı resmi indirme |

> **ÖNEMLİ**: Ingress sadece `/api/*`, `/socket.io`, `/motifs`, `/galeri` yollarını socket server'a yönlendiriyor. Diğer yollar nginx'e gider → 404. Yeni endpoint eklenmesi gerekirse mutlaka `/api/` prefix'i kullanılmalı.

### Build & Deploy Komutları

```bash
# Web build + push
docker build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-web:vX.X.X -f Dockerfile.web .
docker push ghcr.io/ayavuzer/hali-mozaik-web:vX.X.X

# Socket build + push
docker build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-socket:vX.X.X -f Dockerfile.socket .
docker push ghcr.io/ayavuzer/hali-mozaik-socket:vX.X.X

# Deploy
kubectl set image deployment/hali-mozaik-web web=ghcr.io/ayavuzer/hali-mozaik-web:vX.X.X -n hali-mozaik
kubectl set image deployment/hali-mozaik-socket socket=ghcr.io/ayavuzer/hali-mozaik-socket:vX.X.X -n hali-mozaik

# Çizimleri sıfırla (bellek temizleme)
kubectl rollout restart deployment/hali-mozaik-socket -n hali-mozaik
```

---

## 📋 Oturum Geçmişi

### 7 Mart 2026 — Kutlama/QR/İndirme Düzeltmeleri

**Başlangıç**: v15.0.6 → **Sonuç**: v15.0.7-fix12

1. ✅ Kutlama animasyonu hız optimizasyonu (speed 0.15→0.5, stagger 3→0.5ms)
2. ✅ QR zamanlaması `carpet-complete` handler'ından bağımsız timer'a ayrıldı (32s)
3. ✅ "VİDEOYU İNDİR" → **"ESERİ İNDİR"** (HostPage + DownloadPage)
4. ✅ Download sayfası: socket.io → HTTP `GET /api/carpet-image` (güvenilir)
5. ✅ Halı snapshot: 3D canvas → 1200px resize → HTTP POST `/api/carpet-image-upload`
6. ✅ Server'a `/api/carpet-image-upload` POST endpoint eklendi
7. ✅ Tüm video endpoint'lerine `/api/` prefix eklendi (ingress routing fix)
8. ✅ Download sayfası başlık `textAlign: center` düzeltmesi
9. ✅ `onCelebrationDone` QR'ı hemen gösteriyor (2s wait + video upload blocking kaldırıldı)
10. ✅ `carpet-complete`'ten yanlış 3D canvas snapshot ve 45s fallback kaldırıldı

**VERSİYON GEÇMİŞİ** (bu oturum):
- v15.0.6: `/api/` prefix fix
- v15.0.7: Hız boost (0.5 speed, 0.5ms stagger)
- v15.0.7-fix: + QR hemen göster + ESERİ İNDİR + HTTP carpet-image
- v15.0.7-fix3: QR timer ayrıldı (ayrı timer)
- v15.0.7-fix4: QR `carpet-complete`'ten + offscreen canvas HTTP POST
- v15.0.7-fix5→fix9: QR delay fine-tuning (3s→7s→13s→23s→28s→32s)
- v15.0.7-fix10: Snapshot timing +2s
- v15.0.7-fix11: 3D canvas snapshot (offscreen yerine)
- **v15.0.7-fix12**: Snapshot HostPage QR timer içine taşındı (32s, en güvenilir)

### 7 Mart 2026 — QR Kapatma Butonu Düzeltmesi (v15.0.8)

1. ✅ Kutlama overlay'ine sağ üst köşeye sabit `✕` kapatma butonu eklendi (iframe'de de görünür)
2. ✅ Overlay `overflowY: auto` yapıldı (küçük ekranlarda scroll edilebilir)
3. ✅ Deploy: `ghcr.io/ayavuzer/hali-mozaik-web:v15.0.8`

### 7 Mart 2026 — Admin QR Toggle Özelliği

1. ✅ Admin paneli Hızlı Aksiyonlar'a "Kutlama QR Göster/Kapat" butonu eklendi
2. ✅ `admin:toggle-celebration-qr` Socket.IO event'i eklendi (server)
3. ✅ HostPage `toggle-celebration-qr` event listener'ı eklendi
4. ✅ Admin'den host ekranındaki kutlama QR overlay uzaktan açılıp kapatılabiliyor

### 17 Şubat 2026 — AI Motif Pipeline

1. ✅ AI motif pipeline v4: tek adım img2img (Antigravity Gateway)
2. ✅ `applyWovenEnhancement` kaldırıldı
3. ✅ Shader grid kaldırıldı → temiz krem halı
4. ✅ AI motif padding %50 → 2px
5. ✅ Püsküller kısa kenara taşındı

---

## 📝 Tasarım Kararları ve Kurallar

1. **AI motifi orijinali TAM DEĞİŞTİRMELİ** — overlay/blend değil, replace
2. **Orijinal çizim AI'a doğrudan gönderilmeli** — img2img yaklaşımı (şekil korunsun)
3. **applyWovenEnhancement KULLANILMAMALI** — kaldırıldı, çizimi bozuyor
4. **Shader minimal olmalı** — agresif grid desen oluşturuyor, hafif kumaş hissi yeterli
5. **morphToAIMotif padding minimal (2px)** — %50 padding yanındaki motifleri siliyor
6. **Püsküller kısa kenarda olmalı** — gerçek Anadolu halıları gibi
7. **Antigravity Gateway kullan, direkt Google API değil** — quota sorunu yok
8. **Endpoint'ler `/api/` prefix'i ile olmalı** — ingress routing gereksinimi
9. **QR delay `carpet-complete`'ten bağımsız timer** — animasyon + QR ayrı kontrol
10. **Halı snapshot 3D canvas'tan alınmalı** — offscreen 2D canvas eksik görseller veriyor
11. **Download sayfası HTTP ile resim çekiyor** — socket.io yerine `/api/carpet-image`
12. **Dönen ışık efekti İSTENMİYOR** — kullanıcı beğenmedi, kaldırıldı
13. **Kutlama QR overlay admin'den kontrol edilebilmeli** — `toggle-celebration-qr` event ile aç/kapat

---

## ❌ İptal Edilen / Denenip Bırakılanlar

| Özellik | Neden | Tarih |
|---------|-------|-------|
| `applyWovenEnhancement` | Çizimleri bozuyordu (block-averaging) | 17 Şubat 2026 |
| Agresif shader grid | Damalı desen oluşturuyordu | 17 Şubat 2026 |
| Socket.io carpet-image-save | 1MB limit aşılıyordu, sessizce fail | 7 Mart 2026 |
| Offscreen 2D canvas snapshot | Motifler sadece sol üst köşede çıkıyordu | 7 Mart 2026 |
| `handleLand` skip during celebration | Animasyon efektlerini bozuyordu (v15.1.x) | 7 Mart 2026 |
| `totalFlyTime` düşürme (QR erken) | Animasyonu da bozuyordu (aynı timer) | 7 Mart 2026 |
| `carpet-complete`'ten hemen QR gösterme | Animasyon izlenemiyordu | 7 Mart 2026 |

---

## 🔧 Sonraki Oturum İçin Yapılacaklar

### Öncelik 1: İndirme Resmi Doğrulama
- [ ] QR okuyunca indirme sayfasındaki resmi doğrula (3D canvas snapshot doğru mu?)
- [ ] 3D canvas'ın `preserveDrawingBuffer` ile tam halı görüntüsü verdiğini confirm et

### Öncelik 2: UX İyileştirmeleri
- [ ] AI motif geliş animasyonu (fade-in veya progressive reveal)
- [ ] Çizim yapılırken "AI dönüştürülüyor..." loading göstergesi
- [ ] Birden fazla çizim güzel dizilim/grid optimizasyonu

### Öncelik 3: Visual Polish
- [ ] Halı kenarlığına zarif kilim border deseni
- [ ] Ambiyans ışığı ve gölge iyileştirmesi
- [ ] Kamera açısı/zoom ayarı
