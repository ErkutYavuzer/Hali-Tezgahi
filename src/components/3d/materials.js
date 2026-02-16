import * as THREE from 'three';
import { CONFIG } from '../../constants';

// -----------------------------------------------------------------------------
// TEXTURE GENERATORS
// -----------------------------------------------------------------------------

// 🎨 YÜN DOKUSU: Tamamen Düz ve Mat (Çizgisiz)
function createWoolTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // Saf beyaz, rengi mesh material verir
    ctx.fillRect(0, 0, 1, 1);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// 🎨 NORMAL MAP: Devre Dışı (Düz Yüzey)
function createWoolNormalMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8080ff'; // Neutral Normal
    ctx.fillRect(0, 0, 1, 1);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// 🪵 PARKE DOKUSU: Gelişmiş Prosedürel Parke Zemin
function createParquetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Temel Ahşap Tonu (Sıcak Meşe / Bal Rengi)
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(0, 0, 1024, 1024);

    const rows = 8;
    const cols = 4;
    const pw = 1024 / cols;
    const ph = 1024 / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // Parke kaydırma (staggered pattern)
            const xOff = (r % 2 === 0) ? 0 : -pw / 2;
            const x = c * pw + xOff;
            const y = r * ph;

            // Her parke için hafif renk varyasyonu (Daha sıcak kahve tonları)
            const v = Math.random() * 30 - 15;
            const red = 109 + v;
            const green = 76 + v;
            const blue = 65 + v;
            ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
            ctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);

            // Parke İçi Damarlar (Grains - Daha doğal koyu kahve damarlar)
            ctx.save();
            ctx.beginPath();
            ctx.rect(x + 2, y + 2, pw - 4, ph - 4);
            ctx.clip();

            for (let i = 0; i < 20; i++) {
                const gy = y + Math.random() * ph;
                ctx.fillStyle = `rgba(60,30,10,${0.1 + Math.random() * 0.15})`;
                ctx.fillRect(x, gy, pw, Math.random() * 1.5 + 0.5);
            }

            // Işık parıltısı (Hafif vaks etkisi)
            ctx.fillStyle = `rgba(255,255,255,0.02)`;
            ctx.fillRect(x + 2, y + 2, pw - 4, 10);

            ctx.restore();

            // Parke birleşim yerleri (Seams)
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, pw, ph);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4); // Zeminde tekrar etsin
    return texture;
}

// 🎨 KILIM REHBERİ: İmece Modu İçin (Silik Desen)
function createKilimGuideTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Şeffaf Zemin
    ctx.clearRect(0, 0, 512, 1024);

    // Ana Baklava Deseni (Diamond) - 🎨 DAHA İNCE VE SİLİK
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; // Beyaz, daha net kontrast
    ctx.lineWidth = 4; // Çok daha ince çizgiler

    // 3 Büyük Baklava
    for (let i = 0; i < 3; i++) {
        const centerY = 170 + i * 340;
        ctx.beginPath();
        ctx.moveTo(256, centerY - 140);
        ctx.lineTo(420, centerY);
        ctx.lineTo(256, centerY + 140);
        ctx.lineTo(92, centerY);
        ctx.closePath();
        ctx.stroke();

        // İç Detay (Koçboynuzu Sembolü Basitleştirilmiş)
        ctx.beginPath();
        ctx.arc(256, centerY, 40, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Kenar Suyu (Border)
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40, 1024);
    ctx.moveTo(472, 0);
    ctx.lineTo(472, 1024);
    ctx.setLineDash([20, 10]); // Kesik çizgiler
    ctx.stroke();
    ctx.setLineDash([]); // Reset

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// Halı Kenarı Dokusu Oluşturucu
export function createCarpetBorderTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Ana Zemin (Koyu Kırmızı/Bordo)
    ctx.fillStyle = '#8e2323';
    ctx.fillRect(0, 0, 512, 128);

    // Altın Şeritler (Kenar Sınırları)
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 10, 512, 10);
    ctx.fillRect(0, 108, 512, 10);

    // Motifler (Basit Geometrik Baklava Deseni)
    ctx.fillStyle = '#f5f6fa'; // Krem
    for (let i = 0; i < 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i + 32, 30);
        ctx.lineTo(i + 52, 64);
        ctx.lineTo(i + 32, 98);
        ctx.lineTo(i + 12, 64);
        ctx.fill();

        // İç Detay (Nakış Efekti)
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        for (let j = 0; j < 64; j += 4) {
            ctx.beginPath();
            ctx.moveTo(i + j, 0);
            ctx.lineTo(i + j, 128);
            ctx.stroke();
        }
    }

    // Kenar Dikiş İzleri (Stitches)
    ctx.strokeStyle = '#4e0d0d';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.setLineDash([]);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// -----------------------------------------------------------------------------
// GEOMETRIES & MATERIALS
// -----------------------------------------------------------------------------

export const WOOL_TEXTURE = createWoolTexture();
export const WOOL_NORMAL = createWoolNormalMap();
export const WOOD_TEXTURE = createParquetTexture();
export const KILIM_GUIDE_TEXTURE = createKilimGuideTexture();

export const SHARED_BOX_GEO = new THREE.BoxGeometry(CONFIG.NODE_SIZE * 0.99, 0.06, CONFIG.NODE_SIZE * 0.99);

// 🎨 Uçan pikseller için dikişli iplik materyali
export const FLYING_MAT = new THREE.MeshStandardMaterial({
    roughness: 0.2, // Daha pürüzsüz
    metalness: 0.1,
    map: WOOL_TEXTURE,
    normalMap: WOOL_NORMAL,
    transparent: true,
    opacity: 1,
    emissive: '#000000', // Emissive kapalı (görünürlük testi)
    emissiveIntensity: 0,
    toneMapped: true // Normal render
});

// Üçgenler için Geometri (Extrude Ayarları)
const EXTRUDE_SETTINGS = { depth: 0.05, bevelEnabled: false };

const TRIANGLE_SHAPE_TL = new THREE.Shape();
TRIANGLE_SHAPE_TL.moveTo(-0.5 * CONFIG.NODE_SIZE * 0.99, 0.5 * CONFIG.NODE_SIZE * 0.99);
TRIANGLE_SHAPE_TL.lineTo(0.5 * CONFIG.NODE_SIZE * 0.99, 0.5 * CONFIG.NODE_SIZE * 0.99);
TRIANGLE_SHAPE_TL.lineTo(-0.5 * CONFIG.NODE_SIZE * 0.99, -0.5 * CONFIG.NODE_SIZE * 0.99);
TRIANGLE_SHAPE_TL.lineTo(-0.5 * CONFIG.NODE_SIZE * 0.99, 0.5 * CONFIG.NODE_SIZE * 0.99);

const TRIANGLE_SHAPE_BR = new THREE.Shape();
TRIANGLE_SHAPE_BR.moveTo(0.5 * CONFIG.NODE_SIZE * 0.99, 0.5 * CONFIG.NODE_SIZE * 0.99);
TRIANGLE_SHAPE_BR.lineTo(0.5 * CONFIG.NODE_SIZE * 0.99, -0.5 * CONFIG.NODE_SIZE * 0.99);
TRIANGLE_SHAPE_BR.lineTo(-0.5 * CONFIG.NODE_SIZE * 0.99, -0.5 * CONFIG.NODE_SIZE * 0.99);
TRIANGLE_SHAPE_BR.lineTo(0.5 * CONFIG.NODE_SIZE * 0.99, 0.5 * CONFIG.NODE_SIZE * 0.99);

export const SHARED_TRI_TL_GEO = new THREE.ExtrudeGeometry(TRIANGLE_SHAPE_TL, EXTRUDE_SETTINGS);
export const SHARED_TRI_BR_GEO = new THREE.ExtrudeGeometry(TRIANGLE_SHAPE_BR, EXTRUDE_SETTINGS);

// Merkezlemek için
SHARED_TRI_TL_GEO.center();
SHARED_TRI_BR_GEO.center();

// Püskül Geometrisi (Uca doğru incelen ve hafif bükülen lifler)
export const FRINGE_GEO = new THREE.CylinderGeometry(0.005, 0.018, 0.7, 6);
export const FRINGE_MAT = new THREE.MeshStandardMaterial({
    color: '#f5f5dc',
    roughness: 0.8,
    emissive: '#f5f5dc', // Hafif parlasın
    emissiveIntensity: 0.2
});
