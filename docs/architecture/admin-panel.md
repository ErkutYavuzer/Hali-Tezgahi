# Halı Tezgahı — Admin Panel Architecture

**İlgili PRD:** `docs/prd/admin-panel.md`  
**Tip:** Brownfield Integration  
**Tarih:** 2026-02-21

---

## 1. Tech Stack

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Frontend | React + Vite | 18.x + 5.x |
| Backend | Node.js + Express + Socket.IO | 20.x + 4.x + 4.x |
| Styling | Inline CSS (mevcut pattern) | — |
| State | useState + Socket.IO events | — |
| Storage | JSON dosya + PNG dosyalar | — |
| Infra | K8s (K3s) + Longhorn PVC | — |

---

## 2. Source Tree (Değişiklikler)

```
src/
├── App.jsx                    # ✏️ admin role eklenir
├── AdminPage.jsx              # 🆕 Admin panel bileşeni
├── ClientPage.jsx             # (değişmez)
├── HostPage.jsx               # (değişmez)
├── DownloadPage.jsx           # (değişmez)
└── components/
    └── AdminDrawingCard.jsx   # 🆕 Çizim kartı bileşeni

server/
├── index.js                   # ✏️ Admin socket event'leri + REST API
├── ai-motif.js                # (değişmez)
└── motifs/                    # (PVC — değişmez)

k8s/
├── socket.yaml                # ✏️ ADMIN_PIN env eklenir
└── ...
```

---

## 3. Bileşen Mimarisi

```
AdminPage.jsx
├── PinScreen (PIN girişi — giriş yapılmamışsa)
│
├── Dashboard Section
│   ├── StatsGrid (çizim, AI, disk, kullanıcı sayıları)
│   └── AIStatusBar (pipeline health)
│
├── Settings Section
│   ├── MaxDrawingsSlider
│   ├── AIToggle
│   ├── ResetCarpetButton
│   └── RateLimitSlider
│
└── Drawings Section
    ├── BulkActions (toplu sil, toplu AI retry)
    ├── DrawingGrid
    │   └── AdminDrawingCard × N
    │       ├── Thumbnail (çizim + motif)
    │       ├── Meta (isim, tarih, durum)
    │       ├── DeleteButton
    │       ├── RetryAIButton
    │       └── DownloadButton
    └── DrawingDetailModal (lightbox)
```

---

## 4. Socket Event Protokolü

### Client → Server (Admin Events)

| Event | Payload | Açıklama |
|-------|---------|----------|
| `admin:auth` | `{ pin }` | PIN doğrulama |
| `admin:delete-drawing` | `{ id, pin }` | Tek çizim sil |
| `admin:delete-all` | `{ pin }` | Tüm çizimleri sil |
| `admin:retry-ai` | `{ id, pin }` | AI'ı yeniden çalıştır |
| `admin:set-max` | `{ value, pin }` | Max çizim değiştir |
| `admin:toggle-ai` | `{ enabled, pin }` | AI on/off |
| `admin:reset-carpet` | `{ pin }` | Halıyı sıfırla |
| `admin:get-stats` | `{ pin }` | İstatistik iste |

### Server → Client (Admin Responses)

| Event | Payload | Açıklama |
|-------|---------|----------|
| `admin:auth-result` | `{ success, error? }` | PIN sonucu |
| `admin:stats` | `{ drawings, ai, disk, clients }` | İstatistikler |
| `admin:drawing-deleted` | `{ id }` | Silme onayı |
| `admin:all-deleted` | `{}` | Toplu silme onayı |
| `admin:error` | `{ message }` | Hata |

---

## 5. REST API Endpoint'leri

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/stats` | Sistem istatistikleri |
| GET | `/api/motifs` | Motif listesi (mevcut) |
| GET | `/api/motifs/:id/download` | Motif indirme (mevcut) |
| GET | `/galeri` | Galeri sayfası (mevcut) |

> **Not:** Admin işlemleri Socket.IO üzerinden yapılır (PIN kontrolü için). REST API sadece okuma.

---

## 6. PIN Doğrulama Akışı

```
Client                          Server
  │                                │
  ├─ admin:auth { pin: "1234" } ──►│
  │                                ├─ ENV.ADMIN_PIN === pin?
  │                                │  ├─ YES → admin:auth-result { success: true }
  │◄─────────────────────────────── │  │        socket.isAdmin = true
  │                                │  └─ NO  → admin:auth-result { success: false }
  │                                │
  ├─ admin:delete-drawing ────────►│
  │                                ├─ socket.isAdmin === true?
  │                                │  ├─ YES → silme işlemi
  │                                │  └─ NO  → admin:error
```

---

## 7. Güvenlik

- **PIN:** 4 haneli, ENV variable (`ADMIN_PIN`, default: `1234`)
- **Socket Auth:** Her admin event'inde `socket.isAdmin` kontrolü
- **Client-side:** PIN localStorage'da saklanır (session persist)
- **No HTTPS overhead:** Zaten Ingress SSL terminasyon yapıyor

---

## 8. Deployment

```yaml
# k8s/socket.yaml'a eklenecek env:
- name: ADMIN_PIN
  value: "1234"    # Production'da değiştir!
```

Build & deploy:

```bash
docker buildx build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-web:vX.Y.Z --push -f Dockerfile.web .
docker buildx build --platform linux/amd64 -t ghcr.io/ayavuzer/hali-mozaik-socket:vX.Y.Z --push -f Dockerfile.socket .
kubectl apply -f k8s/socket.yaml
kubectl set image deployment/hali-mozaik-web web=ghcr.io/ayavuzer/hali-mozaik-web:vX.Y.Z -n hali-mozaik
```
