import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../constants';
import FlyingPixelsInstances from './FlyingPixels';
import { audioManager } from '../../audio/AudioManager';

// =============================================================================
// 🧶 YÜN FİBER DOKU ÜRETECİ
// =============================================================================

function createWoolNormalMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Nötr normal map arka plan (mavi = düz yüzey)
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, size, size);

    // Yatay iplik lifleri
    for (let y = 0; y < size; y += 3) {
        const offset = Math.sin(y * 0.3) * 2;
        ctx.strokeStyle = `rgba(${120 + Math.random() * 20}, ${120 + Math.random() * 20}, 255, ${0.3 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y + offset);
        for (let x = 0; x < size; x += 4) {
            const waveY = y + offset + Math.sin(x * 0.15 + y * 0.1) * 1.5;
            ctx.lineTo(x, waveY);
        }
        ctx.stroke();
    }

    // Dikey iplik lifleri (çapraz dokuma)
    for (let x = 0; x < size; x += 4) {
        const offset = Math.sin(x * 0.25) * 2;
        ctx.strokeStyle = `rgba(${140 + Math.random() * 15}, ${120 + Math.random() * 15}, 255, ${0.2 + Math.random() * 0.2})`;
        ctx.lineWidth = 0.8 + Math.random() * 1;
        ctx.beginPath();
        ctx.moveTo(x + offset, 0);
        for (let y = 0; y < size; y += 4) {
            const waveX = x + offset + Math.sin(y * 0.12 + x * 0.08) * 1.2;
            ctx.lineTo(waveX, y);
        }
        ctx.stroke();
    }

    // Düğüm noktaları (knot bumps)
    for (let i = 0; i < 800; i++) {
        const kx = Math.random() * size;
        const ky = Math.random() * size;
        const kr = 1 + Math.random() * 2.5;
        const gradient = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        gradient.addColorStop(0, `rgba(${160 + Math.random() * 30}, ${160 + Math.random() * 30}, 255, 0.5)`);
        gradient.addColorStop(1, 'rgba(128, 128, 255, 0)');
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 13); // Halı boyutuna oranla tekrar
    return texture;
}

function createWoolBumpMap() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Gri arka plan
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    // İplik kabartma deseni
    for (let y = 0; y < size; y += 2) {
        for (let x = 0; x < size; x += 2) {
            const n1 = Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.3;
            const n2 = Math.sin(x * 0.15 + y * 0.12) * 0.2;
            const n3 = (Math.random() - 0.5) * 0.15;
            const val = 128 + (n1 + n2 + n3) * 128;
            ctx.fillStyle = `rgb(${val},${val},${val})`;
            ctx.fillRect(x, y, 2, 2);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 20);
    return texture;
}

// =============================================================================
// 🧶 YÜN MATERYALİ - onBeforeCompile ile shader enjeksiyonu
// =============================================================================

function createCarpetMaterial(drawingTexture, normalMap, bumpMap) {
    const mat = new THREE.MeshStandardMaterial({
        map: drawingTexture,
        normalMap: normalMap,
        normalScale: new THREE.Vector2(0.4, 0.4),
        bumpMap: bumpMap,
        bumpScale: 0.015,
        roughness: 0.75,
        metalness: 0.02,
        side: THREE.FrontSide,
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };

        // Vertex shader: hafif yüzey kabartması
        shader.vertexShader = `
            uniform float uTime;
            varying float vFiber;
            varying vec2 vHighUv;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            
            vHighUv = uv * vec2(20.0, 32.0);
            
            // Çok hafif fiber doku
            float fiber = sin(uv.x * 120.0) * cos(uv.y * 120.0) * 0.3;
            vFiber = fiber;
            
            // Minimal yüzey kabartması
            vec3 dispNormal = normalize(normal);
            transformed += dispNormal * fiber * 0.008;
            `
        );

        // Fragment shader: minimal kumaş hissi
        shader.fragmentShader = `
            varying float vFiber;
            varying vec2 vHighUv;
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            
            // ═══ ÇOK HAFİF KUMAŞ DOKUSU ═══
            // Neredeyse görünmez iplik hissi
            float fiberDetail = sin(vHighUv.x * 20.0) * cos(vHighUv.y * 20.0) * 0.015;
            gl_FragColor.rgb += fiberDetail;
            
            // ═══ HAFİF RENK İYİLEŞTİRME ═══
            float luminance = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 saturated = mix(vec3(luminance), gl_FragColor.rgb, 1.3);
            gl_FragColor.rgb = saturated * 1.1;
            
            // ═══ RIM IŞIK ═══
            float rim = 1.0 - max(dot(normalize(vViewPosition), normalize(vNormal)), 0.0);
            gl_FragColor.rgb += vec3(0.03, 0.025, 0.02) * pow(rim, 3.0);
            `
        );

        // Mat referansını sakla (uTime güncelleme için)
        mat.userData.shader = shader;
    };

    return mat;
}

// =============================================================================
// CARPET BOARD - TEXTURE-BASED FREE DRAWING RENDER
// =============================================================================

function CarpetBoard({ socket, carpetWidth, carpetDepth, children, onCarpetCanvasReady }) {
    const meshRef = useRef();
    const offscreenCanvasRef = useRef(null);
    const offscreenCtxRef = useRef(null);
    const textureRef = useRef(null);
    const materialRef = useRef(null);
    const needsUpdateRef = useRef(false);

    // 🧶 Uçan pikseller queue'u
    const flyingQueueRef = useRef([]);
    // 🎨 Bekleyen enhancement timer'ları
    const pendingEnhancementsRef = useRef({});

    // Yün doku texture'ları
    const woolNormal = useMemo(() => createWoolNormalMap(), []);
    const woolBump = useMemo(() => createWoolBumpMap(), []);

    // Offscreen canvas - halı texture'ı
    const initCanvas = useCallback(() => {
        const canvas = document.createElement('canvas');
        canvas.width = CONFIG.TEXTURE_WIDTH;
        canvas.height = CONFIG.TEXTURE_HEIGHT;
        const ctx = canvas.getContext('2d');

        // Halının varsayılan rengi (sıcak krem — karanlık sahnede parlak görünsün)
        ctx.fillStyle = '#f0e4d0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // İnce dokuma ızgara efekti (çok hafif)
        ctx.strokeStyle = 'rgba(0,0,0,0.025)';
        ctx.lineWidth = 0.3;
        const gridStep = 6;
        for (let x = 0; x < canvas.width; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        offscreenCanvasRef.current = canvas;
        offscreenCtxRef.current = ctx;
        if (onCarpetCanvasReady) onCarpetCanvasReady(canvas);

        // Three.js Texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        textureRef.current = texture;

        return texture;
    }, [onCarpetCanvasReady]);

    const drawingTexture = useMemo(() => initCanvas(), [initCanvas]);

    // Yün materyal
    const woolMaterial = useMemo(() => {
        const mat = createCarpetMaterial(drawingTexture, woolNormal, woolBump);
        materialRef.current = mat;
        return mat;
    }, [drawingTexture, woolNormal, woolBump]);

    // =====================================================================
    // 🧶 İPLİK DOKUMA EFEKTİ
    // =====================================================================
    // 🧶 HALI DOKUMA SİMÜLASYONU v2 — Gerçekçi Kilim Dönüşüm Engine
    // Orijinal çizimi koruyarak "Anadolu kiliminde dokunmuş" estetiği verir
    // =====================================================================

    // 24 renklik geleneksel Anadolu kilim paleti (doğal boyalardan)
    const KILIM_PALETTE = useMemo(() => [
        // Kırmızılar (kök boya — Rubia tinctorum)
        [139, 0, 0], [165, 42, 42], [178, 34, 34], [196, 30, 58], [220, 20, 60],
        // Maviler (çivit — Indigo)
        [25, 25, 112], [0, 0, 128], [26, 58, 107], [65, 105, 225],
        // Sarılar/Altınlar (cehri, zerdeçal)
        [218, 165, 32], [184, 134, 11], [205, 133, 63], [200, 169, 81],
        // Yeşiller (çivit + cehri karışımı)
        [0, 100, 0], [34, 139, 34], [85, 107, 47],
        // Toprak (ceviz kabuğu)
        [61, 43, 31], [92, 26, 10], [139, 69, 19], [160, 82, 45],
        // Krem/Beyaz (doğal yün — kasarlanmamış)
        [245, 245, 220], [250, 235, 215], [250, 240, 230], [255, 248, 220],
    ], []);

    // RGB → HSL dönüşümü
    const rgbToHsl = useCallback((r, g, b) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [h, s, l];
    }, []);

    // HSL → RGB dönüşümü
    const hslToRgb = useCallback((h, s, l) => {
        if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [
            Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
            Math.round(hue2rgb(p, q, h) * 255),
            Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
        ];
    }, []);

    // En yakın kilim rengini bul (weighted Euclidean — insan algısına yakın)
    const nearestKilimColor = useCallback((r, g, b) => {
        let minDist = Infinity, best = [r, g, b];
        for (const [kr, kg, kb] of KILIM_PALETTE) {
            // İnsan gözü yeşile daha hassas
            const dist = (r - kr) ** 2 * 0.3 + (g - kg) ** 2 * 0.59 + (b - kb) ** 2 * 0.11;
            if (dist < minDist) { minDist = dist; best = [kr, kg, kb]; }
        }
        return best;
    }, [KILIM_PALETTE]);

    // Basit pseudo-random (deterministic per-position)
    const hashNoise = useCallback((x, y, seed) => {
        const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.7585) * 43758.5453;
        return n - Math.floor(n); // 0..1
    }, []);

    // 👁 Göz motifi helper — kilim çerçeve kenarlarındaki "nazarlık" motifi
    const drawEye = useCallback((ctx, cx, cy, size) => {
        // Dış elips
        ctx.beginPath();
        ctx.ellipse(cx, cy, size, size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // İç nokta — koyu
        ctx.save();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }, []);

    /**
     * 🧶 applyWovenEnhancement v3 — PİKSEL KORUYUCU Halı Dokuma Simülasyonu
     * 
     * KRİTİK FARK: Orijinal çizimin her pikselini KORUYOR, üzerine dokuma
     * dokusu OVERLAY olarak ekleniyor. Blok ortalama YAPMIYOR.
     * 
     * 1. Her piksel: orijinal renk korunur + hafif kilim paleti etkisi
     * 2. Küçük ilmek grid'i üzerine OVERLAY (kenar gölge, iplik çizgileri)
     * 3. Şeffaf alanlar krem zemin (gerçek halıda boşluk olmaz)
     * 4. Abrash: yatay bantlarda hafif ton kayması
     * 5. Çift katmanlı dekoratif kilim çerçevesi
     */
    const applyWovenEnhancement = useCallback((ctx, x, y, width, height) => {
        // 🧶 İlmek boyutu — küçük tutuyoruz ki orijinal çizim belli olsun
        const KNOT = Math.max(4, Math.min(8, Math.round(Math.min(width, height) / 80)));

        // 1️⃣ Source data al
        const sourceData = ctx.getImageData(x, y, width, height);
        const src = sourceData.data;
        const enhanced = new ImageData(width, height);
        const out = enhanced.data;

        // 2️⃣ PİKSEL BAZLI İŞLEME — orijinal rengi koruyarak dönüştür
        for (let py = 0; py < height; py++) {
            // Abrash: her ~6 ilmek satırında renk tonu hafifçe kayar
            const knotRow = Math.floor(py / KNOT);
            const abrashBand = Math.floor(knotRow / 6);
            const abrashShift = (hashNoise(0, abrashBand, 42) - 0.5) * 0.06;

            for (let px = 0; px < width; px++) {
                const pi = (py * width + px) * 4;
                let r = src[pi];
                let g = src[pi + 1];
                let b = src[pi + 2];
                const a = src[pi + 3];

                const knotCol = Math.floor(px / KNOT);

                // ── ŞEFFAF → KREM ZEMİN ──
                if (a < 30) {
                    // Doğal yün krem rengi — hafif varyasyon
                    const noise = hashNoise(knotCol, knotRow, 7);
                    r = 240 + (noise - 0.5) * 12;
                    g = 232 + (noise - 0.5) * 10;
                    b = 215 + (noise - 0.5) * 8;
                } else {
                    // ── ORİJİNAL RENGİ KORU + HAFİF KİLİM ETKİSİ ──
                    // Doygunluk hafifçe artır (+%30)
                    let [h, s, l] = rgbToHsl(r, g, b);
                    s = Math.min(1.0, s * 1.3);
                    l = 0.5 + (l - 0.5) * 1.15; // hafif kontrast
                    l = Math.max(0.05, Math.min(0.95, l));
                    l += abrashShift; // abrash
                    l = Math.max(0.03, Math.min(0.97, l));
                    [r, g, b] = hslToRgb(h, s, l);

                    // Hafif kilim paleti etkisi (%20 palette, %80 orijinal)
                    const [kr, kg, kb] = nearestKilimColor(r, g, b);
                    r = Math.round(r * 0.80 + kr * 0.20);
                    g = Math.round(g * 0.80 + kg * 0.20);
                    b = Math.round(b * 0.80 + kb * 0.20);
                }

                // ── İLMEK KENARI ──
                // Her KNOT sınırında hafif koyu çizgi (iplikler arası oluk)
                const inKnotX = px % KNOT;
                const inKnotY = py % KNOT;
                const isKnotEdge = (inKnotX === 0 || inKnotY === 0);
                if (isKnotEdge) {
                    r = Math.round(r * 0.88);
                    g = Math.round(g * 0.88);
                    b = Math.round(b * 0.88);
                }

                // ── İPLİK BÜKLÜM DOKUSU ──
                // Düğüm içinde hafif ton değişimi (sinüzoidal)
                const normX = inKnotX / KNOT;
                const normY = inKnotY / KNOT;
                const threadTexture = Math.sin(normY * Math.PI * 2) * 0.04
                    + Math.sin(normX * Math.PI * 2) * 0.02;
                r = Math.max(0, Math.min(255, Math.round(r * (1 + threadTexture))));
                g = Math.max(0, Math.min(255, Math.round(g * (1 + threadTexture))));
                b = Math.max(0, Math.min(255, Math.round(b * (1 + threadTexture))));

                // ── PER-KNOT NOISE ──
                // Her düğüm hafifçe farklı (el yapımı hissi)
                const knotNoise = (hashNoise(knotCol, knotRow, 13) - 0.5) * 0.03;
                r = Math.max(0, Math.min(255, Math.round(r * (1 + knotNoise))));
                g = Math.max(0, Math.min(255, Math.round(g * (1 + knotNoise))));
                b = Math.max(0, Math.min(255, Math.round(b * (1 + knotNoise))));

                out[pi] = r;
                out[pi + 1] = g;
                out[pi + 2] = b;
                out[pi + 3] = 255; // Halıda şeffaflık yok
            }
        }

        // 5️⃣ Enhanced sonucu canvas'a yaz
        ctx.putImageData(enhanced, x, y);

        // 6️⃣ Warp/Weft grid overlay — düğümler arası çözgü-atkı iplikleri
        ctx.save();
        // Yatay atkı iplikleri (weft) — her düğüm satırı arasında
        for (let ty = KNOT; ty < height; ty += KNOT) {
            const lineAlpha = (Math.floor(ty / KNOT) % 2 === 0) ? 0.14 : 0.08;
            ctx.strokeStyle = `rgba(60, 35, 15, ${lineAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, y + ty);
            ctx.lineTo(x + width, y + ty);
            ctx.stroke();
        }
        // Dikey çözgü iplikleri (warp) — her düğüm sütunu arasında
        for (let tx = KNOT; tx < width; tx += KNOT) {
            const lineAlpha = (Math.floor(tx / KNOT) % 2 === 0) ? 0.10 : 0.06;
            ctx.strokeStyle = `rgba(50, 30, 10, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x + tx, y);
            ctx.lineTo(x + tx, y + height);
            ctx.stroke();
        }
        ctx.restore();

        // 7️⃣ Profesyonel çift katmanlı kilim çerçevesi
        const borderW = Math.max(8, Math.min(18, Math.min(width, height) * 0.04));
        ctx.save();

        // Dış çerçeve — koyu bordo
        ctx.strokeStyle = '#5c1a0a';
        ctx.lineWidth = borderW;
        ctx.strokeRect(x + borderW / 2, y + borderW / 2, width - borderW, height - borderW);

        // Dış çerçeve iplik dokusu — yatay çizgiler (halı kenarı hissi)
        ctx.strokeStyle = 'rgba(40, 20, 5, 0.2)';
        ctx.lineWidth = 0.5;
        for (let fy = 0; fy < borderW; fy += 3) {
            ctx.beginPath();
            ctx.moveTo(x, y + fy);
            ctx.lineTo(x + width, y + fy);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y + height - fy);
            ctx.lineTo(x + width, y + height - fy);
            ctx.stroke();
        }

        // Orta çerçeve — altın şerit
        const midW = borderW * 0.5;
        ctx.strokeStyle = '#c8a951';
        ctx.lineWidth = midW;
        const inset = borderW + midW / 2;
        ctx.strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);

        // İç çerçeve — ince lacivert
        ctx.strokeStyle = '#1a3a6b';
        ctx.lineWidth = Math.max(2, borderW * 0.3);
        const innerInset = borderW + midW + 2;
        ctx.strokeRect(x + innerInset, y + innerInset, width - innerInset * 2, height - innerInset * 2);

        // 🔶 Köşe motifleri — çift baklava dilimi
        const cs = borderW * 2.0;
        const corners = [
            [x + borderW + cs / 2, y + borderW + cs / 2],
            [x + width - borderW - cs / 2, y + borderW + cs / 2],
            [x + borderW + cs / 2, y + height - borderW - cs / 2],
            [x + width - borderW - cs / 2, y + height - borderW - cs / 2],
        ];
        for (const [cx, cy] of corners) {
            // Dış baklava — altın
            ctx.fillStyle = '#c8a951';
            ctx.beginPath();
            ctx.moveTo(cx, cy - cs / 2);
            ctx.lineTo(cx + cs / 2, cy);
            ctx.lineTo(cx, cy + cs / 2);
            ctx.lineTo(cx - cs / 2, cy);
            ctx.closePath();
            ctx.fill();
            // İç baklava — kırmızı
            ctx.fillStyle = '#c41e3a';
            const ics = cs * 0.45;
            ctx.beginPath();
            ctx.moveTo(cx, cy - ics / 2);
            ctx.lineTo(cx + ics / 2, cy);
            ctx.lineTo(cx, cy + ics / 2);
            ctx.lineTo(cx - ics / 2, cy);
            ctx.closePath();
            ctx.fill();
            // En iç — lacivert nokta
            ctx.fillStyle = '#1a3a6b';
            const tcs = cs * 0.2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - tcs / 2);
            ctx.lineTo(cx + tcs / 2, cy);
            ctx.lineTo(cx, cy + tcs / 2);
            ctx.lineTo(cx - tcs / 2, cy);
            ctx.closePath();
            ctx.fill();
        }

        // 👁️ Kenar göz motifleri
        const eyeSize = borderW * 0.7;
        const eyeSpacing = eyeSize * 4.5;
        ctx.fillStyle = '#c8a951';
        for (let ex = x + innerInset + cs + eyeSpacing; ex < x + width - innerInset - cs; ex += eyeSpacing) {
            drawEye(ctx, ex, y + borderW * 0.5, eyeSize);
            drawEye(ctx, ex, y + height - borderW * 0.5, eyeSize);
        }
        for (let ey = y + innerInset + cs + eyeSpacing; ey < y + height - innerInset - cs; ey += eyeSpacing) {
            drawEye(ctx, x + borderW * 0.5, ey, eyeSize);
            drawEye(ctx, x + width - borderW * 0.5, ey, eyeSize);
        }

        ctx.restore();
        needsUpdateRef.current = true;
    }, [rgbToHsl, hslToRgb, nearestKilimColor, hashNoise, drawEye]);

    // ✍️ Motife dokuma estetiğinde isim yazma
    const renderWovenName = useCallback((ctx, name, x, y, width, height) => {
        if (!name || name === 'Anonim') return;
        ctx.save();
        const fontSize = Math.max(32, Math.min(48, width * 0.15));
        ctx.font = `700 ${fontSize}px "Georgia", "Times New Roman", serif`;
        ctx.fillStyle = 'rgba(60, 30, 10, 0.65)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const padding = Math.max(3, width * 0.02);
        ctx.fillText(name, x + width - padding, y + height - padding);
        // İplik dokusu efekti (ismin üzerinden yatay çizgiler)
        const textMetrics = ctx.measureText(name);
        const textX = x + width - padding - textMetrics.width;
        const textY = y + height - padding - fontSize;
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = 'rgba(80,50,20,0.4)';
        ctx.lineWidth = 0.4;
        for (let ty = textY; ty < y + height - padding; ty += 2) {
            ctx.beginPath();
            ctx.moveTo(textX - 2, ty);
            ctx.lineTo(textX + textMetrics.width + 2, ty);
            ctx.stroke();
        }
        ctx.restore();
    }, []);

    // Anında dokuma çiz (initial-carpet yüklemesi için — animasyonsuz)
    const drawWovenImage = useCallback((drawing) => {
        const ctx = offscreenCtxRef.current;
        if (!ctx) {
            console.warn('⚠️ drawWovenImage: ctx henüz hazır değil!');
            return;
        }
        if (!drawing.dataUrl) {
            console.warn('⚠️ drawWovenImage: dataUrl boş!', drawing.id);
            return;
        }

        // console.log(`🧶 drawWovenImage başladı: x=${drawing.x} y=${drawing.y} w=${drawing.width} h=${drawing.height}`);

        const img = new Image();
        if (!drawing.dataUrl.startsWith('data:')) {
            img.crossOrigin = 'anonymous';
        }
        img.onload = () => {
            // console.log(`✅ drawWovenImage resim yüklendi: ${drawing.width}x${drawing.height}`);
            try {
                // 1️⃣ Önce çizimi tam çözünürlükte direkt yapıştır
                ctx.save();
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(img, drawing.x, drawing.y, drawing.width, drawing.height);
                ctx.restore();
                needsUpdateRef.current = true;

                // 2️⃣ Enhancement kaldırıldı — AI motif dönüşümü yapacak
                // Çizim olduğu gibi gösterilir, Gemini dönüştürünce değişir

                // 3️⃣ ✍️ İsim render
                try {
                    renderWovenName(ctx, drawing.userName, drawing.x, drawing.y, drawing.width, drawing.height);
                } catch (nameErr) {
                    console.warn('⚠️ İsim yazma hatası:', nameErr.message);
                }

                needsUpdateRef.current = true;
                // console.log(`✅ drawWovenImage tamamlandı: ${drawing.id?.substring(0, 15)}`);
            } catch (err) {
                console.error('❌ drawWovenImage genel hata:', err);
            }
        };
        img.onerror = (e) => {
            console.error('❌ drawWovenImage resim yüklenemedi!', drawing.id, e);
        };
        img.src = drawing.dataUrl;
    }, [renderWovenName]);

    // =====================================================================
    // 🚀 UÇAN PİKSEL SİSTEMİ — Çizimden 3D parçacıklara
    // =====================================================================

    // Canvas koordinatından 3D world koordinatına dönüşüm
    const canvasToWorld = useCallback((canvasX, canvasY) => {
        // Canvas: 0..TEXTURE_WIDTH → World: -carpetWidth/2..+carpetWidth/2
        // Canvas: 0..TEXTURE_HEIGHT → World: -carpetDepth/2..+carpetDepth/2
        const worldX = (canvasX / CONFIG.TEXTURE_WIDTH - 0.5) * carpetWidth;
        const worldZ = (canvasY / CONFIG.TEXTURE_HEIGHT - 0.5) * carpetDepth;
        return { x: worldX, z: worldZ };
    }, [carpetWidth, carpetDepth]);

    // Yeni çizim geldiğinde → piksel çıkar, spiral yol oluştur, kuyruğa ekle
    const launchFlyingPixels = useCallback((drawing) => {
        const img = new Image();
        img.onload = () => {
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = drawing.width;
            tmpCanvas.height = drawing.height;
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(img, 0, 0, drawing.width, drawing.height);
            const imageData = tmpCtx.getImageData(0, 0, drawing.width, drawing.height);
            const pixels = imageData.data;

            const now = Date.now();
            let pixelIndex = 0;

            // 🎲 Uçuş stili seç (tüm çizim için aynı stil)
            const flightStyle = Math.floor(Math.random() * 3); // 0=spiral, 1=dalga, 2=kaskad

            // Uçan blok boyutu — daha büyük = daha az parçacık, daha temiz görüntü
            const FLY_BLOCK = 12;

            for (let ty = 0; ty < drawing.height; ty += FLY_BLOCK) {
                for (let tx = 0; tx < drawing.width; tx += FLY_BLOCK) {
                    const pi = (ty * drawing.width + tx) * 4;
                    const r = pixels[pi], g = pixels[pi + 1], b = pixels[pi + 2], a = pixels[pi + 3];
                    if (a < 30) continue;

                    // Hedef canvas koordinatı
                    const destX = drawing.x + tx;
                    const destY = drawing.y + ty;

                    // 3D world hedef
                    const target = canvasToWorld(destX, destY);
                    const targetPos = new THREE.Vector3(target.x, 0.05, target.z);

                    // 🎯 360° rastgele başlangıç yönü
                    const spawnAngle = Math.random() * Math.PI * 2;
                    const spawnDist = 15 + Math.random() * 20;
                    const spawnHeight = 5 + Math.random() * 18;
                    const spawnX = targetPos.x + Math.cos(spawnAngle) * spawnDist;
                    const spawnZ = targetPos.z + Math.sin(spawnAngle) * spawnDist;

                    const points = [];

                    if (flightStyle === 0) {
                        // 🌀 SPİRAL — 360° dönerek iniş
                        const startPos = new THREE.Vector3(spawnX, spawnHeight, spawnZ);
                        points.push(startPos);
                        const spiralLoops = 1.5 + Math.random() * 1.5;
                        const startRadius = 5 + Math.random() * 8;
                        for (let j = 0; j <= 10; j++) {
                            const t = j / 10;
                            const angle = spawnAngle + t * Math.PI * 2 * spiralLoops;
                            const radius = startRadius * (1 - t * 0.7);
                            const height = startPos.y * (1 - t) + targetPos.y * t;
                            points.push(new THREE.Vector3(
                                targetPos.x + Math.cos(angle) * radius,
                                height + Math.sin(t * Math.PI) * 4,
                                targetPos.z + Math.sin(angle) * radius
                            ));
                        }
                    } else if (flightStyle === 1) {
                        // 🌊 DALGA — 360° sinüzoidal yol
                        const startPos = new THREE.Vector3(spawnX, spawnHeight, spawnZ);
                        points.push(startPos);
                        for (let j = 0; j <= 8; j++) {
                            const t = j / 8;
                            const wave = Math.sin(t * Math.PI * 3) * (4 + Math.random() * 3);
                            // Dalga yönüne dik salınım
                            const perpAngle = spawnAngle + Math.PI / 2;
                            points.push(new THREE.Vector3(
                                startPos.x + (targetPos.x - startPos.x) * t + Math.cos(perpAngle) * wave,
                                startPos.y * (1 - t) + targetPos.y * t + Math.sin(t * Math.PI) * 3,
                                startPos.z + (targetPos.z - startPos.z) * t + Math.sin(perpAngle) * wave
                            ));
                        }
                    } else {
                        // 🌈 KASKAD — 360° yönden yükselip düşüş
                        const startPos = new THREE.Vector3(spawnX, spawnHeight, spawnZ);
                        points.push(startPos);
                        // Zirveye çık (halının üstünde)
                        const peakHeight = 22 + Math.random() * 8;
                        points.push(new THREE.Vector3(
                            targetPos.x + Math.cos(spawnAngle) * spawnDist * 0.3,
                            peakHeight,
                            targetPos.z + Math.sin(spawnAngle) * spawnDist * 0.3
                        ));
                        // Hızlı düşüş
                        for (let j = 0; j <= 5; j++) {
                            const t = j / 5;
                            points.push(new THREE.Vector3(
                                targetPos.x + Math.cos(spawnAngle) * spawnDist * 0.1 * (1 - t),
                                (peakHeight * (1 - t * t)) + targetPos.y * (t * t),
                                targetPos.z + Math.sin(spawnAngle) * spawnDist * 0.1 * (1 - t)
                            ));
                        }
                    }

                    points.push(targetPos);
                    const curve = new THREE.CatmullRomCurve3(points);
                    curve.tension = 0.4;

                    const color = `rgb(${r},${g},${b})`;
                    const speed = 0.15 + Math.random() * 0.08; // Değişken hız

                    flyingQueueRef.current.push({
                        id: now + Math.random() + pixelIndex,
                        curve,
                        progress: 0,
                        speed,
                        startTime: now + pixelIndex * 3,
                        landed: false,
                        color,
                        destX,
                        destY,
                        r, g, b, a
                    });

                    pixelIndex++;
                }
            }

            // console.log(`🧶 ${pixelIndex} iplik uçuşa geçti! (stil: ${['spiral', 'dalga', 'kaskad'][flightStyle]})`);

            // 🔊 Uçuş başlangıç sesi
            try { audioManager.playWhoosh(); } catch (e) { }

            // 🎨 Pikseller konduktan sonra → enhancement + isim yaz
            const estimatedLandTime = Math.min(pixelIndex * 3 + 2000, 5000);
            const drawingId = drawing.id || `${Date.now()}`;

            // Önceki timer varsa iptal et
            if (pendingEnhancementsRef.current[drawingId]) {
                clearTimeout(pendingEnhancementsRef.current[drawingId]);
            }

            pendingEnhancementsRef.current[drawingId] = setTimeout(() => {
                const ctx = offscreenCtxRef.current;
                if (ctx) {
                    // Enhancement kaldırıldı — AI dönüşümü yapacak
                    // Sadece isim yaz
                    try {
                        renderWovenName(ctx, drawing.userName, drawing.x, drawing.y, drawing.width, drawing.height);
                    } catch (nameErr) {
                        console.warn('⚠️ İsim yazma hatası:', nameErr.message);
                    }
                    needsUpdateRef.current = true;
                    // console.log(`🎨 İsim eklendi: ${drawing.userName} (${drawingId.substring(0, 15)})`);
                }
                delete pendingEnhancementsRef.current[drawingId];
            }, estimatedLandTime);
        };
        img.src = drawing.dataUrl;
    }, [canvasToWorld, renderWovenName]);

    // 🛬 Piksel konduğunda — canvas'a canlı renk + glow olarak çiz
    const handleLand = useCallback((item) => {
        const ctx = offscreenCtxRef.current;
        if (!ctx) return;

        const LAND_BLOCK = 12;

        // ✨ Konma parıltısı (glow halo)
        const glowSize = LAND_BLOCK * 2;
        const gradient = ctx.createRadialGradient(
            item.destX + LAND_BLOCK / 2, item.destY + LAND_BLOCK / 2, 0,
            item.destX + LAND_BLOCK / 2, item.destY + LAND_BLOCK / 2, glowSize
        );
        gradient.addColorStop(0, `rgba(${item.r},${item.g},${item.b},0.4)`);
        gradient.addColorStop(0.5, `rgba(${item.r},${item.g},${item.b},0.1)`);
        gradient.addColorStop(1, `rgba(${item.r},${item.g},${item.b},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(
            item.destX - glowSize + LAND_BLOCK / 2,
            item.destY - glowSize + LAND_BLOCK / 2,
            glowSize * 2, glowSize * 2
        );

        // Canlı renkle dolu kare çiz
        ctx.fillStyle = `rgba(${item.r},${item.g},${item.b},${(item.a / 255)})`;
        ctx.fillRect(item.destX, item.destY, LAND_BLOCK, LAND_BLOCK);

        // Hafif iplik izi (gölge çizgisi)
        ctx.fillStyle = `rgba(0,0,0,0.06)`;
        ctx.fillRect(item.destX, item.destY + LAND_BLOCK * 0.5, LAND_BLOCK, 0.5);

        needsUpdateRef.current = true;

        // 🎵 Renk piyano notası — her konmada rengin notası çalar
        try {
            const hex = '#' + [item.r, item.g, item.b].map(c => c.toString(16).padStart(2, '0')).join('');
            audioManager.playNoteForColor(hex);
        } catch (e) { }

        // Queue'dan kaldır
        const index = flyingQueueRef.current.findIndex(p => p.id === item.id);
        if (index > -1) {
            flyingQueueRef.current.splice(index, 1);
        }
    }, []);

    // =====================================================================
    // 🤖 AI MOTİF DÖNÜŞÜMÜ — Basit ve temiz
    // =====================================================================

    // 🤖 AI motif geldi — orijinali temizle, AI motifini yerleştir
    const morphToAIMotif = useCallback(({ id, aiDataUrl, userName, x, y, width, height }) => {
        const ctx = offscreenCtxRef.current;
        const canvas = offscreenCanvasRef.current;
        if (!ctx || !canvas || !aiDataUrl) return;

        // console.log(`🤖✨ AI motif dönüşümü: ${id?.substring(0, 15)}`);

        // Pending enhancement varsa iptal et (flying pixels henüz bitmemiş olabilir)
        if (pendingEnhancementsRef.current[id]) {
            clearTimeout(pendingEnhancementsRef.current[id]);
            delete pendingEnhancementsRef.current[id];
        }

        const aiImg = new Image();
        if (!aiDataUrl.startsWith('data:')) {
            aiImg.crossOrigin = 'anonymous';
        }
        aiImg.onload = () => {
            try {
                // Sadece çizim alanını temizle — yanındaki motiflere DOKUNMA
                const pad = 2; // Minimal padding (sadece anti-alias artıkları için)
                const clearX = Math.max(0, x - pad);
                const clearY = Math.max(0, y - pad);
                const clearW = Math.min(canvas.width - clearX, width + pad * 2);
                const clearH = Math.min(canvas.height - clearY, height + pad * 2);

                ctx.save();
                // Alanı temizle
                ctx.clearRect(clearX, clearY, clearW, clearH);
                // Halı zemin geri koy
                ctx.fillStyle = '#f0e4d0';
                ctx.fillRect(clearX, clearY, clearW, clearH);
                // AI motifini yerleştir
                ctx.globalAlpha = 1.0;
                ctx.drawImage(aiImg, x, y, width, height);
                ctx.restore();

                // İsim yaz
                try {
                    renderWovenName(ctx, userName, x, y, width, height);
                } catch (nameErr) {
                    console.warn('⚠️ AI motif isim hatası:', nameErr.message);
                }
                needsUpdateRef.current = true;
                // console.log(`✨ AI kilim motifi yerleştirildi! (${width}x${height})`);
            } catch (err) {
                console.error('❌ morphToAIMotif genel hata:', err);
            }
        };
        aiImg.onerror = (e) => {
            console.error('❌ AI motif yüklenemedi', e);
        };
        aiImg.src = aiDataUrl;
    }, [renderWovenName]);

    // 🧵 Kilim tarzı dekoratif çerçeve (orijinal çizime dokunmadan kenar ekler)
    const applyKilimBorder = useCallback((ctx, x, y, width, height) => {
        ctx.save();
        const borderW = Math.max(3, Math.min(8, width * 0.02));

        // Dış çerçeve — koyu çizgi
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.6)';
        ctx.lineWidth = borderW;
        ctx.strokeRect(x + borderW / 2, y + borderW / 2, width - borderW, height - borderW);

        // İç çerçeve — ince altın çizgi
        ctx.strokeStyle = 'rgba(205, 165, 80, 0.4)';
        ctx.lineWidth = Math.max(1, borderW * 0.5);
        ctx.strokeRect(x + borderW * 1.5, y + borderW * 1.5, width - borderW * 3, height - borderW * 3);

        // Köşe süsleri (küçük dörtgenler)
        const cornerSize = Math.max(4, borderW * 1.5);
        ctx.fillStyle = 'rgba(180, 120, 50, 0.5)';
        // Sol üst
        ctx.fillRect(x + borderW * 0.5, y + borderW * 0.5, cornerSize, cornerSize);
        // Sağ üst
        ctx.fillRect(x + width - borderW * 0.5 - cornerSize, y + borderW * 0.5, cornerSize, cornerSize);
        // Sol alt
        ctx.fillRect(x + borderW * 0.5, y + height - borderW * 0.5 - cornerSize, cornerSize, cornerSize);
        // Sağ alt
        ctx.fillRect(x + width - borderW * 0.5 - cornerSize, y + height - borderW * 0.5 - cornerSize, cornerSize, cornerSize);

        ctx.restore();
    }, []);

    // =====================================================================
    // SOCKET EVENTLERI
    // =====================================================================
    useEffect(() => {
        if (!socket) return;

        socket.on('initial-carpet', ({ drawings }) => {
            // console.log(`📦 initial-carpet geldi: ${drawings?.length || 0} çizim`);
            // console.log(`📦 ctx durumu: ${!!offscreenCtxRef.current}, textureRef: ${!!textureRef.current}`);
            const resolvedDrawings = (drawings || []).map((d) => {
                const dataUrl = d.dataUrl || (d.drawingFile ? `${window.location.origin}/motifs/${d.drawingFile}` : null);
                const aiDataUrl = d.aiDataUrl || (d.aiFile ? `${window.location.origin}/motifs/${d.aiFile}` : null);
                return { ...d, dataUrl, aiDataUrl };
            });
            if (resolvedDrawings.length > 0) {
                const ctx = offscreenCtxRef.current;
                if (!ctx) {
                    console.error('❌ CANVAS CTX NULL! Çizimler gösterilemez.');
                    return;
                }

                resolvedDrawings.forEach((drawing, i) => {
                    // console.log(`📦 [${i}] id=${drawing.id?.substring(0, 12)} ai=${!!drawing.aiDataUrl} dataUrl=${drawing.dataUrl ? 'OK' : 'NULL'} x=${drawing.x} y=${drawing.y} w=${drawing.width} h=${drawing.height}`);

                    if (drawing.aiDataUrl && ctx) {
                        // ✅ AI motifi HAZIR — direkt çiz
                        setTimeout(() => {
                            const aiImg = new Image();
                            // data: URL'lerde crossOrigin KULLANMA — hata çıkarır
                            if (!drawing.aiDataUrl.startsWith('data:')) {
                                aiImg.crossOrigin = 'anonymous';
                            }
                            aiImg.onload = () => {
                                try {
                                    ctx.save();
                                    ctx.globalAlpha = 1.0;
                                    ctx.drawImage(aiImg, drawing.x, drawing.y, drawing.width, drawing.height);
                                    ctx.restore();
                                    try {
                                        renderWovenName(ctx, drawing.userName, drawing.x, drawing.y, drawing.width, drawing.height);
                                    } catch (nameErr) {
                                        console.warn('⚠️ İsim hatası:', nameErr.message);
                                    }
                                    needsUpdateRef.current = true;
                                    // console.log(`📦✅ AI motif çizildi [${i}]: ${drawing.id?.substring(0, 15)}`);
                                } catch (err) {
                                    console.error('❌ AI drawImage hatası:', err);
                                    // Fallback: orijinal çizimi göster
                                    drawWovenImage(drawing);
                                }
                            };
                            aiImg.onerror = (e) => {
                                console.warn(`⚠️ AI SVG bozuk [${i}], orijinal çizim gösterilecek`);
                                // FALLBACK: AI yüklenemedi → orijinal çizimi göster
                                drawWovenImage(drawing);
                            };
                            aiImg.src = drawing.aiDataUrl;
                        }, i * 100);
                    } else {
                        // ⏳ AI motifi yok — orijinal çizimi direkt göster
                        setTimeout(() => {
                            drawWovenImage(drawing);
                        }, i * 100);
                    }
                });
            }
        });

        socket.on('new-drawing', (drawing) => {
            launchFlyingPixels(drawing);
        });

        // 🤖 AI motifi hazır — morph animasyonu başlat
        socket.on('ai-drawing-ready', (data) => {
            // console.log(`🤖 AI drawing ready:`, data.id?.substring(0, 15));
            morphToAIMotif(data);
        });

        socket.on('carpet-reset', () => {
            const ctx = offscreenCtxRef.current;
            const canvas = offscreenCanvasRef.current;
            if (!ctx || !canvas) return;

            flyingQueueRef.current = [];

            ctx.fillStyle = '#f0e4d0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(80,50,20,0.03)';
            ctx.lineWidth = 0.3;
            const gridStep = 4;
            for (let x = 0; x < canvas.width; x += gridStep) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridStep) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            needsUpdateRef.current = true;
        });

        // 🔑 KALICI FIX: Bileşen mount olduktan sonra veriyi tekrar iste
        // (socket zaten bağlıysa initial-carpet eventi kaçırılmış olabilir)
        // console.log('🔄 request-initial-carpet gönderiliyor...');
        socket.emit('request-initial-carpet');

        return () => {
            socket.off('initial-carpet');
            socket.off('new-drawing');
            socket.off('ai-drawing-ready');
            socket.off('carpet-reset');
        };
    }, [socket, drawWovenImage, launchFlyingPixels, morphToAIMotif, renderWovenName]);

    // Frame loop: texture + shader time güncelle
    useFrame((state) => {
        if (needsUpdateRef.current && textureRef.current) {
            textureRef.current.needsUpdate = true;
            needsUpdateRef.current = false;
        }

        // Shader time güncelle
        if (materialRef.current?.userData?.shader) {
            materialRef.current.userData.shader.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <group>
            {/* ANA HALI YÜZEYİ */}
            <mesh ref={meshRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
                <planeGeometry args={[carpetWidth, carpetDepth, 64, 64]} />
                <primitive object={woolMaterial} attach="material" />
            </mesh>

            {/* 🧶 UÇAN İPLİKLER */}
            <FlyingPixelsInstances
                queueRef={flyingQueueRef}
                onLand={handleLand}
            />

            {/* Çocuk bileşenler (Border, Fringes vb.) */}
            {children}
        </group>
    );
}

export default CarpetBoard;

