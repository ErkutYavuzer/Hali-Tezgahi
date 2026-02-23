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
const ARCHIVE_FILE = path.join(__dirname, 'archive_data.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions_data.json');

// 📁 Motif dosyaları dizini
const MOTIFS_DIR = process.env.MOTIFS_DIR || path.join(__dirname, 'motifs');
if (!fs.existsSync(MOTIFS_DIR)) fs.mkdirSync(MOTIFS_DIR, { recursive: true });

// 📁 Arşiv dizini (silinmiş dosyalar taşınır)
const ARCHIVE_DIR = path.join(MOTIFS_DIR, 'archive');
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

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
app.get('/', (req, res) => res.send('🧶 Halı Tezgahı Sunucusu çalışıyor!'));

// Health check for K8s
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// 🖼️ Motif dosyalarını statik sunma
app.use('/motifs', express.static(MOTIFS_DIR));

// 📸 Tüm motifleri listele (galeri API)
app.get('/api/motifs', (req, res) => {
  const motifList = drawings
    .filter(d => d.aiFile || d.aiDataUrl)
    .map(d => ({
      id: d.id,
      userName: d.userName || 'Anonim',
      timestamp: d.timestamp,
      aiFile: d.aiFile || null,
      aiUrl: d.aiFile ? `/motifs/${d.aiFile}` : null,
      drawingFile: d.drawingFile || null,
      drawingUrl: d.drawingFile ? `/motifs/${d.drawingFile}` : null,
    }));
  res.json({ total: motifList.length, motifs: motifList });
});

// 📥 Tek motif indirme
app.get('/api/motifs/:id/download', (req, res) => {
  const drawing = drawings.find(d => d.id === req.params.id);
  if (!drawing || !drawing.aiFile) {
    return res.status(404).json({ error: 'Motif bulunamadı' });
  }
  const filePath = path.join(MOTIFS_DIR, drawing.aiFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Motif dosyası bulunamadı' });
  }
  const safeName = (drawing.userName || 'motif').replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ_-]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="kilim_${safeName}_${drawing.id}.png"`);
  res.sendFile(filePath);
});

// 🖼️ Galeri sayfası (basit HTML)
app.get('/galeri', (req, res) => {
  res.redirect('/?role=gallery');
});

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
let aiEnabled = true;  // 🤖 AI motif AKTİF — Gemini native image generation ile çizim → kilim dönüşümü

// Her çizim: { id, dataUrl, x, y, width, height, rotation, timestamp }
let drawings = [];
let archive = [];
let sessions = [];

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
  if (fs.existsSync(ARCHIVE_FILE)) {
    try {
      archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8')).archive || [];
      console.log(`📦 ${archive.length} arşiv kaydı yüklendi.`);
    } catch (e) { archive = []; }
  }
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')).sessions || [];
      console.log(`📋 ${sessions.length} oturum kaydı yüklendi.`);
    } catch (e) { sessions = []; }
  }
}
loadData();

// 💾 VERİ KAYDETME (Throttled)
let saveTimeout = null;
function saveData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const lightDrawings = drawings.map(d => ({
        id: d.id,
        userName: d.userName,
        drawingFile: d.drawingFile || null,
        aiFile: d.aiFile || null,
        aiStatus: d.aiStatus,
        x: d.x, y: d.y, width: d.width, height: d.height,
        rotation: d.rotation,
        timestamp: d.timestamp,
      }));
      fs.writeFileSync(DATA_FILE, JSON.stringify({ drawings: lightDrawings }));
    } catch (e) {
      console.error('Veri kaydetme hatası:', e);
    }
  }, 2000);
}

function saveArchive() {
  try { fs.writeFileSync(ARCHIVE_FILE, JSON.stringify({ archive })); }
  catch (e) { console.error('Arşiv kaydetme hatası:', e); }
}

function saveSessions() {
  try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify({ sessions })); }
  catch (e) { console.error('Oturum kaydetme hatası:', e); }
}

// 📦 Çizimi arşive taşı (dosyaları silme, archive/ klasörüne kopyala)
function archiveDrawing(drawing, reason = 'admin-delete') {
  const archiveEntry = {
    ...drawing,
    deletedAt: Date.now(),
    deleteReason: reason,
    archivedDrawingFile: null,
    archivedAiFile: null,
  };
  // Dosyaları archive/ klasörüne taşı
  if (drawing.drawingFile) {
    const src = path.join(MOTIFS_DIR, drawing.drawingFile);
    const dest = path.join(ARCHIVE_DIR, drawing.drawingFile);
    if (fs.existsSync(src)) { try { fs.copyFileSync(src, dest); archiveEntry.archivedDrawingFile = drawing.drawingFile; } catch (e) { } }
  }
  if (drawing.aiFile) {
    const src = path.join(MOTIFS_DIR, drawing.aiFile);
    const dest = path.join(ARCHIVE_DIR, drawing.aiFile);
    if (fs.existsSync(src)) { try { fs.copyFileSync(src, dest); archiveEntry.archivedAiFile = drawing.aiFile; } catch (e) { } }
  }
  // dataUrl büyük olabilir, arşive kaydetme
  delete archiveEntry.dataUrl;
  delete archiveEntry.aiDataUrl;
  archive.push(archiveEntry);
  saveArchive();
  return archiveEntry;
}

// 💾 Base64 data URL'ü dosyaya kaydet
function saveBase64ToFile(base64DataUrl, filename) {
  try {
    const matches = base64DataUrl.match(/^data:image\/([a-z]+);base64,(.+)$/i);
    if (!matches) return null;
    const buffer = Buffer.from(matches[2], 'base64');
    const filePath = path.join(MOTIFS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return filename;
  } catch (err) {
    console.error(`Dosya kaydetme hatası (${filename}):`, err.message);
    return null;
  }
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
      drawingFile: null,
      aiDataUrl: null,
      aiFile: null,
      aiStatus: 'none',
      ...placement,
      timestamp: Date.now()
    };

    // 💾 Orijinal çizimi dosyaya kaydet
    const drawingFilename = `drawing_${drawing.id}.png`;
    const savedDrawing = saveBase64ToFile(dataUrl, drawingFilename);
    if (savedDrawing) {
      drawing.drawingFile = savedDrawing;
    }

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

      transformToMotif(dataUrl, drawing.userName)
        .then(aiDataUrl => {
          if (aiDataUrl) {
            // 💾 AI motifini dosyaya kaydet
            const motifFilename = `motif_${drawing.id}.png`;
            const savedMotif = saveBase64ToFile(aiDataUrl, motifFilename);

            if (savedMotif) {
              drawing.aiFile = savedMotif;
              console.log(`💾 Motif dosyaya kaydedildi: ${savedMotif}`);
            }

            drawing.aiDataUrl = aiDataUrl;
            drawing.aiStatus = 'done';
            io.emit('ai-drawing-ready', {
              id: drawing.id,
              aiDataUrl,
              aiFile: drawing.aiFile,
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

  // ═══════════════════════════════════════════════════
  // 🔐 ADMIN EVENT'LERİ
  // ═══════════════════════════════════════════════════

  const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

  function verifyAdmin(pin) {
    return pin === ADMIN_PIN;
  }

  function getDiskUsage() {
    try {
      const files = fs.readdirSync(MOTIFS_DIR);
      let totalSize = 0;
      files.forEach(f => {
        const stat = fs.statSync(path.join(MOTIFS_DIR, f));
        if (stat.isFile()) totalSize += stat.size;
      });
      return totalSize;
    } catch { return 0; }
  }

  // 🔐 Admin PIN doğrulama
  socket.on('admin:auth', ({ pin }) => {
    if (verifyAdmin(pin)) {
      socket.isAdmin = true;
      socket.emit('admin:auth-result', { success: true });
      // İlk veriyi gönder
      socket.emit('initial-carpet', { drawings });
      socket.emit('ai-status', getAIStatus());
      console.log(`🔐 Admin giriş başarılı: ${socket.id}`);
    } else {
      socket.isAdmin = false;
      socket.emit('admin:auth-result', { success: false, error: 'Yanlış PIN' });
      console.warn(`🔐❌ Admin giriş başarısız: ${socket.id}`);
    }
  });

  // 📊 İstatistik
  socket.on('admin:get-stats', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    // Kullanıcı çizim istatistiklerini hesapla
    const userStats = {};
    const timeline = [];

    drawings.forEach(d => {
      // Leaderboard için:
      const uname = d.userName || 'Anonim';
      if (!userStats[uname]) {
        userStats[uname] = { count: 1, lastActive: d.timestamp };
      } else {
        userStats[uname].count += 1;
        if (d.timestamp > userStats[uname].lastActive) {
          userStats[uname].lastActive = d.timestamp;
        }
      }

      // Timeline için (son 20 çizim):
      timeline.push({ id: d.id, userName: uname, timestamp: d.timestamp });
    });

    const leaderboard = Object.keys(userStats)
      .map(k => ({ userName: k, ...userStats[k] }))
      .sort((a, b) => b.count - a.count);

    const recentTimeline = timeline
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    socket.emit('admin:stats', {
      drawingCount: drawings.length,
      maxDrawings: MAX_DRAWINGS,
      aiEnabled,
      aiDone: drawings.filter(d => d.aiStatus === 'done').length,
      aiFailed: drawings.filter(d => d.aiStatus === 'failed').length,
      aiProcessing: drawings.filter(d => d.aiStatus === 'processing').length,
      clientCount,
      diskUsage: getDiskUsage(),
      leaderboard,
      recentTimeline
    });
  });

  // 🗑️ Tek çizim sil (SOFT DELETE → arşive taşı)
  socket.on('admin:delete-drawing', ({ id, pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    const idx = drawings.findIndex(d => d.id === id);
    if (idx === -1) return socket.emit('admin:error', { message: 'Çizim bulunamadı' });

    const drawing = drawings[idx];

    // 📦 Arşive taşı (dosyalar korunur)
    archiveDrawing(drawing, 'admin-delete');

    // Aktif dizinden dosyaları sil
    if (drawing.drawingFile) {
      const p = path.join(MOTIFS_DIR, drawing.drawingFile);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (drawing.aiFile) {
      const p = path.join(MOTIFS_DIR, drawing.aiFile);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    // Diziden çıkar
    drawings.splice(idx, 1);

    // Yerleşimleri yeniden hesapla
    drawings.forEach((d, i) => {
      const placement = getGridPlacement(i);
      Object.assign(d, placement);
    });

    saveData();

    // Tüm client'lara bildir
    io.emit('admin:drawing-deleted', { id });
    io.emit('carpet-reset');
    io.emit('initial-carpet', { drawings });
    io.emit('drawing-count', drawings.length);

    console.log(`🗑️ Admin çizim sildi (arşive taşındı): ${id}`);
  });

  // 🗑️ Tüm çizimleri sil (Hepsi arşive taşınır)
  socket.on('admin:delete-all', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    // Hepsini arşive taşı
    drawings.forEach(d => archiveDrawing(d, 'admin-delete-all'));

    // Aktif dizinden dosyaları sil
    drawings.forEach(d => {
      if (d.drawingFile) {
        const p = path.join(MOTIFS_DIR, d.drawingFile);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      if (d.aiFile) {
        const p = path.join(MOTIFS_DIR, d.aiFile);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    });

    drawings = [];
    saveData();

    io.emit('admin:all-deleted', {});
    io.emit('carpet-reset');
    io.emit('initial-carpet', { drawings });
    io.emit('drawing-count', 0);

    console.log('🗑️ Admin tüm çizimleri sildi (arşive taşındı)!');
  });

  // 🔄 AI yeniden çalıştır
  socket.on('admin:retry-ai', ({ id, pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    const drawing = drawings.find(d => d.id === id);
    if (!drawing) return socket.emit('admin:error', { message: 'Çizim bulunamadı' });
    if (!drawing.dataUrl && !drawing.drawingFile) {
      return socket.emit('admin:error', { message: 'Orijinal çizim verisi yok' });
    }

    // Orijinal çizimi oku
    let dataUrl = drawing.dataUrl;
    if (!dataUrl && drawing.drawingFile) {
      const p = path.join(MOTIFS_DIR, drawing.drawingFile);
      if (fs.existsSync(p)) {
        const b64 = fs.readFileSync(p, 'base64');
        dataUrl = `data:image/png;base64,${b64}`;
      }
    }

    if (!dataUrl) return socket.emit('admin:error', { message: 'Çizim dosyası bulunamadı' });

    drawing.aiStatus = 'processing';
    io.emit('ai-processing', { drawingId: drawing.id });

    transformToMotif(dataUrl, drawing.userName)
      .then(aiDataUrl => {
        if (aiDataUrl) {
          const motifFilename = `motif_${drawing.id}.png`;
          const savedMotif = saveBase64ToFile(aiDataUrl, motifFilename);
          if (savedMotif) drawing.aiFile = savedMotif;

          drawing.aiDataUrl = aiDataUrl;
          drawing.aiStatus = 'done';
          io.emit('ai-drawing-ready', {
            id: drawing.id, aiDataUrl, aiFile: drawing.aiFile,
            userName: drawing.userName,
            x: drawing.x, y: drawing.y, width: drawing.width, height: drawing.height,
          });
          saveData();
          console.log(`🔄✅ Admin AI retry başarılı: ${drawing.id}`);
        } else {
          drawing.aiStatus = 'failed';
        }
      })
      .catch(() => { drawing.aiStatus = 'failed'; });
  });

  // ⚙️ Max çizim (admin)
  socket.on('admin:set-max', ({ value, pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    const num = parseInt(value);
    if (num >= 12 && num <= 60) {
      MAX_DRAWINGS = num;
      drawings = drawings.slice(0, MAX_DRAWINGS).map((d, i) => {
        const placement = getGridPlacement(i);
        return { ...d, ...placement };
      });
      io.emit('carpet-reset');
      io.emit('initial-carpet', { drawings });
      io.emit('drawing-count', drawings.length);
      saveData();
      console.log(`⚙️ Admin max çizim: ${MAX_DRAWINGS}`);
    }
  });

  // 🤖 AI toggle (admin)
  socket.on('admin:toggle-ai', ({ enabled, pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    aiEnabled = !!enabled;
    io.emit('ai-mode', aiEnabled);
    console.log(`🤖 Admin AI modu: ${aiEnabled ? 'AÇIK' : 'KAPALI'}`);
  });

  // 🔄 Halıyı sıfırla (admin) — oturum geçmişine kaydet
  socket.on('admin:reset-carpet', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    // 📋 Mevcut oturumu kaydet
    if (drawings.length > 0) {
      const uniqueUsers = [...new Set(drawings.map(d => d.userName || 'Anonim'))];
      const sessionEntry = {
        sessionId: `session_${Date.now()}`,
        startedAt: drawings.reduce((min, d) => d.timestamp < min ? d.timestamp : min, Infinity),
        endedAt: Date.now(),
        totalDrawings: drawings.length,
        aiSuccessCount: drawings.filter(d => d.aiStatus === 'done').length,
        aiFailedCount: drawings.filter(d => d.aiStatus === 'failed').length,
        uniqueUsers,
        userCount: uniqueUsers.length,
        drawings: drawings.map(d => ({ id: d.id, userName: d.userName, aiStatus: d.aiStatus, timestamp: d.timestamp })),
      };
      sessions.push(sessionEntry);
      saveSessions();
      console.log(`📋 Oturum kaydedildi: ${sessionEntry.sessionId} (${sessionEntry.totalDrawings} çizim, ${sessionEntry.userCount} kullanıcı)`);
    }

    // Tüm çizimleri arşive taşı
    drawings.forEach(d => archiveDrawing(d, 'session-reset'));

    // Aktif dosyaları sil (archive/ hariç)
    try {
      const files = fs.readdirSync(MOTIFS_DIR);
      files.forEach(f => {
        if (f === 'archive') return; // archive/ klasörüne dokunma
        const p = path.join(MOTIFS_DIR, f);
        if (fs.statSync(p).isFile()) fs.unlinkSync(p);
      });
    } catch (err) {
      console.error('Dosya silme hatası:', err.message);
    }

    drawings = [];
    saveData();

    io.emit('admin:all-deleted', {});
    io.emit('carpet-reset');
    io.emit('initial-carpet', { drawings });
    io.emit('drawing-count', 0);

    console.log('🔄 Admin halıyı sıfırladı — yeni oturum!');
  });

  // ═══════════════════════════════════════════════════
  // 📦 ARŞİV & OTURUM & KULLANICI EVENT'LERİ
  // ═══════════════════════════════════════════════════

  // 📦 Arşiv listesini getir
  socket.on('admin:get-archive', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    socket.emit('admin:archive', { archive });
  });

  // 📦 Arşivden geri yükle
  socket.on('admin:restore-drawing', ({ id, pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    const idx = archive.findIndex(a => a.id === id);
    if (idx === -1) return socket.emit('admin:error', { message: 'Arşiv kaydı bulunamadı' });

    if (drawings.length >= MAX_DRAWINGS) {
      return socket.emit('admin:error', { message: 'Halı dolu — geri yükleme yapılamaz' });
    }

    const archivedEntry = archive[idx];

    // Dosyaları archive/'den motifs/ dizinine geri kopyala
    if (archivedEntry.archivedDrawingFile) {
      const src = path.join(ARCHIVE_DIR, archivedEntry.archivedDrawingFile);
      const dest = path.join(MOTIFS_DIR, archivedEntry.archivedDrawingFile);
      if (fs.existsSync(src)) { try { fs.copyFileSync(src, dest); } catch (e) { } }
    }
    if (archivedEntry.archivedAiFile) {
      const src = path.join(ARCHIVE_DIR, archivedEntry.archivedAiFile);
      const dest = path.join(MOTIFS_DIR, archivedEntry.archivedAiFile);
      if (fs.existsSync(src)) { try { fs.copyFileSync(src, dest); } catch (e) { } }
    }

    // Yeni placement hesapla
    const placement = getGridPlacement(drawings.length);
    const restoredDrawing = {
      id: archivedEntry.id,
      userName: archivedEntry.userName,
      drawingFile: archivedEntry.drawingFile,
      aiFile: archivedEntry.aiFile,
      aiStatus: archivedEntry.aiStatus || 'none',
      ...placement,
      timestamp: archivedEntry.timestamp,
    };

    drawings.push(restoredDrawing);
    archive.splice(idx, 1);
    saveData();
    saveArchive();

    // Tüm client'lara bildir
    io.emit('new-drawing', restoredDrawing);
    io.emit('drawing-count', drawings.length);
    socket.emit('admin:archive', { archive });

    console.log(`📦 Arşivden geri yüklendi: ${id}`);
  });

  // 📦 Arşivden kalıcı sil (hard delete)
  socket.on('admin:hard-delete', ({ id, pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    const idx = archive.findIndex(a => a.id === id);
    if (idx === -1) return socket.emit('admin:error', { message: 'Arşiv kaydı bulunamadı' });

    const entry = archive[idx];
    // Arşiv dosyalarını sil
    if (entry.archivedDrawingFile) {
      const p = path.join(ARCHIVE_DIR, entry.archivedDrawingFile);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (entry.archivedAiFile) {
      const p = path.join(ARCHIVE_DIR, entry.archivedAiFile);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    archive.splice(idx, 1);
    saveArchive();
    socket.emit('admin:archive', { archive });
    console.log(`🗑️ Arşivden kalıcı silindi: ${id}`);
  });

  // 📋 Oturum geçmişini getir
  socket.on('admin:get-sessions', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    socket.emit('admin:sessions', { sessions });
  });

  // 👥 Kullanıcı profili (tüm aktif + arşiv verileri)
  socket.on('admin:get-users', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    const userMap = {};
    const processDrawing = (d, source) => {
      const name = d.userName || 'Anonim';
      if (!userMap[name]) userMap[name] = { userName: name, activeCount: 0, archivedCount: 0, aiDone: 0, aiFailed: 0, firstSeen: d.timestamp, lastSeen: d.timestamp };
      const u = userMap[name];
      if (source === 'active') u.activeCount++; else u.archivedCount++;
      if (d.aiStatus === 'done') u.aiDone++;
      if (d.aiStatus === 'failed') u.aiFailed++;
      if (d.timestamp < u.firstSeen) u.firstSeen = d.timestamp;
      if (d.timestamp > u.lastSeen) u.lastSeen = d.timestamp;
    };

    drawings.forEach(d => processDrawing(d, 'active'));
    archive.forEach(d => processDrawing(d, 'archive'));

    const users = Object.values(userMap)
      .map(u => ({ ...u, totalCount: u.activeCount + u.archivedCount, aiSuccessRate: u.aiDone + u.aiFailed > 0 ? Math.round((u.aiDone / (u.aiDone + u.aiFailed)) * 100) : 0 }))
      .sort((a, b) => b.totalCount - a.totalCount);

    socket.emit('admin:users', { users, totalUniqueUsers: users.length });
  });

  // ═══════════════════════════════════════════════════

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
