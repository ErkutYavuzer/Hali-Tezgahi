import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const PALETTE = ['#c0392b', '#2ecc71', '#3498db', '#f1c40f', '#8e44ad', '#ecf0f1', '#2c3e50', '#e67e22'];
const GRID_SIZE = 16;

// Varsayılan hücre yapısı: 4 parça (Top, Right, Bottom, Left)
const createEmptyPixel = () => ({
  tl: '#ffffff', // Top-Left
  br: '#ffffff'  // Bottom-Right
});

export default function ClientPage() {
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [pixels, setPixels] = useState(Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel));
  const [isSymmetry, setIsSymmetry] = useState(true);
  const [drawMode, setDrawMode] = useState('full'); // 'full' (Kare) veya 'triangle' (Üçgen)
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(window.location.hostname === 'localhost' ? 'http://localhost:3001' : `http://${window.location.hostname}:3001`);
    return () => socketRef.current?.disconnect();
  }, []);

  const clear = () => setPixels(Array(GRID_SIZE * GRID_SIZE).fill(null).map(createEmptyPixel));

  const paint = (index, part = null) => {
    setPixels(prev => {
      const newPixels = [...prev];
      const pixel = { ...newPixels[index] }; 

      if (drawMode === 'full') {
        pixel.tl = selectedColor;
        pixel.br = selectedColor;
      } else if (part) {
        pixel[part] = selectedColor;
      }
      
      newPixels[index] = pixel;
      
      // Simetri (Kare Modu İçin Basit Simetri)
      if (isSymmetry && drawMode === 'full') {
        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);
        
        const x2 = GRID_SIZE - 1 - x;
        const index2 = y * GRID_SIZE + x2;
        newPixels[index2] = { tl: selectedColor, br: selectedColor };
        
        const y3 = GRID_SIZE - 1 - y;
        const index3 = y3 * GRID_SIZE + x;
        newPixels[index3] = { tl: selectedColor, br: selectedColor };

        const index4 = y3 * GRID_SIZE + x2;
        newPixels[index4] = { tl: selectedColor, br: selectedColor };
      }
      
      return newPixels;
    });
  };

  const sendMotif = () => {
    if (socketRef.current) {
      console.log("Motif gönderiliyor...", pixels);
      socketRef.current.emit('pixel-data', pixels);
      if (navigator.vibrate) navigator.vibrate(50);
      alert("Motif Halıya Uçtu! 🦅🧶");
      clear();
    } else {
      alert("Bağlantı yok!");
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#2c3e50', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', boxSizing: 'border-box' }}>
      <h2 style={{ color: 'white', margin: '10px 0' }}>Dokuma Tezgahı</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={() => setIsSymmetry(!isSymmetry)} style={{ background: isSymmetry ? '#f39c12' : '#7f8c8d', color: 'white', padding: '8px 12px', borderRadius: '8px', border: 'none' }}>
          {isSymmetry ? '🦋 Simetri' : '🌑 Simetri'}
        </button>
        <button onClick={() => setDrawMode(drawMode === 'full' ? 'triangle' : 'full')} style={{ background: drawMode === 'full' ? '#3498db' : '#9b59b6', color: 'white', padding: '8px 12px', borderRadius: '8px', border: 'none' }}>
          {drawMode === 'full' ? '⬛ Kare' : '🔺 Üçgen'}
        </button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, 
        width: '90vw', 
        maxWidth: '400px', 
        aspectRatio: '1/1', 
        background: '#fff',
        touchAction: 'none'
      }}>
        {pixels.map((p, i) => (
          <div key={i} style={{ position: 'relative', border: '1px solid #eee' }}
               onPointerDown={() => paint(i)}
               onPointerEnter={(e) => e.buttons === 1 && paint(i)}>
            
            {/* Eğer kare moduysa tek parça göster */}
            {drawMode === 'full' ? (
              <div style={{ width: '100%', height: '100%', background: p.tl }} />
            ) : (
              <>
                {/* Üçgen Modu: 2 Parça (TL ve BR) */}
                <div 
                  onClick={(e) => { e.stopPropagation(); paint(i, 'tl'); }}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: p.tl, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} 
                />
                <div 
                  onClick={(e) => { e.stopPropagation(); paint(i, 'br'); }}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: '100%', height: '100%', background: p.br, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} 
                />
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {PALETTE.map(color => (
          <div key={color} onClick={() => setSelectedColor(color)} style={{ width: '35px', height: '35px', borderRadius: '50%', background: color, border: selectedColor === color ? '3px solid white' : '2px solid transparent', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginTop: 'auto', marginBottom: '20px' }}>
        <button onClick={clear} style={{ padding: '12px 24px', background: '#e74c3c', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>🗑️ Temizle</button>
        <button onClick={sendMotif} style={{ padding: '12px 24px', background: '#27ae60', color: 'white', borderRadius: '8px', border: 'none', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>🚀 Gönder</button>
      </div>
    </div>
  );
}
