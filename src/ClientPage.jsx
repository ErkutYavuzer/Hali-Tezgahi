import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// Geniş Renk Paleti - Geleneksel Halı Renkleri + Modern Tonlar 🎨
// Geniş Renk Paleti - Açıktan Koyuya Sıralı 🎨
const PALETTE = [
  // 🏮 SICAK (Sarı -> Turuncu -> Kırmızı -> Bordo)
  '#fff200', '#f1c40f', '#f39c12', '#e1b12c', '#e67e22', '#d35400',
  '#ff7979', '#eb4d4b', '#e74c3c', '#c0392b', '#b33939', '#8B0000',

  // 🌿 DOĞA (Fıstık -> Yeşil -> Zümrüt -> Koyu Yeşil)
  '#badc58', '#6ab04c', '#2ecc71', '#27ae60', '#1abc9c', '#16a085', '#218c74', '#006266',

  // 🌊 DENİZ (Buz -> Mavi -> Lacivert)
  '#7ed6df', '#22a6b3', '#3498db', '#2980b9', '#30336b', '#130f40', '#273c75', '#192a56',

  // 🔮 MİSTİK (Pembe -> Mor -> Mürdüm)
  '#ff9ff3', '#f368e0', '#be2edd', '#8e44ad', '#9b59b6', '#574b90',

  // 🗿 NÖTR & TOPRAK (Beyaz -> Gri -> Kahve -> Siyah)
  '#ffffff', '#ecf0f1', '#bdc3c7', '#95a5a6', '#7f8c8d', '#535c68', '#34495e', '#2c3e50',
  '#cd6133', '#cc8e35', '#834c32', '#5d4037', '#000000'
];

const GRID_SIZE = 16;
const createEmptyPixel = () => ({ tl: '#ffffff', br: '#ffffff' });

// 🏺 HAZIR MOTİFLER (16x16 Taslaklar)
const MOTIFS = {
  BAKLAVA: {
    name: 'Baklava', icon: '🔶',
    generate: (color) => {
      const arr = Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dist = Math.abs(x - 7.5) + Math.abs(y - 7.5);
          if (dist < 7) arr[y * 16 + x] = { tl: color, br: color };
        }
      }
      return arr;
    }
  },
  YILDIZ: {
    name: 'Yıldız', icon: '⭐',
    generate: (color) => {
      const arr = Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel);
      for (let i = 0; i < 16; i++) {
        arr[i * 16 + 8] = { tl: color, br: color };
        arr[8 * 16 + i] = { tl: color, br: color };
        arr[i * 16 + i] = { tl: color, br: color };
        arr[i * 16 + (15 - i)] = { tl: color, br: color };
      }
      return arr;
    }
  },
  ELIBELINDE: {
    name: 'Elibelinde', icon: '🏺',
    generate: (color) => {
      const arr = Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel);
      const draw = (x, y) => { if (x >= 0 && x < 16 && y >= 0 && y < 16) arr[y * 16 + x] = { tl: color, br: color }; };
      // Basit Elibelinde Formu
      for (let y = 4; y < 12; y++) draw(8, y);
      for (let x = 6; x < 11; x++) { draw(x, 4); draw(x, 11); }
      draw(5, 5); draw(11, 5); draw(5, 6); draw(11, 6);
      draw(5, 10); draw(11, 10); draw(5, 9); draw(11, 9);
      return arr;
    }
  },
  GOZ: {
    name: 'Göz', icon: '👁️',
    generate: (color) => {
      const arr = Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x - 7.5; const dy = y - 7.5;
          const dist = Math.sqrt(dx * dx + dy * dy * 2);
          if (dist > 3 && dist < 6) arr[y * 16 + x] = { tl: color, br: color };
          if (dist < 1.5) arr[y * 16 + x] = { tl: color, br: color };
        }
      }
      return arr;
    }
  }
};

const TOOLS = {
  PENCIL: 'pencil',
  ERASER: 'eraser',
  FILL: 'fill',
};

// 🎨 Tasarım Jetonları (Design Tokens)
const THEME = {
  bg: 'radial-gradient(circle at top right, #1a1a2e, #0f0f1a)',
  glass: 'rgba(255, 255, 255, 0.05)',
  glassBorder: '1px solid rgba(255, 255, 255, 0.1)',
  accent: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  accentGold: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
  shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
};

export default function ClientPage() {
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [pixels, setPixels] = useState(Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel));
  const [isSymmetry, setIsSymmetry] = useState(true);
  const [drawMode, setDrawMode] = useState('full');
  const [currentTool, setCurrentTool] = useState(TOOLS.PENCIL);
  const [showGrid, setShowGrid] = useState(true);
  const [gridOpacity, setGridOpacity] = useState(0.2); // 🆕 Grid Şeffaflığı
  const [recentColors, setRecentColors] = useState([]); // 🆕 Son Kullanılan Renkler
  const [history, setHistory] = useState([]);
  const [canUndo, setCanUndo] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    const socketUrl = window.location.protocol + "//" + window.location.hostname + ":3003";
    socketRef.current = io(socketUrl, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      upgrade: true
    });
    // carpet-progress listener removed
    // initial-carpet progress listener removed

    // 📱 JİROSKOP (SAVUR-GÖNDER) ENTEGRASYONU
    const handleMotion = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      // Z eksenindeki ani ivmelenme (Telefonu ileri savurma)
      // Eşik değer: 15 (Normal hareketlerden ayırmak için)
      const threshold = 15;
      const totalForce = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);

      if (totalForce > threshold) {
        // Debounce: Çok sık tetiklenmesini önle
        const now = Date.now();
        if (!window._lastFlick || now - window._lastFlick > 2000) {
          window._lastFlick = now;
          // Ekranda motif varsa gönder
          // Not: pixels state'ine doğrudan erişmek yerine sendMotif'i tetikleyebiliriz.
          // Ancak useEffect içindeki event listener state'in güncel halini görmeyebilir.
          // Bu yüzden bir ref veya trigger mekanizması gerekebilir.
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

  const saveToHistory = useCallback((currentPixels) => {
    setHistory(prev => {
      const newHistory = [...prev, JSON.stringify(currentPixels)];
      if (newHistory.length > 30) newHistory.shift();
      return newHistory;
    });
    setCanUndo(true);
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const lastState = prev[prev.length - 1];
      setPixels(JSON.parse(lastState));
      const newHistory = prev.slice(0, -1);
      setCanUndo(newHistory.length > 0);
      return newHistory;
    });
  }, []);

  const floodFill = useCallback((startIndex, newColor) => {
    const currentPixels = [...pixels];
    const targetTl = currentPixels[startIndex]?.tl;
    const targetBr = currentPixels[startIndex]?.br;
    if (drawMode === 'full' && targetTl === newColor) return null;
    if (drawMode !== 'full' && targetTl === newColor && targetBr === newColor) return null;

    const visited = new Set();
    const stack = [startIndex];
    while (stack.length > 0) {
      const index = stack.pop();
      if (visited.has(index)) continue;
      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);
      if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue;
      const pixel = currentPixels[index];
      if (drawMode === 'full' ? pixel.tl !== targetTl : (pixel.tl !== targetTl || pixel.br !== targetBr)) continue;
      visited.add(index);
      currentPixels[index] = { tl: newColor, br: newColor };
      if (x > 0) stack.push(index - 1);
      if (x < GRID_SIZE - 1) stack.push(index + 1);
      if (y > 0) stack.push(index - GRID_SIZE);
      if (y < GRID_SIZE - 1) stack.push(index + GRID_SIZE);
    }
    return currentPixels;
  }, [pixels, drawMode]);

  const SYMMETRY_MODES = {
    NONE: 'none',
    HORIZONTAL: 'horizontal',
    QUAD: 'quad',
    RADIAL: 'radial',
  };
  const [symMode, setSymMode] = useState(SYMMETRY_MODES.QUAD);

  const paint = (index, part = null) => {
    if (navigator.vibrate) navigator.vibrate(5);

    // Snapshot before change
    saveToHistory(pixels);

    setPixels(prev => {
      let newPixels = [...prev];
      const x = index % GRID_SIZE;
      const y = Math.floor(index / GRID_SIZE);

      const applyColor = (idx) => {
        if (idx < 0 || idx >= newPixels.length) return;
        const pixel = { ...newPixels[idx] };
        if (currentTool === TOOLS.ERASER) {
          pixel.tl = '#ffffff';
          pixel.br = '#ffffff';
        } else {
          if (drawMode === 'full') {
            pixel.tl = selectedColor;
            pixel.br = selectedColor;
          } else if (part) {
            pixel[part] = selectedColor;
          }
        }
        newPixels[idx] = pixel;
      };

      if (currentTool === TOOLS.FILL) {
        newPixels = floodFill(index, selectedColor) || prev;
      } else {
        applyColor(index);

        if (symMode !== SYMMETRY_MODES.NONE && drawMode === 'full') {
          if (symMode === SYMMETRY_MODES.HORIZONTAL || symMode === SYMMETRY_MODES.QUAD || symMode === SYMMETRY_MODES.RADIAL) {
            applyColor(y * GRID_SIZE + (GRID_SIZE - 1 - x));
          }
          if (symMode === SYMMETRY_MODES.QUAD || symMode === SYMMETRY_MODES.RADIAL) {
            const y2 = GRID_SIZE - 1 - y;
            applyColor(y2 * GRID_SIZE + x);
            applyColor(y2 * GRID_SIZE + (GRID_SIZE - 1 - x));
          }
          if (symMode === SYMMETRY_MODES.RADIAL) {
            applyColor(x * GRID_SIZE + y);
            applyColor(x * GRID_SIZE + (GRID_SIZE - 1 - y));
            applyColor((GRID_SIZE - 1 - x) * GRID_SIZE + y);
            applyColor((GRID_SIZE - 1 - x) * GRID_SIZE + (GRID_SIZE - 1 - y));
          }
        }
      }
      return newPixels;
    });
  };

  const clear = () => {
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
    saveToHistory(pixels);
    setPixels(Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel));
  };

  const sendMotif = () => {
    if (socketRef.current) {
      if (navigator.vibrate) navigator.vibrate(40);
      socketRef.current.emit('pixel-data', pixels);
      setPixels(Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel));
      setHistory([]);
      setCanUndo(false);
    }
  };

  const loadMotif = (motifKey) => {
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
    const newPixels = MOTIFS[motifKey].generate(selectedColor);
    saveToHistory(pixels);
    setPixels(newPixels);
  };

  const ToolButton = ({ icon, label, active, onClick, extraStyle = {} }) => (
    <button onClick={onClick} style={{
      width: '54px', height: '54px', borderRadius: '16px', border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.05)',
      background: active ? THEME.accent : THEME.glass, color: 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      transform: active ? 'scale(1.05) translateY(-2px)' : 'scale(1)', boxShadow: active ? THEME.shadow : 'none', backdropFilter: 'blur(10px)', ...extraStyle
    }}>
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <span style={{ fontSize: '9px', fontWeight: '500', marginTop: '2px', opacity: active ? 1 : 0.6 }}>{label}</span>
    </button>
  );

  return (
    <div style={{
      width: '100vw', minHeight: '100vh', background: THEME.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', padding: '15px 0', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch'
    }}>
      {/* 🔝 ÜST PANEL: Başlık */}
      <div style={{ width: '90%', maxWidth: '400px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.5px' }}>DOKUMA TEZGAHI</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '11px' }}>v4.0 Profesyonel Versiyon</p>
        </div>
        {/* İlerleme göstergesi kaldırıldı */}
      </div>



      {/* 🛠️ ARAÇ ÇUBUĞU (Yüzen Ada) */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', border: THEME.glassBorder, backdropFilter: 'blur(20px)', marginBottom: '20px', boxShadow: THEME.shadow }}>
        <ToolButton icon="✏️" label="Kalem" active={currentTool === TOOLS.PENCIL} onClick={() => setCurrentTool(TOOLS.PENCIL)} />
        <ToolButton icon="🧼" label="Silgi" active={currentTool === TOOLS.ERASER} onClick={() => setCurrentTool(TOOLS.ERASER)} />
        <ToolButton icon="🪣" label="Kova" active={currentTool === TOOLS.FILL} onClick={() => setCurrentTool(TOOLS.FILL)} />

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '5px 2px' }} />


        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '5px 2px' }} />

        {/* 🦋 SİMETRİ MODLARI (Ayrı Butonlar) */}
        <ToolButton
          icon="DÜZ"
          label="Simetri Yok"
          active={symMode === SYMMETRY_MODES.NONE}
          onClick={() => { setSymMode(SYMMETRY_MODES.NONE); if (navigator.vibrate) navigator.vibrate(10); }}
          extraStyle={{ fontSize: '12px', fontWeight: 'bold' }}
        />
        <ToolButton
          icon="🌓"
          label="2-Ayna"
          active={symMode === SYMMETRY_MODES.HORIZONTAL}
          onClick={() => { setSymMode(SYMMETRY_MODES.HORIZONTAL); if (navigator.vibrate) navigator.vibrate(10); }}
        />
        <ToolButton
          icon="🍀"
          label="4-Ayna"
          active={symMode === SYMMETRY_MODES.QUAD}
          onClick={() => { setSymMode(SYMMETRY_MODES.QUAD); if (navigator.vibrate) navigator.vibrate(10); }}
        />
        <ToolButton
          icon="☸️"
          label="Radyal"
          active={symMode === SYMMETRY_MODES.RADIAL}
          onClick={() => { setSymMode(SYMMETRY_MODES.RADIAL); if (navigator.vibrate) navigator.vibrate(10); }}
        />

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '5px 2px' }} />

        <ToolButton icon={drawMode === 'full' ? '⬛' : '🔺'} label={drawMode === 'full' ? 'Kare' : 'Üçgen'} active={drawMode !== 'full'} onClick={() => setDrawMode(drawMode === 'full' ? 'triangle' : 'full')} />
        <ToolButton icon="↩️" label="Geri" active={false} onClick={undo} extraStyle={{ opacity: canUndo ? 1 : 0.3 }} />
      </div>

      {/* 🖼️ ÇİZİM ALANI (Glass Box) */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '24px', border: THEME.glassBorder, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)', marginBottom: '20px', position: 'relative' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, width: '85vw', maxWidth: '380px', aspectRatio: '1/1',
          background: '#fff', borderRadius: '12px', overflow: 'hidden', position: 'relative',
          boxShadow: '0 0 40px rgba(0,0,0,0.3)'
        }}>
          {/* 🔍 TEXTURE OVERLAY (Wool/Canvas effect) */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10,
            opacity: 0.15, background: `url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMDAwIiBvcGFjaXR5PSIuNSIvPgo8L3N2Zz4=')`,
            mixBlendMode: 'multiply'
          }} />

          {pixels.map((p, i) => (
            <div key={i} style={{
              position: 'relative',
              border: showGrid ? `0.5px solid rgba(0,0,0,${gridOpacity})` : 'none',
              filter: 'contrast(1.1) brightness(0.95)'
            }} onPointerDown={() => paint(i)} onPointerEnter={(e) => e.buttons === 1 && paint(i)}>
              {drawMode === 'full' ? (
                <div style={{
                  width: '100%', height: '100%', background: p.tl,
                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)',
                  backgroundSize: '4px 4px'
                }} />
              ) : (
                <>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: p.tl, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '100%', height: '100%', background: p.br, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 🏺 HAZIR MOTİFLER (Scrollable Bar) */}
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 20px', boxSizing: 'border-box', marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>HAZIR MOTİFLER</div>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px', scrollbarWidth: 'none' }}>
          {Object.keys(MOTIFS).map(key => (
            <button key={key} onClick={() => loadMotif(key)} style={{
              flexShrink: 0, padding: '8px 12px', borderRadius: '12px', background: THEME.glass, border: THEME.glassBorder,
              color: 'white', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'all 0.2s'
            }}>
              <span style={{ fontSize: '16px' }}>{MOTIFS[key].icon}</span>
              <span style={{ fontSize: '11px', fontWeight: '600' }}>{MOTIFS[key].name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 🎨 RENK PALETİ (Responsive Grid/Scroll) */}
      <div style={{ width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>

        {/* 🕒 SON KULLANILANLAR */}
        {recentColors.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {recentColors.map((color, idx) => (
                <div key={`${color}-${idx}`} onClick={() => { setSelectedColor(color); setCurrentTool(TOOLS.PENCIL); }} style={{
                  width: '26px', height: '26px', borderRadius: '50%', background: color, border: selectedColor === color ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', flexShrink: 0
                }} />
              ))}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          {PALETTE.map(color => (
            <div key={color} onClick={() => {
              setSelectedColor(color);
              setCurrentTool(TOOLS.PENCIL);
              if (navigator.vibrate) navigator.vibrate(10);
              setRecentColors(prev => {
                const filtered = prev.filter(c => c !== color);
                return [color, ...filtered].slice(0, 8);
              });
            }} style={{
              width: '32px', height: '32px', borderRadius: '10px', background: color, border: selectedColor === color ? '3px solid white' : '2px solid rgba(255,255,255,0.1)',
              boxShadow: selectedColor === color ? `0 0 12px ${color}` : 'none',
              transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)', cursor: 'pointer'
            }} />
          ))}
        </div>
      </div>

      {/* 📏 GRID CONTROL */}
      <div style={{ width: '90%', maxWidth: '400px', display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 15px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', marginBottom: '15px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>GRID:</span>
        <input type="range" min="0" max="0.5" step="0.05" value={gridOpacity} onChange={(e) => setGridOpacity(parseFloat(e.target.value))} style={{ flex: 1, accentColor: '#ffd700' }} />
        <button onClick={() => setShowGrid(!showGrid)} style={{ background: 'none', border: 'none', color: showGrid ? '#ffd700' : 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '18px' }}>{showGrid ? '🔔' : '🔕'}</button>
      </div>

      {/* 📱 ALT AKSİYONLAR */}
      <div style={{ marginTop: 'auto', width: '90%', maxWidth: '400px', display: 'flex', gap: '10px', paddingBottom: '10px' }}>
        <button onClick={clear} style={{ flex: 1, padding: '14px', borderRadius: '16px', border: '1px solid rgba(231, 76, 60, 0.3)', background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}>TEMİZLE</button>
        <button id="send-trigger-btn" onClick={sendMotif} style={{ flex: 2, padding: '14px', borderRadius: '16px', border: 'none', background: THEME.accentGold, color: '#000', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(212, 175, 55, 0.3)', letterSpacing: '0.5px' }}>MOTİFİ GÖNDER 🚀</button>
      </div>
    </div>
  );
}
