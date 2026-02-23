## 🔴 DİKKAT: LOCALHOST (TEST) MODU AKTİF

Halı Tezgahı projesinin (Mobil Çizim ↔ 3D Halı) arasındaki veri iletişimi yapan **Socket.io bağlantı adresleri**, Kubernetes (K8S) canlı yayın ortamından çıkarılarak **Lokal (Yerel) Geliştirme** ortamında `3004` (Vite) ile `3003` (Server) portlarının haberleşebilmesi için **GEÇİCİ OLARAK** değiştirilmiştir.

**⚠️ GITHUB PUSH ETMEDEN ÖNCE GERİ DÜZELTİLMESİ GEREKEN DOSYALAR:**

Asağıdaki dosyalarda bulunan şu kod satırı:
`const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.') ? \`http://\${window.location.hostname}:3003\` : window.location.origin;`

Yeniden eskisi gibi şu şekilde değiştirilmelidir:
`const socketUrl = window.location.origin;`

**Değişiklik Yapılan Dosyalar:**
1. `src/AdminPage.jsx` (Tahmini 220. satır)
2. `src/ClientPage.jsx` (Tahmini 105. satır)
3. `src/HostPage.jsx` (Tahmini 137. satır)
4. `src/DownloadPage.jsx` (Veya projede Socket bağlanan diğer sayfalar, incelendi)

---
> Projeyi GitHub'a yolladığında bu dosyadaki notlara bakılarak sistemin tekrar canlı (kube/network) uyumlu hale ("origin" URL tabanlı haline) geri getirilmesi elzemdir. Aksi halde bulut ortamında frontend backend'e ulaşamaz.
