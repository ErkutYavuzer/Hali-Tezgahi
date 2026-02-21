import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const THEME = {
    bg: '#0f0c29',
    card: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,215,0,0.15)',
    gold: '#ffd700',
    green: '#4ecdc4',
    text: '#e8dcc8',
    muted: 'rgba(255,255,255,0.4)',
};

export default function GalleryPage() {
    const [motifs, setMotifs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all | done | failed | pending
    const [sort, setSort] = useState('newest'); // newest | oldest
    const [lightbox, setLightbox] = useState(null); // motif object or null
    const serverUrl = window.location.origin;

    // Motifleri yükle
    useEffect(() => {
        const socket = io(serverUrl, { transports: ['polling', 'websocket'], upgrade: true });

        socket.on('connect', () => {
            socket.emit('request-initial-carpet');
        });

        socket.on('initial-carpet', ({ drawings }) => {
            setMotifs(drawings || []);
            setLoading(false);
        });

        // Realtime güncellemeler
        socket.on('new-drawing', (d) => {
            setMotifs(prev => [...prev, d]);
        });

        socket.on('ai-drawing-ready', ({ id, aiDataUrl, aiFile }) => {
            setMotifs(prev => prev.map(d =>
                d.id === id ? { ...d, aiDataUrl, aiFile, aiStatus: 'done' } : d
            ));
        });

        socket.on('carpet-reset', () => setMotifs([]));
        socket.on('admin:all-deleted', () => setMotifs([]));
        socket.on('admin:drawing-deleted', ({ id }) => {
            setMotifs(prev => prev.filter(d => d.id !== id));
        });

        return () => socket.close();
    }, []);

    // Filtrele ve sırala
    const filtered = motifs
        .filter(m => {
            if (filter === 'all') return true;
            if (filter === 'done') return m.aiStatus === 'done';
            if (filter === 'failed') return m.aiStatus === 'failed';
            if (filter === 'pending') return m.aiStatus !== 'done' && m.aiStatus !== 'failed';
            return true;
        })
        .sort((a, b) => sort === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);

    const doneCount = motifs.filter(m => m.aiStatus === 'done').length;

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(160deg, ${THEME.bg} 0%, #1a1040 40%, #24243e 100%)`,
            fontFamily: "'Inter', -apple-system, sans-serif",
            color: THEME.text, padding: '20px 16px',
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .gallery-card { transition: transform 0.3s, border-color 0.3s; }
        .gallery-card:hover { transform: translateY(-4px); border-color: rgba(255,215,0,0.4) !important; }
        .gallery-card:active { transform: scale(0.98); }
      `}</style>

            {/* Header */}
            <div style={{ maxWidth: 1200, margin: '0 auto 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🧶</div>
                <h1 style={{
                    fontSize: 26, fontWeight: 900,
                    background: 'linear-gradient(135deg, #ffd700 0%, #ff6b35 50%, #ffd700 100%)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    animation: 'shimmer 3s linear infinite',
                    marginBottom: 6,
                }}>Kilim Motif Galerisi</h1>
                <p style={{ fontSize: 12, color: THEME.muted, letterSpacing: 2 }}>
                    İNTERAKTİF KOLEKTİF SANAT DENEYİMİ
                </p>
                <div style={{ fontSize: 13, color: THEME.muted, marginTop: 10 }}>
                    {doneCount} motif · {motifs.length} çizim
                </div>
            </div>

            {/* Filtre + Sıralama */}
            <div style={{
                maxWidth: 1200, margin: '0 auto 16px',
                display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
            }}>
                {[
                    { id: 'all', label: '🎨 Tümü', count: motifs.length },
                    { id: 'done', label: '✅ Motifler', count: doneCount },
                    { id: 'pending', label: '⏳ Bekleyen', count: motifs.filter(m => m.aiStatus !== 'done' && m.aiStatus !== 'failed').length },
                    { id: 'failed', label: '❌ Başarısız', count: motifs.filter(m => m.aiStatus === 'failed').length },
                ].map(f => (
                    <button key={f.id} onClick={() => setFilter(f.id)} style={{
                        padding: '8px 16px', borderRadius: 20, border: 'none',
                        background: filter === f.id ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                        color: filter === f.id ? THEME.gold : THEME.muted,
                        fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.2s',
                    }}>
                        {f.label} ({f.count})
                    </button>
                ))}

                <div style={{ width: 1, background: THEME.border, margin: '0 4px' }} />

                {[
                    { id: 'newest', label: '🕐 Yeni → Eski' },
                    { id: 'oldest', label: '🕐 Eski → Yeni' },
                ].map(s => (
                    <button key={s.id} onClick={() => setSort(s.id)} style={{
                        padding: '8px 14px', borderRadius: 20, border: 'none',
                        background: sort === s.id ? 'rgba(78,205,196,0.15)' : 'rgba(255,255,255,0.04)',
                        color: sort === s.id ? THEME.green : THEME.muted,
                        fontWeight: 600, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 60, color: THEME.muted, fontSize: 16 }}>
                        ⏳ Yükleniyor...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: THEME.muted, fontSize: 16 }}>
                        🎨 {filter === 'all' ? 'Henüz çizim yok' : 'Bu filtrede sonuç yok'}
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 14,
                    }}>
                        {filtered.map((m, i) => {
                            const aiSrc = m.aiFile ? `${serverUrl}/motifs/${m.aiFile}` : null;
                            const drawingSrc = m.drawingFile ? `${serverUrl}/motifs/${m.drawingFile}` : null;
                            const imgSrc = aiSrc || drawingSrc;

                            return (
                                <div
                                    key={m.id}
                                    className="gallery-card"
                                    onClick={() => setLightbox(m)}
                                    style={{
                                        background: THEME.card,
                                        borderRadius: 16, overflow: 'hidden',
                                        border: `1px solid ${THEME.border}`,
                                        cursor: 'pointer',
                                        animation: `fadeIn 0.4s ease ${i * 0.03}s both`,
                                    }}
                                >
                                    {imgSrc ? (
                                        <img src={imgSrc} alt={`${m.userName} motifi`} loading="lazy" style={{
                                            width: '100%', aspectRatio: '1', objectFit: 'cover',
                                            display: 'block',
                                        }} />
                                    ) : (
                                        <div style={{
                                            width: '100%', aspectRatio: '1',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'rgba(255,255,255,0.02)', fontSize: 14, color: THEME.muted,
                                        }}>
                                            {m.aiStatus === 'processing' ? '⏳ AI işleniyor...' : '🎨 Çizim'}
                                        </div>
                                    )}
                                    <div style={{ padding: '10px 14px' }}>
                                        <div style={{
                                            fontSize: 13, fontWeight: 700, color: THEME.gold,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            ✨ {m.userName || 'Anonim'}
                                        </div>
                                        <div style={{ fontSize: 10, color: THEME.muted, marginTop: 3 }}>
                                            {new Date(m.timestamp).toLocaleString('tr-TR', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                            })}
                                        </div>
                                    </div>
                                    {m.aiFile && (
                                        <a
                                            href={`${serverUrl}/api/motifs/${m.id}/download`}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                display: 'block', textAlign: 'center', padding: '10px',
                                                background: 'linear-gradient(135deg, #4ecdc4, #44bd32)',
                                                color: '#fff', textDecoration: 'none',
                                                fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                                            }}
                                        >📥 İndir</a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 9999,
                        background: 'rgba(0,0,0,0.92)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: 20, cursor: 'zoom-out',
                        animation: 'fadeIn 0.2s ease',
                    }}
                >
                    {/* Kapatma butonu */}
                    <button onClick={() => setLightbox(null)} style={{
                        position: 'absolute', top: 16, right: 20,
                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12,
                        color: '#fff', fontSize: 20, padding: '8px 14px', cursor: 'pointer',
                    }}>✕</button>

                    {/* Yan yana: Orijinal + Motif */}
                    <div style={{
                        display: 'flex', gap: 16, maxWidth: '90vw', maxHeight: '70vh',
                        flexWrap: 'wrap', justifyContent: 'center',
                    }} onClick={(e) => e.stopPropagation()}>
                        {lightbox.drawingFile && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: THEME.muted, marginBottom: 6 }}>Orijinal Çizim</div>
                                <img src={`${serverUrl}/motifs/${lightbox.drawingFile}`} alt="çizim" style={{
                                    maxHeight: '60vh', maxWidth: '42vw', borderRadius: 12,
                                    border: `2px solid ${THEME.border}`,
                                }} />
                            </div>
                        )}
                        {lightbox.aiFile && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 11, color: THEME.muted, marginBottom: 6 }}>AI Kilim Motifi</div>
                                <img src={`${serverUrl}/motifs/${lightbox.aiFile}`} alt="motif" style={{
                                    maxHeight: '60vh', maxWidth: '42vw', borderRadius: 12,
                                    border: `2px solid ${THEME.gold}`,
                                }} />
                            </div>
                        )}
                    </div>

                    {/* Bilgi + İndir */}
                    <div style={{ marginTop: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: THEME.gold }}>
                            ✨ {lightbox.userName || 'Anonim'}
                        </div>
                        <div style={{ fontSize: 12, color: THEME.muted, marginTop: 4 }}>
                            {new Date(lightbox.timestamp).toLocaleString('tr-TR')}
                        </div>
                        {lightbox.aiFile && (
                            <a
                                href={`${serverUrl}/api/motifs/${lightbox.id}/download`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    display: 'inline-block', marginTop: 12,
                                    padding: '12px 30px', borderRadius: 14,
                                    background: 'linear-gradient(135deg, #4ecdc4, #44bd32)',
                                    color: '#fff', textDecoration: 'none',
                                    fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
                                }}
                            >📥 Motifi İndir</a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
