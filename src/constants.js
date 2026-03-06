export const CONFIG = {
    // Halı boyutları (3D birim) — LANDSCAPE (yatay)
    CARPET_WIDTH: 40,   // Geniş kenar (ekranın yatay ekseni)
    CARPET_DEPTH: 24,   // Kısa kenar (ekranın dikey ekseni)

    // Çizim canvas çözünürlüğü
    CANVAS_RESOLUTION: 1280,

    // Halı texture çözünürlüğü (2560x512 ekran, landscape)
    TEXTURE_WIDTH: 2560,
    TEXTURE_HEIGHT: 512,       // 50:10 oran (5:1), landscape

    // Çizim yerleştirme
    DRAWING_SCALE: 0.35,       // Motifler daha büyük ve detaylı
    MAX_DRAWINGS: 60,          // Max çizim sayısı

    // Eski uyumluluk
    NODE_SIZE: 0.25,
};

// 🎨 Kategorili Renk Paleti — Geleneksel Halı Renkleri + Modern Tonlar
export const PALETTE_CATEGORIES = [
    {
        name: 'Sıcak',
        emoji: '🔥',
        colors: ['#c0392b', '#8B0000', '#e74c3c', '#d35400', '#e67e22', '#f39c12', '#f1c40f', '#c23616', '#b33939', '#ffb142']
    },
    {
        name: 'Soğuk',
        emoji: '❄️',
        colors: ['#3498db', '#2980b9', '#273c75', '#192a56', '#40739e', '#487eb0', '#8e44ad', '#9b59b6', '#574b90', '#706fd3']
    },
    {
        name: 'Doğa',
        emoji: '🌿',
        colors: ['#2ecc71', '#27ae60', '#16a085', '#218c74', '#33d9b2', '#44bd32', '#1abc9c', '#0a3d62', '#079992', '#38ada9']
    },
    {
        name: 'Toprak',
        emoji: '🏺',
        colors: ['#e1b12c', '#cc8e35', '#a0522d', '#8B4513', '#D2691E', '#CD853F', '#B8860B', '#DAA520', '#d4a574', '#c19a6b']
    },
    {
        name: 'Nötr',
        emoji: '⚪',
        colors: ['#000000', '#2c3e50', '#474747', '#7f8c8d', '#aaa69d', '#bdc3c7', '#ecf0f1', '#ffffff']
    }
];

// Flat palette (backward compat)
export const PALETTE = PALETTE_CATEGORIES.flatMap(c => c.colors);

export const THEME = {
    bg: 'radial-gradient(circle at top right, #1a1a2e, #0f0f1a)',
    glass: 'rgba(255, 255, 255, 0.05)',
    glassBorder: '1px solid rgba(255, 255, 255, 0.1)',
    accent: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accentGold: 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)',
    shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
};
