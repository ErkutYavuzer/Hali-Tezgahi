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
    const totalDepth = depth + BORDER_WIDTH * 2;
    const count = Math.ceil(totalDepth / 0.035) * 2 + 600;
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!meshRef.current) return;

        let index = 0;

        // Kısa kenar boyunca püskül dizme (Z ekseni boyunca, X uçlarında)
        const generateFringes = (xPos, baseRot) => {
            for (let z = -totalDepth / 2; z <= totalDepth / 2; z += 0.035) {
                const randX = (Math.random() - 0.5) * 0.05;
                const randZ = (Math.random() - 0.5) * 0.03;
                const randRotZ = (Math.random() - 0.5) * 0.4;
                const randRotX = (Math.random() - 0.5) * 0.2;
                const scale = 0.8 + Math.random() * 0.4;

                dummy.position.set(xPos + randX, -0.02, z + randZ);
                dummy.rotation.set(randRotX, 0, baseRot + randRotZ);
                dummy.scale.set(1, scale, 1);
                dummy.updateMatrix();
                meshRef.current.setMatrixAt(index++, dummy.matrix);
            }
        };

        // Sol ve Sağ (kısa kenar) Püskülleri
        generateFringes(-width / 2 - BORDER_WIDTH - 0.35, Math.PI / 2);
        generateFringes(width / 2 + BORDER_WIDTH + 0.35, -Math.PI / 2);

        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [width, depth]);

    return (
        <instancedMesh ref={meshRef} args={[FRINGE_GEO, FRINGE_MAT, count + 100]} />
    );
}

export { BORDER_WIDTH };
