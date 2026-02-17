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

        // Vertex shader: hafif yüzey bozulması (fiber displacement)
        shader.vertexShader = `
            uniform float uTime;
            varying float vFiber;
            varying vec2 vHighUv;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            
            // Yüksek frekanslı UV (fiber detail)
            vHighUv = uv * vec2(24.0, 40.0);
            
            // İplik fiber noise
            float fiber = sin(uv.x * 200.0) * cos(uv.y * 200.0) * 0.5
                        + sin(uv.x * 80.0 + uv.y * 60.0) * 0.3;
            vFiber = fiber;
            
            // Hafif yüzey kabartması
            vec3 dispNormal = normalize(normal);
            transformed += dispNormal * fiber * 0.02;
            `
        );

        // Fragment shader: fiber detail ve renk varyasyonu
        shader.fragmentShader = `
            varying float vFiber;
            varying vec2 vHighUv;
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            
            // 🧶 Yün fiber detayı
            float fiberDetail = sin(vHighUv.x * 25.0) * cos(vHighUv.y * 25.0) * 0.05;
            float fiberCross = sin(vHighUv.x * 12.5 + vHighUv.y * 12.5) * 0.025;
            
            // Renk varyasyonu (her iplik hafif farklı ton)
            float colorVar = sin(vHighUv.x * 50.0) * sin(vHighUv.y * 50.0) * 0.03;
            
            gl_FragColor.rgb += fiberDetail + fiberCross;
            gl_FragColor.rgb *= (1.0 + colorVar);
            
            // 🎨 RENK CANLANDIRMA - Satürasyon artışı
            float luminance = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 saturated = mix(vec3(luminance), gl_FragColor.rgb, 1.8);
            gl_FragColor.rgb = saturated * 1.4;
            
            // Rim ışık (kenar parlaması - yün tüylerini simüle eder)
            float rim = 1.0 - max(dot(normalize(vViewPosition), normalize(vNormal)), 0.0);
            gl_FragColor.rgb += vec3(0.06) * pow(rim, 3.0);
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

function CarpetBoard({ socket, carpetWidth, carpetDepth, children }) {
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

        // Three.js Texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        textureRef.current = texture;

        return texture;
    }, []);

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
    const THREAD_SIZE = 2; // İplik aralığı (küçük = daha detaylı)
    const PIXEL_SIZE = 4;  // Mozaik blok boyutu (halıya dokunmuş efekti)

    // =====================================================================
    // 🎨 CLIENT-SIDE DETERMİNİSTİK ENHANCEMENT
    // Orijinal çizimi koruyarak "halıya dokunmuş" estetiği verir
    // AI'dan bağımsız, her zaman çalışır, anında sonuç (50-100ms)
    // =====================================================================

    // 12 renklik geleneksel kilim paleti
    const KILIM_PALETTE = [
        [196, 30, 58],   // kırmızı
        [26, 58, 107],   // lacivert
        [200, 169, 81],  // altın
        [245, 240, 232], // krem
        [45, 90, 39],    // yeşil
        [92, 26, 10],    // bordo
        [232, 162, 62],  // turuncu
        [61, 43, 31],    // kahverengi
        [123, 45, 79],   // mor
        [212, 165, 116], // bej
        [26, 26, 46],    // gece mavisi
        [255, 245, 230], // fildişi
    ];

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

    // En yakın kilim rengini bul
    const nearestKilimColor = useCallback((r, g, b) => {
        let minDist = Infinity, best = [r, g, b];
        for (const [kr, kg, kb] of KILIM_PALETTE) {
            const dist = (r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2;
            if (dist < minDist) { minDist = dist; best = [kr, kg, kb]; }
        }
        return best;
    }, []);

    /**
     * 🎨 applyWovenEnhancement — Çizimi "halıya dokunmuş" estetiğine dönüştürür
     * 
     * Uygulanan efektler (sırasıyla):
     * 1. Pikselizasyon (mozaik) — her PIXEL_SIZE×PIXEL_SIZE blok aynı renk
     * 2. Renk doygunluğu artırma — %40 saturation boost
     * 3. Kontrast artırma — %25 contrast boost
     * 4. Kilim paleti quantization — en yakın 12 geleneksel renge snap
     * 5. İplik dokusu overlay — yatay + dikey ince çizgiler
     * 6. Dekoratif kilim çerçevesi
     * 
     * Orijinal şekil %100 korunur, sadece "medium" değişir.
     */
    const applyWovenEnhancement = useCallback((ctx, x, y, width, height) => {
        // 1️⃣ Orijinali tmpCanvas'a kopyala
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = width;
        tmpCanvas.height = height;
        const tmpCtx = tmpCanvas.getContext('2d');

        // Mevcut canvas'tan bu bölgeyi al
        const sourceData = ctx.getImageData(x, y, width, height);
        tmpCtx.putImageData(sourceData, 0, 0);

        // 2️⃣ Piksel piksel işle: mozaik + renk enhancement
        const imageData = tmpCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        const enhanced = new ImageData(width, height);
        const out = enhanced.data;

        for (let by = 0; by < height; by += PIXEL_SIZE) {
            for (let bx = 0; bx < width; bx += PIXEL_SIZE) {
                // Blok içindeki piksellerin ortalamasını al
                let totalR = 0, totalG = 0, totalB = 0, totalA = 0, count = 0;

                for (let dy = 0; dy < PIXEL_SIZE && (by + dy) < height; dy++) {
                    for (let dx = 0; dx < PIXEL_SIZE && (bx + dx) < width; dx++) {
                        const pi = ((by + dy) * width + (bx + dx)) * 4;
                        totalR += pixels[pi];
                        totalG += pixels[pi + 1];
                        totalB += pixels[pi + 2];
                        totalA += pixels[pi + 3];
                        count++;
                    }
                }

                let avgR = Math.round(totalR / count);
                let avgG = Math.round(totalG / count);
                let avgB = Math.round(totalB / count);
                const avgA = Math.round(totalA / count);

                // Şeffaf pikselleri atla
                if (avgA < 20) {
                    for (let dy = 0; dy < PIXEL_SIZE && (by + dy) < height; dy++) {
                        for (let dx = 0; dx < PIXEL_SIZE && (bx + dx) < width; dx++) {
                            const oi = ((by + dy) * width + (bx + dx)) * 4;
                            out[oi] = pixels[oi];
                            out[oi + 1] = pixels[oi + 1];
                            out[oi + 2] = pixels[oi + 2];
                            out[oi + 3] = pixels[oi + 3];
                        }
                    }
                    continue;
                }

                // Renk doygunluğu artır (+%40)
                let [h, s, l] = rgbToHsl(avgR, avgG, avgB);
                s = Math.min(1.0, s * 1.4);
                // Kontrast artır (+%25)
                l = 0.5 + (l - 0.5) * 1.25;
                l = Math.max(0, Math.min(1, l));
                [avgR, avgG, avgB] = hslToRgb(h, s, l);

                // Kilim paleti quantization (hafif — %60 orijinal + %40 palette)
                const [kr, kg, kb] = nearestKilimColor(avgR, avgG, avgB);
                avgR = Math.round(avgR * 0.6 + kr * 0.4);
                avgG = Math.round(avgG * 0.6 + kg * 0.4);
                avgB = Math.round(avgB * 0.6 + kb * 0.4);

                // Tüm bloğu bu renkle doldur (mozaik efekti)
                for (let dy = 0; dy < PIXEL_SIZE && (by + dy) < height; dy++) {
                    for (let dx = 0; dx < PIXEL_SIZE && (bx + dx) < width; dx++) {
                        const oi = ((by + dy) * width + (bx + dx)) * 4;
                        out[oi] = avgR;
                        out[oi + 1] = avgG;
                        out[oi + 2] = avgB;
                        out[oi + 3] = avgA;
                    }
                }
            }
        }

        // 3️⃣ Enhanced sonucu canvas'a yaz
        ctx.putImageData(enhanced, x, y);

        // 4️⃣ İplik dokusu overlay — bloklar arası ince çizgiler (dokuma grid)
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = 'rgba(61, 43, 31, 0.35)';
        ctx.lineWidth = 0.5;

        // Yatay iplik çizgileri
        for (let ty = 0; ty < height; ty += PIXEL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, y + ty);
            ctx.lineTo(x + width, y + ty);
            ctx.stroke();
        }
        // Dikey iplik çizgileri
        for (let tx = 0; tx < width; tx += PIXEL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x + tx, y);
            ctx.lineTo(x + tx, y + height);
            ctx.stroke();
        }
        ctx.restore();

        // 5️⃣ Dekoratif kilim çerçevesi
        const bw = Math.max(4, Math.min(10, Math.min(width, height) * 0.03));

        ctx.save();
        // Dış çerçeve — koyu border
        ctx.strokeStyle = 'rgba(92, 26, 10, 0.7)'; // bordo
        ctx.lineWidth = bw;
        ctx.strokeRect(x + bw / 2, y + bw / 2, width - bw, height - bw);

        // İç çerçeve — altın
        ctx.strokeStyle = 'rgba(200, 169, 81, 0.5)'; // altın
        ctx.lineWidth = Math.max(1.5, bw * 0.4);
        ctx.strokeRect(x + bw * 1.8, y + bw * 1.8, width - bw * 3.6, height - bw * 3.6);

        // Köşe süsleri — küçük kilim motifleri (baklava dilimi)
        const cs = Math.max(6, bw * 2);
        ctx.fillStyle = 'rgba(200, 169, 81, 0.6)';

        // Sol üst — baklava
        ctx.beginPath();
        ctx.moveTo(x + bw, y + bw + cs / 2);
        ctx.lineTo(x + bw + cs / 2, y + bw);
        ctx.lineTo(x + bw + cs, y + bw + cs / 2);
        ctx.lineTo(x + bw + cs / 2, y + bw + cs);
        ctx.closePath();
        ctx.fill();

        // Sağ üst
        ctx.beginPath();
        ctx.moveTo(x + width - bw - cs, y + bw + cs / 2);
        ctx.lineTo(x + width - bw - cs / 2, y + bw);
        ctx.lineTo(x + width - bw, y + bw + cs / 2);
        ctx.lineTo(x + width - bw - cs / 2, y + bw + cs);
        ctx.closePath();
        ctx.fill();

        // Sol alt
        ctx.beginPath();
        ctx.moveTo(x + bw, y + height - bw - cs / 2);
        ctx.lineTo(x + bw + cs / 2, y + height - bw - cs);
        ctx.lineTo(x + bw + cs, y + height - bw - cs / 2);
        ctx.lineTo(x + bw + cs / 2, y + height - bw);
        ctx.closePath();
        ctx.fill();

        // Sağ alt
        ctx.beginPath();
        ctx.moveTo(x + width - bw - cs, y + height - bw - cs / 2);
        ctx.lineTo(x + width - bw - cs / 2, y + height - bw - cs);
        ctx.lineTo(x + width - bw, y + height - bw - cs / 2);
        ctx.lineTo(x + width - bw - cs / 2, y + height - bw);
        ctx.closePath();
        ctx.fill();

        // Kenar süsleri — üst ve alt kenarda küçük üçgenler
        ctx.fillStyle = 'rgba(196, 30, 58, 0.4)'; // kırmızı
        const triSize = Math.max(3, bw * 0.8);
        const triSpacing = triSize * 3;
        for (let tx = x + bw * 3 + cs; tx < x + width - bw * 3 - cs; tx += triSpacing) {
            // Üst kenar üçgenleri
            ctx.beginPath();
            ctx.moveTo(tx, y + bw * 1.2);
            ctx.lineTo(tx + triSize / 2, y + bw * 1.2 + triSize);
            ctx.lineTo(tx - triSize / 2, y + bw * 1.2 + triSize);
            ctx.closePath();
            ctx.fill();
            // Alt kenar üçgenleri (ters)
            ctx.beginPath();
            ctx.moveTo(tx, y + height - bw * 1.2);
            ctx.lineTo(tx + triSize / 2, y + height - bw * 1.2 - triSize);
            ctx.lineTo(tx - triSize / 2, y + height - bw * 1.2 - triSize);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();

        needsUpdateRef.current = true;
    }, [rgbToHsl, hslToRgb, nearestKilimColor]);


    // ✍️ Motife dokuma estetiğinde isim yazma
    const renderWovenName = useCallback((ctx, name, x, y, width, height) => {
        if (!name || name === 'Anonim') return;
        ctx.save();
        const fontSize = Math.max(10, Math.min(16, width * 0.06));
        ctx.font = `600 ${fontSize}px "Georgia", "Times New Roman", serif`;
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

        console.log(`🧶 drawWovenImage başladı: x=${drawing.x} y=${drawing.y} w=${drawing.width} h=${drawing.height}`);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            console.log(`✅ drawWovenImage resim yüklendi: ${drawing.width}x${drawing.height}`);
            // 1️⃣ Önce çizimi tam çözünürlükte direkt yapıştır
            ctx.save();
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(img, drawing.x, drawing.y, drawing.width, drawing.height);
            ctx.restore();

            // 2️⃣ 🎨 Dokuma enhancement uygula (mozaik + renk + çerçeve)
            applyWovenEnhancement(ctx, drawing.x, drawing.y, drawing.width, drawing.height);

            // 3️⃣ ✍️ İsim render
            renderWovenName(ctx, drawing.userName, drawing.x, drawing.y, drawing.width, drawing.height);

            needsUpdateRef.current = true;
            console.log(`✅ drawWovenImage + enhancement tamamlandı: ${drawing.id?.substring(0, 15)}`);
        };
        img.onerror = (e) => {
            console.error('❌ drawWovenImage resim yüklenemedi!', drawing.id, e);
        };
        img.src = drawing.dataUrl;
    }, [renderWovenName, applyWovenEnhancement]);

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

            console.log(`🧶 ${pixelIndex} iplik uçuşa geçti! (stil: ${['spiral', 'dalga', 'kaskad'][flightStyle]})`);

            // 🔊 Uçuş başlangıç sesi
            try { audioManager.playWhoosh(); } catch (e) { }

            // 🎨 Tüm pikseller konduktan sonra enhancement uygula
            // Tahmini süre: (pixelIndex * 3ms offset) + (~1.5sn uçuş) + 500ms buffer
            const estimatedLandTime = Math.min(pixelIndex * 3 + 2000, 5000);
            const drawingId = drawing.id || `${Date.now()}`;

            // Önceki timer varsa iptal et (aynı çizim tekrar geldiyse)
            if (pendingEnhancementsRef.current[drawingId]) {
                clearTimeout(pendingEnhancementsRef.current[drawingId]);
            }

            pendingEnhancementsRef.current[drawingId] = setTimeout(() => {
                const ctx = offscreenCtxRef.current;
                if (ctx) {
                    console.log(`🎨 Enhancement uygulanıyor: ${drawingId.substring(0, 15)}`);
                    applyWovenEnhancement(ctx, drawing.x, drawing.y, drawing.width, drawing.height);
                    renderWovenName(ctx, drawing.userName, drawing.x, drawing.y, drawing.width, drawing.height);
                }
                delete pendingEnhancementsRef.current[drawingId];
            }, estimatedLandTime);
        };
        img.src = drawing.dataUrl;
    }, [canvasToWorld, carpetWidth, carpetDepth, applyWovenEnhancement, renderWovenName]);

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
    // 🤖 AI ENHANCEMENT OVERLAY — Orijinal çizimi KORUYARAK güzelleştirme
    // =====================================================================
    // MAX_AI_BLEND: AI sonucu bu opacity'den fazla uygulanMAZ
    // Orijinal çizim her zaman %100 görünür kalır, AI sadece hafif overlay
    const MAX_AI_BLEND = 0.35;

    const morphToAIMotif = useCallback(({ id, aiDataUrl, userName, x, y, width, height }) => {
        const ctx = offscreenCtxRef.current;
        if (!ctx || !aiDataUrl) return;

        console.log(`🤖✨ AI enhancement başlıyor: ${id?.substring(0, 15)} (max blend: ${MAX_AI_BLEND})`);

        const aiImg = new Image();
        aiImg.crossOrigin = 'anonymous';
        aiImg.onload = () => {
            // 💡 Orijinal çizim ZATEN canvas'ta — silmiyoruz!
            // AI sonucunu sadece hafif overlay olarak uyguluyoruz

            // Aşama 1: Yumuşak altın ışıltı (dönüşüm başladı sinyali)
            const glowFrames = 10;
            let frame = 0;

            const glowInterval = setInterval(() => {
                if (frame >= glowFrames) {
                    clearInterval(glowInterval);
                    // Aşama 2: AI overlay — BLEND, replace DEĞİL!
                    startAIBlend(ctx, aiImg, userName, x, y, width, height);
                    return;
                }

                ctx.save();
                const intensity = Math.sin((frame / glowFrames) * Math.PI) * 0.3;
                ctx.globalAlpha = intensity;
                ctx.globalCompositeOperation = 'lighter';

                const gradient = ctx.createRadialGradient(
                    x + width / 2, y + height / 2, 0,
                    x + width / 2, y + height / 2, Math.max(width, height) * 0.6
                );
                gradient.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
                gradient.addColorStop(0.6, 'rgba(255, 180, 0, 0.2)');
                gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(x - 5, y - 5, width + 10, height + 10);

                ctx.restore();
                needsUpdateRef.current = true;
                frame++;
            }, 50);
        };
        aiImg.onerror = (e) => {
            console.error('❌ AI enhancement: resim yüklenemedi', e);
        };
        aiImg.src = aiDataUrl;
    }, []);

    // AI Blend: Orijinal çizim üzerine AI'ı HAFIF overlay (max %35) + enhancement
    const startAIBlend = useCallback((ctx, aiImg, userName, x, y, width, height) => {
        const blendSteps = 6;
        let step = 0;

        const blendInterval = setInterval(() => {
            if (step >= blendSteps) {
                clearInterval(blendInterval);

                // SON ADIM: AI overlay (max MAX_AI_BLEND opacity)
                ctx.save();
                ctx.globalAlpha = MAX_AI_BLEND;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(aiImg, x, y, width, height);
                ctx.restore();

                // 🎨 Dokuma enhancement uygula (mozaik + renk + çerçeve)
                applyWovenEnhancement(ctx, x, y, width, height);

                // ✍️ İsim render
                renderWovenName(ctx, userName, x, y, width, height);

                needsUpdateRef.current = true;
                console.log(`✨ AI + enhancement tamamlandı! (blend: ${MAX_AI_BLEND})`);
                return;
            }

            // Kademeli blend: 0 → MAX_AI_BLEND arası
            const alpha = ((step + 1) / blendSteps) * MAX_AI_BLEND;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(aiImg, x, y, width, height);
            ctx.restore();
            needsUpdateRef.current = true;
            step++;
        }, 70);
    }, [renderWovenName, applyWovenEnhancement]);

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
            console.log(`📦 initial-carpet geldi: ${drawings?.length || 0} çizim`);
            if (drawings && drawings.length > 0) {
                drawings.forEach((drawing, i) => {
                    // HER ZAMAN orijinal çizimi göster (AI asla tam üstüne yazılmaz)
                    setTimeout(() => launchFlyingPixels(drawing), i * 800);

                    // AI versiyonu varsa, çizim yerleştikten sonra overlay olarak uygula
                    if (drawing.aiDataUrl) {
                        setTimeout(() => {
                            morphToAIMotif({
                                id: drawing.id,
                                aiDataUrl: drawing.aiDataUrl,
                                userName: drawing.userName,
                                x: drawing.x,
                                y: drawing.y,
                                width: drawing.width,
                                height: drawing.height
                            });
                        }, i * 800 + 3000); // Çizim yerleştikten 3sn sonra AI blend
                    }
                });
            }
        });

        socket.on('new-drawing', (drawing) => {
            launchFlyingPixels(drawing);
        });

        // 🤖 AI motifi hazır — morph animasyonu başlat
        socket.on('ai-drawing-ready', (data) => {
            console.log(`🤖 AI drawing ready:`, data.id?.substring(0, 15));
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
        console.log('🔄 request-initial-carpet gönderiliyor...');
        socket.emit('request-initial-carpet');

        return () => {
            socket.off('initial-carpet');
            socket.off('new-drawing');
            socket.off('ai-drawing-ready');
            socket.off('carpet-reset');
        };
    }, [socket, drawWovenImage, launchFlyingPixels, morphToAIMotif]);

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

