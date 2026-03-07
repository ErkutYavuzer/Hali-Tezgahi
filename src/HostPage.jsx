import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { io } from 'socket.io-client';
import * as THREE from 'three';
import CarpetBoard from './components/3d/CarpetBoard';
import { CarpetBorder, CarpetFringes, BORDER_WIDTH } from './components/3d/CarpetBorder';
import { CONFIG } from './constants';
import { audioManager } from './audio/AudioManager';

const initAudio = () => {
  audioManager.init().then(() => {/* console.log('🔊 Audio System Initialized') */ });
};

// ✨ HAVADA SÜZÜLEN TOZ PARÇACIKLARI — zamansız atmosfer
function FloatingDust({ count = 80 }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 120,
      y: Math.random() * 80 - 10,
      z: (Math.random() - 0.5) * 80,
      scale: 0.03 + Math.random() * 0.08,
      speedY: 0.002 + Math.random() * 0.008,
      speedX: (Math.random() - 0.5) * 0.003,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.1 + Math.random() * 0.3,
    }));
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    particles.forEach((p, i) => {
      p.y += p.speedY;
      if (p.y > 70) p.y = -10;

      dummy.position.set(
        p.x + Math.sin(t * p.driftSpeed + p.drift) * 2,
        p.y,
        p.z + Math.cos(t * p.driftSpeed * 0.7 + p.drift) * 1.5
      );
      dummy.scale.setScalar(p.scale * (0.7 + Math.sin(t * 0.5 + i) * 0.3));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ffd699" transparent opacity={0.35} />
    </instancedMesh>
  );
}

// BackdropGlow kaldırıldı — halı boşlukta süzülüyor, arka plan saf siyah

// 🧶 HALININ RÜZGAR ANİMASYONU — Boşlukta süzülen, hafif sallanan kilim
function BreathingCarpet({ socket, onCarpetCanvasReady }) {
  const groupRef = useRef();
  const innerRef = useRef();
  const carpetWidth = CONFIG.CARPET_WIDTH;
  const carpetDepth = CONFIG.CARPET_DEPTH;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      // 🌬️ Yumuşak rüzgar sallanımı
      // Y pozisyon: yavaş nefes alma (süzülme hissi)
      groupRef.current.position.y = 22 + Math.sin(t * 0.3) * 0.15;
      // Y rotation: hafif yalpalama
      groupRef.current.rotation.y = Math.sin(t * 0.15) * 0.012;
    }
    if (innerRef.current) {
      // X rotation: öne-arkaya rüzgar eğimi (tabii halat etkisi)
      innerRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.2) * 0.015;
      // Z rotation: sola-sağa hafif eğim (rüzgar değişimi)
      innerRef.current.rotation.z = Math.sin(t * 0.25 + 1.5) * 0.008;
    }
  });

  return (
    <group ref={groupRef} position={[0, 22, 0]}>
      <group ref={innerRef} rotation={[Math.PI / 2, 0, 0]}>
        <CarpetBoard socket={socket} carpetWidth={carpetWidth} carpetDepth={carpetDepth} onCarpetCanvasReady={onCarpetCanvasReady}
          onCelebrationDone={() => {
            console.log('🎉 Kutlama animasyonu tamamlandı!');

            // ✅ QR kodu HEMEN göster
            const origin = window.location.origin;
            const downloadUrl = `${origin}/?role=download`;
            const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(downloadUrl)}`;
            setDownloadQrUrl(qr);
            setShowCelebration(true);

            // 🎥 Video arka planda durdur/yükle
            setTimeout(() => {
              try {
                const recorder = mediaRecorderRef.current;
                if (recorder && recorder.state !== 'inactive') {
                  recorder.onstop = async () => {
                    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                    try {
                      const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')
                        ? `http://${window.location.hostname}:3003`
                        : window.location.origin;
                      await fetch(`${socketUrl}/api/upload-celebration-video`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'video/webm' },
                        body: blob,
                      });
                    } catch (err) { console.warn('Video yükleme hatası:', err.message); }
                  };
                  recorder.stop();
                }
              } catch (err) { console.warn('Recorder hatası:', err.message); }
            }, 500);
          }}>
          <CarpetBorder width={carpetWidth} depth={carpetDepth} />
          <CarpetFringes width={carpetWidth} depth={carpetDepth} />
        </CarpetBoard>
      </group>
    </group>
  );
}

// Animasyon artık 3D sahnede FlyingPixels ile yapılıyor (CarpetBoard içinde)

// 🏠 ANA SAYFA
export default function HostPage() {
  const [showPanel, setShowPanel] = useState(false);
  const [qrImageURL, setQrImageURL] = useState('');
  const [socket, setSocket] = useState(null);
  const [maxDrawings, setMaxDrawings] = useState(28);
  const [drawingCount, setDrawingCount] = useState(0);
  const [connectedClients, setConnectedClients] = useState(0);
  const [clearConfirm, setClearConfirm] = useState(false);
  const clearTimerRef = useRef(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [downloadQrUrl, setDownloadQrUrl] = useState('');
  const [showDownloadQr, setShowDownloadQr] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(70);
  const serverIpRef = useRef('');
  const carpetCanvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const confettiPieces = useMemo(() => {
    const palette = ['#ffd700', '#ff6b35', '#ff3366', '#4ecdc4', '#667eea', '#ff69b4', '#00ff88', '#ff4444', '#44bbff'];
    return Array.from({ length: 80 }, (_, idx) => {
      const size = 6 + Math.random() * 8;
      return {
        id: `confetti_${idx}_${Math.random().toString(36).slice(2, 8)}`,
        left: `${Math.random() * 100}%`,
        top: `-${10 + Math.random() * 20}px`,
        size,
        color: palette[idx % palette.length],
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        duration: 2 + Math.random() * 3,
        delay: Math.random() * 2,
        rotation: Math.random() * 360,
      };
    });
  }, []);

  // 🤖 AI Motif State
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiStatus, setAiStatus] = useState({ activeRequests: 0, queueLength: 0 });
  const [aiProcessingCount, setAiProcessingCount] = useState(0);
  const [aiCompletedCount, setAiCompletedCount] = useState(0);

  const WEAVER_OPTIONS = [12, 20, 28, 40, 50, 60];

  const getCarpetImageData = useCallback(() => {
    if (carpetCanvasRef.current) {
      return carpetCanvasRef.current.toDataURL('image/png');
    }
    const canvas = document.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : null;
  }, []);

  const handleCarpetCanvasReady = useCallback((canvas) => {
    carpetCanvasRef.current = canvas;
  }, []);

  // 🔊 İlk tıklamada ses sistemini başlat
  useEffect(() => {
    const handleFirstClick = () => {
      initAudio();
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);
    return () => document.removeEventListener('click', handleFirstClick);
  }, []);

  useEffect(() => {
    const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')
      ? `http://${window.location.hostname}:3003`
      : window.location.origin;

    const newSocket = io(socketUrl, {
      transports: ['polling', 'websocket'],
      upgrade: true
    });
    setSocket(newSocket);

    newSocket.on('server-ip', ({ ip }) => {
      serverIpRef.current = ip; // Lokal referans için sakla
      // K8s/Ingress: Her zaman browser origin'i kullan (hali-mozaik.mindops.net)
      const origin = window.location.origin;
      const clientUrl = `${origin}/?role=client`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(clientUrl)}`;
      setQrImageURL(qrUrl);
    });

    newSocket.on('drawing-count', (count) => {
      setDrawingCount(count);
    });
    newSocket.on('client-count', (count) => setConnectedClients(count));
    newSocket.on('max-drawings', (max) => setMaxDrawings(max));

    // 🤖 AI eventleri
    newSocket.on('ai-mode', (enabled) => setAiEnabled(enabled));
    newSocket.on('ai-status', (status) => setAiStatus(status));
    newSocket.on('ai-processing', () => setAiProcessingCount(c => c + 1));
    newSocket.on('ai-drawing-ready', () => {
      setAiCompletedCount(c => c + 1);
      setAiProcessingCount(c => Math.max(0, c - 1));
    });

    // AI durumunu sor
    newSocket.emit('get-ai-status');

    // 🎉 Halı tamamlandı!
    newSocket.on('carpet-complete', ({ total }) => {
      console.log(`🎉 Halı tamamlandı! ${total} çizim`);

      // 🎥 Video kaydını başlat (3D canvas)
      try {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const stream = canvas.captureStream(30); // 30 FPS
          const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 5000000, // 5 Mbps
          });
          recordedChunksRef.current = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunksRef.current.push(e.data);
          };
          recorder.start(100); // 100ms çunk size
          mediaRecorderRef.current = recorder;
          console.log('🎥 Video kaydı başladı!');
        }
      } catch (err) {
        console.warn('🎥 MediaRecorder başlatılamadı:', err.message);
      }

      // ✅ QR + celebration overlay 32 saniye sonra göster + halı snapshot kaydet
      setTimeout(() => {
        // 📸 Önce 3D canvas'ın ekran görüntüsünü kaydet (halı tam görünüyor)
        try {
          const threeCanvas = document.querySelector('canvas');
          if (threeCanvas) {
            const scale = 1200 / threeCanvas.width;
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = 1200;
            tmpCanvas.height = Math.round(threeCanvas.height * scale);
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(threeCanvas, 0, 0, tmpCanvas.width, tmpCanvas.height);
            tmpCanvas.toBlob((blob) => {
              if (blob) {
                const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')
                  ? `http://${window.location.hostname}:3003`
                  : window.location.origin;
                fetch(`${socketUrl}/api/carpet-image-upload`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'image/png' },
                  body: blob,
                }).then(() => console.log('📸 Halı snapshot kaydedildi!'))
                  .catch(e => console.warn('📸 Upload hatası:', e.message));
              }
            }, 'image/png');
          }
        } catch (e) { console.warn('📸 Snapshot hatası:', e.message); }

        // QR göster
        const origin = window.location.origin;
        const downloadUrl = `${origin}/?role=download`;
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(downloadUrl)}`;
        setDownloadQrUrl(qr);
        setShowCelebration(true);
      }, 32000);
    });

    // 📸 Admin'den snapshot talebi
    newSocket.on('take-snapshot', ({ eventId }) => {
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const imageData = canvas.toDataURL('image/png');
          newSocket.emit('snapshot-data', { eventId, dataUrl: imageData });
          console.log('📸 Snapshot gönderildi');
        }
      }, 500);
    });

    // 🧶 Halı görüntüsü talebi (oturum arşivi için)
    newSocket.on('request-carpet-image', () => {
      setTimeout(() => {
        const imageData = getCarpetImageData();
        if (imageData) {
          newSocket.emit('carpet-image-save', imageData);
          console.log('🧶 Halı görüntüsü gönderildi');
        }
      }, 300);
    });

    // 🎉 Admin'den kutlama QR overlay aç/kapat
    newSocket.on('toggle-celebration-qr', ({ show }) => {
      if (show) {
        const origin = window.location.origin;
        const downloadUrl = `${origin}/?role=download`;
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(downloadUrl)}`;
        setDownloadQrUrl(qr);
        setShowCelebration(true);
        console.log('🎉 Admin kutlama QR açtı');
      } else {
        setShowCelebration(false);
        console.log('🎉 Admin kutlama QR kapattı');
      }
    });

    return () => {
      newSocket.off('server-ip');
      newSocket.off('drawing-count');
      newSocket.off('client-count');
      newSocket.off('carpet-complete');
      newSocket.off('take-snapshot');
      newSocket.off('request-carpet-image');
      newSocket.off('toggle-celebration-qr');
      newSocket.close();
    };
  }, [getCarpetImageData]);

  const handleMaxDrawingsChange = useCallback((val) => {
    setMaxDrawings(val);
    if (socket) socket.emit('set-max-drawings', val);
  }, [socket]);

  const handleReset = useCallback(() => {
    if (clearConfirm) {
      if (socket) socket.emit('manual-reset');
      setClearConfirm(false);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    } else {
      setClearConfirm(true);
      clearTimerRef.current = setTimeout(() => setClearConfirm(false), 3000);
    }
  }, [socket, clearConfirm]);

  const panelStyle = {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: showPanel ? '320px' : '0px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(10,10,30,0.98) 100%)',
    backdropFilter: 'blur(20px)',
    borderLeft: showPanel ? '1px solid rgba(255,255,255,0.08)' : 'none',
    transition: 'width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    overflowX: 'hidden', overflowY: 'auto', zIndex: 200, display: 'flex', flexDirection: 'column',
    fontFamily: "'Inter', 'Segoe UI', sans-serif", color: 'white',
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'radial-gradient(ellipse at 50% 35%, #0c0a14 0%, #030305 60%, #000000 100%)' }}>
      <Canvas
        shadows dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        {/* Arka plan — halı zemin rengi (siyahlık yok) */}
        <color attach="background" args={['#d4c9b0']} />

        <PerspectiveCamera makeDefault position={[0, 22, 18]} fov={70} />

        {/* ═══════════════════════════════════════════════════ */}
        {/* 🌟 MÜZE AYDINLATMASI — Halı yıldız, sahne karanlık */}
        {/* ═══════════════════════════════════════════════════ */}

        {/* Ambient — yeterince aydınlık ama dramatik */}
        <ambientLight intensity={0.5} color="#e8dcc8" />

        {/* ☀️ Ana müze spot — üstten, geniş, sıcak beyaz */}
        <spotLight
          position={[5, 70, 50]} angle={0.55} penumbra={0.6}
          intensity={60} castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          color="#fff8f0"
          target-position={[0, 22, 0]}
        />

        {/* 🌙 İkinci spot — hafif yandan, derinlik veren */}
        <spotLight
          position={[-30, 55, 35]} angle={0.5} penumbra={0.8}
          intensity={25} color="#ffe4c4"
        />

        {/* ✨ Altın backlight — arkadan halo yaratır */}
        <spotLight
          position={[0, 40, -20]} angle={0.7} penumbra={1}
          intensity={20} color="#ffd700"
        />

        {/* Simetrik kenar fill ışıkları */}
        <pointLight position={[50, 30, 30]} intensity={8} color="#ffeedd" distance={100} decay={2} />
        <pointLight position={[-50, 30, 30]} intensity={8} color="#ffeedd" distance={100} decay={2} />

        {/* Alt rim — halı kenarlarını aydınlatır */}
        <pointLight position={[0, 0, 50]} intensity={4} color="#e8c99a" distance={80} decay={2} />

        {/* ═══════════════════════════════════════════════════ */}
        {/* 🧶 SAHNEDEKİ NESNELER                              */}
        {/* ═══════════════════════════════════════════════════ */}

        {/* BackdropGlow kaldırıldı — saf siyah arka plan */}

        {/* 🧶 HALI — tam ekran görünüm */}
        <BreathingCarpet socket={socket} onCarpetCanvasReady={handleCarpetCanvasReady} />

      </Canvas>

      {/* Animasyonlar artık 3D sahnede CarpetBoard/FlyingPixels ile yapılıyor */}

      {/* ═══ TOGGLE BUTONU ═══ */}
      <button
        type="button"
        onClick={() => { setShowPanel(!showPanel); initAudio(); }}
        style={{
          position: 'absolute', top: 20, right: showPanel ? 330 : 20,
          width: 50, height: 50, borderRadius: '50%',
          background: showPanel ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: '1px solid rgba(255,255,255,0.15)', color: 'white',
          fontSize: '22px', cursor: 'pointer', zIndex: 300,
          transition: 'all 0.4s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {showPanel ? '✕' : '⚙️'}
      </button>

      {/* ═══ YAN PANEL ═══ */}
      <div style={panelStyle}>
        <div style={{ padding: '30px 24px', minWidth: 280 }}>

          {/* LOGO */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.4, marginBottom: 6 }}>KONTROL PANELİ</div>
            <div style={{
              fontSize: 22, fontWeight: 800, letterSpacing: -1,
              background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>DİJİTAL MOTİF ATÖLYESİ</div>
          </div>

          {/* DURUM KARTLARI */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {[
              { val: drawingCount, label: 'ÇİZİM', color: '#4ecdc4' },
              { val: maxDrawings, label: 'KAPASİTE', color: '#ff6b6b' },
              { val: connectedClients, label: 'BAĞLI', color: '#ffd700' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 10px',
                textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* 📊 DOLULUK GÖSTERGE ÇUBUĞU */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, opacity: 0.4, letterSpacing: 2 }}>DOLULUK</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: drawingCount >= maxDrawings ? '#ff4444' : '#4ecdc4' }}>
                {maxDrawings > 0 ? Math.round((drawingCount / maxDrawings) * 100) : 0}%
              </span>
            </div>
            <div style={{
              width: '100%', height: 8, borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${maxDrawings > 0 ? (drawingCount / maxDrawings) * 100 : 0}%`,
                height: '100%', borderRadius: 4,
                background: drawingCount >= maxDrawings
                  ? 'linear-gradient(90deg, #ff4444, #ff6b6b)'
                  : 'linear-gradient(90deg, #4ecdc4, #44bd32, #ffd700)',
                transition: 'width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                boxShadow: drawingCount >= maxDrawings ? '0 0 10px rgba(255,68,68,0.4)' : '0 0 8px rgba(78,205,196,0.3)',
              }} />
            </div>
          </div>

          {/* DOKUMACI SAYISI */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.4, marginBottom: 12 }}>DOKUMACI SAYISI</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {WEAVER_OPTIONS.map(n => (
                <button type="button" key={n} onClick={() => handleMaxDrawingsChange(n)} style={{
                  padding: '12px 0', borderRadius: 12, cursor: 'pointer',
                  fontWeight: 700, fontSize: 16, fontFamily: 'inherit',
                  transition: 'all 0.25s ease',
                  background: maxDrawings === n
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'rgba(255,255,255,0.04)',
                  border: maxDrawings === n
                    ? '1px solid rgba(102, 126, 234, 0.5)'
                    : '1px solid rgba(255,255,255,0.08)',
                  color: maxDrawings === n ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: maxDrawings === n ? '0 4px 15px rgba(102, 126, 234, 0.3)' : 'none',
                }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* QR KOD */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.4, marginBottom: 12 }}>QR KOD İLE KATIL</div>
            <div style={{
              background: 'white', borderRadius: 16, padding: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {qrImageURL && <img src={qrImageURL} alt="QR" style={{ width: 160, height: 160, display: 'block' }} />}
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, opacity: 0.4 }}>
              Aynı Wi-Fi ağında telefonla tarayın
            </div>
          </div>

          {/* 🖼️ GALERİ QR KOD */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.4, marginBottom: 12 }}>🖼️ MOTİF GALERİSİ</div>
            <div style={{
              background: 'white', borderRadius: 16, padding: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(window.location.origin + '/?role=gallery')}`}
                alt="Galeri QR"
                style={{ width: 120, height: 120, display: 'block' }}
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, opacity: 0.35 }}>
              Tüm motifleri görmek ve indirmek için tarayın
            </div>
          </div>

          {/* 🔊 SES KONTROL */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: 14,
            padding: '12px 16px', marginBottom: 10,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <button type="button" onClick={() => {
                const newMuted = !isMuted;
                setIsMuted(newMuted);
                audioManager.setMuted(newMuted);
              }} style={{
                width: 36, height: 36, borderRadius: 10,
                background: isMuted
                  ? 'rgba(255,59,48,0.15)'
                  : 'rgba(78,205,196,0.15)',
                border: isMuted
                  ? '1px solid rgba(255,59,48,0.3)'
                  : '1px solid rgba(78,205,196,0.3)',
                color: isMuted ? '#ff6b6b' : '#4ecdc4',
                cursor: 'pointer', fontSize: 18, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit', transition: 'all 0.3s',
              }}>
                {isMuted ? '🔇' : '🔊'}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4, letterSpacing: 1 }}>SES SEVİYESİ</div>
                <input
                  type="range" min="0" max="100" value={isMuted ? 0 : volumeLevel}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setVolumeLevel(val);
                    if (isMuted && val > 0) {
                      setIsMuted(false);
                      audioManager.setMuted(false);
                    }
                    audioManager.setVolume(val / 100);
                  }}
                  style={{
                    width: '100%', height: 4, appearance: 'none', WebkitAppearance: 'none',
                    background: `linear-gradient(to right, ${isMuted ? '#555' : '#4ecdc4'} ${isMuted ? 0 : volumeLevel}%, rgba(255,255,255,0.1) ${isMuted ? 0 : volumeLevel}%)`,
                    borderRadius: 2, outline: 'none', cursor: 'pointer',
                  }}
                />
              </div>
              <span style={{ fontSize: 12, opacity: 0.4, minWidth: 28, textAlign: 'right' }}>
                {isMuted ? '0' : volumeLevel}%
              </span>
            </div>
          </div>

          {/* 🤖 AI MOTİF KONTROL */}
          <div style={{
            background: aiEnabled
              ? 'rgba(139, 92, 246, 0.08)'
              : 'rgba(255,255,255,0.04)',
            borderRadius: 14,
            padding: '12px 16px', marginBottom: 10,
            border: aiEnabled
              ? '1px solid rgba(139, 92, 246, 0.2)'
              : '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>AI Motif</span>
              </div>
              <button type="button" onClick={() => {
                const newVal = !aiEnabled;
                setAiEnabled(newVal);
                socket?.emit('toggle-ai', newVal);
              }} style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                background: aiEnabled
                  ? 'linear-gradient(135deg, #8b5cf6, #a855f7)'
                  : 'rgba(255,255,255,0.1)',
                border: 'none', position: 'relative',
                transition: 'all 0.3s ease',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', position: 'absolute',
                  top: 3,
                  left: aiEnabled ? 23 : 3,
                  transition: 'left 0.3s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
            {aiEnabled && (
              <div style={{ fontSize: 11, opacity: 0.5, lineHeight: 1.4 }}>
                {
                  aiStatus.activeRequests > 0
                    ? `✨ ${aiStatus.activeRequests} motif işleniyor${aiStatus.queueLength > 0 ? ` (+${aiStatus.queueLength} kuyrukta)` : ''}...`
                    : aiCompletedCount > 0
                      ? `✅ ${aiCompletedCount} motif dönüştürüldü`
                      : 'Çizimler otomatik kilim motifine dönüştürülecek'
                }
              </div>
            )}
          </div>

          {/* 📸 HALIYI İNDİR */}
          <button type="button" onClick={() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
              const link = document.createElement('a');
              link.download = `dijital_motif_${Date.now()}.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();
            }
          }} style={{
            width: '100%', padding: '14px', borderRadius: 14, cursor: 'pointer',
            background: 'rgba(78, 205, 196, 0.08)',
            border: '1px solid rgba(78, 205, 196, 0.15)',
            color: '#4ecdc4', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
            transition: 'all 0.3s ease', letterSpacing: 1, marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            📸 ESERİ İNDİR
          </button>

          {/* 📱 İNDİRME QR KODU — Sadece halı tamamlandığında */}
          {drawingCount >= maxDrawings && (
            <>
              <button type="button" onClick={() => {
                if (!showDownloadQr) {
                  // QR URL oluştur — browser origin kullan (K8s uyumlu)
                  const origin = window.location.origin;
                  const downloadUrl = `${origin}/?role=download`;
                  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(downloadUrl)}`;
                  setDownloadQrUrl(qr);

                  // Halı görüntüsünü sunucuya kaydet
                  if (socket) {
                    const imageData = getCarpetImageData();
                    if (imageData) socket.emit('carpet-image-save', imageData);
                  }
                }
                setShowDownloadQr(!showDownloadQr);
              }} style={{
                width: '100%', padding: '14px', borderRadius: 14, cursor: 'pointer',
                background: showDownloadQr
                  ? 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,107,53,0.1))'
                  : 'rgba(255, 215, 0, 0.08)',
                border: showDownloadQr
                  ? '1px solid rgba(255,215,0,0.4)'
                  : '1px solid rgba(255,215,0,0.15)',
                color: '#ffd700', fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
                transition: 'all 0.3s ease', letterSpacing: 1, marginBottom: showDownloadQr ? 0 : 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {showDownloadQr ? '✕ QR KAPAT' : '📱 İNDİRME QR AÇ'}
              </button>

              {showDownloadQr && (
                <div style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: '0 0 14px 14px',
                  padding: 16, marginBottom: 10, textAlign: 'center',
                  border: '1px solid rgba(255,215,0,0.15)', borderTop: 'none',
                }}>
                  <div style={{
                    background: 'white', borderRadius: 12, padding: 10,
                    display: 'inline-block', marginBottom: 8,
                  }}>
                    {downloadQrUrl && <img src={downloadQrUrl} alt="İndir QR" style={{ width: 150, height: 150, display: 'block' }} />}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>Telefonla tarayarak halıyı indir</div>
                </div>
              )}
            </>
          )}

          {/* TEMİZLE BUTONU — Inline 2-Tık Onay */}
          <button type="button" onClick={handleReset} style={{
            width: '100%', padding: '14px', borderRadius: 14, cursor: 'pointer',
            background: clearConfirm
              ? 'linear-gradient(135deg, rgba(255,59,48,0.3), rgba(255,59,48,0.15))'
              : 'rgba(255, 59, 48, 0.08)',
            border: clearConfirm
              ? '1px solid rgba(255, 59, 48, 0.6)'
              : '1px solid rgba(255, 59, 48, 0.15)',
            color: clearConfirm ? '#ff4444' : '#ff6b6b',
            fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
            transition: 'all 0.3s ease', letterSpacing: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transform: clearConfirm ? 'scale(1.02)' : 'scale(1)',
            boxShadow: clearConfirm ? '0 0 20px rgba(255,59,48,0.2)' : 'none',
          }}>
            {clearConfirm ? '⚠️ EMİN MİSİN? TEKRAR TIKLA!' : '🧹 TÜM ÇİZİMLERİ TEMİZLE'}
          </button>
          {clearConfirm && (
            <div style={{
              textAlign: 'center', marginTop: 6, fontSize: 11,
              color: 'rgba(255,100,100,0.6)', animation: 'pulse 1s ease-in-out infinite',
            }}>
              3 saniye içinde tekrar tıklayın...
            </div>
          )}
        </div>
      </div>

      {/* 🎉 KUTLAMA OVERLAY */}
      {showCelebration && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.5s ease',
          overflowY: 'auto',
        }}>
          {/* Sabit kapatma butonu — her zaman görünür (iframe içinde de) */}
          <button type="button" onClick={() => setShowCelebration(false)} style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10001,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
            color: 'white', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', transition: 'all 0.3s',
          }}>✕</button>
          {/* Konfeti parçacıkları */}
          {confettiPieces.map((piece) => (
            <div key={piece.id} style={{
              position: 'absolute',
              left: piece.left,
              top: piece.top,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              background: piece.color,
              borderRadius: piece.borderRadius,
              animation: `confettiFall ${piece.duration}s ease-in ${piece.delay}s infinite`,
              opacity: 0.9,
              transform: `rotate(${piece.rotation}deg)`,
            }} />
          ))}

          {/* Altın ışıltı */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(circle at center, rgba(255,215,0,0.15) 0%, transparent 70%)',
            animation: 'pulse 2s ease infinite',
          }} />

          {/* İçerik */}
          <div style={{
            textAlign: 'center', zIndex: 1,
            animation: 'bounceIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}>
            <div style={{ fontSize: 80, marginBottom: 10 }}>🎉</div>
            <h1 style={{
              fontSize: 48, fontWeight: 900, color: 'white',
              fontFamily: "'Inter', sans-serif",
              textShadow: '0 0 40px rgba(255,215,0,0.5), 0 4px 20px rgba(0,0,0,0.5)',
              margin: '0 0 8px 0',
              background: 'linear-gradient(135deg, #ffd700, #ff6b35, #ffd700)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundSize: '300% 100%',
              animation: 'shimmer 3s linear infinite',
            }}>MOTİF TAMAMLANDI!</h1>
            <p style={{
              fontSize: 18, color: 'rgba(255,255,255,0.7)', margin: '0 0 30px 0',
              fontFamily: "'Inter', sans-serif",
            }}>
              {maxDrawings} dokumacının eseri bir araya geldi ✨
            </p>

            {/* İndirme QR Kodu */}
            {downloadQrUrl && (
              <div style={{
                background: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 20,
                display: 'inline-block', marginBottom: 20,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                animation: 'fadeInUp 1s ease 0.5s both',
              }}>
                <img src={downloadQrUrl} alt="İndir" style={{ width: 250, height: 250, display: 'block' }} />
                <div style={{
                  marginTop: 12, fontSize: 14, fontWeight: 700,
                  color: '#333', letterSpacing: 1,
                }}>📱 QR İLE ESERİ İNDİR</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              {/* Video İndir Butonu */}
              <button type="button" onClick={() => {
                const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')
                  ? `http://${window.location.hostname}:3003`
                  : window.location.origin;
                const link = document.createElement('a');
                link.download = `dijital_motif_kutlama_${Date.now()}.webm`;
                link.href = `${socketUrl}/api/celebration-video`;
                link.click();
              }} style={{
                padding: '14px 32px', borderRadius: 16, cursor: 'pointer',
                background: 'linear-gradient(135deg, #4ecdc4, #44bd32)',
                border: 'none', color: 'white', fontWeight: 700, fontSize: 16,
                fontFamily: "'Inter', sans-serif",
                boxShadow: '0 4px 20px rgba(78,205,196,0.4)',
                transition: 'all 0.3s', letterSpacing: 1,
              }}>
                🎨 ESERİ İNDİR
              </button>

              {/* Kapat Butonu */}
              <button type="button" onClick={() => setShowCelebration(false)} style={{
                padding: '14px 32px', borderRadius: 16, cursor: 'pointer',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)',
                fontWeight: 700, fontSize: 16, fontFamily: "'Inter', sans-serif",
                transition: 'all 0.3s', letterSpacing: 1,
              }}>
                ✕ KAPAT
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
