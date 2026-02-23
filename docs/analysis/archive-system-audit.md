# 📦 Arşiv Sistemi Derin Analiz Raporu

**Tarih:** 2026-02-23  
**Analiz Edilen:** `server/index.js` (v10.2.0, commit `97f2fd8`)  
**Analiz Eden:** Antigravity Agentic AI  

---

## 1. Genel Mimari

Sistem 3 katmanlı bir veri saklama yapısı kullanıyor:

```
📁 Veri Katmanları
├── 🟢 Aktif Veri       → drawings[]        → carpet_data.json
├── 🟡 Arşiv Verisi     → archive[]         → archive_data.json
└── 📋 Oturum Geçmişi   → sessions[]        → sessions_data.json

📁 Dosya Sistemi
├── /data/motifs/           → Aktif çizim ve motif PNG dosyaları
└── /data/motifs/archive/   → Arşivlenmiş PNG dosyaları (kopyalanmış)
```

## 2. Arşivleme Fonksiyonu

`archiveDrawing(drawing, reason)` fonksiyonu (satır 186-211):

```javascript
function archiveDrawing(drawing, reason = 'admin-delete') {
  const archiveEntry = {
    ...drawing,                      // Tüm metadata kopyalanır
    deletedAt: Date.now(),           // Silme zamanı
    deleteReason: reason,            // Silme nedeni
    archivedDrawingFile: null,       // Arşive kopyalanan orijinal dosya
    archivedAiFile: null,            // Arşive kopyalanan motif dosyası
  };
  // PNG dosyaları motifs/ → motifs/archive/ klasörüne KOPYALANIR
  // JSON metadata archive[] dizisine eklenir
  // archive_data.json dosyasına yazılır
}
```

### ✅ Arşive Kaydeden İşlemler

| İşlem | Socket Event | Arşive Kaydediyor? | Reason Kodu | Satır |
|-------|-------------|-------------------|-------------|-------|
| Admin tekli silme | `admin:delete-drawing` | ✅ EVET | `admin-delete` | 554 |
| Admin tümünü silme | `admin:delete-all` | ✅ EVET | `admin-delete-all` | 591 |
| Admin halıyı sıfırla | `admin:reset-carpet` | ✅ EVET | `session-reset` | 714 |

### ❌ Arşive KAYDETMEYEN İşlem (KRİTİK BULGU)

| İşlem | Socket Event | Arşive Kaydediyor? | Risk | Satır |
|-------|-------------|-------------------|------|-------|
| **Manuel sıfırlama** | `manual-reset` | ❌ HAYIR | 🔴 **VERİ KAYBI** | 451-458 |

**`manual-reset` event'i (satır 451-458) çizimleri arşive taşımadan siliyor!**  
Bu event host ekranından tetiklenebilir ve tüm çizimler geri dönüşümsüz kaybedilir.

## 3. Arşivden Geri Yükleme

`admin:restore-drawing` event'i (satır 750-797):

- ✅ Arşivden seçilen çizimi aktif halıya geri yükler
- ✅ PNG dosyalarını `archive/` → `motifs/` klasörüne kopyalar
- ✅ Yeni grid placement hesaplar
- ✅ Tüm client'ları bilgilendirir
- ✅ MAX_DRAWINGS limitini kontrol eder

## 4. Kalıcı Silme (Hard Delete)

`admin:hard-delete` event'i (satır 800-821):

- ✅ Arşivden seçilen kaydı **kalıcı** olarak siler
- ✅ `archive/` klasöründeki PNG dosyalarını da siler
- ✅ `archive_data.json`'ı günceller

## 5. Oturum Kayıtları

`admin:reset-carpet` event'i halıyı sıfırlarken oturum bilgisi de kaydeder (satır 693-710):

```json
{
  "sessionId": "session_1708700000000",
  "startedAt": "<ilk çizim zamanı>",
  "endedAt": "<sıfırlama zamanı>",
  "totalDrawings": 12,
  "aiSuccessCount": 10,
  "aiFailedCount": 2,
  "uniqueUsers": ["Ali", "Veli"],
  "userCount": 2
}
```

## 6. Veri Akış Diyagramı

```
    Çizim Yapılır
         │
         ▼
  ┌──────────────┐    ┌─────────────────┐
  │  drawings[]  │───▶│ carpet_data.json│
  │  (aktif)     │    │ motifs/*.png    │
  └──────┬───────┘    └─────────────────┘
         │
    ┌────┴────┐
    │ SİLME   │
    └────┬────┘
         │
    ┌────┴──────────────────────────────┐
    │                                   │
    ▼                                   ▼
┌────────────────┐            ┌──────────────────┐
│ admin:delete   │            │ manual-reset     │
│ admin:delete-all│           │ (HOST EKRAN)     │
│ admin:reset    │            └──────────────────┘
└────────┬───────┘                    │
         │                            │
    ┌────▼────┐                  ┌────▼────┐
    │ ARŞİVE  │                  │ KAYBEDİR│
    │ TAŞI    │                  │ ❌      │
    └────┬────┘                  └─────────┘
         │
         ▼
  ┌──────────────┐    ┌──────────────────────┐
  │  archive[]   │───▶│ archive_data.json    │
  │  (korunan)   │    │ motifs/archive/*.png │
  └──────┬───────┘    └──────────────────────┘
         │
    ┌────┴────┐
    │ RESTORE │ admin:restore-drawing
    └────┬────┘
         │
         ▼
  drawings[]'e geri eklenir
```

## 7. Persist (Kalıcılık) Durumu

| Veri | Dosya | Pod Restart'ta Korunur? |
|------|-------|----------------------|
| Aktif çizimler | `carpet_data.json` | ⚠️ PVC yok ise HAYIR |
| Arşiv metadata | `archive_data.json` | ⚠️ PVC yok ise HAYIR |
| Oturum geçmişi | `sessions_data.json` | ⚠️ PVC yok ise HAYIR |
| Motif PNG'leri | `motifs/*.png` | ⚠️ PVC yok ise HAYIR |
| Arşiv PNG'leri | `motifs/archive/*.png` | ⚠️ PVC yok ise HAYIR |

**⚠️ Şu an PVC (Persistent Volume Claim) yapılandırılmamış. Pod restart'larında tüm veriler kaybolur.**

## 8. Bulgular ve Öneriler

### 🔴 Kritik

1. **`manual-reset` arşive kaydetmiyor** — Satır 451-458'de `drawings = []` yapılıyor ama `archiveDrawing()` çağrılmıyor. Bu bir veri kaybı riskidir.

2. **PVC eksik** — Tüm veriler container filesystem'de. Pod yeniden başlatılırsa hem aktif çizimler hem arşiv tamamen kaybolur.

### 🟡 Orta

3. **Arşiv boyutu kontrolsüz** — `archive[]` dizisi sınırsız büyüyebilir. Uzun süreli kullanımda bellek ve disk sorunlarına yol açabilir.

4. **`dataUrl` base64 verisi korunmuyor** — `archiveDrawing()` fonksiyonu `delete archiveEntry.dataUrl` yapıyor. Eğer PNG dosyası kayıpsa (PVC yoksa), çizim tamamen kurtarılamaz.

### 🟢 İyi Yönler

5. **Soft delete** yaklaşımı doğru — Admin silme işlemleri arşive taşıyor
6. **Oturum kayıtları** tutuluyor — Halı sıfırlandığında istatistikler kaydediliyor
7. **Geri yükleme** çalışıyor — Arşivden istenen çizim geri getirilebilir
8. **Hard delete** seçeneği var — Arşivden kalıcı silme mümkün

## 9. Aksiyon Planı

| Öncelik | Aksiyon | Etki |
|---------|---------|------|
| 🔴 P0 | `manual-reset`'e `archiveDrawing()` ekle | Veri kaybını önle |
| 🔴 P0 | K8s PVC ekle (`/data` mount) | Kalıcı depolama |
| 🟡 P1 | Arşiv boyutu limiti (örn: son 500 kayıt) | Bellek/disk kontrolü |
| 🟡 P1 | Arşiv export (ZIP indirme) | Yedekleme kolaylığı |
| 🟢 P2 | Arşiv arama/filtreleme | Kullanılabilirlik |

---

## Sonuç

**Evet, admin panelden "Tümünü Sil" ve "Halıyı Sıfırla" butonları arşive kaydediyor.** Son commit (`34cf3e4`) `archiveDrawing()` fonksiyonu ve `archive/` klasörü eklemiş. Tek kör nokta eski `manual-reset` event'i — bu arşive kaydetmiyor.

**Özet:**
- `admin:delete-drawing` → ✅ Arşive taşır
- `admin:delete-all` → ✅ Arşive taşır  
- `admin:reset-carpet` → ✅ Arşive taşır + Oturum kaydeder
- `manual-reset` → ❌ **Arşive taşımaz** (tek kör nokta)
