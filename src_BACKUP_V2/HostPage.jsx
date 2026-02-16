import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { io } from 'socket.io-client';

// Halı Yapılandırması (6x10 = 60 Parça)
const SLOT_COLS = 6; 
const SLOT_ROWS = 10; 
const PIXELS_PER_SLOT = 16; 
const NODE_SIZE = 0.25; 
const GAP = 0.1; 

// -----------------------------------------------------------------------------
// OPTİMİZASYON: Geometri ve Materyalleri Dışarı Al (Tek Sefer Oluştur) 🚀
// -----------------------------------------------------------------------------
const SHARED_BOX_GEO = new THREE.BoxGeometry(NODE_SIZE * 0.95, 0.05, NODE_SIZE * 0.95);
const SHARED_MAT_OPT = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.1 });

// Üçgenler için Geometri (Extrude Ayarları)
const EXTRUDE_SETTINGS = { depth: 0.05, bevelEnabled: false };

const TRIANGLE_SHAPE_TL = new THREE.Shape();
TRIANGLE_SHAPE_TL.moveTo(-0.5 * NODE_SIZE * 0.95, 0.5 * NODE_SIZE * 0.95);
TRIANGLE_SHAPE_TL.lineTo(0.5 * NODE_SIZE * 0.95, 0.5 * NODE_SIZE * 0.95);
TRIANGLE_SHAPE_TL.lineTo(-0.5 * NODE_SIZE * 0.95, -0.5 * NODE_SIZE * 0.95);
TRIANGLE_SHAPE_TL.lineTo(-0.5 * NODE_SIZE * 0.95, 0.5 * NODE_SIZE * 0.95);

const TRIANGLE_SHAPE_BR = new THREE.Shape();
TRIANGLE_SHAPE_BR.moveTo(0.5 * NODE_SIZE * 0.95, 0.5 * NODE_SIZE * 0.95);
TRIANGLE_SHAPE_BR.lineTo(0.5 * NODE_SIZE * 0.95, -0.5 * NODE_SIZE * 0.95);
TRIANGLE_SHAPE_BR.lineTo(-0.5 * NODE_SIZE * 0.95, -0.5 * NODE_SIZE * 0.95);
TRIANGLE_SHAPE_BR.lineTo(0.5 * NODE_SIZE * 0.95, 0.5 * NODE_SIZE * 0.95);

const SHARED_TRI_TL_GEO = new THREE.ExtrudeGeometry(TRIANGLE_SHAPE_TL, EXTRUDE_SETTINGS);
const SHARED_TRI_BR_GEO = new THREE.ExtrudeGeometry(TRIANGLE_SHAPE_BR, EXTRUDE_SETTINGS);

// Merkezlemek için (ExtrudeGeometry merkezi kayık olabilir)
SHARED_TRI_TL_GEO.center();
SHARED_TRI_BR_GEO.center();


// Tek Bir İlmek (Knot) Bileşeni - MEMOIZED (Gereksiz Render'ı Önler)
const Knot = React.memo(({ position, data }) => {
  const meshRef = useRef();
  
  const isSplit = typeof data === 'object' && data !== null;
  const baseColor = isSplit ? data.tl : data;

  // Kare Modu
  if (!isSplit || (data.tl === data.br)) {
      return (
        <mesh 
          ref={meshRef} 
          position={position} 
          geometry={SHARED_BOX_GEO} 
        >
          <meshStandardMaterial color={baseColor} roughness={0.9} />
        </mesh>
      );
  }

  // Üçgen Modu
  return (
    <group position={position}>
       <mesh 
         rotation={[Math.PI/2, 0, 0]} 
         position={[0, 0, 0]}
         geometry={SHARED_TRI_TL_GEO}
       >
          <meshStandardMaterial color={data.tl} roughness={0.9} />
       </mesh>
       <mesh 
         rotation={[Math.PI/2, 0, 0]} 
         position={[0, 0, 0]}
         geometry={SHARED_TRI_BR_GEO}
       >
          <meshStandardMaterial color={data.br} roughness={0.9} />
       </mesh>
    </group>
  );
}, (prevProps, nextProps) => {
  // Sadece veri (renk) değiştiyse render et
  if (prevProps.data === nextProps.data) return true; // Render etme
  if (typeof prevProps.data === 'object' && typeof nextProps.data === 'object') {
      return prevProps.data.tl === nextProps.data.tl && prevProps.data.br === nextProps.data.br;
  }
  return false; // Render et
});

const CarpetSlot = React.memo(({ id, pixels, position }) => {
  return (
    <group position={position}>
      {pixels.map((data, i) => {
        const x = i % PIXELS_PER_SLOT;
        const z = Math.floor(i / PIXELS_PER_SLOT);
        
        return (
          <Knot 
            key={i} 
            position={[
              (x - PIXELS_PER_SLOT/2) * NODE_SIZE, 
              0, 
              (z - PIXELS_PER_SLOT/2) * NODE_SIZE
            ]} 
            data={data} 
          />
        );
      })}
      
      {/* Zemin plakası gölge alabilir, sorun yok */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[PIXELS_PER_SLOT * NODE_SIZE, 0.02, PIXELS_PER_SLOT * NODE_SIZE]} />
        <meshStandardMaterial color="#34495e" />
      </mesh>
    </group>
  );
});

// -----------------------------------------------------------------------------
// YENİ: Yılan Animasyon Sistemi (Pixel Snake) 🐍🦅
// -----------------------------------------------------------------------------

// Helper: Slotun başlangıç pozisyonunu hesapla
function getSlotBasePosition(index) {
  const col = index % SLOT_COLS;
  const row = Math.floor(index / SLOT_COLS);
  
  const xPos = (col - SLOT_COLS/2 + 0.5) * (PIXELS_PER_SLOT * NODE_SIZE + GAP);
  const zPos = (row - SLOT_ROWS/2 + 0.5) * (PIXELS_PER_SLOT * NODE_SIZE + GAP);
  
  return { x: xPos, z: zPos };
}

// -----------------------------------------------------------------------------
// INSTANCED MESH OPTİMİZASYONU: Binlerce Uçan Piksel Tek Bir Objede 🚀🦅
// -----------------------------------------------------------------------------

function FlyingPixelsInstances({ queueRef, onLand }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!meshRef.current || !queueRef.current) return;

    // Kuyruktaki her pikseli güncelle
    const queue = queueRef.current;
    
    queue.forEach((item, i) => {
      // 1000 buffer sınırını aşarsak işlem yapma
      if (i >= 1000) return;

      // Başlangıç gecikmesi kontrolü
      if (Date.now() < item.startTime) {
        // Görünmez yap (Uzak bir yere at + Scale 0)
        dummy.position.set(0, -5000, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        return;
      }

      // İlerleme hesapla
      item.progress += delta * 0.5; // Hız

      if (item.progress >= 1) {
        // Hedefe ulaştı
        if (!item.landed) {
          item.landed = true;
          onLand(item);
        }
        // Görünmez yap ve silinmeyi bekle
        dummy.position.set(0, -5000, 0); 
        dummy.scale.setScalar(0);
      } else {
        // Eğri üzerindeki pozisyonu bul
        const point = item.curve.getPoint(item.progress);
        
        dummy.position.set(point.x, point.y, point.z);
        dummy.rotation.x += delta * 5;
        dummy.rotation.y += delta * 5;
        
        const scale = Math.sin(item.progress * Math.PI) + 0.5;
        dummy.scale.setScalar(scale);
      }

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Renk güncelle
      const color = new THREE.Color(typeof item.data === 'object' ? item.data.tl : item.data);
      meshRef.current.setColorAt(i, color);
    });
    
    // Kullanılmayan instance'ları gizle
    for (let j = queue.length; j < 1000; j++) {
        dummy.position.set(0, -5000, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(j, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[SHARED_BOX_GEO, SHARED_MAT_OPT, 1000]} // Max 1000 uçan piksel
      frustumCulled={false}
    />
  );
}

// -----------------------------------------------------------------------------
// SÜSLEMELER: Püsküller ve Tabanlık (Halı Havası) 🧶✨
// -----------------------------------------------------------------------------

// Püskül Geometrisi (İnce Silindir)
const FRINGE_GEO = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8);
const FRINGE_MAT = new THREE.MeshStandardMaterial({ color: '#ecf0f1', roughness: 1 }); // Krem/Beyaz yün rengi

function CarpetFringes({ width, depth }) {
  const meshRef = useRef();
  const count = Math.floor(width / 0.05) * 2; // Her 5cm'de bir püskül, alt ve üst için x2
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;

    let index = 0;
    
    // Üst Kenar (Top)
    for (let x = -width / 2; x <= width / 2; x += 0.04) {
      // Hafif rastgelelik (Doğal görünüm)
      const randX = (Math.random() - 0.5) * 0.02;
      const randRot = (Math.random() - 0.5) * 0.3;
      
      dummy.position.set(x + randX, 0, -depth / 2 - 0.3); // Halının hemen dışı
      dummy.rotation.set(Math.PI / 2, 0, randRot); // Yere yatır
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index++, dummy.matrix);
    }

    // Alt Kenar (Bottom)
    for (let x = -width / 2; x <= width / 2; x += 0.04) {
      const randX = (Math.random() - 0.5) * 0.02;
      const randRot = (Math.random() - 0.5) * 0.3;

      dummy.position.set(x + randX, 0, depth / 2 + 0.3);
      dummy.rotation.set(Math.PI / 2, 0, randRot);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(index++, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [width, depth]);

  return (
    <instancedMesh ref={meshRef} args={[FRINGE_GEO, FRINGE_MAT, count + 100]} />
  );
}

function MegaCarpet() {
  const [slotsData, setSlotsData] = useState(
    Array(SLOT_COLS * SLOT_ROWS).fill(null).map(() => 
      Array(PIXELS_PER_SLOT * PIXELS_PER_SLOT).fill('#222222')
    )
  );
  
  // Halı Boyutlarını Hesapla (Püsküller için)
  const carpetWidth = SLOT_COLS * (PIXELS_PER_SLOT * NODE_SIZE + GAP);
  const carpetDepth = SLOT_ROWS * (PIXELS_PER_SLOT * NODE_SIZE + GAP);

  // Uçan pikselleri REF olarak tutuyoruz (Render tetiklemesin)
  const flyingQueueRef = useRef([]); 
  const [queueVersion, setQueueVersion] = useState(0); // Kuyruk değiştiğinde re-render için

  useEffect(() => {
    const socket = io(window.location.hostname === 'localhost' ? 'http://localhost:3001' : `http://${window.location.hostname}:3001`);

    socket.on('update-slot', ({ slotId, pixels }) => {
      console.log(`🦅 Slot ${slotId} için YILAN saldırısı başladı!`);
      
      const basePos = getSlotBasePosition(slotId);
      
      // Rastgele Başlangıç
      const startPos = new THREE.Vector3(0, 40, 20);

      pixels.forEach((data, i) => {
        const xRel = i % PIXELS_PER_SLOT;
        const zRel = Math.floor(i / PIXELS_PER_SLOT);
        
        const targetX = basePos.x + (xRel - PIXELS_PER_SLOT/2) * NODE_SIZE;
        const targetZ = basePos.z + (zRel - PIXELS_PER_SLOT/2) * NODE_SIZE;
        const targetPos = new THREE.Vector3(targetX, 0, targetZ);

        // Bezier Eğrisi Oluştur
        const mid1 = new THREE.Vector3(
          startPos.x + (Math.random() - 0.5) * 20,
          startPos.y - 10,
          startPos.z + (Math.random() - 0.5) * 20
        );
        const mid2 = new THREE.Vector3(
          targetPos.x + (Math.random() - 0.5) * 5,
          targetPos.y + 5,
          targetPos.z + (Math.random() - 0.5) * 5
        );
        const curve = new THREE.CubicBezierCurve3(startPos, mid1, mid2, targetPos);

        flyingQueueRef.current.push({
          id: Date.now() + Math.random(),
          slotId,
          pixelIndex: i,
          data,
          curve,
          progress: 0,
          startTime: Date.now() + i * 5, // Gecikme
          landed: false
        });
      });
      
      // Re-render tetikle ki InstancedMesh yeni kuyruğu görsün
      setQueueVersion(v => v + 1);
    });

    return () => socket.disconnect();
  }, []);

  const handleLand = (item) => {
    // Halıya yapıştır
    setSlotsData(prev => {
      const newData = [...prev];
      if (!newData[item.slotId] || newData[item.slotId][0] === '#222222') { 
         if(!newData[item.slotId]) newData[item.slotId] = Array(PIXELS_PER_SLOT * PIXELS_PER_SLOT).fill('#222222');
      }
      const newSlotPixels = [...newData[item.slotId]];
      newSlotPixels[item.pixelIndex] = item.data;
      newData[item.slotId] = newSlotPixels;
      return newData;
    });

    // Kuyruktan sil
    const index = flyingQueueRef.current.findIndex(p => p.id === item.id);
    if (index > -1) {
        flyingQueueRef.current.splice(index, 1);
    }
  };

  return (
    <group>
      {/* 1. Statik Halı */}
      {slotsData.map((pixels, i) => {
        const pos = getSlotBasePosition(i);
        return (
          <CarpetSlot 
            key={i} 
            id={i} 
            pixels={pixels} 
            position={[pos.x, 0, pos.z]} 
          />
        );
      })}
      
      {/* 2. Uçan Pikseller (Instanced Mesh - Tek Obje) */}
      <FlyingPixelsInstances 
        queueRef={flyingQueueRef} 
        onLand={handleLand}
      />
      
      {/* 3. PÜSKÜLLER (Fringes) 🧶 */}
      <CarpetFringes width={carpetWidth} depth={carpetDepth} />

      {/* 4. Gelişmiş Zemin Tabanı (Backing) */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[carpetWidth + 0.5, 0.04, carpetDepth + 0.5]} /> {/* Biraz daha geniş */}
        <meshStandardMaterial color="#ecf0f1" roughness={1} /> {/* Krem rengi taban */}
      </mesh>
      
      {/* 5. Alt Zemin (Koyu Gölge/Zemin Kontrastı) */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
         <boxGeometry args={[carpetWidth, 0.02, carpetDepth]} />
         <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}

export default function HostPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
      <Canvas 
        shadows={false} 
        dpr={[1, 1.5]} 
        gl={{ antialias: false, powerPreference: "high-performance" }} 
      >
        <PerspectiveCamera makeDefault position={[0, 45, 35]} fov={50} />
        <OrbitControls 
          maxPolarAngle={Math.PI / 2.5} 
          minDistance={10}
          maxDistance={100}
        />
        
        <ambientLight intensity={0.5} />
        <spotLight 
          position={[20, 50, 20]} 
          angle={0.5} 
          penumbra={1} 
          intensity={2} 
        />
        <pointLight position={[-20, 10, -20]} intensity={1} color="#ff9f43" />

        <MegaCarpet />
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#000000" metalness={0.8} roughness={0.2} />
        </mesh>
      </Canvas>

      <div style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'white',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        pointerEvents: 'none'
      }}>
        <h1 style={{ margin: 0, textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>Kolektif Halı</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>72 Parça - Birlikte Dokuyun! 🧶</p>
      </div>
    </div>
  );
}
