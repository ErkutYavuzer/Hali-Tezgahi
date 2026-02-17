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
            gl_FragColor.rgb = saturated * 1.25;
            
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

    // Yün doku texture'ları
    const woolNormal = useMemo(() => createWoolNormalMap(), []);
    const woolBump = useMemo(() => createWoolBumpMap(), []);

    // Offscreen canvas - halı texture'ı
    const initCanvas = useCallback(() => {
        const canvas = document.createElement('canvas');
        canvas.width = CONFIG.TEXTURE_WIDTH;
        canvas.height = CONFIG.TEXTURE_HEIGHT;
        const ctx = canvas.getContext('2d');

        // Halının varsayılan rengi (açık krem — çizimler öne çıksın)
        ctx.fillStyle = '#e8dcc8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // İnce dokuma ızgara efekti
        ctx.strokeStyle = 'rgba(0,0,0,0.04)';
        ctx.lineWidth = 0.5;
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
    const THREAD_SIZE = 3; // İplik aralığı (küçük = daha detaylı)

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
            // 1️⃣ Önce çizimi tam çözünürlükte direkt yapıştır (canlı renkler)
            ctx.save();
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(img, drawing.x, drawing.y, drawing.width, drawing.height);

            // 2️⃣ Üstüne hafif iplik dokusu overlay
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = drawing.width;
            tmpCanvas.height = drawing.height;
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(img, 0, 0, drawing.width, drawing.height);
            const imageData = tmpCtx.getImageData(0, 0, drawing.width, drawing.height);
            const pixels = imageData.data;

            // İplik çizgileri — çok hafif overlay
            ctx.globalAlpha = 0.06;
            ctx.globalCompositeOperation = 'source-over';

            for (let ty = 0; ty < drawing.height; ty += THREAD_SIZE) {
                for (let tx = 0; tx < drawing.width; tx += THREAD_SIZE) {
                    const pi = (ty * drawing.width + tx) * 4;
                    const r = pixels[pi], g = pixels[pi + 1], b = pixels[pi + 2], a = pixels[pi + 3];
                    if (a < 30) continue;

                    ctx.fillStyle = `rgba(0,0,0,0.3)`;
                    ctx.fillRect(drawing.x + tx, drawing.y + ty + THREAD_SIZE * 0.5, THREAD_SIZE, 0.5);
                    ctx.fillRect(drawing.x + tx + THREAD_SIZE * 0.5, drawing.y + ty, 0.5, THREAD_SIZE);
                }
            }

            ctx.restore();
            needsUpdateRef.current = true;
            console.log(`✅ drawWovenImage tamamlandı: ${drawing.id?.substring(0, 15)}`);
        };
        img.onerror = (e) => {
            console.error('❌ drawWovenImage resim yüklenemedi!', drawing.id, e);
        };
        img.src = drawing.dataUrl;
    }, []);

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
        };
        img.src = drawing.dataUrl;
    }, [canvasToWorld, carpetWidth, carpetDepth]);

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
    // 🤖 AI MOTİF MORPH ANİMASYONU
    // =====================================================================
    const morphToAIMotif = useCallback(({ id, aiDataUrl, x, y, width, height }) => {
        const ctx = offscreenCtxRef.current;
        if (!ctx || !aiDataUrl) return;

        console.log(`🤖✨ AI morph başlıyor: ${id?.substring(0, 15)}`);

        const aiImg = new Image();
        aiImg.crossOrigin = 'anonymous';
        aiImg.onload = () => {
            // Aşama 1: Altın ışıltı pulsu (glow flash)
            const glowFrames = 12;
            let frame = 0;

            const glowInterval = setInterval(() => {
                if (frame >= glowFrames) {
                    clearInterval(glowInterval);
                    // Aşama 2: Crossfade — AI motifini üç adımda yerleştir
                    startCrossfade(ctx, aiImg, x, y, width, height);
                    return;
                }

                ctx.save();
                // Pulsating golden glow
                const intensity = Math.sin((frame / glowFrames) * Math.PI) * 0.6;
                ctx.globalAlpha = intensity;
                ctx.globalCompositeOperation = 'lighter';

                // Altın renkli glow overlay
                const gradient = ctx.createRadialGradient(
                    x + width / 2, y + height / 2, 0,
                    x + width / 2, y + height / 2, Math.max(width, height) * 0.7
                );
                gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
                gradient.addColorStop(0.5, 'rgba(255, 165, 0, 0.4)');
                gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(x - 10, y - 10, width + 20, height + 20);

                ctx.restore();
                needsUpdateRef.current = true;
                frame++;
            }, 60);
        };
        aiImg.onerror = (e) => {
            console.error('❌ AI morph: resim yüklenemedi', e);
        };
        aiImg.src = aiDataUrl;
    }, []);

    // Crossfade: orijinal → AI motifi (üç adımlı geçiş)
    const startCrossfade = useCallback((ctx, aiImg, x, y, width, height) => {
        const fadeSteps = 8;
        let step = 0;

        const fadeInterval = setInterval(() => {
            if (step >= fadeSteps) {
                clearInterval(fadeInterval);
                // Son adım: tam AI motifini çiz + iplik dokusu
                ctx.save();
                ctx.globalAlpha = 1.0;
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(aiImg, x, y, width, height);

                // İplik overlay (hafif)
                const THREAD_SIZE = 3;
                ctx.globalAlpha = 0.04;
                for (let ty = 0; ty < height; ty += THREAD_SIZE) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(x, y + ty + THREAD_SIZE * 0.5, width, 0.5);
                }
                for (let tx = 0; tx < width; tx += THREAD_SIZE) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(x + tx + THREAD_SIZE * 0.5, y, 0.5, height);
                }
                ctx.restore();
                needsUpdateRef.current = true;
                console.log(`✨ AI morph tamamlandı!`);
                return;
            }

            const alpha = (step + 1) / fadeSteps;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(aiImg, x, y, width, height);
            ctx.restore();
            needsUpdateRef.current = true;
            step++;
        }, 80);
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
                    // AI versiyonu varsa direkt onu kullan
                    const renderDrawing = drawing.aiDataUrl
                        ? { ...drawing, dataUrl: drawing.aiDataUrl }
                        : drawing;
                    // Her çizim sırayla uçarak gelsin
                    setTimeout(() => launchFlyingPixels(renderDrawing), i * 800);
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

            ctx.fillStyle = '#c8b896';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = 'rgba(0,0,0,0.04)';
            ctx.lineWidth = 0.5;
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

