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




// Halı Kenarı Dokusu Oluşturucu — Zengin Anadolu Motifli
export function createCarpetBorderTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Ana Zemin (Koyu Kırmızı/Bordo)
    ctx.fillStyle = '#8e2323';
    ctx.fillRect(0, 0, 1024, 256);

    // Altın Şerit Çerçeve (Çift şerit)
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(0, 8, 1024, 6);
    ctx.fillRect(0, 18, 1024, 3);
    ctx.fillRect(0, 235, 1024, 3);
    ctx.fillRect(0, 242, 1024, 6);

    // İnce krem iç çizgiler
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(0, 28, 1024, 2);
    ctx.fillRect(0, 226, 1024, 2);

    // Ana Motif Band — Baklava Deseni (Koçboynuzu stili)
    for (let i = 0; i < 1024; i += 80) {
        // Büyük baklava
        ctx.fillStyle = '#f5f0e0';
        ctx.beginPath();
        ctx.moveTo(i + 40, 38);
        ctx.lineTo(i + 70, 128);
        ctx.lineTo(i + 40, 218);
        ctx.lineTo(i + 10, 128);
        ctx.closePath();
        ctx.fill();

        // İç baklava (kırmızı)
        ctx.fillStyle = '#b22222';
        ctx.beginPath();
        ctx.moveTo(i + 40, 58);
        ctx.lineTo(i + 58, 128);
        ctx.lineTo(i + 40, 198);
        ctx.lineTo(i + 22, 128);
        ctx.closePath();
        ctx.fill();

        // İç iç motif (altın yıldız)
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.moveTo(i + 40, 78);
        ctx.lineTo(i + 50, 128);
        ctx.lineTo(i + 40, 178);
        ctx.lineTo(i + 30, 128);
        ctx.closePath();
        ctx.fill();

        // Merkez nokta
        ctx.beginPath();
        ctx.arc(i + 40, 128, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#1a0808';
        ctx.fill();

        // Baklavalar arası küçük motifler  
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(i, 128, 4, 0, Math.PI * 2);
        ctx.fill();

        // Üst-alt küçük üçgenler
        ctx.fillStyle = '#f5e6c8';
        ctx.beginPath();
        ctx.moveTo(i, 35); ctx.lineTo(i + 8, 50); ctx.lineTo(i - 8, 50);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(i, 221); ctx.lineTo(i + 8, 206); ctx.lineTo(i - 8, 206);
        ctx.closePath();
        ctx.fill();
    }

    // Dikiş İzleri (Stitches)
    ctx.strokeStyle = '#4e0d0d';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(4, 4, 1016, 248);
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

export const SHARED_BOX_GEO = new THREE.BoxGeometry(CONFIG.NODE_SIZE * 0.99, 0.06, CONFIG.NODE_SIZE * 0.99);

// 🎨 Uçan pikseller için dikişli iplik materyali
export const FLYING_MAT = new THREE.MeshStandardMaterial({
    roughness: 0.2,
    metalness: 0.1,
    map: WOOL_TEXTURE,
    normalMap: WOOL_NORMAL,
    transparent: true,
    opacity: 1,
    emissive: '#000000',
    emissiveIntensity: 0,
    toneMapped: true
});

// Püskül Geometrisi (Uca doğru incelen ve hafif bükülen lifler)
export const FRINGE_GEO = new THREE.CylinderGeometry(0.005, 0.018, 0.7, 6);
export const FRINGE_MAT = new THREE.MeshStandardMaterial({
    color: '#f5f5dc',
    roughness: 0.8,
    emissive: '#f5f5dc', // Hafif parlasın
    emissiveIntensity: 0.2
});
