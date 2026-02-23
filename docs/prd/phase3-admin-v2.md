# PRD: Phase 3 — Admin Panel v2 & Sistem İyileştirmeleri

**Proje:** Halı Tezgahı (Halı Mozaik)
**Versiyon:** v11.0.0
**Tarih:** 2026-02-23
**Yazar:** John (PM) + BMad Master
**Durum:** DRAFT

---

## 1. Vizyon ve Hedef

Halı Tezgahı şu an 19 feature ile %100 tamamlanmış bir MVP+. Phase 3'ün amacı, sistemi **etkinlik yöneticisi perspektifinden** tam yönetilebilir hale getirmek.

### Hedef Kullanıcı

**Etkinlik Yöneticisi (Event Manager)**
- Müze/fuar/otel lobisinde interaktif halı deneyimi kuran kişi
- Teknik bilgisi sınırlı — tablet/telefondan yönetebilmeli
- Etkinlik öncesi hazırlık, sırasında canlı takip, sonrasında rapor alımı

### Başarı Metrikleri

| Metrik | Hedef |
|--------|-------|
| Admin panelden etkinlik başlatma süresi | < 30 saniye |
| Canlı halı durumunu görme | Dashboard'dan anında |
| Etkinlik sonrası rapor alma | 1 tıklama |
| AI prompt değiştirme | Admin panelden, deploy gerektirmeden |
| Arşivde çizim bulma | < 10 saniye (arama ile) |

---

## 2. Mevcut Durum (As-Is)

### Tamamlanan Phase'ler

| Phase | SP | Durum |
|-------|:--:|:-----:|
| Phase 0: Core Platform | 30 | ✅ Done |
| Phase 1: AI Motif Pipeline | 20 | ✅ Done |
| Phase 2: Admin Panel | 16 | ✅ Done |
| **Toplam** | **66** | **%100** |

### Mevcut Admin Yetenekleri

- ✅ PIN auth ile giriş
- ✅ Dashboard (stat kartları, doluluk, liderlik)
- ✅ Çizim galerisi (seçme, silme, AI retry)
- ✅ Arşiv / Geçmiş (oturum + silinmişler)
- ✅ Kullanıcı listesi
- ✅ Ayarlar (max çizim, AI toggle, servis durumu)
- ✅ Halı sıfırlama (danger zone)

### Eksikler

- ❌ Dashboard'da canlı halı önizlemesi yok
- ❌ Etkinlik (event) kavramı yok — her şey tek oturum
- ❌ AI prompt admin'den düzenlenemiyor
- ❌ Arşivde arama/filtreleme yok
- ❌ Toplu indirme (ZIP) yok
- ❌ Etkinlik raporu yok
- ❌ Halı snapshot otomatik saklanmıyor
- ❌ Mobil uyumlu değil (admin panel)
- ❌ Son aktivite feed'i yok

---

## 3. Epic ve Feature Listesi

### Epic 3.1 — Dashboard Zenginleştirme (8 SP)

**Amaç:** Admin'in tek bakışta sistemi kavraması

| ID | Feature | SP | Açıklama |
|----|---------|:--:|----------|
| F020 | LiveCarpetPreview | 3 | Dashboard'da halının canlı küçük önizlemesi (iframe veya mini canvas) |
| F021 | ActivityFeed | 3 | Son olaylar: "Ali çizim yaptı", "AI motif tamamlandı", "Erkut sildi" — gerçek zamanlı |
| F022 | QuickActions | 2 | Hızlı aksiyonlar: "Tüm Başarısızları Retry", "QR Göster", "Snapshot Al" |

### Epic 3.2 — Etkinlik Yönetimi (8 SP)

**Amaç:** Farklı etkinlikleri (fuar, müze, otel) ayrı yönetmek

| ID | Feature | SP | Açıklama |
|----|---------|:--:|----------|
| F023 | EventLifecycle | 5 | Etkinlik oluştur (ad, yer, tarih) → başlat → bitir → arşivle |
| F024 | CarpetSnapshot | 3 | Etkinlik bittiğinde tamamlanmış halının PNG/JPG snapshot'ı otomatik saklanır |

### Epic 3.3 — AI Yönetimi (5 SP)

**Amaç:** Etkinliğe göre motif stilini değiştirebilme

| ID | Feature | SP | Açıklama |
|----|---------|:--:|----------|
| F025 | PromptEditor | 3 | Admin panelden AI dönüşüm prompt'unu düzenleme + preset'ler (Kilim, Çini, Modern) |
| F026 | AIRetryQueue | 2 | Başarısız motifleri toplu retry, kuyruk durumu görünümü |

### Epic 3.4 — Gelişmiş Arşiv (5 SP)

**Amaç:** Büyüyen arşivde kolay navigasyon

| ID | Feature | SP | Açıklama |
|----|---------|:--:|----------|
| F027 | ArchiveSearch | 2 | Arşivde kullanıcı adı, tarih aralığı, silme nedeni ile arama/filtreleme |
| F028 | BulkDownload | 3 | Seçili arşiv kayıtlarını ZIP olarak indirme |

### Epic 3.5 — Responsive & UX (5 SP)

**Amaç:** Tablet'ten yönetilebilir admin

| ID | Feature | SP | Açıklama |
|----|---------|:--:|----------|
| F029 | ResponsiveAdmin | 3 | Admin panel tablet/mobil breakpoint uyumu (sidebar → bottombar) |
| F030 | MultiLang | 2 | Çizim arayüzü TR/EN dil seçimi (admin'den ayarlanır) |

---

## 4. Önceliklendirme Matrisi

```
              YÜK DEĞERİ
          Düşük        Yüksek
    ┌──────────┬───────────┐
 D  │ F030     │ F020,F021 │
 Ü  │ MultiLang│ LivePreview│
 Ş  │          │ Activity  │
 Ü  ├──────────┼───────────┤
 K  │          │ F023,F025 │
    │          │ Event,    │
 E  │          │ Prompt    │
 F  ├──────────┼───────────┤
 O  │ F028     │ F024      │
 R  │ BulkDL   │ Snapshot  │
    └──────────┴───────────┘
```

### Önerilen Sprint Sırası

| Sprint | Epic | SP | Süre |
|--------|------|:--:|------|
| Sprint 1 | Epic 3.1 (Dashboard) | 8 | 1 oturum |
| Sprint 2 | Epic 3.3 (AI Yönetimi) | 5 | 1 oturum |
| Sprint 3 | Epic 3.2 (Etkinlik) | 8 | 1-2 oturum |
| Sprint 4 | Epic 3.4 + 3.5 (Arşiv + UX) | 10 | 1-2 oturum |

---

## 5. Non-Functional Requirements

| NFR | Hedef |
|-----|-------|
| Admin sayfa yükleme | < 2 saniye |
| Dashboard realtime güncelleme | < 500ms gecikme |
| Arşiv arama yanıt süresi | < 200ms (client-side) |
| Responsive breakpoint | ≥ 768px tablet, ≥ 1024px desktop |
| PVC kullanımı | < %50 (2GB limit) |
| AI prompt max uzunluk | 2000 karakter |

---

## 6. Riskler ve Mitigasyonlar

| Risk | Etki | Mitigasyon |
|------|------|-----------|
| AdminPage.jsx 1100+ satır ve büyüyor | Yüksek | Sprint 1'de component refactor |
| server/index.js 950+ satır ve büyüyor | Orta | Route modülarizasyonu |
| ZIP oluşturma backend yükü | Düşük | Archiver kütüphanesi + streaming |
| Etkinlik verisi PVC limitini aşar | Düşük | Monitoring + eski etkinlik temizleme |
