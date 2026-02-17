import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SHARED_BOX_GEO, FLYING_MAT } from './materials';


// =============================================================================
// 🧶 UÇAN İPLİKLER — 3D InstancedMesh Parçacık Sistemi
// =============================================================================
// Çizimdeki renkli pikseller spiral eğrilerde uçar,
// ~5sn dolaştıktan sonra halıya iplik olarak dokunur.

function FlyingPixelsInstances({ queueRef, onLand }) {
    const meshRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const _color = useMemo(() => new THREE.Color(), []);
    const lastSoundRef = useRef(0); // Son uçuş notası zamanı

    useFrame((state, delta) => {
        if (!meshRef.current || !queueRef.current) return;

        const queue = queueRef.current;
        const now = Date.now();
        const maxInstances = 5000;

        queue.forEach((item, i) => {
            if (i >= maxInstances) return;

            // Başlangıç gecikmesi — henüz sırası gelmemiş
            if (now < item.startTime) {
                dummy.position.set(0, -5000, 0);
                dummy.scale.setScalar(0);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(i, dummy.matrix);
                return;
            }

            // İlerleme hesapla (değişken hız)
            item.progress += delta * (item.speed || 0.18);

            if (item.progress >= 1) {
                // Hedefe ulaştı — halıya dokun
                if (!item.landed) {
                    item.landed = true;
                    onLand(item);
                }
                dummy.position.set(0, -5000, 0);
                dummy.scale.setScalar(0);
            } else {
                // Eğri üzerindeki pozisyon
                const point = item.curve.getPoint(item.progress);
                const nextPoint = item.curve.getPoint(Math.min(1, item.progress + 0.01));

                dummy.position.set(point.x, point.y, point.z);
                dummy.lookAt(nextPoint);

                // Kendi ekseninde dönüş (dinamik iplik hareketi)
                dummy.rotateZ(item.progress * 12);

                // Boyut: ortada büyük, uçlarda küçük
                const scale = (Math.sin(item.progress * Math.PI) * 0.8 + 0.3);
                dummy.scale.setScalar(scale);
            }

            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);

            // Renk
            _color.set(item.color);
            meshRef.current.setColorAt(i, _color);
        });

        // Kullanılmayan instance'ları gizle
        for (let j = queue.length; j < maxInstances; j++) {
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
            args={[SHARED_BOX_GEO, FLYING_MAT, 5000]}
            frustumCulled={false}
        />
    );
}

export default FlyingPixelsInstances;
