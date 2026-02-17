import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export default function DownloadPage() {
    const [imageUrl, setImageUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Socket.io ile sunucuya bağlan (zaten çalışan bağlantı, firewall sorunu yok)
        const serverUrl = window.location.origin;
        const socket = io(serverUrl, {
            transports: ['polling', 'websocket'],
            upgrade: true
        });

        socket.on('connect', () => {
            // Sunucudan halı görüntüsünü iste
            socket.emit('request-carpet-image');
        });

        socket.on('carpet-image-data', (dataUrl) => {
            if (dataUrl) {
                setImageUrl(dataUrl);
                setLoading(false);
            } else {
                setError('Henüz halı görüntüsü yok');
                setLoading(false);
            }
        });

        socket.on('connect_error', () => {
            setError('Sunucuya bağlanılamıyor');
            setLoading(false);
        });

        return () => socket.close();
    }, []);

    const handleDownload = () => {
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.download = `dijital_motif_${Date.now()}.png`;
        link.href = imageUrl;
        link.click();
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Inter', 'Segoe UI', sans-serif", color: 'white',
            padding: 20,
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

            <div style={{ fontSize: 60, marginBottom: 10 }}>🧶</div>

            <h1 style={{
                fontSize: 32, fontWeight: 900, margin: '0 0 8px 0',
                background: 'linear-gradient(135deg, #ffd700, #ff6b35, #ffd700)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundSize: '300% 100%',
                animation: 'shimmer 3s linear infinite',
            }}>DİJİTAL MOTİF ATÖLYESİ</h1>

            <p style={{ fontSize: 14, opacity: 0.5, margin: '0 0 30px 0', letterSpacing: 2 }}>
                İNTERAKTİF KOLEKTİF SANAT DENEYİMİ
            </p>

            {loading && (
                <div style={{
                    animation: 'fadeIn 0.5s ease',
                    fontSize: 16, opacity: 0.7,
                }}>⏳ Halı yükleniyor...</div>
            )}

            {error && (
                <div style={{
                    animation: 'fadeIn 0.5s ease',
                    background: 'rgba(255,59,48,0.15)', borderRadius: 16, padding: '20px 30px',
                    border: '1px solid rgba(255,59,48,0.3)', textAlign: 'center',
                }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>😕</div>
                    <div style={{ fontSize: 16, color: '#ff6b6b' }}>{error}</div>
                    <div style={{ fontSize: 13, opacity: 0.5, marginTop: 8 }}>Halı tamamlandığında burada görebilirsiniz</div>
                </div>
            )}

            {imageUrl && (
                <div style={{ animation: 'fadeIn 0.8s ease', textAlign: 'center', width: '100%' }}>
                    <div style={{
                        borderRadius: 16, overflow: 'hidden',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                        border: '2px solid rgba(255,215,0,0.3)',
                        marginBottom: 24, maxWidth: 500, margin: '0 auto 24px',
                    }}>
                        <img src={imageUrl} alt="Dijital Motif Atölyesi" style={{
                            width: '100%', display: 'block',
                        }} />
                    </div>

                    <button onClick={handleDownload} style={{
                        padding: '16px 40px', borderRadius: 16, cursor: 'pointer',
                        background: 'linear-gradient(135deg, #4ecdc4, #44bd32)',
                        border: 'none', color: 'white', fontWeight: 700, fontSize: 18,
                        fontFamily: "'Inter', sans-serif",
                        boxShadow: '0 4px 24px rgba(78,205,196,0.4)',
                        transition: 'all 0.3s', letterSpacing: 1,
                        width: '90%', maxWidth: 300,
                    }}>
                        📥 ESERİ İNDİR
                    </button>

                    <div style={{
                        marginTop: 16, fontSize: 12, opacity: 0.4,
                    }}>
                        Kolektif sanat eserimizi kaydedin ✨
                    </div>
                </div>
            )}
        </div>
    );
}
