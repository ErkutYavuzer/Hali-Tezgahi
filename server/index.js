import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { transformToMotif, getAIStatus } from './ai-motif.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'carpet_data.json');

// 🌐 YEREL IP TESPİTİ
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let preferredIp = '';

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.')) {
          return iface.address;
        }
        if (!preferredIp) preferredIp = iface.address;
      }
    }
  }
  return preferredIp || 'localhost';
}

const LOCAL_IP = getLocalIp();
console.log(`🌍 Sunucu IP Adresi: ${LOCAL_IP}`);

const app = express();

// CORS — telefonlardan erişim için
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

// Test endpoint
app.get('/', (req, res) => res.send('🦅 Halı Tezgahı Sunucusu çalışıyor!'));

// Health check for K8s
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 5e6 // 5MB - base64 çizimler için
});

// ============================================================================
// ÇİZİM YÖNETİMİ
// ============================================================================

let MAX_DRAWINGS = 28; // Varsayılan (4x7 ızgara)
let aiEnabled = false;  // 🤖 AI motif KAPALI — applyWovenEnhancement orijinal şekli koruyarak kilim tarzına dönüştürüyor

// Her çizim: { id, dataUrl, x, y, width, height, rotation, timestamp }
let drawings = [];

// 💾 VERİ YÜKLEME
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data.drawings) {
        drawings = data.drawings;
        console.log(`💾 ${drawings.length} çizim yüklendi.`);
      }
    } catch (e) {
      console.error('Veri yükleme hatası:', e);
    }
  }
}
loadData();

// 💾 VERİ KAYDETME (Throttled)
let saveTimeout = null;
function saveData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify({ drawings }));
    } catch (e) {
      console.error('Veri kaydetme hatası:', e);
    }
  }, 2000);
}

// 🎯 Dinamik ızgara yerleştirme (dokumacı sayısına göre otomatik boyut)
// 4224x1536 ekran için optimize — halı texture boyutu (LANDSCAPE)
const TEX_W = 4224;
const TEX_H = 2534;
const PAD = 5;

// Dokumacı sayısına göre en uygun ızgara düzenini hesapla
function getGridLayout(maxDrawings) {
  const aspect = TEX_W / TEX_H;

  let bestCols = 1, bestRows = maxDrawings;
  let bestWaste = Infinity;

  for (let cols = 1; cols <= maxDrawings; cols++) {
    const rows = Math.ceil(maxDrawings / cols);
    const cellW = (TEX_W - PAD * 2) / cols;
    const cellH = (TEX_H - PAD * 2) / rows;
    const cellAspect = cellW / cellH;
    const waste = Math.abs(cellAspect - 1.0) + Math.abs(cols * rows - maxDrawings) * 0.01;
    if (waste < bestWaste) {
      bestWaste = waste;
      bestCols = cols;
      bestRows = rows;
    }
  }

  const cellW = Math.floor((TEX_W - PAD * 2) / bestCols);
  const cellH = Math.floor((TEX_H - PAD * 2) / bestRows);

  return { cols: bestCols, rows: bestRows, cellW, cellH };
}

function getGridPlacement(index) {
  const { cols, rows, cellW, cellH } = getGridLayout(MAX_DRAWINGS);
  const slot = index % (cols * rows);
  const col = slot % cols;
  const row = Math.floor(slot / cols);

  return {
    x: PAD + col * cellW,
    y: PAD + row * cellH,
    width: cellW,
    height: cellH,
    rotation: 0,
  };
}

// ============================================================================
// SOCKET.IO
// ============================================================================

let clientCount = 0;
const lastDrawingTime = new Map(); // Rate limiting: socketId → timestamp
const RATE_LIMIT_MS = 10000; // 10 saniye

io.on('connection', (socket) => {
  clientCount++;
  console.log('🦅 Bir dokumacı bağlandı:', socket.id);
  io.emit('client-count', clientCount);

  // 📡 İstemciye IP adresini gönder
  socket.emit('server-ip', { ip: LOCAL_IP, port: PORT });

  // Mevcut çizimleri gönder
  socket.emit('initial-carpet', { drawings });
  socket.emit('drawing-count', drawings.length);
  socket.emit('client-count', clientCount);

  // 🔑 Bileşen geç mount olduğunda veriyi tekrar iste
  socket.on('request-initial-carpet', () => {
    console.log(`🔄 ${socket.id} halı verisini tekrar istedi`);
    socket.emit('initial-carpet', { drawings });
    socket.emit('drawing-count', drawings.length);
  });

  // ⚙️ Max drawing sayısını değiştir + mevcut çizimleri yeniden yerleştir
  socket.on('set-max-drawings', (val) => {
    const num = parseInt(val);
    if (num >= 12 && num <= 60) {
      MAX_DRAWINGS = num;
      console.log(`⚙️ Max dokumacı sayısı: ${MAX_DRAWINGS}`);

      // 🔄 Mevcut çizimlerin yerleşimini yeniden hesapla
      drawings = drawings.slice(0, MAX_DRAWINGS).map((d, i) => {
        const placement = getGridPlacement(i);
        return { ...d, ...placement };
      });

      // Tüm client'lara güncel halıyı gönder (sıfırla + yeniden çiz)
      io.emit('carpet-reset');
      io.emit('initial-carpet', { drawings });
      io.emit('drawing-count', drawings.length);
      saveData();

      console.log(`🔄 ${drawings.length} çizim yeniden yerleştirildi.`);
    }
  });

  // 🎨 Yeni çizim geldi
  socket.on('drawing-data', (payload) => {
    // Backward compat: eski format string, yeni format obje
    let dataUrl, userName;
    if (typeof payload === 'string') {
      dataUrl = payload;
      userName = 'Anonim';
    } else {
      dataUrl = payload?.dataUrl;
      userName = payload?.userName || 'Anonim';
    }

    if (!dataUrl || typeof dataUrl !== 'string') return;

    // ⏱️ Rate limiting — aynı kullanıcıdan max 1 çizim/3sn
    const now = Date.now();
    const lastTime = lastDrawingTime.get(socket.id) || 0;
    if (now - lastTime < 3000) {
      socket.emit('rate-limited', { waitMs: 3000 - (now - lastTime) });
      return;
    }
    lastDrawingTime.set(socket.id, now);

    // Max sınırı kontrol et
    if (drawings.length >= MAX_DRAWINGS) {
      console.log('🎉 Halı tamamlandı! Kutlama gönderiliyor...');
      io.emit('carpet-complete', { total: MAX_DRAWINGS });
      return;
    }

    const placement = getGridPlacement(drawings.length);
    const drawing = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      dataUrl,
      userName,
      aiDataUrl: null,
      aiStatus: 'none',
      ...placement,
      timestamp: Date.now()
    };

    drawings.push(drawing);
    saveData();

    // Tüm host'lara yeni çizimi gönder (orijinal)
    io.emit('new-drawing', drawing);
    io.emit('drawing-count', drawings.length);

    // Son çizim mi? Tamamlanma kontrolü
    if (drawings.length >= MAX_DRAWINGS) {
      console.log('🎉 Halı tamamlandı! Kutlama gönderiliyor...');
      setTimeout(() => io.emit('carpet-complete', { total: MAX_DRAWINGS }), 500);
    }

    console.log(`🎨 Yeni çizim! [${userName}] Toplam: ${drawings.length}/${MAX_DRAWINGS}`);

    // 🤖 AI motif dönüşümü (async — bloklamaz)
    if (aiEnabled) {
      drawing.aiStatus = 'processing';
      io.emit('ai-processing', { drawingId: drawing.id });
      io.emit('ai-status', getAIStatus());

      transformToMotif(dataUrl)
        .then(aiDataUrl => {
          if (aiDataUrl) {
            drawing.aiDataUrl = aiDataUrl;
            drawing.aiStatus = 'done';
            io.emit('ai-drawing-ready', {
              id: drawing.id,
              aiDataUrl,
              userName: drawing.userName,
              x: drawing.x,
              y: drawing.y,
              width: drawing.width,
              height: drawing.height
            });
            console.log(`🤖✅ AI motif hazır: ${drawing.id.substring(0, 15)}`);
            saveData();
          } else {
            drawing.aiStatus = 'failed';
            console.log(`🤖❌ AI motif başarısız: ${drawing.id.substring(0, 15)}`);
          }
          io.emit('ai-status', getAIStatus());
        })
        .catch(err => {
          drawing.aiStatus = 'failed';
          console.error('🤖❌ AI pipeline hatası:', err.message);
          io.emit('ai-status', getAIStatus());
        });
    }
  });

  // 🤖 AI motif modu aç/kapa
  socket.on('toggle-ai', (enabled) => {
    aiEnabled = !!enabled;
    console.log(`🤖 AI motif modu: ${aiEnabled ? 'AÇIK' : 'KAPALI'}`);
    io.emit('ai-mode', aiEnabled);
  });

  // 🤖 AI durum sorgulama
  socket.on('get-ai-status', () => {
    socket.emit('ai-status', getAIStatus());
    socket.emit('ai-mode', aiEnabled);
  });

  // 🧹 Manuel sıfırlama
  socket.on('manual-reset', () => {
    console.log('🧹 MANUEL TEMİZLİK EMRİ GELDİ!');
    drawings = [];
    io.emit('carpet-reset');
    io.emit('drawing-count', 0);
    saveData();
    console.log('✨ Sunucu hafızası sıfırlandı.');
  });

  socket.on('disconnect', () => {
    clientCount--;
    lastDrawingTime.delete(socket.id);
    io.emit('client-count', clientCount);
  });

  // 📱 Telefondan halı görüntüsü isteği (socket.io üzerinden — firewall sorunu yok)
  socket.on('request-carpet-image', () => {
    const imgPath = path.join(__dirname, 'carpet_latest.png');
    if (fs.existsSync(imgPath)) {
      const base64 = fs.readFileSync(imgPath, 'base64');
      socket.emit('carpet-image-data', `data:image/png;base64,${base64}`);
      console.log('📱 Halı görüntüsü telefona gönderildi!');
    } else {
      socket.emit('carpet-image-data', null);
    }
  });

  // 📸 Halı görüntüsünü kaydet (kutlama anında host'tan gelir)
  socket.on('carpet-image-save', (dataUrl) => {
    try {
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(path.join(__dirname, 'carpet_latest.png'), base64, 'base64');
      console.log('📸 Halı görüntüsü kaydedildi!');
    } catch (err) {
      console.error('❌ Halı görüntüsü kaydetme hatası:', err.message);
    }
  });
});

// 📥 Halı görüntüsü indirme endpoint'i
app.get('/carpet-image', (req, res) => {
  const imgPath = path.join(__dirname, 'carpet_latest.png');
  if (fs.existsSync(imgPath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="dijital_motif.png"');
    res.sendFile(imgPath);
  } else {
    res.status(404).send('Henüz halı görüntüsü yok.');
  }
});

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`🦅 Halı Tezgahı Sunucusu ${PORT} portunda çalışıyor...`);
});
