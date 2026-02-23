# Architecture: Phase 3 — Admin Panel v2 & Sistem İyileştirmeleri

**Proje:** Halı Tezgahı (Halı Mozaik)
**Versiyon:** v11.0.0
**Tarih:** 2026-02-23
**Yazar:** Winston (Architect) + BMad Master

---

## 1. Mevcut Mimari

```
┌──────────────────────────────────────────────────────────┐
│                    KUBERNETES (K3s)                       │
│                                                          │
│  ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │ hali-mozaik-web  │    │   hali-mozaik-socket         │ │
│  │ (Nginx)          │    │   (Node.js / Express)        │ │
│  │                  │    │                              │ │
│  │ React SPA        │    │ server/index.js (936 LOC)    │ │
│  │ - AdminPage      │    │ server/ai-motif.js (264 LOC) │ │
│  │ - ClientPage     │    │                              │ │
│  │ - HostPage       │    │ Socket.IO Server             │ │
│  │ - GalleryPage    │    │ Express Static (/motifs)     │ │
│  │ - DownloadPage   │    │ REST API (/api/*)            │ │
│  └────────┬─────────┘    └─────────────┬────────────────┘ │
│           │                            │                  │
│           │       ┌────────────────────┘                  │
│           │       │                                       │
│           │  ┌────▼──────────────────┐                   │
│           │  │  Longhorn PVC (2GB)   │                   │
│           │  │  /data/motifs/        │                   │
│           │  │  ├── *.png            │                   │
│           │  │  ├── archive/*.png    │                   │
│           │  │  ├── carpet_data.json │                   │
│           │  │  ├── archive_data.json│                   │
│           │  │  └── sessions_data.json                   │
│           │  └───────────────────────┘                   │
│           │                                              │
│  ┌────────▼──────────────────────────────────────────┐   │
│  │              Ingress (Nginx)                       │   │
│  │  /           → web:80                             │   │
│  │  /socket.io  → socket:3003                        │   │
│  │  /motifs     → socket:3003                        │   │
│  │  /api        → socket:3003                        │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Phase 3 Mimari Değişiklikler

### 2.1 Backend Modülarizasyon

**Mevcut:** `server/index.js` (936 LOC) — tüm event handler'lar tek dosyada

**Hedef:**

```
server/
├── index.js              ← Ana sunucu (Express + Socket.IO setup)
├── ai-motif.js           ← AI pipeline (değişmez)
├── routes/
│   └── api.js            ← REST API route'ları
├── handlers/
│   ├── drawing.js        ← Çizim event handler'ları
│   ├── admin.js          ← Admin event handler'ları
│   ├── archive.js        ← Arşiv event handler'ları
│   └── event-mgmt.js     ← 🆕 Etkinlik yönetimi handler'ları
├── services/
│   ├── data-store.js     ← JSON dosya okuma/yazma
│   ├── snapshot.js       ← 🆕 Halı snapshot servisi
│   └── prompt-store.js   ← 🆕 Prompt yönetim servisi
└── config.js             ← Environment config
```

### 2.2 Yeni Veri Modelleri

#### Event (Etkinlik)

```json
{
  "id": "evt_1708700000000",
  "name": "Antalya Müzeler Gecesi",
  "location": "Antalya Müzesi",
  "createdAt": 1708700000000,
  "startedAt": 1708700100000,
  "endedAt": 1708710000000,
  "status": "active|completed|archived",
  "settings": {
    "maxDrawings": 28,
    "aiEnabled": true,
    "promptId": "kilim-classic",
    "language": "tr"
  },
  "stats": {
    "totalDrawings": 45,
    "aiSuccessCount": 42,
    "aiFailedCount": 3,
    "uniqueUsers": 38,
    "snapshotFile": "snapshot_evt_1708700000000.png"
  }
}
```

#### Prompt Preset

```json
{
  "id": "kilim-classic",
  "name": "Klasik Kilim",
  "prompt": "Transform this freehand drawing into a traditional...",
  "isDefault": true,
  "createdAt": 1708700000000
}
```

### 2.3 Yeni PVC Yapısı

```
/data/motifs/                    (PVC — Longhorn 2GB)
├── carpet_data.json             ← Aktif çizimler
├── archive_data.json            ← Arşiv metadata
├── sessions_data.json           ← Oturumlar
├── events_data.json             ← 🆕 Etkinlikler
├── prompts_data.json            ← 🆕 Prompt presetleri
├── drawing_*.png                ← Aktif çizim dosyaları
├── motif_*.png                  ← Aktif motif dosyaları
├── archive/                     ← Arşivlenmiş dosyalar
│   └── KullanıcıAdı_tarih_*.png
└── snapshots/                   ← 🆕 Halı snapshot'ları
    └── snapshot_evt_*.png
```

### 2.4 Yeni Socket Event'leri

| Event (Client → Server) | Payload | Açıklama |
|--------------------------|---------|----------|
| `admin:create-event` | `{ pin, name, location }` | Etkinlik oluştur |
| `admin:start-event` | `{ pin, eventId }` | Etkinliği başlat |
| `admin:end-event` | `{ pin, eventId }` | Etkinliği bitir + snapshot |
| `admin:get-events` | `{ pin }` | Etkinlik listesi |
| `admin:update-prompt` | `{ pin, promptId, prompt }` | Prompt güncelle |
| `admin:get-prompts` | `{ pin }` | Prompt listesi |
| `admin:take-snapshot` | `{ pin }` | Manuel snapshot al |
| `admin:retry-all-failed` | `{ pin }` | Tüm başarısızları retry |
| `admin:search-archive` | `{ pin, query, dateFrom, dateTo }` | Arşiv arama |
| `admin:bulk-download` | `{ pin, ids }` | Toplu ZIP indirme |

| Event (Server → Client) | Payload | Açıklama |
|--------------------------|---------|----------|
| `admin:events` | `{ events }` | Etkinlik listesi |
| `admin:prompts` | `{ prompts }` | Prompt listesi |
| `admin:snapshot-ready` | `{ url }` | Snapshot hazır |
| `admin:activity` | `{ type, message, timestamp }` | Aktivite feed |
| `admin:archive-search-result` | `{ results }` | Arama sonuçları |

### 2.5 Frontend Component Yapısı

**Mevcut:** `AdminPage.jsx` (1106 LOC) — tek monolitik dosya

**Hedef:**

```
src/admin/
├── AdminPage.jsx              ← Ana layout + routing (200 LOC)
├── components/
│   ├── PinScreen.jsx          ← PIN giriş (mevcut, ayıkla)
│   ├── Sidebar.jsx            ← Menü (mevcut, ayıkla)
│   ├── StatCard.jsx           ← İstatistik kartı (mevcut)
│   ├── DrawingCard.jsx        ← Çizim kartı (mevcut)
│   ├── ConfirmModal.jsx       ← Onay dialogu (mevcut)
│   ├── ImageModal.jsx         ← Görsel önizleme (mevcut)
│   └── ToastContainer.jsx     ← Bildirim (mevcut)
├── views/
│   ├── DashboardView.jsx      ← 🔄 Dashboard + canlı halı + feed
│   ├── GalleryView.jsx        ← 🔄 Çizim galerisi
│   ├── ArchiveView.jsx        ← 🔄 Arşiv + arama
│   ├── UsersView.jsx          ← 🔄 Kullanıcılar
│   ├── SettingsView.jsx       ← 🔄 Ayarlar + prompt
│   └── EventsView.jsx         ← 🆕 Etkinlik yönetimi
└── hooks/
    └── useAdminSocket.js      ← Socket bağlantı hook'u
```

---

## 3. Teknik Kararlar

| Karar | Seçim | Neden |
|-------|-------|-------|
| Halı snapshot | Server-side HTML→PNG (puppeteer/canvas) | Client-side güvenilir değil |
| ZIP oluşturma | `archiver` npm paketi + streaming | Bellek-dostu |
| Prompt depolama | JSON dosya (PVC) | Veritabanı gereksiz bu ölçekte |
| Component refactor | Aynı dosyada başla, sonra ayır | Breaking change minimize |
| State management | React useState + useRef (mevcut) | Context/Redux gereksiz |

---

## 4. Güvenlik İyileştirmeleri

| Mevcut | Hedef |
|--------|-------|
| PIN hardcoded default | ENV var zorunlu, CLI'dan SET |
| Socket auth yok | Her admin event'te PIN doğrulama (zaten var) |
| Rate limit yok | Express-rate-limit ekle |
| CORS * | Whitelist origin (zaten yapılmış) |

---

## 5. Deployment Stratejisi

Her sprint sonunda:
1. `git commit` → `beta` branch
2. `docker buildx` → GHCR push
3. `kubectl set image` → rollout
4. Smoke test (admin + çizim + motif)

Versiyon planı:
- Sprint 1 → v11.0.0 (Dashboard)
- Sprint 2 → v11.1.0 (AI Yönetimi)
- Sprint 3 → v12.0.0 (Etkinlik)
- Sprint 4 → v12.1.0 (Arşiv + UX)
