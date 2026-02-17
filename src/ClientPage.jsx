import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { CONFIG, PALETTE_CATEGORIES, THEME } from './constants';

// 🎨 Fırça boyutları
const BRUSH_SIZES = [3, 6, 10, 16, 24];

// 💫 CSS Animasyonları
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(15px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes bounceIn {
    0% { transform: scale(0.3); opacity: 0; }
    50% { transform: scale(1.08); }
    70% { transform: scale(0.95); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes successPop {
    0% { transform: scale(1); }
    15% { transform: scale(0.92); }
    30% { transform: scale(1.15); }
    50% { transform: scale(0.98); }
    70% { transform: scale(1.03); }
    100% { transform: scale(1); }
  }
  @keyframes checkDraw {
    0% { stroke-dashoffset: 24; opacity: 0; }
    30% { opacity: 1; }
    100% { stroke-dashoffset: 0; opacity: 1; }
  }
  @keyframes ripple {
    0% { transform: scale(0); opacity: 0.6; }
    100% { transform: scale(4); opacity: 0; }
  }
  @keyframes gentleFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }

  /* Scrollbar gizle */
  .client-page::-webkit-scrollbar { display: none; }
  .client-page { scrollbar-width: none; }

  /* Kategori scroll */
  .color-row::-webkit-scrollbar { display: none; }
  .color-row { scrollbar-width: none; }
`;

export default function ClientPage() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const socketRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  const [selectedColor, setSelectedColor] = useState('#c0392b');
  const [brushSize, setBrushSize] = useState(10);
  const [currentTool, setCurrentTool] = useState('brush'); // brush | marker | spray | star | calligraphy | eraser | fill
  const [recentColors, setRecentColors] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [connected, setConnected] = useState(false);
  const [sendState, setSendState] = useState('idle'); // idle | sending | success
  const [activeCat, setActiveCat] = useState(0);

  // Canvas başlat
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const size = CONFIG.CANVAS_RESOLUTION;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, size, size);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    saveToHistory();
  }, []);

  // Socket bağlantısı
  useEffect(() => {
    const socketUrl = window.location.origin;
    socketRef.current = io(socketUrl, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      upgrade: true
    });

    socketRef.current.on('connect', () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));

    // 📱 JİROSKOP (SAVUR-GÖNDER)
    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const threshold = 15;
      const totalForce = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
      if (totalForce > threshold) {
        const now = Date.now();
        if (!window._lastFlick || now - window._lastFlick > 2000) {
          window._lastFlick = now;
          document.getElementById('send-trigger-btn')?.click();
        }
      }
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => {
      socketRef.current?.disconnect();
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  // Undo/Redo History
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    const idx = historyIndexRef.current;
    historyRef.current = historyRef.current.slice(0, idx + 1);
    historyRef.current.push(data);
    if (historyRef.current.length > 30) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    restoreFromHistory(historyIndexRef.current);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    restoreFromHistory(historyIndexRef.current);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const restoreFromHistory = (index) => {
    const img = new Image();
    img.onload = () => {
      const ctx = ctxRef.current;
      ctx.clearRect(0, 0, CONFIG.CANVAS_RESOLUTION, CONFIG.CANVAS_RESOLUTION);
      ctx.drawImage(img, 0, 0);
    };
    img.src = historyRef.current[index];
  };

  // Çizim fonksiyonları
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // 🪣 Flood Fill (Doldur) fonksiyonu
  const floodFill = useCallback((startX, startY, fillColor) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const w = canvas.width, h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const sx = Math.floor(startX), sy = Math.floor(startY);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) return;

    // Hedef pikselin rengini al
    const targetIdx = (sy * w + sx) * 4;
    const tR = data[targetIdx], tG = data[targetIdx + 1], tB = data[targetIdx + 2], tA = data[targetIdx + 3];

    // fillColor'u parse et
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1; tempCanvas.height = 1;
    const tmpCtx = tempCanvas.getContext('2d');
    tmpCtx.fillStyle = fillColor;
    tmpCtx.fillRect(0, 0, 1, 1);
    const fc = tmpCtx.getImageData(0, 0, 1, 1).data;
    const fR = fc[0], fG = fc[1], fB = fc[2], fA = fc[3];

    // Aynı renge doldurmaya çalışma
    if (tR === fR && tG === fG && tB === fB && tA === fA) return;

    const tolerance = 32;
    const match = (idx) => {
      return Math.abs(data[idx] - tR) <= tolerance &&
        Math.abs(data[idx + 1] - tG) <= tolerance &&
        Math.abs(data[idx + 2] - tB) <= tolerance &&
        Math.abs(data[idx + 3] - tA) <= tolerance;
    };

    const stack = [[sx, sy]];
    const visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
      const vi = cy * w + cx;
      if (visited[vi]) continue;
      const idx = vi * 4;
      if (!match(idx)) continue;

      visited[vi] = 1;
      data[idx] = fR; data[idx + 1] = fG; data[idx + 2] = fB; data[idx + 3] = fA;

      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
    if (navigator.vibrate) navigator.vibrate(20);
  }, [saveToHistory]);

  // 🌟 Yıldız çizimi
  const drawStar = (ctx, cx, cy, outerR, innerR, points) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / points - Math.PI / 2;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const ctx = ctxRef.current;

    // Fill aracı — tıklama anında doldur
    if (currentTool === 'fill') {
      floodFill(pos.x, pos.y, selectedColor);
      return;
    }

    isDrawingRef.current = true;
    lastPosRef.current = pos;

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    if (currentTool === 'spray') {
      // Sprey — rastgele noktalar
      ctx.fillStyle = selectedColor;
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * brushSize;
        ctx.globalAlpha = 0.3 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(pos.x + Math.cos(angle) * dist, pos.y + Math.sin(angle) * dist, 1 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (currentTool === 'star') {
      // Yıldız damgası
      ctx.fillStyle = selectedColor;
      drawStar(ctx, pos.x, pos.y, brushSize, brushSize * 0.4, 5);
    } else if (currentTool === 'marker') {
      // Marker — yarı şeffaf kalın çizgi
      ctx.fillStyle = selectedColor;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (currentTool === 'calligraphy') {
      // Kaligrafi — düz dikdörtgen
      ctx.fillStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : selectedColor;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-brushSize / 2, -2, brushSize, 4);
      ctx.restore();
    } else {
      // Normal fırça veya silgi
      ctx.fillStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : selectedColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (navigator.vibrate) navigator.vibrate(3);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;

    const pos = getCanvasPos(e);
    const ctx = ctxRef.current;

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    if (currentTool === 'spray') {
      ctx.fillStyle = selectedColor;
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * brushSize;
        ctx.globalAlpha = 0.2 + Math.random() * 0.5;
        ctx.beginPath();
        ctx.arc(pos.x + Math.cos(angle) * dist, pos.y + Math.sin(angle) * dist, 1 + Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (currentTool === 'star') {
      // Yıldız izleri
      const dist = Math.hypot(pos.x - lastPosRef.current.x, pos.y - lastPosRef.current.y);
      if (dist > brushSize * 1.5) {
        ctx.fillStyle = selectedColor;
        drawStar(ctx, pos.x, pos.y, brushSize, brushSize * 0.4, 5);
        lastPosRef.current = pos;
      }
      return;
    } else if (currentTool === 'marker') {
      ctx.lineWidth = brushSize * 1.5;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = selectedColor;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (currentTool === 'calligraphy') {
      const dx = pos.x - lastPosRef.current.x;
      const dy = pos.y - lastPosRef.current.y;
      const angle = Math.atan2(dy, dx);
      ctx.fillStyle = selectedColor;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      ctx.fillRect(-brushSize / 2, -2, brushSize, 4);
      ctx.restore();
    } else {
      // Normal fırça / silgi
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : selectedColor;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    lastPosRef.current = pos;
  };

  const stopDrawing = (e) => {
    if (e) e.preventDefault();
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPosRef.current = null;
      ctxRef.current.globalCompositeOperation = 'source-over';
      ctxRef.current.globalAlpha = 1;
      saveToHistory();
    }
  };

  // Canvas temizle
  const clearCanvas = () => {
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    const ctx = ctxRef.current;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, CONFIG.CANVAS_RESOLUTION, CONFIG.CANVAS_RESOLUTION);
    saveToHistory();
  };

  // Çizimi gönder
  const sendDrawing = () => {
    if (!socketRef.current || sendState === 'sending') return;
    if (navigator.vibrate) navigator.vibrate(40);

    setSendState('sending');

    const canvas = canvasRef.current;
    // 📦 PNG — şeffaflık korunur (JPEG siyah yapıyordu!)
    const dataUrl = canvas.toDataURL('image/png');

    socketRef.current.emit('drawing-data', dataUrl);

    // Başarı animasyonu
    setTimeout(() => {
      setSendState('success');
      if (navigator.vibrate) navigator.vibrate([20, 50, 20]);

      // Canvas'ı temizle
      const ctx = ctxRef.current;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, CONFIG.CANVAS_RESOLUTION, CONFIG.CANVAS_RESOLUTION);
      historyRef.current = [];
      historyIndexRef.current = -1;
      saveToHistory();

      setTimeout(() => setSendState('idle'), 2500);
    }, 400);
  };

  // Renk seç
  const selectColor = useCallback((color) => {
    setSelectedColor(color);
    setCurrentTool('brush');
    if (navigator.vibrate) navigator.vibrate(10);
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 8);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="client-page" style={{
      width: '100vw',
      minHeight: 'calc(var(--vh, 1vh) * 100)',
      background: 'linear-gradient(160deg, #0f0c29 0%, #1a1040 40%, #24243e 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflowY: 'auto', padding: '12px 0 24px', boxSizing: 'border-box',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <style>{GLOBAL_STYLES}</style>

      {/* ═══════════════ BAŞLIK ═══════════════ */}
      <div style={{
        width: '92%', maxWidth: '420px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '14px', animation: 'fadeInUp 0.6s ease',
      }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: '20px', fontWeight: '900',
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #ffd700 0%, #ff6b35 50%, #ffd700 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'shimmer 3s linear infinite',
          }}>🎨 DİJİTAL MOTİF ATÖLYESİ</h1>
          <p style={{
            color: 'rgba(255,255,255,0.35)', margin: '2px 0 0', fontSize: '10px',
            letterSpacing: '2px', fontWeight: '500',
          }}>İNTERAKTİF KOLEKTİF SANAT DENEYİMİ</p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: connected ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)',
          border: connected ? '1px solid rgba(46,204,113,0.3)' : '1px solid rgba(231,76,60,0.3)',
          borderRadius: '20px', padding: '6px 14px',
          transition: 'all 0.4s ease',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#2ecc71' : '#e74c3c',
            boxShadow: connected ? '0 0 8px #2ecc71' : '0 0 8px #e74c3c',
            animation: connected ? 'pulse 2s ease infinite' : 'none',
          }} />
          <span style={{
            fontSize: '10px', fontWeight: '600',
            color: connected ? '#2ecc71' : '#e74c3c',
            letterSpacing: '0.5px',
          }}>{connected ? 'BAĞLI' : 'BAĞLANIYOR'}</span>
        </div>
      </div>

      {/* ═══════════════ ARAÇ ÇUBUĞU ═══════════════ */}
      <div style={{
        width: '92%', maxWidth: '420px',
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '8px 8px',
        flexWrap: 'wrap', justifyContent: 'center',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        marginBottom: '12px',
        animation: 'fadeInUp 0.7s ease',
      }}>
        {/* Araç butonları */}
        {[
          { id: 'brush', icon: '🖌️', label: 'Fırça' },
          { id: 'marker', icon: '🖍️', label: 'Marker' },
          { id: 'spray', icon: '💨', label: 'Sprey' },
          { id: 'star', icon: '⭐', label: 'Yıldız' },
          { id: 'calligraphy', icon: '✒️', label: 'Kalem' },
          { id: 'fill', icon: '🪣', label: 'Doldur' },
          { id: 'eraser', icon: '🧹', label: 'Silgi' },
        ].map(tool => (
          <button key={tool.id} onClick={() => setCurrentTool(tool.id)} style={{
            width: '40px', height: '44px', borderRadius: '12px',
            border: currentTool === tool.id ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
            background: currentTool === tool.id
              ? 'linear-gradient(135deg, rgba(102,126,234,0.5), rgba(118,75,162,0.5))'
              : 'rgba(255,255,255,0.04)',
            color: 'white', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: currentTool === tool.id ? 'scale(1.08)' : 'scale(1)',
            boxShadow: currentTool === tool.id ? '0 4px 15px rgba(102,126,234,0.3)' : 'none',
            padding: '2px',
          }}>
            <span style={{ fontSize: '16px' }}>{tool.icon}</span>
            <span style={{ fontSize: '7px', fontWeight: '600', marginTop: '1px', opacity: 0.7 }}>{tool.label}</span>
          </button>
        ))}

        {/* Ayırıcı */}
        <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

        {/* Undo/Redo */}
        {[
          { icon: '↩️', label: 'Geri', action: undo, enabled: canUndo },
          { icon: '↪️', label: 'İleri', action: redo, enabled: canRedo },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} style={{
            width: '44px', height: '44px', borderRadius: '12px',
            border: '1px solid transparent',
            background: 'rgba(255,255,255,0.04)',
            color: 'white', cursor: btn.enabled ? 'pointer' : 'default',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            opacity: btn.enabled ? 1 : 0.25,
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: '16px' }}>{btn.icon}</span>
            <span style={{ fontSize: '8px', fontWeight: '600', marginTop: '1px', opacity: 0.6 }}>{btn.label}</span>
          </button>
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Fırça boyutu göstergesi */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
          padding: '6px 10px',
        }}>
          <div style={{
            width: Math.max(brushSize * 0.8, 6), height: Math.max(brushSize * 0.8, 6),
            borderRadius: '50%',
            background: currentTool === 'eraser' ? 'rgba(255,255,255,0.4)' : selectedColor,
            border: '1px solid rgba(255,255,255,0.3)',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>
            {brushSize}
          </span>
        </div>
      </div>

      {/* ═══════════════ ÇİZİM ALANI ═══════════════ */}
      <div style={{
        position: 'relative',
        padding: '10px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(139,69,19,0.15))',
        border: '2px solid rgba(212,175,55,0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 30px rgba(212,175,55,0.05)',
        marginBottom: '12px',
        animation: 'fadeInUp 0.8s ease',
      }}>
        {/* Dekoratif köşeler */}
        {[[16, 16], [16, 'auto'], ['auto', 16], ['auto', 'auto']].map(([t, l], i) => (
          <div key={i} style={{
            position: 'absolute',
            top: typeof t === 'number' ? t : 'auto',
            bottom: t === 'auto' ? 16 : 'auto',
            left: typeof l === 'number' ? l : 'auto',
            right: l === 'auto' ? 16 : 'auto',
            width: '20px', height: '20px',
            borderTop: i < 2 ? '2px solid rgba(212,175,55,0.4)' : 'none',
            borderBottom: i >= 2 ? '2px solid rgba(212,175,55,0.4)' : 'none',
            borderLeft: (i % 2 === 0) ? '2px solid rgba(212,175,55,0.4)' : 'none',
            borderRight: (i % 2 !== 0) ? '2px solid rgba(212,175,55,0.4)' : 'none',
            pointerEvents: 'none',
          }} />
        ))}

        <canvas
          ref={canvasRef}
          style={{
            width: '84vw', maxWidth: '380px', aspectRatio: '1/1',
            borderRadius: '10px', touchAction: 'none',
            cursor: currentTool === 'eraser' ? 'crosshair' : 'default',
            background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 50%/18px 18px',
            display: 'block',
          }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Gönderim başarı overlay */}
        {sendState === 'success' && (
          <div style={{
            position: 'absolute', inset: 10, borderRadius: '10px',
            background: 'rgba(46,204,113,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'bounceIn 0.5s ease',
            pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" opacity="0.3" />
                <path d="M8 12l3 3 5-6" style={{
                  strokeDasharray: 24,
                  animation: 'checkDraw 0.6s ease 0.2s forwards',
                  strokeDashoffset: 24,
                }} />
              </svg>
              <p style={{
                color: '#2ecc71', fontSize: '13px', fontWeight: '800',
                margin: '8px 0 0', letterSpacing: '1px',
              }}>DOKULDU! ✨</p>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ FIRÇA BOYUTU ═══════════════ */}
      <div style={{
        width: '92%', maxWidth: '420px',
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: '10px',
        animation: 'fadeInUp 0.9s ease',
      }}>
        <span style={{
          fontSize: '10px', color: 'rgba(255,255,255,0.4)',
          fontWeight: '700', letterSpacing: '1px', minWidth: '40px',
        }}>FIRÇA</span>
        <div style={{ display: 'flex', gap: '6px', flex: 1, justifyContent: 'center' }}>
          {BRUSH_SIZES.map(size => {
            const isActive = brushSize === size;
            return (
              <button key={size} onClick={() => setBrushSize(size)} style={{
                width: Math.max(size * 1.4, 28), height: Math.max(size * 1.4, 28),
                borderRadius: '50%',
                background: isActive
                  ? (currentTool === 'eraser'
                    ? 'rgba(255,255,255,0.2)'
                    : `radial-gradient(circle, ${selectedColor}, ${selectedColor}88)`)
                  : 'rgba(255,255,255,0.06)',
                border: isActive ? '2px solid rgba(255,255,255,0.7)' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                boxShadow: isActive ? `0 0 12px ${selectedColor}40` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: Math.max(size * 0.5, 4), height: Math.max(size * 0.5, 4),
                  borderRadius: '50%',
                  background: isActive ? 'white' : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.2s',
                }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ RENK PALETİ ═══════════════ */}
      <div style={{
        width: '92%', maxWidth: '420px',
        marginBottom: '14px',
        animation: 'fadeInUp 1.0s ease',
      }}>
        {/* Son kullanılanlar */}
        {recentColors.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '10px', padding: '6px 8px',
            background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
          }}>
            <span style={{
              fontSize: '9px', color: 'rgba(255,255,255,0.3)',
              fontWeight: '600', letterSpacing: '1px', marginRight: '4px',
            }}>SON</span>
            {recentColors.map((color, idx) => (
              <div key={`${color}-${idx}`}
                onClick={() => selectColor(color)}
                style={{
                  width: '24px', height: '24px', borderRadius: '8px', flexShrink: 0,
                  background: color, cursor: 'pointer',
                  border: selectedColor === color ? '2px solid white' : '1px solid rgba(255,255,255,0.15)',
                  boxShadow: selectedColor === color ? `0 0 8px ${color}` : 'none',
                  transition: 'all 0.2s',
                }} />
            ))}
          </div>
        )}

        {/* Kategori tabları */}
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '10px',
          overflowX: 'auto', paddingBottom: '2px',
        }} className="color-row">
          {PALETTE_CATEGORIES.map((cat, i) => (
            <button key={cat.name} onClick={() => setActiveCat(i)} style={{
              padding: '6px 12px', borderRadius: '10px', cursor: 'pointer',
              border: activeCat === i ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
              background: activeCat === i
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(255,255,255,0.02)',
              color: activeCat === i ? 'white' : 'rgba(255,255,255,0.4)',
              fontSize: '11px', fontWeight: '600', fontFamily: 'inherit',
              whiteSpace: 'nowrap', transition: 'all 0.25s',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <span>{cat.emoji}</span> {cat.name}
            </button>
          ))}
        </div>

        {/* Aktif kategorinin renkleri */}
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
          padding: '8px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {PALETTE_CATEGORIES[activeCat]?.colors.map((color, ci) => {
            const isSelected = selectedColor === color;
            return (
              <div key={color}
                onClick={() => selectColor(color)}
                style={{
                  width: '36px', height: '36px', borderRadius: '12px',
                  background: color, cursor: 'pointer',
                  border: isSelected ? '3px solid white' : '2px solid rgba(255,255,255,0.08)',
                  boxShadow: isSelected ? `0 0 16px ${color}, 0 4px 12px rgba(0,0,0,0.3)` : '0 2px 6px rgba(0,0,0,0.2)',
                  transform: isSelected ? 'scale(1.15) translateY(-2px)' : 'scale(1)',
                  transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  animation: isSelected ? 'gentleFloat 2s ease infinite' : 'none',
                }} />
            );
          })}
        </div>
      </div>

      {/* ═══════════════ ALT AKSİYONLAR ═══════════════ */}
      <div style={{
        marginTop: 'auto', width: '92%', maxWidth: '420px',
        display: 'flex', gap: '10px',
        padding: '0 0 env(safe-area-inset-bottom, 10px)',
        animation: 'fadeInUp 1.1s ease',
      }}>
        {/* Temizle */}
        <button onClick={clearCanvas} style={{
          flex: 1, padding: '16px', borderRadius: '16px',
          border: '1px solid rgba(255,59,48,0.2)',
          background: 'rgba(255,59,48,0.06)',
          color: '#ff6b6b', fontWeight: '700', fontSize: '13px',
          fontFamily: 'inherit', cursor: 'pointer',
          transition: 'all 0.3s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '16px' }}>🗑️</span> TEMİZLE
        </button>

        {/* Gönder */}
        <button
          id="send-trigger-btn"
          onClick={sendDrawing}
          disabled={sendState === 'sending'}
          style={{
            flex: 2.5, padding: '16px 20px', borderRadius: '16px',
            border: 'none',
            background: sendState === 'success'
              ? 'linear-gradient(135deg, #2ecc71, #27ae60)'
              : sendState === 'sending'
                ? 'linear-gradient(135deg, #95a5a6, #7f8c8d)'
                : 'linear-gradient(135deg, #ffd700 0%, #ff8c00 50%, #ffd700 100%)',
            backgroundSize: sendState === 'idle' ? '200% auto' : '100% auto',
            animation: sendState === 'idle'
              ? 'shimmer 2.5s linear infinite'
              : sendState === 'success'
                ? 'successPop 0.6s ease'
                : 'none',
            color: sendState === 'success' ? '#fff' : '#1a0a00',
            fontWeight: '900', fontSize: '15px', fontFamily: 'inherit',
            cursor: sendState === 'sending' ? 'wait' : 'pointer',
            boxShadow: sendState === 'success'
              ? '0 6px 25px rgba(46,204,113,0.4)'
              : '0 6px 25px rgba(255,215,0,0.3)',
            letterSpacing: '0.5px',
            transition: 'background 0.4s, box-shadow 0.4s, color 0.4s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
          {sendState === 'success' ? (
            <>✈️ HALIYA UÇUYOR!</>
          ) : sendState === 'sending' ? (
            <>⏳ GÖNDERİLİYOR...</>
          ) : (
            <>🧶 ÇİZİMİ DOKULA</>
          )}
        </button>
      </div>
    </div>
  );
}
