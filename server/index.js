import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import archiver from 'archiver';
import sharp from 'sharp';
import { transformToMotif, getAIStatus, getTransformPrompt, setTransformPrompt } from './ai-motif.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📁 Motif dosyaları dizini (PVC mount — kalıcı depolama)
const MOTIFS_DIR = process.env.MOTIFS_DIR || path.join(__dirname, 'motifs');
if (!fs.existsSync(MOTIFS_DIR)) fs.mkdirSync(MOTIFS_DIR, { recursive: true });

// 📁 Arşiv dizini (silinmiş dosyalar taşınır)
const ARCHIVE_DIR = path.join(MOTIFS_DIR, 'archive');
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

// 💾 JSON veri dosyaları — PVC'de saklanır (pod restart'ta korunur)
const DATA_FILE = path.join(MOTIFS_DIR, 'carpet_data.json');
const ARCHIVE_FILE = path.join(MOTIFS_DIR, 'archive_data.json');
const SESSIONS_FILE = path.join(MOTIFS_DIR, 'sessions_data.json');

// 🔄 Eski konumdan otomatik migrasyon (bir kerelik)
function migrateOldData() {
  const oldFiles = [
    { old: path.join(__dirname, 'carpet_data.json'), new: DATA_FILE },
    { old: path.join(__dirname, 'archive_data.json'), new: ARCHIVE_FILE },
    { old: path.join(__dirname, 'sessions_data.json'), new: SESSIONS_FILE },
  ];
  for (const f of oldFiles) {
    if (fs.existsSync(f.old) && !fs.existsSync(f.new)) {
      try {
        fs.copyFileSync(f.old, f.new);
        console.log(`🔄 Migrasyon: ${path.basename(f.old)} → PVC'ye taşındı`);
      } catch (e) { console.error(`Migrasyon hatası: ${e.message}`); }
    }
  }
}
migrateOldData();

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

// 📦 Arşiv toplu ZIP indirme
app.get('/api/archive/download', (req, res) => {
  const ids = (req.query.ids || '').split(',').filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: 'ID listesi gerekli' });

  const ARCHIVE_DIR = path.join(MOTIFS_DIR, 'archive');
  const zip = archiver('zip', { zlib: { level: 5 } });
  const timestamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="hali-arsiv-${timestamp}.zip"`);
  zip.pipe(res);

  let count = 0;
  for (const id of ids) {
    const entry = archive.find(a => a.id === id || a.originalId === id);
    if (!entry) continue;
    // Arşivdeki dosyaları ekle
    const files = [entry.archivedFile, entry.archivedAiFile].filter(Boolean);
    for (const f of files) {
      const fp = path.join(ARCHIVE_DIR, f);
      if (fs.existsSync(fp)) { zip.file(fp, { name: f }); count++; }
    }
    // Orijinal dosyalar (eski format)
    if (entry.drawingFile) {
      const fp = path.join(MOTIFS_DIR, entry.drawingFile);
      if (fs.existsSync(fp)) { zip.file(fp, { name: entry.drawingFile }); count++; }
    }
  }

  if (count === 0) { res.status(404).json({ error: 'Dosya bulunamadı' }); return; }
  zip.finalize();
});

// 📋 Oturum indirme (tüm motifleri tek zip)
app.get('/api/sessions/:id/download', (req, res) => {
  const session = sessions.find(s => s.sessionId === req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı' });

  const files = Array.isArray(session.files) ? session.files : [];
  if (files.length === 0) return res.status(404).json({ error: 'Oturum dosyası yok' });

  const zip = archiver('zip', { zlib: { level: 5 } });
  const safeId = session.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="hali-oturum-${safeId}.zip"`);
  zip.pipe(res);

  zip.append(JSON.stringify(session, null, 2), { name: 'session.json' });

  files.forEach((f) => {
    const fp = path.join(ARCHIVE_DIR, f);
    if (fs.existsSync(fp)) zip.file(fp, { name: f });
  });

  zip.finalize();
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
let events = [];   // 🆕 Etkinlik listesi
let activityFeed = []; // Son aktivite kayıtları (max 50)

// 📢 Aktivite feed'e ekle ve admin'lere bildir
function emitActivity(type, message, extra = {}) {
  const entry = { type, message, timestamp: Date.now(), ...extra };
  activityFeed.unshift(entry);
  if (activityFeed.length > 50) activityFeed = activityFeed.slice(0, 50);
  io.emit('admin:activity', entry);
}

// 🎨 Prompt preset'leri
const PROMPT_PRESETS = [
  {
    id: 'kilim-classic',
    name: '🏺 Klasik Kilim',
    prompt: `Transform this freehand drawing into a traditional Anatolian Turkish kilim carpet motif.\n\nCRITICAL RULES:\n1. KEEP the same subject/shape from the drawing — if it's a house, make a kilim house motif. If it's a cat, make a kilim cat motif. DO NOT change the subject.\n2. Convert the lines and shapes into geometric kilim style: use stepped lines, diamonds, triangles, zigzag edges\n3. Use traditional Turkish kilim color palette: deep reds, navy blue, gold/saffron, cream, dark brown, forest green\n4. Keep the original composition and positioning\n5. Add a small decorative kilim border frame\n6. Fill background with cream/natural wool color\n7. Flat, textile-like coloring — no gradients, no 3D effects, no photorealism\n8. The result should look like it was hand-woven on a carpet loom with visible thread texture and slight raised embossed relief\n9. Make the motif warm, symmetric where possible, and authentically Turkish\n10. Output a clean, square image`
  },
  {
    id: 'cini-iznik',
    name: '🔵 İznik Çini',
    prompt: `Transform this freehand drawing into an İznik-style Turkish ceramic tile motif.\n\nCRITICAL RULES:\n1. KEEP the same subject/shape from the drawing — preserve the original concept\n2. Convert to traditional İznik ceramic style: flowing tulips, carnations, arabesques, intertwining vines\n3. Use classic İznik color palette: cobalt blue, turquoise, coral red, emerald green on white background\n4. Add traditional border pattern with repeating motifs\n5. Flat, hand-painted ceramic look — visible brush strokes\n6. Symmetric and balanced composition\n7. White ceramic background with glossy appearance\n8. No 3D effects, maintain flat tile aesthetic\n9. Output a clean, square image`
  },
  {
    id: 'modern-geo',
    name: '✨ Modern Geometrik',
    prompt: `Transform this freehand drawing into a modern geometric art piece inspired by Turkish patterns.\n\nCRITICAL RULES:\n1. KEEP the same subject/shape from the drawing — preserve the concept\n2. Convert to clean geometric shapes: triangles, hexagons, clean lines, minimal curves\n3. Use a modern color palette: soft pastels, muted gold, charcoal, ivory, sage green\n4. Minimalist composition with generous white space\n5. Subtle geometric border\n6. Clean, contemporary aesthetic — blend of Turkish motifs with Scandinavian simplicity\n7. No 3D effects, flat vector-like style\n8. Output a clean, square image`
  },
  {
    id: 'ottoman-palace',
    name: '👑 Osmanlı Saray',
    prompt: `Transform this freehand drawing into a luxurious Ottoman palace art motif.\n\nCRITICAL RULES:\n1. KEEP the same subject/shape from the drawing — preserve the concept\n2. Convert to ornate Ottoman style: heavy gold gilding, intricate scrollwork, rumi motifs, hatai flowers\n3. Use Ottoman palace palette: rich gold, deep burgundy, midnight blue, ivory, emerald\n4. Add ornate baroque-influenced border with gold details\n5. Luxurious, regal appearance — like a miniature painting or illuminated manuscript\n6. Detailed textures suggesting gold leaf and fine brushwork\n7. Dark rich background (burgundy or navy) with gold motifs\n8. Output a clean, square image`
  }
];

// 🔄 Başlangıçta kaydedilmiş prompt'u yükle
const PROMPT_FILE = path.join(MOTIFS_DIR, 'prompt_data.json');
if (fs.existsSync(PROMPT_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(PROMPT_FILE, 'utf-8'));
    if (saved.prompt) {
      setTransformPrompt(saved.prompt);
      console.log('🎨 Kaydedilmiş AI prompt yüklendi.');
    }
  } catch (e) { /* default prompt kalır */ }
}

// 📁 Snapshot dizini
const SNAPSHOTS_DIR = path.join(MOTIFS_DIR, 'snapshots');
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

// 📁 Events dosyası
const EVENTS_FILE = path.join(MOTIFS_DIR, 'events_data.json');

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
      if (data.maxDrawings && data.maxDrawings >= 12 && data.maxDrawings <= 60) {
        MAX_DRAWINGS = data.maxDrawings;
        console.log(`💾 Max dokumacı sayısı: ${MAX_DRAWINGS}`);
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
  if (fs.existsSync(EVENTS_FILE)) {
    try {
      events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8')).events || [];
      console.log(`🎪 ${events.length} etkinlik kaydı yüklendi.`);
    } catch (e) { events = []; }
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
      fs.writeFileSync(DATA_FILE, JSON.stringify({ drawings: lightDrawings, maxDrawings: MAX_DRAWINGS }));
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

function saveEvents() {
  try { fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events })); }
  catch (e) { console.error('Etkinlik kaydetme hatası:', e); }
}

// 📦 Çizimi arşive taşı (dosyaları kullanıcı adı ile birlikte sakla)
function archiveDrawing(drawing, reason = 'admin-delete') {
  const safeName = (drawing.userName || 'Anonim').replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]/g, '_').slice(0, 30);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prefix = `${safeName}_${ts}`;

  const archiveEntry = {
    ...drawing,
    deletedAt: Date.now(),
    deleteReason: reason,
    archivedDrawingFile: null,
    archivedAiFile: null,
  };

  // Orijinal çizimi archive/ klasörüne kopyala (kullanıcı adı ile)
  if (drawing.drawingFile) {
    const src = path.join(MOTIFS_DIR, drawing.drawingFile);
    const archiveName = `${prefix}_original.png`;
    const dest = path.join(ARCHIVE_DIR, archiveName);
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, dest); archiveEntry.archivedDrawingFile = archiveName; }
      catch (e) { console.error('Arşiv kopyalama hatası (orijinal):', e.message); }
    }
  }

  // AI motifini archive/ klasörüne kopyala (kullanıcı adı ile)
  if (drawing.aiFile) {
    const src = path.join(MOTIFS_DIR, drawing.aiFile);
    const archiveName = `${prefix}_motif.png`;
    const dest = path.join(ARCHIVE_DIR, archiveName);
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, dest); archiveEntry.archivedAiFile = archiveName; }
      catch (e) { console.error('Arşiv kopyalama hatası (motif):', e.message); }
    }
  }

  // base64 büyük olabilir, metadata'dan çıkar
  delete archiveEntry.dataUrl;
  delete archiveEntry.aiDataUrl;

  archive.push(archiveEntry);
  saveArchive();
  console.log(`📦 Arşive kaydedildi: [${safeName}] reason=${reason} (orijinal: ${archiveEntry.archivedDrawingFile ? '✅' : '❌'}, motif: ${archiveEntry.archivedAiFile ? '✅' : '❌'})`);
  return archiveEntry;
}

function createSessionFromDrawings(reason) {
  if (drawings.length === 0) return null;

  const sessionId = `session_${Date.now()}`;
  const archivedEntries = drawings.map(d => archiveDrawing(d, reason));
  const uniqueUsers = [...new Set(drawings.map(d => d.userName || 'Anonim'))];
  const files = new Set();
  const archiveIds = [];

  archivedEntries.forEach((entry) => {
    if (entry.archivedDrawingFile) files.add(entry.archivedDrawingFile);
    if (entry.archivedAiFile) files.add(entry.archivedAiFile);
    if (entry.id) archiveIds.push(entry.id);
  });

  let carpetFile = null;
  const carpetPath = path.join(__dirname, 'carpet_latest.png');
  if (fs.existsSync(carpetPath)) {
    const carpetArchiveName = `${sessionId}_carpet.png`;
    const carpetDest = path.join(ARCHIVE_DIR, carpetArchiveName);
    try {
      fs.copyFileSync(carpetPath, carpetDest);
      carpetFile = carpetArchiveName;
      files.add(carpetArchiveName);
    } catch (e) {
      console.error('Carpet snapshot kopyalama hatası:', e.message);
    }
  }

  const sessionEntry = {
    sessionId,
    reason,
    startedAt: drawings.reduce((min, d) => d.timestamp < min ? d.timestamp : min, Infinity),
    endedAt: Date.now(),
    totalDrawings: drawings.length,
    aiSuccessCount: drawings.filter(d => d.aiStatus === 'done').length,
    aiFailedCount: drawings.filter(d => d.aiStatus === 'failed').length,
    uniqueUsers,
    userCount: uniqueUsers.length,
    files: Array.from(files),
    carpetFile,
    archiveIds,
    drawings: drawings.map(d => ({
      id: d.id,
      userName: d.userName,
      aiStatus: d.aiStatus,
      timestamp: d.timestamp
    }))
  };

  sessions.push(sessionEntry);
  saveSessions();
  io.emit('admin:sessions', { sessions });
  io.emit('admin:archive', { archive });
  console.log(`📋 Oturum kaydedildi: ${sessionEntry.sessionId} (${sessionEntry.totalDrawings} çizim, ${sessionEntry.userCount} kullanıcı)`);
  return sessionEntry;
}

// 💾 Base64 data URL'ü dosyaya kaydet (opsiyonel sharp optimizasyonu)
function saveBase64ToFile(base64DataUrl, filename, optimize = false) {
  try {
    const matches = base64DataUrl.match(/^data:image\/([a-z]+);base64,(.+)$/i);
    if (!matches) return null;
    const buffer = Buffer.from(matches[2], 'base64');
    const filePath = path.join(MOTIFS_DIR, filename);

    if (optimize) {
      // 🚀 Async optimizasyon: sharp ile resize + JPEG dönüştürme
      sharp(buffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(filePath)
        .then(info => console.log(`🚀 Motif optimize edildi: ${filename} (${Math.round(info.size / 1024)}KB)`))
        .catch(err => {
          console.warn(`⚠️ Sharp optimizasyon hatası, orijinal kaydediliyor: ${err.message}`);
          fs.writeFileSync(filePath, buffer);
        });
    } else {
      fs.writeFileSync(filePath, buffer);
    }
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
    const waste = Math.abs(cellAspect - 1.0) + Math.abs(cols * rows - maxDrawings) * 0.5;
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
let lastCarpetImageAt = 0;
let pendingCarpetCapture = null;

function withLatestCarpetImage(actionLabel, fn) {
  const freshWindowMs = 1500;
  if (Date.now() - lastCarpetImageAt < freshWindowMs) {
    fn();
    return;
  }

  if (pendingCarpetCapture) {
    pendingCarpetCapture.queue.push(fn);
    return;
  }

  pendingCarpetCapture = { queue: [fn] };
  io.emit('request-carpet-image', { reason: actionLabel });
  setTimeout(() => {
    if (!pendingCarpetCapture) return;
    const { queue } = pendingCarpetCapture;
    pendingCarpetCapture = null;
    queue.forEach((cb) => {
      cb();
    });
  }, 1200);
}

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

      // 🎉 Max düşürüldüyse ve mevcut çizimler yeterli mi?
      const willCelebrate = drawings.length >= MAX_DRAWINGS;

      if (!willCelebrate) {
        // Normal güncelleme — çizimleri yeniden yerleştir
        io.emit('carpet-reset');
        io.emit('initial-carpet', { drawings });
      }

      io.emit('drawing-count', drawings.length);
      saveData();
      console.log(`🔄 ${drawings.length} çizim yeniden yerleştirildi.`);

      if (willCelebrate) {
        console.log('🎉 Max düşürüldü — halı tamamlandı! Kutlama gönderiliyor...');
        setTimeout(() => {
          io.emit('carpet-complete', { total: MAX_DRAWINGS });
          // 500ms sonra celebration replay başlat (hızlı)
          setTimeout(() => {
            io.emit('celebration-replay', { drawings });
          }, 500);
        }, 500);
      }
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
      setTimeout(() => {
        io.emit('carpet-complete', { total: MAX_DRAWINGS });
        // 500ms sonra celebration replay başlat
        setTimeout(() => {
          io.emit('celebration-replay', { drawings });
        }, 500);
      }, 500);
    }

    console.log(`🎨 Yeni çizim! [${userName}] Toplam: ${drawings.length}/${MAX_DRAWINGS}`);
    emitActivity('drawing', `${userName} yeni çizim yaptı`, { userName, drawingId: drawing.id });

    // 🤖 AI motif dönüşümü (async — bloklamaz)
    if (aiEnabled) {
      drawing.aiStatus = 'processing';
      io.emit('ai-processing', { drawingId: drawing.id });
      io.emit('ai-status', getAIStatus());

      transformToMotif(dataUrl, drawing.userName)
        .then(aiDataUrl => {
          if (aiDataUrl) {
            // 💾 AI motifini dosyaya kaydet
            const motifFilename = `motif_${drawing.id}.jpg`;
            const savedMotif = saveBase64ToFile(aiDataUrl, motifFilename, true);

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
            emitActivity('ai-success', `${drawing.userName} motifi hazır ✨`, { userName: drawing.userName, drawingId: drawing.id });
            saveData();
          } else {
            drawing.aiStatus = 'failed';
            console.log(`🤖❌ AI motif başarısız: ${drawing.id.substring(0, 15)}`);
            emitActivity('ai-failed', `${drawing.userName} motifi üretilemedi ⚠️`, { userName: drawing.userName, drawingId: drawing.id });
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

  // 🧹 Manuel sıfırlama (arşive kaydederek sil)
  socket.on('manual-reset', () => {
    console.log('🧹 MANUEL TEMİZLİK EMRİ GELDİ!');

    withLatestCarpetImage('manual-reset', () => {
      createSessionFromDrawings('manual-reset');

      // Aktif dosyaları sil (archive/ hariç)
      try {
        const files = fs.readdirSync(MOTIFS_DIR);
        files.forEach(f => {
          if (f === 'archive') return;
          const p = path.join(MOTIFS_DIR, f);
          if (fs.statSync(p).isFile()) fs.unlinkSync(p);
        });
      } catch (err) {
        console.error('Dosya silme hatası:', err.message);
      }

      drawings = [];
      io.emit('carpet-reset');
      io.emit('drawing-count', 0);
      saveData();
      console.log(`✨ Sunucu hafızası sıfırlandı. (${archive.length} kayıt arşivde)`);
    });
  });

  // ═══════════════════════════════════════════════════
  // 🔐 ADMIN EVENT'LERİ
  // ═══════════════════════════════════════════════════

  const ADMIN_PIN = process.env.ADMIN_PIN || '1234';
  const ADMIN_PIN_REQUIRED = (process.env.ADMIN_PIN_REQUIRED ?? 'true') !== 'false';

  function verifyAdmin(pin = '') {
    if (!ADMIN_PIN_REQUIRED) return true;
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
      console.log(`🔐 Admin giriş başarılı: ${socket.id}${ADMIN_PIN_REQUIRED ? '' : ' (passwordless)'}`);
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

    withLatestCarpetImage('admin-delete-all', () => {
      // Hepsini arşive taşı + oturum kaydı oluştur
      createSessionFromDrawings('admin-delete-all');

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
          const motifFilename = `motif_${drawing.id}.jpg`;
          const savedMotif = saveBase64ToFile(aiDataUrl, motifFilename, true);
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

  // 🎉 Kutlama QR overlay aç/kapat (admin → host)
  socket.on('admin:toggle-celebration-qr', ({ pin, show }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    io.emit('toggle-celebration-qr', { show: !!show });
    io.emit('admin:celebration-qr-state', { visible: !!show });
    emitActivity('admin', `Kutlama QR ${show ? 'açıldı' : 'kapatıldı'} 🎉`);
    console.log(`🎉 Admin kutlama QR: ${show ? 'AÇIK' : 'KAPALI'}`);
  });

  // 📡 Host celebration QR state sync (host → admin)
  socket.on('host:celebration-shown', ({ visible }) => {
    io.emit('admin:celebration-qr-state', { visible: !!visible });
    console.log(`📡 Host celebration QR state: ${visible ? 'GÖSTER' : 'KAPAT'}`);
  });

  // 🔄 Halıyı sıfırla (admin) — oturum geçmişine kaydet
  socket.on('admin:reset-carpet', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });

    withLatestCarpetImage('session-reset', () => {
      createSessionFromDrawings('session-reset');

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

  // 📢 Aktivite feed'i getir
  socket.on('admin:get-activity', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    socket.emit('admin:activity-feed', { activities: activityFeed });
  });

  // 🔄 Tüm başarısız motifleri yeniden dene
  socket.on('admin:retry-all-failed', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    const failed = drawings.filter(d => d.aiStatus === 'failed');
    if (failed.length === 0) {
      return socket.emit('admin:error', { message: 'Başarısız motif yok' });
    }
    let retryCount = 0;
    failed.forEach(d => {
      d.aiStatus = 'processing';
      retryCount++;
      transformToMotif(d.dataUrl || '', d.userName)
        .then(aiDataUrl => {
          if (aiDataUrl) {
            const motifFilename = `motif_${d.id}.jpg`;
            const savedMotif = saveBase64ToFile(aiDataUrl, motifFilename, true);
            if (savedMotif) d.aiFile = savedMotif;
            d.aiDataUrl = aiDataUrl;
            d.aiStatus = 'done';
            io.emit('ai-drawing-ready', { id: d.id, aiDataUrl, aiFile: d.aiFile, userName: d.userName, x: d.x, y: d.y, width: d.width, height: d.height });
            emitActivity('ai-success', `${d.userName} motifi yeniden üretildi ✨`, { userName: d.userName, drawingId: d.id });
            saveData();
          } else {
            d.aiStatus = 'failed';
            emitActivity('ai-failed', `${d.userName} retry başarısız ⚠️`, { userName: d.userName, drawingId: d.id });
          }
          io.emit('ai-status', getAIStatus());
        })
        .catch(() => { d.aiStatus = 'failed'; });
    });
    emitActivity('admin', `${retryCount} motif yeniden deneniyor 🔄`);
    socket.emit('admin:info', { message: `${retryCount} motif yeniden deneniyor...` });
    console.log(`🔄 Toplu retry: ${retryCount} motif`);
  });

  // 🎨 Prompt yönetimi
  socket.on('admin:get-prompt', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    socket.emit('admin:prompt', {
      prompt: getTransformPrompt(),
      presets: PROMPT_PRESETS
    });
  });

  socket.on('admin:update-prompt', ({ pin, prompt }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    if (!prompt || prompt.length < 20) return socket.emit('admin:error', { message: 'Prompt çok kısa (min 20 karakter)' });
    if (prompt.length > 3000) return socket.emit('admin:error', { message: 'Prompt çok uzun (max 3000 karakter)' });
    setTransformPrompt(prompt);
    // PVC'ye kaydet
    try {
      const promptFile = path.join(MOTIFS_DIR, 'prompt_data.json');
      fs.writeFileSync(promptFile, JSON.stringify({ prompt, updatedAt: Date.now() }));
    } catch (e) { console.error('Prompt kaydetme hatası:', e); }
    emitActivity('admin', 'AI prompt güncellendi 🎨');
    socket.emit('admin:prompt-updated', { success: true });
    addToast && socket.emit('admin:info', { message: 'AI prompt güncellendi!' });
    console.log('🎨 AI prompt güncellendi');
  });

  // 🎪 ETKİNLİK YÖNETİMİ
  socket.on('admin:get-events', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    socket.emit('admin:events', { events });
  });

  socket.on('admin:create-event', ({ pin, name, location }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    if (!name || name.trim().length < 2) return socket.emit('admin:error', { message: 'Etkinlik adı gerekli' });
    const evt = {
      id: `evt_${Date.now()}`,
      name: name.trim(),
      location: (location || '').trim(),
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      status: 'draft',
      stats: { totalDrawings: 0, aiSuccessCount: 0, aiFailedCount: 0, uniqueUsers: 0, snapshotFile: null }
    };
    events.unshift(evt);
    saveEvents();
    emitActivity('admin', `Yeni etkinlik oluşturuldu: ${evt.name} 🎪`);
    socket.emit('admin:events', { events });
    socket.emit('admin:info', { message: `"${evt.name}" oluşturuldu!` });
    console.log(`🎪 Etkinlik oluşturuldu: ${evt.name}`);
  });

  socket.on('admin:start-event', ({ pin, eventId }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    const evt = events.find(e => e.id === eventId);
    if (!evt) return socket.emit('admin:error', { message: 'Etkinlik bulunamadı' });
    if (evt.status === 'active') return socket.emit('admin:error', { message: 'Etkinlik zaten aktif' });
    // Diğer aktif etkinlikleri durdur
    events.forEach(e => { if (e.status === 'active') e.status = 'paused'; });
    evt.status = 'active';
    evt.startedAt = evt.startedAt || Date.now();
    saveEvents();
    emitActivity('admin', `Etkinlik başladı: ${evt.name} 🚀`);
    socket.emit('admin:events', { events });
    socket.emit('admin:info', { message: `"${evt.name}" başlatıldı!` });
    console.log(`🚀 Etkinlik başladı: ${evt.name}`);
  });

  socket.on('admin:end-event', ({ pin, eventId }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    const evt = events.find(e => e.id === eventId);
    if (!evt) return socket.emit('admin:error', { message: 'Etkinlik bulunamadı' });
    evt.status = 'completed';
    evt.endedAt = Date.now();
    // İstatistikleri kaydet
    const aiDone = drawings.filter(d => d.aiStatus === 'done').length;
    const aiFailed = drawings.filter(d => d.aiStatus === 'failed').length;
    const uniqueUsers = new Set(drawings.map(d => d.userName)).size;
    evt.stats = {
      totalDrawings: drawings.length,
      aiSuccessCount: aiDone,
      aiFailedCount: aiFailed,
      uniqueUsers,
      snapshotFile: null
    };
    saveEvents();
    // Snapshot talep et (host sayfasından)
    io.emit('take-snapshot', { eventId: evt.id, eventName: evt.name });
    emitActivity('admin', `Etkinlik tamamlandı: ${evt.name} — ${drawings.length} çizim, ${uniqueUsers} katılımcı 🏁`);
    socket.emit('admin:events', { events });
    socket.emit('admin:info', { message: `"${evt.name}" tamamlandı! Snapshot alınıyor...` });
    console.log(`🏁 Etkinlik tamamlandı: ${evt.name} (${drawings.length} çizim, ${uniqueUsers} katılımcı)`);
  });

  // 📸 Host'tan gelen snapshot verisi
  socket.on('snapshot-data', ({ eventId, dataUrl }) => {
    if (!dataUrl) return;
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const filename = `snapshot_${eventId || 'manual'}_${Date.now()}.png`;
      fs.writeFileSync(path.join(SNAPSHOTS_DIR, filename), Buffer.from(base64, 'base64'));
      // Etkinliğe bağla
      if (eventId) {
        const evt = events.find(e => e.id === eventId);
        if (evt) { evt.stats.snapshotFile = filename; saveEvents(); }
      }
      emitActivity('admin', `Halı snapshot kaydedildi 📸`);
      io.emit('admin:info', { message: 'Snapshot kaydedildi!' });
      console.log(`📸 Snapshot kaydedildi: ${filename}`);
    } catch (e) { console.error('Snapshot kaydetme hatası:', e); }
  });

  // 📸 Manuel snapshot al
  socket.on('admin:take-snapshot', ({ pin }) => {
    if (!verifyAdmin(pin)) return socket.emit('admin:error', { message: 'Yetkisiz' });
    io.emit('take-snapshot', { eventId: null, eventName: 'Manuel Snapshot' });
    socket.emit('admin:info', { message: 'Snapshot talebi gönderildi...' });
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

    drawings.forEach((d) => {
      processDrawing(d, 'active');
    });
    archive.forEach((d) => {
      processDrawing(d, 'archive');
    });

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
      lastCarpetImageAt = Date.now();
      if (pendingCarpetCapture) {
        const { queue } = pendingCarpetCapture;
        pendingCarpetCapture = null;
        queue.forEach((cb) => {
          cb();
        });
      }
      console.log('📸 Halı görüntüsü kaydedildi!');
    } catch (err) {
      console.error('❌ Halı görüntüsü kaydetme hatası:', err.message);
    }
  });
});

// 📸 Halı görüntüsü upload endpoint'i (HTTP POST)
app.post('/api/carpet-image-upload', express.raw({ type: 'image/*', limit: '10mb' }), (req, res) => {
  try {
    const imgPath = path.join(__dirname, 'carpet_latest.png');
    fs.writeFileSync(imgPath, req.body);
    lastCarpetImageAt = Date.now();
    console.log(`📸 Halı snapshot kaydedildi! (${(req.body.length / 1024).toFixed(0)} KB)`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📥 Halı görüntüsü indirme endpoint'i
app.get('/api/carpet-image', (req, res) => {
  const imgPath = path.join(__dirname, 'carpet_latest.png');
  if (fs.existsSync(imgPath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="dijital_motif.png"');
    res.sendFile(imgPath);
  } else {
    res.status(404).send('Henüz halı görüntüsü yok.');
  }
});

// 🎬 Kutlama videosu upload endpoint'i (max 50MB)
app.post('/api/upload-celebration-video', express.raw({ type: 'video/*', limit: '50mb' }), (req, res) => {
  try {
    const videoPath = path.join(__dirname, 'celebration_latest.webm');
    fs.writeFileSync(videoPath, req.body);
    console.log(`🎬 Kutlama videosu kaydedildi! (${(req.body.length / 1024 / 1024).toFixed(1)} MB)`);
    res.json({ ok: true, size: req.body.length });
  } catch (err) {
    console.error('❌ Video kaydetme hatası:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🎬 Kutlama videosu serve endpoint'i
app.get('/api/celebration-video', (req, res) => {
  const videoPath = path.join(__dirname, 'celebration_latest.webm');
  if (fs.existsSync(videoPath)) {
    const stat = fs.statSync(videoPath);
    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'inline; filename="dijital_motif_kutlama.webm"');
    fs.createReadStream(videoPath).pipe(res);
  } else {
    res.status(404).send('Henüz kutlama videosu yok.');
  }
});

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`🦅 Halı Tezgahı Sunucusu ${PORT} portunda çalışıyor...`);
});
