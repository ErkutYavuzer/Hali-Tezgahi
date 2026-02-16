# 📅 13 Şubat 2026 - Halı Tezgahı Geliştirme Günlüğü

## 🚀 Durum: Halı Tezgahı v2.0 "Anadolu Işıkları" ✨🌌

## 🛠️ Yapılanlar:
1. **Proje Kurulumu:** Vite + React + Three.js + Socket.io ile sıfırdan kuruldu.
2. **Mozaik Mantığı:** 6x10 (60 Slot), 16x16 piksel, rastgele slot dolumu.
3. **Görselleştirme (Host - Sanat Eseri Modu):**
   - **Gerçekçi Doku:** Prosedürel yün (iplik) dokusu ve mat yüzey.
   - **3D Derinlik:** Extrude geometriler, püsküller ve kenar süsleri.
   - **🆕 Atmosfer:** Ahşap zemin, yıldızlı gökyüzü, mistik sis (Fog) ve sıcak ışıklandırma.
   - **🆕 Yıldız Tozu:** Halı üzerinde uçuşan büyülü parçacıklar (Particle System).
   - **Animasyonlar:** Uçan pikseller (Bezier), Dalga şeklinde yok olma (Dissolve).
   - **Ses:** Web Audio API ile piksellerin yerine oturma sesi.
4. **İmece Modu (Opsiyonel):**
   - **🆕 Referans Desen:** Ekrana silik (%15 opaklık) bir kilim deseni yansıtılarak katılımcıların o deseni ortaya çıkarması sağlanıyor.
5. **Kullanıcı Deneyimi (Client):**
   - Mobil öncelikli tasarım (Touch fix, scroll engelleme).
   - Simetri Modu, Kare/Üçgen çizim, Geri Al, Geniş Palet.
   - İlerleme Çubuğu (Progress Bar).
6. **Sistem:**
   - Durum Senkronizasyonu (Memory): Yeni gelenler halıyı kaldığı yerden görüyor.
   - Otomatik Fotoğraf: Halı bitince screenshot alınıyor.
   - **🆕 QR Giriş:** Ekrana (placeholder) QR kod kutusu eklendi.
7. **Galeri Modu (v2.1):**
   - **Sahne:** Halı tam ortalandı, ışıklandırma müze kalitesine getirildi.
   - **Arayüz:** Yazı ortalandı, "Mozaikleri Temizle" butonu eklendi.
   - **Animasyon:** Yılan (Snake) efekti eklendi, pikseller kıvrılarak yerine oturuyor.
   - **Hata Düzeltmeleri:** Sıfırlama sonrası nesnelerin kaybolmaması sağlandı.

## 🔜 Sırada Ne Var? (Next Steps)
- [ ] **Admin Paneli:** Renk paletini, simetriyi veya halı boyutunu uzaktan yönetmek.
- [ ] **QR Code Modu:** Oyuncuların kendi desenlerini telefonlarına kaydetmeleri.
- [ ] **Dinamik QR:** Sunucu IP'sini otomatik algılayıp gerçek QR kodu oluşturmak.

## 📂 Önemli Dosyalar:
- `src/HostPage.jsx`: 3D Halı, atmosfer, parçacıklar ve rehber desen.
- `src/ClientPage.jsx`: Çizim arayüzü, araçlar.
- `server/index.js`: Socket.io sunucusu, state management.
