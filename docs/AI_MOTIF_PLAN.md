# 🎨 AI Motif Dönüşümü — Uygulama Planı

## 📋 Özellik Tanımı

Kullanıcıların telefonda serbest çizdikleri desenleri **Gemini 3 Pro Image** modeli ile geleneksel
Anadolu halı/kilim motifine dönüştürmek. Orijinal çizim halıya yerleşirken **eşzamanlı olarak**
AI işlemesi başlar ve tamamlandığında orijinalin yerini alır.

---

## 🏗️ Mevcut Akış (As-Is)

```
┌──────────┐    drawing-data     ┌──────────┐    new-drawing      ┌──────────┐
│  CLIENT   │ ──────────────────→│  SERVER   │ ──────────────────→│   HOST   │
│ (Telefon) │   base64 PNG       │ (Node.js) │   {dataUrl, x,y}  │  (3D TV) │
│           │                    │           │                    │          │
│ Canvas    │                    │ Grid      │                    │ CarpetBd │
│ 768x768   │                    │ placement │                    │ Uçan     │
│           │                    │ drawings[]│                    │ pikseller│
└──────────┘                    └──────────┘                    └──────────┘
```

## 🚀 Yeni Akış (To-Be) — Dual-Render Pipeline

```
┌──────────┐    drawing-data     ┌──────────────────────────────────────────┐
│  CLIENT   │ ──────────────────→│               SERVER                     │
│ (Telefon) │   base64 PNG       │                                          │
└──────────┘                    │  1. Grid placement hesapla                │
                                │  2. Orijinal çizimi → Host'a gönder ✨    │
                                │  3. ASYNC: AI dönüşüm başlat ──────────┐ │
                                │                                         │ │
                                └────────────────────────────────────────│─┘
                                          │                              │
                                          ▼                              ▼
                                ┌──────────────┐              ┌────────────────┐
                                │    HOST       │              │  Gemini 3 Pro  │
                                │              │              │    Image API    │
                                │ 1. Orijinal  │              │                │
                                │    pikseller  │              │ Prompt:        │
                                │    uçar       │              │ "Bu serbest    │
                                │              │  ai-drawing   │  çizimi Anadolu│
                                │ 2. AI hazır  │◄─────────────│  kilim motifine│
                                │    olunca    │              │  dönüştür"     │
                                │    morph!    │              └────────────────┘
                                └──────────────┘
                                                    ~30-60 sn
```

---

## 📦 Değişiklik Listesi

### Phase 1: Backend — AI Pipeline (server/index.js)

#### 1.1 AI Service Modülü Oluştur

**Yeni dosya:** `server/ai-motif.js`

```javascript
// Sorumluluklar:
// - Gemini API çağrısı (OpenAI-compatible endpoint)
// - Base64 image input → AI-refined base64 output
// - Retry logic (503 capacity exhausted)
// - Timeout handling (max 90 saniye)

const API_URL = 'https://antigravity2.mindops.net/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || 'sk-antigravity-lejyon-2026';
const MODEL = 'gemini-3-pro-image-1x1'; // 1:1 aspect ratio (çizim karesi)

async function transformToMotif(base64Image) {
  // 1. Base64 PNG → Gemini'ye gönder (image input + text prompt)
  // 2. AI'dan dönen kilim motifi image'ı al
  // 3. Base64 olarak döndür
}
```

#### 1.2 Prompt Stratejisi (Kritik!)

```
SYSTEM: Sen bir geleneksel Anadolu halı motifi ustasısın.

USER: [Kullanıcının çizdiği resim eklenir]

Bu serbest el çizimini geleneksel Anadolu kilim/halı motifine dönüştür.

Kurallar:
1. Çizimin GENEL ŞEKLİNİ ve RENKLERINI koru
2. Geometrik simetri ekle (merkez, 4'lü veya 8'li simetri)
3. Kenarları düzelt, çizgileri keskinleştir
4. Geleneksel kilim motif dili kullan (koçboynuzu, elibelinde, yıldız, 
   göz motifi, hayat ağacı gibi)
5. Arka planı ŞEFFAF bırak (sadece motif)
6. Çözünürlük: Kare format, yüksek detay
7. Renk paleti: Orijinal renkleri kullan ama halıya uygun tonla

Sadece resim oluştur, metin yazma.
```

#### 1.3 Server Event Akışı

```javascript
// server/index.js'e eklenecek yeni eventler:

socket.on('drawing-data', async (dataUrl) => {
  // ... mevcut kod (placement, broadcast) ...
  
  // YENI: Async AI dönüşüm başlat
  processAIMotif(drawing.id, dataUrl, drawing)
    .then(aiDataUrl => {
      // AI sonucu geldiğinde — tüm client'lara bildir
      drawing.aiDataUrl = aiDataUrl;
      io.emit('ai-drawing-ready', { 
        id: drawing.id, 
        aiDataUrl,
        x: drawing.x, 
        y: drawing.y, 
        width: drawing.width, 
        height: drawing.height 
      });
      saveData();
    })
    .catch(err => console.error('AI motif hatası:', err));
});
```

### Phase 2: Frontend — Host AI Render (CarpetBoard.jsx)

#### 2.1 Yeni Socket Event: `ai-drawing-ready`

```javascript
socket.on('ai-drawing-ready', ({ id, aiDataUrl, x, y, width, height }) => {
  // AI motifi hazır — morph animasyonu başlat
  morphToAIMotif({ id, aiDataUrl, x, y, width, height });
});
```

#### 2.2 Morph Animasyonu — "Metamorfoz"

Orijinal çizim → AI motifine geçiş animasyonu:

```
Adım 1 (t=0):     Orijinal çizim halıda görünüyor
Adım 2 (t=0-0.5): Altın ışıltı efekti (glow pulse)  
Adım 3 (t=0.5-1): Crossfade → AI motifi beliriyor
Adım 4 (t=1):     AI motifi tam yerleşmiş
```

**Teknik:** Offscreen canvas'ta:

1. Orijinal alanı sakla (snapshot)
2. AI image'ı yükle
3. `globalAlpha` animasyonu ile crossfade
4. Opsiyonel: "Altın toz" parçacık efekti geçiş sırasında

#### 2.3 Initial Load'da AI Versiyonları

```javascript
socket.on('initial-carpet', ({ drawings }) => {
  drawings.forEach(d => {
    // AI versiyonu varsa direkt onu göster
    const dataUrl = d.aiDataUrl || d.dataUrl;
    drawWovenImage({ ...d, dataUrl });
  });
});
```

### Phase 3: Frontend — Client UX Feedbacki (ClientPage.jsx)

#### 3.1 Gönderim Sonrası AI Durumu

```
[DOKULUDU! ✨]              → Mevcut (çizim gönderildi)
[🤖 MOTİF İŞLENİYOR...]    → Yeni (AI çalışıyor)
[✨ MOTİF HAZIR!]           → Yeni (AI tamamlandı, halıda göster)
```

#### 3.2 Yeni Socket Eventleri (Client tarafı)

```javascript
socket.on('ai-processing', ({ drawingId }) => {
  // Loading göster: "AI motif oluşturuluyor..."
});

socket.on('ai-drawing-ready', ({ id, aiDataUrl }) => {
  // Başarı göster + AI motifin küçük preview'ı
});
```

### Phase 4: Bonus — Host Kontrol Paneli

#### 4.1 AI Toggle

Panel'de "🤖 AI Motif Modu" switch'i:

- **AÇIK:** Her çizim AI'dan geçer
- **KAPALI:** Sadece orijinal çizimler gösterilir (düşük latency mod)

#### 4.2 AI Durum Göstergesi

Panel'de küçük bir "AI İşlem Kuyruğu" göstergesi:

```
🤖 AI Kuyruğu: 3/5 tamamlandı
[████████░░] 60%
```

---

## ⚙️ Teknik Detaylar

### API Konfigürasyonu

| Parametre | Değer |
|---|---|
| **Endpoint** | `https://antigravity2.mindops.net/v1/chat/completions` |
| **API Key** | `sk-antigravity-lejyon-2026` (env var: `AI_API_KEY`) |
| **Model** | `gemini-3-pro-image-1x1` (kare format) |
| **Max Tokens** | 8192 |
| **Timeout** | 90 saniye |
| **Retry** | 3 deneme, 10s bekleme (503 için) |

### Response Parse

Gemini response'u Markdown inline image formatında döner:

```
![image](data:image/jpeg;base64,/9j/4AAQ...)
```

Parse: `content.match(/data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)/)`

### Veri Modeli Güncellemesi

```javascript
// Mevcut drawing objesi:
{
  id: "timestamp_random",
  dataUrl: "data:image/png;base64,...",    // Orijinal çizim
  x, y, width, height, rotation,
  timestamp: Date.now()
}

// Güncelleme:
{
  id: "timestamp_random",
  dataUrl: "data:image/png;base64,...",    // Orijinal çizim (korunur)
  aiDataUrl: "data:image/jpeg;base64,...", // AI motifi (yeni!)
  aiStatus: "pending|processing|done|failed",
  x, y, width, height, rotation,
  timestamp: Date.now()
}
```

### Performans ve Boyut Hesabı

| Metrik | Değer |
|---|---|
| Orijinal çizim (768x768 PNG) | ~50-200 KB |
| AI motif (JPEG) | ~500-1500 KB |
| Gemini API latency | 30-60 saniye |
| Max eşzamanlı AI işlem | 2-3 (rate limit) |
| Model başına maliyet | ~0 (gateway ücretsiz) |

### Error Handling

| Hata | Eylem |
|---|---|
| 503 Capacity Exhausted | 10s bekle, 3x retry |
| Timeout (90s) | Orijinal çizimle devam |
| Parse hatası (base64 yok) | Log + orijinal çizimle devam |
| Genel hata | `aiStatus: "failed"`, orijinal kalır |

---

## 📐 Uygulama Sırası

### Sprint 1: MVP (Çekirdek Pipeline)

1. ✅ `server/ai-motif.js` — AI service modülü
2. ✅ `server/index.js` — Async AI pipeline entegrasyonu
3. ✅ `src/components/3d/CarpetBoard.jsx` — `ai-drawing-ready` event handler
4. ✅ Basit crossfade animasyonu

### Sprint 2: UX Polish

5. ✅ Client tarafı AI durum feedbacki
2. ✅ Host panel'de AI toggle + durum göstergesi
3. ✅ Morph animasyonu (altın ışıltı efekti)
4. ✅ Initial load'da AI versiyonlarını göster

### Sprint 3: Hardening

9. ✅ Rate limiting (max 2 eşzamanlı AI çağrısı)
2. ✅ Retry logic ve error recovery
3. ✅ AI sonuçlarını disk'e cache'le
4. ✅ Environment variable yapılandırması

---

## 🎯 Prompt Mühendisliği Testleri

Farklı prompt stratejileri denenecek:

### Strateji A: "Transformasyon" (Ana plan)
>
> "Bu serbest çizimi Anadolu kilim motifine dönüştür. Renkleri koru,
> geometrik simetri ekle."

### Strateji B: "İlham"
>
> "Bu çizimden ilham alarak benzer renk ve şekillerle geleneksel
> bir halı motifi oluştur."

### Strateji C: "Stilize"
>
> "Bu çizimi geleneksel Türk halı dokuma stiliyle yeniden oluştur.
> Pikselleştir, düğüm noktaları ekle."

**Not:** Image input desteği varsa (multimodal), kullanıcı çizimini
direkt image olarak göndermek en iyi sonucu verecektir.

---

## 📁 Dosya Değişiklikleri Özeti

| Dosya | Değişiklik Türü | Açıklama |
|---|---|---|
| `server/ai-motif.js` | **YENİ** | AI service modülü |
| `server/index.js` | **GÜNCELLEME** | AI pipeline, yeni eventler |
| `src/components/3d/CarpetBoard.jsx` | **GÜNCELLEME** | ai-drawing-ready handler, morph |
| `src/ClientPage.jsx` | **GÜNCELLEME** | AI durum feedbacki |
| `src/HostPage.jsx` | **GÜNCELLEME** | AI toggle, durum göstergesi |
| `Dockerfile.socket` | **GÜNCELLEME** | AI_API_KEY env var |
