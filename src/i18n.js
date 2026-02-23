// 🌍 Çoklu Dil Desteği — TR/EN
export const LANG = {
  tr: {
    name: '🇹🇷 TR',
    enterName: 'Adını yaz!',
    namePlaceholder: 'Adınız',
    startDrawing: 'Çizmeye Başla!',
    send: 'GÖNDER ✨',
    sending: 'Gönderiliyor...',
    sent: 'Gönderildi! ✅',
    brush: 'Fırça',
    marker: 'Marker',
    spray: 'Sprey',
    star: 'Yıldız',
    calligraphy: 'Hat',
    eraser: 'Silgi',
    fill: 'Dolgu',
    undo: 'Geri Al',
    redo: 'İleri Al',
    clear: 'Temizle',
    colors: 'Renkler',
    brushSize: 'Fırça Boyutu',
    connectionLost: 'Bağlantı kesildi...',
    welcome: 'Halı Tezgahına',
    welcomeSub: 'hoş geldin!',
    drawComment: 'Bir şey çiz ve halıya dokuyalım! 🧶',
  },
  en: {
    name: '🇬🇧 EN',
    enterName: 'Enter your name!',
    namePlaceholder: 'Your name',
    startDrawing: 'Start Drawing!',
    send: 'SEND ✨',
    sending: 'Sending...',
    sent: 'Sent! ✅',
    brush: 'Brush',
    marker: 'Marker',
    spray: 'Spray',
    star: 'Star',
    calligraphy: 'Calligraphy',
    eraser: 'Eraser',
    fill: 'Fill',
    undo: 'Undo',
    redo: 'Redo',
    clear: 'Clear',
    colors: 'Colors',
    brushSize: 'Brush Size',
    connectionLost: 'Connection lost...',
    welcome: 'Welcome to',
    welcomeSub: 'Carpet Loom!',
    drawComment: 'Draw something and we\'ll weave it! 🧶',
  }
};

export function getLang() {
  return localStorage.getItem('carpet-lang') || 'tr';
}

export function setLang(lang) {
  localStorage.setItem('carpet-lang', lang);
}

export function t(key) {
  const lang = getLang();
  return LANG[lang]?.[key] || LANG.tr[key] || key;
}
