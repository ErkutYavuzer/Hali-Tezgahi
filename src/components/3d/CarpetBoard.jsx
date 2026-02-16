import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../constants';
import {
    SHARED_BOX_GEO,
    WOOL_TEXTURE,
    WOOL_NORMAL,
    SHARED_TRI_TL_GEO,
    SHARED_TRI_BR_GEO
} from './materials';
import FlyingPixelsInstances from './FlyingPixels';
import { createWoolMaterial } from './shaders/WoolShader';

// -----------------------------------------------------------------------------
// HELPER FUNCTIONS
// -----------------------------------------------------------------------------

function getSlotBasePosition(index) {
    const col = index % CONFIG.SLOT_COLS;
    const row = Math.floor(index / CONFIG.SLOT_COLS);

    const xPos = (col - CONFIG.SLOT_COLS / 2 + 0.5) * (CONFIG.PIXELS_PER_SLOT * CONFIG.NODE_SIZE + CONFIG.GAP);
    const zPos = (row - CONFIG.SLOT_ROWS / 2 + 0.5) * (CONFIG.PIXELS_PER_SLOT * CONFIG.NODE_SIZE + CONFIG.GAP);

    return { x: xPos, z: zPos };
}

// -----------------------------------------------------------------------------
// CARPET SLOT COMPONENT (OPTIMIZED: INSTANCED MESH)
// -----------------------------------------------------------------------------

const CarpetSlot = React.memo(({ index, data, pos, isResetting, resetStartTime, woolMaterial }) => {
    const groupRef = useRef();
    const boxMeshRef = useRef();
    const tlMeshRef = useRef();
    const brMeshRef = useRef();

    const id = index;
    const pixels = data;
    const position = [pos.x, 0, pos.z];

    // Animasyon: Resetleme sırasında yukarı kalkma ve şeffaflaşma
    useFrame(() => {
        if (!groupRef.current || !isResetting) return;

        const elapsed = (Date.now() - resetStartTime) / 1000;
        const delay = id * 0.03;
        const progress = Math.max(0, Math.min(1, (elapsed - delay) / 2));

        if (progress > 0) {
            groupRef.current.position.y = position[1] + progress * 20;
            groupRef.current.scale.setScalar(1 - progress * 0.5);
            // InstancedMesh opacity yönetimi zor olduğu için kaba bir scale/position animasyonu şimdilik yeterli
        }
    });

    // Reset bittiğinde pozisyonu düzelt
    useEffect(() => {
        if (!isResetting && groupRef.current) {
            groupRef.current.position.set(position[0], position[1], position[2]);
            groupRef.current.scale.setScalar(1);
        }
    }, [isResetting, position]);

    // 🎨 INSTANCED MESH GÜNCELLEME
    useEffect(() => {
        if (!boxMeshRef.current || !tlMeshRef.current || !brMeshRef.current) return;

        let boxIdx = 0;
        let tlIdx = 0;
        let brIdx = 0;

        const dummy = new THREE.Object3D();
        const _color = new THREE.Color();

        pixels.forEach((data, i) => {
            const xRel = i % CONFIG.PIXELS_PER_SLOT;
            const zRel = Math.floor(i / CONFIG.PIXELS_PER_SLOT);

            // Düğüm Pozisyonu
            const x = (xRel - CONFIG.PIXELS_PER_SLOT / 2) * CONFIG.NODE_SIZE;
            const z = (zRel - CONFIG.PIXELS_PER_SLOT / 2) * CONFIG.NODE_SIZE;

            // Rastgelelik (Deterministik olması için i'ye bağlı olabilir veya sabit seed)
            const rotY = (Math.random() - 0.5) * 0.15;
            const rotX = (Math.random() - 0.5) * 0.05;
            const offX = (Math.random() - 0.5) * 0.005;
            const offZ = (Math.random() - 0.5) * 0.005;
            const scaleY = 0.9 + Math.random() * 0.2;

            dummy.position.set(x + offX, 0, z + offZ);
            dummy.rotation.set(rotX, rotY, 0);
            dummy.scale.set(1, scaleY, 1);
            dummy.updateMatrix();

            if (typeof data === 'object' && data !== null && data.tl !== data.br) {
                // Split Knot (Üçgenler)

                // TL Üçgen
                tlMeshRef.current.setMatrixAt(tlIdx, dummy.matrix);
                _color.set(data.tl);
                tlMeshRef.current.setColorAt(tlIdx, _color);
                tlIdx++;

                // BR Üçgen
                brMeshRef.current.setMatrixAt(brIdx, dummy.matrix);
                _color.set(data.br);
                brMeshRef.current.setColorAt(brIdx, _color);
                brIdx++;

            } else {
                // Solid Knot (Kutu)
                const colorHex = (typeof data === 'object' && data !== null) ? data.tl : data;

                boxMeshRef.current.setMatrixAt(boxIdx, dummy.matrix);
                _color.set(colorHex);
                boxMeshRef.current.setColorAt(boxIdx, _color);
                boxIdx++;
            }
        });

        // Kullanılmayan instance'ları sıfırla/gizle (Count'u güncellemek yeterli)
        boxMeshRef.current.count = boxIdx;
        tlMeshRef.current.count = tlIdx;
        brMeshRef.current.count = brIdx;

        boxMeshRef.current.instanceMatrix.needsUpdate = true;
        if (boxMeshRef.current.instanceColor) boxMeshRef.current.instanceColor.needsUpdate = true;

        tlMeshRef.current.instanceMatrix.needsUpdate = true;
        if (tlMeshRef.current.instanceColor) tlMeshRef.current.instanceColor.needsUpdate = true;

        brMeshRef.current.instanceMatrix.needsUpdate = true;
        if (brMeshRef.current.instanceColor) brMeshRef.current.instanceColor.needsUpdate = true;

    }, [pixels]);

    return (
        <group ref={groupRef} position={position}>
            {/* Solid Box Knots */}
            <instancedMesh ref={boxMeshRef} args={[SHARED_BOX_GEO, undefined, 256]} frustumCulled={false}>
                <primitive object={woolMaterial} attach="material" />
            </instancedMesh>

            {/* Top-Left Triangle Knots */}
            <instancedMesh ref={tlMeshRef} args={[SHARED_TRI_TL_GEO, undefined, 256]} frustumCulled={false}>
                <primitive object={woolMaterial} attach="material" />
            </instancedMesh>

            {/* Bottom-Right Triangle Knots */}
            <instancedMesh ref={brMeshRef} args={[SHARED_TRI_BR_GEO, undefined, 256]} frustumCulled={false}>
                <primitive object={woolMaterial} attach="material" rotation={[0, Math.PI, 0]} />
            </instancedMesh>

            {/* Slot Base */}
            <mesh position={[0, -0.02, 0]} receiveShadow>
                <boxGeometry args={[CONFIG.PIXELS_PER_SLOT * CONFIG.NODE_SIZE, 0.02, CONFIG.PIXELS_PER_SLOT * CONFIG.NODE_SIZE]} />
                <meshStandardMaterial color="#9c8d76" roughness={1.0} />
            </mesh>
        </group>
    );
});

// -----------------------------------------------------------------------------
// MAIN CARPET BOARD COMPONENT
// -----------------------------------------------------------------------------

const CarpetBoard = ({ socket: propSocket, playLandSound, onFinalShow, carpetWidth, carpetDepth, carpetWidthReal, children }) => {
    const { gl, scene, camera } = useThree();
    const [slotsData, setSlotsData] = useState(
        Array(CONFIG.SLOT_COLS * CONFIG.SLOT_ROWS).fill(null).map(() =>
            Array(CONFIG.PIXELS_PER_SLOT * CONFIG.PIXELS_PER_SLOT).fill('#9c8d76')
        )
    );
    const [isResetting, setIsResetting] = useState(false);
    const [isFinalShow, setIsFinalShow] = useState(false);
    const [snapshots, setSnapshots] = useState([]); // 🎬 Zaman atlamalı kayıt

    const resetStartTimeRef = useRef(0);
    const lastSnapshotProgress = useRef(0);

    // 🎧 AMBİYANS VE FİNAL KONTROLÜ
    useEffect(() => {
        let filledCount = 0;
        const totalPixels = CONFIG.SLOT_COLS * CONFIG.SLOT_ROWS * CONFIG.PIXELS_PER_SLOT * CONFIG.PIXELS_PER_SLOT;

        slotsData.forEach(slot => {
            slot.forEach(pixel => {
                if (pixel !== '#9c8d76' && pixel !== '#d4c5a9') filledCount++;
            });
        });

        const progress = filledCount / totalPixels;

        // Zaman atlamalı kayıt (Her %5'te bir kare al)
        if (progress > lastSnapshotProgress.current + 0.05) {
            setSnapshots(prev => [...prev, JSON.parse(JSON.stringify(slotsData))]);
            lastSnapshotProgress.current = progress;
            console.log(`🎬 Snapshot alındı: %${Math.round(progress * 100)}`);
        }

        // Final Şovu Tetikle
        if (progress >= 0.99 && !isFinalShow && !isResetting) {
            setIsFinalShow(true);
            if (onFinalShow) onFinalShow(true);
            console.log('🎉 FİNAL SEREMONİSİ BAŞLIYOR!');
            import('../../audio/AudioManager').then(({ audioManager }) => {
                audioManager.playFinalCrescendo();
            });

            // 5 saniye sonra Time-Lapse'i oynat ve resetle
            setTimeout(() => {
                // Şimdilik sadece reset, ilerde Time-Lapse izletme eklenebilir
                if (propSocket) propSocket.emit('manual-reset');
                setIsFinalShow(false);
                if (onFinalShow) onFinalShow(false);
                import('../../audio/AudioManager').then(({ audioManager }) => {
                    audioManager.stopAll();
                });
                setSnapshots([]);
                lastSnapshotProgress.current = 0;
            }, 8000);
        }

        import('../../audio/AudioManager').then(({ audioManager }) => {
            if (audioManager.isInitialized) {
                audioManager.updateDrone(progress);
            }
        });

    }, [slotsData, isFinalShow, isResetting, propSocket]);

    const flyingQueueRef = useRef([]);
    const audioContextRef = useRef(null);

    // 🧶 PAYLAŞIMLI YÜN MATERYALİ (Tüm bölmeler için tek bir tane)
    const sharedWoolMaterial = useMemo(() => {
        const mat = createWoolMaterial(new THREE.Color('#ffffff'));
        mat.map = WOOL_TEXTURE;
        mat.normalMap = WOOL_NORMAL;
        return mat;
    }, []);

    useFrame((state) => {
        if (sharedWoolMaterial.userData.shader) {
            sharedWoolMaterial.userData.shader.uniforms.uTime.value = state.clock.getElapsedTime();
        }
    });

    useEffect(() => {
        if (!propSocket) return;

        propSocket.on('initial-carpet', ({ carpetState }) => {
            console.log('📦 Halı durumu senkronize edildi:', carpetState);
            setSlotsData(prev => {
                const newData = [...prev];
                carpetState.forEach((pixels, slotId) => {
                    if (pixels) newData[slotId] = pixels;
                });
                return newData;
            });
        });

        propSocket.on('batch-update', (updates) => {
            console.log('📨 Batch update received:', updates.length, 'items');

            // 1. Uçan Pikselleri kuyruğa ekle (Loop)
            updates.forEach(({ slotId, pixels }) => {
                const basePos = getSlotBasePosition(slotId);
                const startPos = new THREE.Vector3(0, 50, 50);

                pixels.forEach((data, i) => {
                    const xRel = i % CONFIG.PIXELS_PER_SLOT;
                    const zRel = Math.floor(i / CONFIG.PIXELS_PER_SLOT);

                    const targetX = basePos.x + (xRel - CONFIG.PIXELS_PER_SLOT / 2) * CONFIG.NODE_SIZE;
                    const targetZ = basePos.z + (zRel - CONFIG.PIXELS_PER_SLOT / 2) * CONFIG.NODE_SIZE;
                    const targetPos = new THREE.Vector3(targetX, 0, targetZ);

                    const points = [];
                    const spiralLoops = 2 + Math.random(); // Biraz varyasyon
                    const startRadius = 30;

                    points.push(startPos);

                    for (let j = 0; j <= 10; j++) {
                        const t = j / 10;
                        const angle = t * Math.PI * 2 * spiralLoops;
                        const radius = startRadius * (1 - t);
                        const height = startPos.y * (1 - t) + targetPos.y * t;
                        const offsetX = Math.cos(angle) * radius;
                        const offsetZ = Math.sin(angle) * radius;
                        const randX = (Math.random() - 0.5) * 5;
                        const randY = (Math.random() - 0.5) * 5;
                        const randZ = (Math.random() - 0.5) * 5;

                        points.push(new THREE.Vector3(
                            targetPos.x + offsetX + randX,
                            height + randY + 10,
                            targetPos.z + offsetZ + randZ
                        ));
                    }
                    points.push(targetPos);

                    const curve = new THREE.CatmullRomCurve3(points);
                    curve.tension = 0.5;

                    flyingQueueRef.current.push({
                        id: Date.now() + Math.random() + i, // Unique ID
                        slotId,
                        pixelIndex: i,
                        data,
                        curve,
                        progress: 0,
                        startTime: Date.now() + i * 2, // Sırayla gelsinler
                        landed: false
                    });
                });
            });
        });

        propSocket.on('carpet-reset', () => {
            console.log('🔄 HALI SIFIRLANIYOR!');
            try {
                gl.render(scene, camera);
                const dataURL = gl.domElement.toDataURL('image/png');
                const link = document.createElement('a');
                const date = new Date().toISOString().replace(/[:.]/g, '-');
                link.setAttribute('download', `hali-tezgahi-${date}.png`);
                link.setAttribute('href', dataURL);
                link.click();
            } catch (e) {
                console.error('Screenshot hatası:', e);
            }

            setIsResetting(true);
            resetStartTimeRef.current = Date.now();

            setTimeout(() => {
                setSlotsData(
                    Array(CONFIG.SLOT_COLS * CONFIG.SLOT_ROWS).fill(null).map(() =>
                        Array(CONFIG.PIXELS_PER_SLOT * CONFIG.PIXELS_PER_SLOT).fill('#9c8d76')
                    )
                );
                setIsResetting(false);
            }, 3000);
        });

        return () => {
            if (propSocket) {
                propSocket.off('initial-carpet');
                propSocket.off('batch-update');
                propSocket.off('carpet-reset');
            }
        };
    }, [propSocket, gl, scene, camera]);

    const handleLand = (item) => {
        const { slotId, pixelIndex, data } = item;
        const color = typeof data === 'object' ? data.tl : data;

        // 🌊 DALGALANMA TETİKLE
        const impactPos = item.curve.getPoint(1); // Varış noktası
        if (sharedWoolMaterial.userData.shader) {
            sharedWoolMaterial.userData.shader.uniforms.uImpactPos.value.copy(impactPos);
            sharedWoolMaterial.userData.shader.uniforms.uImpactTime.value = sharedWoolMaterial.userData.shader.uniforms.uTime.value;
        }

        setSlotsData(prev => {
            const newData = [...prev];
            if (!newData[slotId] || newData[slotId][0] === '#d4c5a9') {
                newData[slotId] = Array(CONFIG.PIXELS_PER_SLOT * CONFIG.PIXELS_PER_SLOT).fill('#9c8d76');
            }
            const newSlot = [...newData[slotId]];
            newSlot[pixelIndex] = color;
            newData[slotId] = newSlot;
            return newData;
        });

        if (playLandSound) playLandSound();

        const index = flyingQueueRef.current.findIndex(p => p.id === item.id);
        if (index > -1) {
            flyingQueueRef.current.splice(index, 1);
        }
    };

    return (
        <>
            {slotsData.map((slot, index) => {
                const pos = getSlotBasePosition(index);
                return (
                    <CarpetSlot
                        key={index}
                        index={index}
                        data={slot}
                        pos={pos}
                        isResetting={isResetting}
                        resetStartTime={resetStartTimeRef.current}
                        woolMaterial={sharedWoolMaterial}
                    />
                );
            })}

            <FlyingPixelsInstances
                queueRef={flyingQueueRef}
                onLand={handleLand}
            />

            {children}
        </>
    );
};

export default CarpetBoard;
