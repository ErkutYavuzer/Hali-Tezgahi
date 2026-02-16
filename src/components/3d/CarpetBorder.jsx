import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { createCarpetBorderTexture, FRINGE_GEO, FRINGE_MAT } from './materials';

const BORDER_WIDTH = 0.4;
const BORDER_HEIGHT = 0.06;

export function CarpetBorder({ width, depth }) {
    const texture = useMemo(() => createCarpetBorderTexture(), []);

    const matTopX = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: '#4e0d0d', emissiveIntensity: 0.3 });
    const matTopZ = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: '#4e0d0d', emissiveIntensity: 0.3 });

    // Clone texture for rotation/repeat
    matTopZ.map = matTopX.map.clone();
    matTopZ.map.rotation = Math.PI / 2;

    return (
        <group>
            {/* Üst Kenar */}
            <mesh position={[0, 0, -depth / 2 - BORDER_WIDTH / 2]} receiveShadow>
                <boxGeometry args={[width + BORDER_WIDTH * 2, BORDER_HEIGHT, BORDER_WIDTH]} />
                <meshStandardMaterial map={texture} roughness={0.8} />
            </mesh>

            {/* Alt Kenar */}
            <mesh position={[0, 0, depth / 2 + BORDER_WIDTH / 2]} receiveShadow>
                <boxGeometry args={[width + BORDER_WIDTH * 2, BORDER_HEIGHT, BORDER_WIDTH]} />
                <meshStandardMaterial map={texture} roughness={0.8} />
            </mesh>

            {/* Sol Kenar */}
            <mesh position={[-width / 2 - BORDER_WIDTH / 2, 0, 0]} receiveShadow>
                <boxGeometry args={[BORDER_WIDTH, BORDER_HEIGHT, depth]} />
                <meshStandardMaterial color="#8e2323" roughness={0.8} />
            </mesh>

            {/* Sağ Kenar */}
            <mesh position={[width / 2 + BORDER_WIDTH / 2, 0, 0]} receiveShadow>
                <boxGeometry args={[BORDER_WIDTH, BORDER_HEIGHT, depth]} />
                <meshStandardMaterial color="#8e2323" roughness={0.8} />
            </mesh>

            {/* Köşe Süsleri */}
            <mesh position={[-width / 2 - BORDER_WIDTH / 2, 0.01, -depth / 2 - BORDER_WIDTH / 2]}>
                <boxGeometry args={[BORDER_WIDTH, BORDER_HEIGHT + 0.01, BORDER_WIDTH]} />
                <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[width / 2 + BORDER_WIDTH / 2, 0.01, -depth / 2 - BORDER_WIDTH / 2]}>
                <boxGeometry args={[BORDER_WIDTH, BORDER_HEIGHT + 0.01, BORDER_WIDTH]} />
                <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[-width / 2 - BORDER_WIDTH / 2, 0.01, depth / 2 + BORDER_WIDTH / 2]}>
                <boxGeometry args={[BORDER_WIDTH, BORDER_HEIGHT + 0.01, BORDER_WIDTH]} />
                <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[width / 2 + BORDER_WIDTH / 2, 0.01, depth / 2 + BORDER_WIDTH / 2]}>
                <boxGeometry args={[BORDER_WIDTH, BORDER_HEIGHT + 0.01, BORDER_WIDTH]} />
                <meshStandardMaterial color="#d4af37" metalness={0.5} roughness={0.4} />
            </mesh>
        </group>
    );
}

export function CarpetFringes({ width, depth }) {
    const meshRef = useRef();
    const totalWidth = width + BORDER_WIDTH * 2;
    const count = Math.ceil(totalWidth / 0.035) * 2 + 600;
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!meshRef.current) return;

        let index = 0;

        const generateFringes = (zPos, baseRot) => {
            for (let x = -totalWidth / 2; x <= totalWidth / 2; x += 0.035) {
                const randX = (Math.random() - 0.5) * 0.03;
                const randZ = (Math.random() - 0.5) * 0.05;
                const randRotZ = (Math.random() - 0.5) * 0.4;
                const randRotX = (Math.random() - 0.5) * 0.2;
                const scale = 0.8 + Math.random() * 0.4;

                dummy.position.set(x + randX, -0.02, zPos + randZ);
                dummy.rotation.set(baseRot + randRotX, 0, randRotZ);
                dummy.scale.set(1, scale, 1);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(index++, dummy.matrix);
            }
        };

        // Üst ve Alt Püsküller
        generateFringes(-depth / 2 - BORDER_WIDTH - 0.35, Math.PI / 2);
        generateFringes(depth / 2 + BORDER_WIDTH + 0.35, Math.PI / 2);

        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [width, depth]);

    return (
        <instancedMesh ref={meshRef} args={[FRINGE_GEO, FRINGE_MAT, count + 100]} />
    );
}

export { BORDER_WIDTH };
