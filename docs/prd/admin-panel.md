# Halı Tezgahı — Admin Panel PRD

**Proje:** Halı Tezgahı (Dijital Motif Atölyesi)  
**Tip:** Brownfield — Mevcut projeye admin panel ekleme  
**Tarih:** 2026-02-21  
**Versiyon:** v1.0

---

## 1. Arka Plan & Problem

Halı Tezgahı interaktif bir kolektif sanat deneyimi. Ziyaretçiler telefondan çizim yapıyor, AI (Gemini) çizimleri kilim motiflerine dönüştürüyor ve büyük ekranda halı oluşuyor.

### Mevcut Sorunlar

- **Çizim yönetimi yok** — uygunsuz çizimler silinemez
- **Ayarlar için kod değişikliği gerekiyor** — max çizim sayısı, AI toggle gibi
- **Durum izleme yok** — kaç çizim var, AI kuyruk durumu, disk kullanımı
- **Halı sıfırlama zor** — yeni oturum başlatmak için pod restart gerekiyor
- **Erişim kontrolü yok** — herkes her şeyi yapabilir

### Mevcut Mimari

```
┌─ Frontend (Vite/React) ─────────────┐
│  App.jsx → role=host | client | download │
│  HostPage.jsx (büyük ekran)          │
│  ClientPage.jsx (telefon çizim)      │
│  DownloadPage.jsx (indirme)          │
└──────────────────────────────────────┘
         ↕ Socket.IO
┌─ Backend (Node.js/Express) ──────────┐
│  server/index.js (ana sunucu)        │
│  server/ai-motif.js (AI pipeline)    │
│  carpet_data.json (veri)             │
│  /data/motifs/ (PNG dosyaları, PVC)  │
└──────────────────────────────────────┘
```

---

## 2. Hedefler

| # | Hedef | Başarı Kriteri |
|---|-------|---------------|
| G1 | Admin paneli ile çizimleri yönet | Tek tıkla silme, toplu silme |
| G2 | Sistem ayarlarını değiştir | Max çizim, AI on/off, halı reset |
| G3 | Durum izleme | Canlı istatistikler, AI kuyruk |
| G4 | Basit erişim kontrolü | PIN korumalı admin paneli |
| G5 | Galeri yönetimi | Motifleri incele, indir, sil |

---

## 3. Epik'ler

### Epic 1: Admin Panel Temeli (8 SP)

#### Story 1.1: Admin Rotası ve PIN Koruması (3 SP)

**Açıklama:** `/admin` URL'si ile erişilebilir, basit PIN korumalı admin paneli.

**Kabul Kriterleri:**

- `?role=admin` veya `/admin` ile erişim
- 4 haneli PIN ile giriş (ENV: `ADMIN_PIN`, default: `1234`)
- PIN localStorage'da saklanır (oturum boyunca)
- Yanlış PIN'de hata mesajı

**Teknik Notlar:**

- App.jsx'e `admin` role eklenir
- AdminPage.jsx bileşeni oluşturulur
- PIN kontrolü client-side + server-side socket auth

#### Story 1.2: Dashboard — Canlı İstatistikler (2 SP)

**Açıklama:** Admin panelinde canlı durum göstergesi.

**Göstergeler:**

- Toplam çizim / Max çizim
- AI motif sayısı (başarılı / başarısız / bekleyen)
- Bağlı kullanıcı sayısı
- Disk kullanımı (/data/motifs boyutu)
- AI pipeline durumu (Antigravity/Google API sağlık)
- Son çizim zamanı

#### Story 1.3: Sistem Ayarları (3 SP)

**Açıklama:** Admin panelinden değiştirilebilir ayarlar.

**Ayarlar:**

- Max çizim sayısı (12-60 arası slider)
- AI motif dönüşüm on/off toggle
- Halıyı sıfırla (tüm çizimleri temizle + yeni oturum)
- Rate limit süresi (3-30sn)

---

### Epic 2: Çizim Yönetimi (5 SP)

#### Story 2.1: Çizim Listesi ve Silme (3 SP)

**Açıklama:** Tüm çizimleri grid görünümünde listele, tek tek veya toplu sil.

**Özellikler:**

- Thumbnail grid (orijinal çizim + AI motif yan yana)
- Kullanıcı adı, tarih, AI durumu gösterimi
- Tek çizim sil (onay dialogu ile)
- Toplu seçim + silme
- Silinince halı otomatik yeniden yerleştirilir

**Socket Events:**

- `admin:delete-drawing` → { id, pin }
- `admin:delete-all` → { pin }

#### Story 2.2: Çizim Detay ve Yeniden İşleme (2 SP)

**Açıklama:** Tekil çizimi büyüterek incele, AI'ı yeniden çalıştır.

**Özellikler:**

- Orijinal çizim büyük görünüm
- AI motif büyük görünüm (yan yana karşılaştırma)
- "AI'ı yeniden çalıştır" butonu
- Motif indirme butonu

---

### Epic 3: Galeri Geliştirme (3 SP)

#### Story 3.1: Gelişmiş Galeri Sayfası (2 SP)

**Açıklama:** Mevcut `/galeri` endpoint'ini React bileşenine dönüştür.

**Özellikler:**

- Responsive grid layout
- Lazy loading görseller
- Lightbox (büyütme)
- Filtrele: tümü / AI tamamlanan / bekleyen
- Sıralama: yeni → eski, eski → yeni

#### Story 3.2: QR ile Galeri Paylaşımı (1 SP)

**Açıklama:** Galeri sayfasına QR ile erişim.

**Özellikler:**

- Host ekranında galeri QR kodu
- Mobil uyumlu galeri görünümü

---

## 4. Teknik Gereksinimler

### Frontend

- `AdminPage.jsx` — Yeni bileşen
- `App.jsx` — `admin` role ekleme
- Socket events: `admin:*` namespace

### Backend (server/index.js)

- Admin socket eventi handler'ları
- PIN doğrulama middleware
- Çizim silme + dosya temizleme
- İstatistik endpoint'i: `GET /api/stats`

### Güvenlik

- Admin PIN ENV variable (`ADMIN_PIN`)
- Socket event'lerinde PIN kontrolü
- Rate limiting admin işlemleri

---

## 5. Dışarda Bırakılanlar (v1)

- Kullanıcı hesap sistemi (overkill)
- Veritabanı (JSON yeterli)
- Admin logları
- Çoklu admin desteği

---

## 6. Story Point Özeti

| Epic | SP | Açıklama |
|------|----|----------|
| Epic 1: Admin Panel Temeli | 8 | PIN, dashboard, ayarlar |
| Epic 2: Çizim Yönetimi | 5 | Liste, silme, yeniden işleme |
| Epic 3: Galeri Geliştirme | 3 | React galeri, QR |
| **TOPLAM** | **16** | |

---

## 7. Öncelik Sırası

```
1️⃣ Story 1.1 — Admin rotası + PIN (MUST)
2️⃣ Story 2.1 — Çizim listesi + silme (MUST)
3️⃣ Story 1.2 — Dashboard istatistikler (SHOULD)
4️⃣ Story 1.3 — Sistem ayarları (SHOULD)
5️⃣ Story 2.2 — Çizim detay (COULD)
6️⃣ Story 3.1 — Gelişmiş galeri (COULD)
7️⃣ Story 3.2 — QR galeri (NICE)
```
