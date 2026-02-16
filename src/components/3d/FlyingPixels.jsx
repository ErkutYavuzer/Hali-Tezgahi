import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SHARED_BOX_GEO, FLYING_MAT } from './materials';

// ✨ PARTICLE SYSTEM COMPONENT
function FlyingParticles({ queueRef }) {
    const meshRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const particleGeo = useMemo(() => new THREE.PlaneGeometry(0.5, 0.5), []);
    const particleMat = useMemo(() => new THREE.MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    }), []);

    useFrame((state) => {
        if (!meshRef.current || !queueRef.current) return;
        const queue = queueRef.current;
        let pIndex = 0;

        queue.forEach((item) => {
            if (item.landed) return;
            // Her uçan piksel için arkasına 5-10 tane partikül dizelim
            const trailLength = 10;
            for (let t = 0; t < trailLength; t++) {
                if (pIndex >= 8000) break; // Max particle limit

                const lag = t * 0.02; // Gecikme
                const trailProgress = Math.max(0, item.progress - lag);

                if (trailProgress <= 0) continue;

                const point = item.curve.getPoint(trailProgress);

                // Hafif dağılmış pozisyon
                const jitter = (Math.random() - 0.5) * 0.5;
                dummy.position.set(point.x + jitter, point.y + jitter, point.z + jitter);

                // Kameraya bakması için (Billboard effect - basitçe yukarı baksa da olur veya lookAt camera)
                dummy.lookAt(state.camera.position);

                const scale = (1 - t / trailLength) * 0.8;
                dummy.scale.setScalar(scale);

                dummy.updateMatrix();
                meshRef.current.setMatrixAt(pIndex, dummy.matrix);

                // Renk güncelle (Sıcaktan soğuğa veya sabit altın rengi)
                const color = new THREE.Color(typeof item.data === 'object' ? item.data.tl : item.data);
                // Biraz açalım rengi
                color.lerp(new THREE.Color('#ffffff'), 0.5);
                meshRef.current.setColorAt(pIndex, color);

                pIndex++;
            }
        });

        // Geri kalanları temizle
        for (let j = pIndex; j < 8000; j++) {
            dummy.position.set(0, -9999, 0);
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(j, dummy.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[particleGeo, particleMat, 8000]} frustumCulled={false} />
    );
}

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

                    // 🎵 SES EFEKTİ
                    try {
                        const colorHex = typeof item.data === 'object' ? item.data.tl : item.data;
                        import('../../audio/AudioManager').then(({ audioManager }) => {
                            audioManager.playNoteForColor(colorHex);
                        });
                    } catch (e) {
                        // Ses hatası kritik değil
                    }
                }
                // Görünmez yap ve silinmeyi bekle
                dummy.position.set(0, -5000, 0);
                dummy.scale.setScalar(0);
            } else {
                // Eğri üzerindeki pozisyonu bul
                const point = item.curve.getPoint(item.progress);

                // Bir sonraki noktaya bakarak yönü ayarla (Yılan kafası ileri bakar)
                const nextPoint = item.curve.getPoint(Math.min(1, item.progress + 0.01));
                dummy.position.set(point.x, point.y, point.z);
                dummy.lookAt(nextPoint); // 🐍 Yönü gidiş yönüne çevir

                // Ekstra kendi ekseninde dönüş (Daha dinamik)
                dummy.rotateZ(item.progress * 10);

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
        <group>
            {/* Ana Pikseller */}
            <instancedMesh
                ref={meshRef}
                args={[SHARED_BOX_GEO, FLYING_MAT, 1000]}
                frustumCulled={false}
            />
            {/* 🌟 Parçacık İzi */}
            <FlyingParticles queueRef={queueRef} />
        </group>
    );
}

export default FlyingPixelsInstances;
