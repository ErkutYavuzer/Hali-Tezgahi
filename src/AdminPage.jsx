import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const THEME = {
    bg: '#0f0c29',
    card: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,215,0,0.15)',
    gold: '#ffd700',
    red: '#ff6b6b',
    green: '#4ecdc4',
    blue: '#6c5ce7',
    text: '#e8dcc8',
    muted: 'rgba(255,255,255,0.4)',
};

// ═══════════════════════════════════════════════════
// PIN GİRİŞ EKRANI
// ═══════════════════════════════════════════════════
function PinScreen({ onAuth }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (pin.length < 4) return;
        setLoading(true);
        setError('');
        onAuth(pin, (success) => {
            setLoading(false);
            if (!success) {
                setError('Yanlış PIN');
                setPin('');
            }
        });
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: `linear-gradient(160deg, ${THEME.bg} 0%, #1a1040 40%, #24243e 100%)`,
            fontFamily: "'Inter', sans-serif",
        }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🔐</div>
            <h1 style={{
                fontSize: 24, fontWeight: 900, color: THEME.gold,
                marginBottom: 8,
            }}>Admin Panel</h1>
            <p style={{ color: THEME.muted, fontSize: 13, marginBottom: 30 }}>
                Yönetim paneline erişmek için PIN girin
            </p>
            <form onSubmit={handleSubmit} style={{ textAlign: 'center' }}>
                <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="PIN"
                    autoFocus
                    style={{
                        width: 200, padding: '16px 20px', borderRadius: 16,
                        border: `2px solid ${error ? THEME.red : THEME.border}`,
                        background: 'rgba(255,255,255,0.06)',
                        color: THEME.text, fontSize: 28, fontWeight: 700,
                        textAlign: 'center', letterSpacing: 12,
                        outline: 'none', fontFamily: 'inherit',
                    }}
                />
                {error && <div style={{ color: THEME.red, fontSize: 13, marginTop: 10 }}>{error}</div>}
                <button type="submit" disabled={loading || pin.length < 4} style={{
                    display: 'block', width: 200, margin: '20px auto 0',
                    padding: '14px', borderRadius: 14, border: 'none',
                    background: pin.length >= 4
                        ? `linear-gradient(135deg, ${THEME.gold}, #ff8c00)`
                        : 'rgba(255,255,255,0.1)',
                    color: pin.length >= 4 ? '#1a0a00' : THEME.muted,
                    fontWeight: 800, fontSize: 15, cursor: 'pointer',
                    fontFamily: 'inherit',
                }}>
                    {loading ? '⏳ Doğrulanıyor...' : '🔓 Giriş Yap'}
                </button>
            </form>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════
function StatCard({ emoji, label, value, color = THEME.gold }) {
    return (
        <div style={{
            background: THEME.card, borderRadius: 14,
            border: `1px solid ${THEME.border}`,
            padding: '14px 16px', flex: '1 1 140px', minWidth: 140,
        }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{emoji}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
            <div style={{ fontSize: 11, color: THEME.muted, marginTop: 2 }}>{label}</div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// ÇİZİM KARTI
// ═══════════════════════════════════════════════════
function DrawingCard({ drawing, selected, onSelect, onDelete, onRetryAI, serverUrl }) {
    const aiSrc = drawing.aiFile
        ? `${serverUrl}/motifs/${drawing.aiFile}`
        : null;
    const drawingSrc = drawing.drawingFile
        ? `${serverUrl}/motifs/${drawing.drawingFile}`
        : null;

    return (
        <div style={{
            background: selected ? 'rgba(255,215,0,0.08)' : THEME.card,
            borderRadius: 14,
            border: `1px solid ${selected ? THEME.gold : THEME.border}`,
            overflow: 'hidden', transition: 'all 0.2s',
            cursor: 'pointer',
        }} onClick={() => onSelect(drawing.id)}>
            {/* Görseller */}
            <div style={{ display: 'flex', height: 120 }}>
                {drawingSrc && (
                    <img src={drawingSrc} alt="çizim" style={{
                        flex: 1, height: '100%', objectFit: 'cover',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                    }} />
                )}
                {aiSrc ? (
                    <img src={aiSrc} alt="motif" style={{
                        flex: 1, height: '100%', objectFit: 'cover',
                    }} />
                ) : (
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: THEME.muted,
                        background: 'rgba(255,255,255,0.02)',
                    }}>
                        {drawing.aiStatus === 'processing' ? '⏳ AI...' : '—'}
                    </div>
                )}
            </div>

            {/* Bilgiler */}
            <div style={{ padding: '8px 10px' }}>
                <div style={{
                    fontSize: 12, fontWeight: 700, color: THEME.gold,
                    marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {drawing.userName || 'Anonim'}
                </div>
                <div style={{ fontSize: 10, color: THEME.muted }}>
                    {new Date(drawing.timestamp).toLocaleString('tr-TR', {
                        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
                    })}
                </div>
                <div style={{
                    fontSize: 9, marginTop: 4,
                    color: drawing.aiStatus === 'done' ? THEME.green
                        : drawing.aiStatus === 'processing' ? THEME.blue
                            : drawing.aiStatus === 'failed' ? THEME.red
                                : THEME.muted,
                    fontWeight: 600,
                }}>
                    {drawing.aiStatus === 'done' ? '✅ AI Tamamlandı'
                        : drawing.aiStatus === 'processing' ? '⏳ AI İşleniyor'
                            : drawing.aiStatus === 'failed' ? '❌ AI Başarısız'
                                : '⬜ Bekliyor'}
                </div>
            </div>

            {/* Aksiyonlar */}
            <div style={{
                display: 'flex', borderTop: `1px solid ${THEME.border}`,
            }}>
                {drawing.aiStatus === 'failed' && (
                    <button onClick={(e) => { e.stopPropagation(); onRetryAI(drawing.id); }} style={{
                        flex: 1, padding: '8px', border: 'none',
                        background: 'rgba(108,92,231,0.1)', color: THEME.blue,
                        fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>🔄 Yeniden</button>
                )}
                {drawing.aiFile && (
                    <a href={`${serverUrl}/api/motifs/${drawing.id}/download`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            flex: 1, padding: '8px', border: 'none',
                            background: 'rgba(78,205,196,0.1)', color: THEME.green,
                            fontSize: 11, fontWeight: 700, textDecoration: 'none',
                            textAlign: 'center', fontFamily: 'inherit',
                        }}>📥 İndir</a>
                )}
                <button onClick={(e) => { e.stopPropagation(); onDelete(drawing.id); }} style={{
                    flex: 1, padding: '8px', border: 'none',
                    background: 'rgba(255,107,107,0.1)', color: THEME.red,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>🗑️ Sil</button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// ANA ADMIN PANELİ
// ═══════════════════════════════════════════════════
export default function AdminPage() {
    const [authed, setAuthed] = useState(() => !!localStorage.getItem('admin-pin'));
    const [pin, setPin] = useState(() => localStorage.getItem('admin-pin') || '');
    const [drawings, setDrawings] = useState([]);
    const [stats, setStats] = useState(null);
    const [aiStatus, setAiStatus] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [tab, setTab] = useState('drawings'); // drawings | settings
    const [maxDrawings, setMaxDrawings] = useState(28);
    const [aiEnabled, setAiEnabled] = useState(true);
    const [confirmAction, setConfirmAction] = useState(null);
    const socketRef = useRef(null);
    const serverUrl = window.location.origin;

    // Socket bağlantısı
    useEffect(() => {
        const socket = io(serverUrl, {
            transports: ['polling', 'websocket'],
            upgrade: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (authed && pin) {
                socket.emit('admin:auth', { pin });
                socket.emit('admin:get-stats', { pin });
            }
        });

        // Auth sonucu
        socket.on('admin:auth-result', ({ success }) => {
            if (success) {
                setAuthed(true);
                localStorage.setItem('admin-pin', pin);
            } else {
                setAuthed(false);
                localStorage.removeItem('admin-pin');
            }
        });

        // Stats
        socket.on('admin:stats', (data) => {
            setStats(data);
            setMaxDrawings(data.maxDrawings || 28);
            setAiEnabled(data.aiEnabled !== false);
        });

        // Drawings
        socket.on('initial-carpet', ({ drawings: d }) => {
            setDrawings(d || []);
        });

        socket.on('admin:drawing-deleted', ({ id }) => {
            setDrawings(prev => prev.filter(d => d.id !== id));
            setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
        });

        socket.on('admin:all-deleted', () => {
            setDrawings([]);
            setSelected(new Set());
        });

        // Realtime güncellemeler
        socket.on('new-drawing', (d) => {
            setDrawings(prev => [...prev, d]);
        });

        socket.on('ai-drawing-ready', ({ id, aiDataUrl, aiFile }) => {
            setDrawings(prev => prev.map(d =>
                d.id === id ? { ...d, aiDataUrl, aiFile, aiStatus: 'done' } : d
            ));
        });

        socket.on('ai-status', (s) => setAiStatus(s));
        socket.on('drawing-count', () => { });

        socket.on('admin:error', ({ message }) => {
            alert('❌ ' + message);
        });

        return () => socket.close();
    }, [authed, pin]);

    // Auth handler
    const handleAuth = (inputPin, callback) => {
        setPin(inputPin);
        const socket = socketRef.current;
        if (!socket) return callback(false);

        socket.emit('admin:auth', { pin: inputPin });
        socket.once('admin:auth-result', ({ success }) => {
            if (success) {
                setAuthed(true);
                setPin(inputPin);
                localStorage.setItem('admin-pin', inputPin);
                // Veri yükle
                socket.emit('admin:get-stats', { pin: inputPin });
            }
            callback(success);
        });
    };

    // Aksiyonlar
    const deleteDrawing = (id) => {
        if (!confirm('Bu çizimi silmek istediğinize emin misiniz?')) return;
        socketRef.current?.emit('admin:delete-drawing', { id, pin });
    };

    const deleteSelected = () => {
        if (selected.size === 0) return;
        if (!confirm(`${selected.size} çizimi silmek istediğinize emin misiniz?`)) return;
        selected.forEach(id => {
            socketRef.current?.emit('admin:delete-drawing', { id, pin });
        });
        setSelected(new Set());
    };

    const deleteAll = () => {
        if (!confirm('TÜM çizimleri silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!')) return;
        socketRef.current?.emit('admin:delete-all', { pin });
    };

    const retryAI = (id) => {
        socketRef.current?.emit('admin:retry-ai', { id, pin });
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === drawings.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(drawings.map(d => d.id)));
        }
    };

    const updateMaxDrawings = (val) => {
        setMaxDrawings(val);
        socketRef.current?.emit('admin:set-max', { value: val, pin });
    };

    const toggleAI = () => {
        const next = !aiEnabled;
        setAiEnabled(next);
        socketRef.current?.emit('admin:toggle-ai', { enabled: next, pin });
    };

    const resetCarpet = () => {
        if (!confirm('Halıyı sıfırlamak istediğinize emin misiniz?\n\nTüm çizimler silinecek ve yeni oturum başlayacak!')) return;
        socketRef.current?.emit('admin:reset-carpet', { pin });
    };

    const logout = () => {
        localStorage.removeItem('admin-pin');
        setAuthed(false);
        setPin('');
    };

    // PIN giriş ekranı
    if (!authed) return <PinScreen onAuth={handleAuth} />;

    const aiDone = drawings.filter(d => d.aiStatus === 'done').length;
    const aiFailed = drawings.filter(d => d.aiStatus === 'failed').length;
    const aiProcessing = drawings.filter(d => d.aiStatus === 'processing').length;

    return (
        <div style={{
            minHeight: '100vh',
            background: `linear-gradient(160deg, ${THEME.bg} 0%, #1a1040 40%, #24243e 100%)`,
            fontFamily: "'Inter', -apple-system, sans-serif",
            color: THEME.text, padding: '16px',
        }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.2); border-radius: 3px; }
      `}</style>

            {/* ═══ HEADER ═══ */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 16, maxWidth: 1200, margin: '0 auto 16px',
            }}>
                <div>
                    <h1 style={{
                        fontSize: 22, fontWeight: 900, color: THEME.gold,
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>⚙️ Admin Panel</h1>
                    <p style={{ fontSize: 11, color: THEME.muted, marginTop: 2 }}>
                        Halı Tezgahı Yönetimi
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <a href="/galeri" target="_blank" style={{
                        padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(78,205,196,0.1)', color: THEME.green,
                        fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        border: `1px solid rgba(78,205,196,0.2)`,
                    }}>🖼️ Galeri</a>
                    <button onClick={logout} style={{
                        padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(255,107,107,0.1)', color: THEME.red,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid rgba(255,107,107,0.2)`, fontFamily: 'inherit',
                    }}>🚪 Çıkış</button>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                {/* ═══ STATS ═══ */}
                <div style={{
                    display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16,
                }}>
                    <StatCard emoji="🎨" label="Çizim" value={`${drawings.length}/${maxDrawings}`} />
                    <StatCard emoji="🤖" label="AI Motif" value={aiDone} color={THEME.green} />
                    <StatCard emoji="⏳" label="İşleniyor" value={aiProcessing} color={THEME.blue} />
                    <StatCard emoji="❌" label="Başarısız" value={aiFailed} color={THEME.red} />
                    <StatCard emoji="👥" label="Bağlı" value={stats?.clientCount || '?'} color="#a29bfe" />
                </div>

                {/* ═══ TABS ═══ */}
                <div style={{
                    display: 'flex', gap: 4, marginBottom: 16,
                    background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4,
                }}>
                    {[
                        { id: 'drawings', label: '🎨 Çizimler', count: drawings.length },
                        { id: 'settings', label: '⚙️ Ayarlar' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                            background: tab === t.id ? 'rgba(255,215,0,0.12)' : 'transparent',
                            color: tab === t.id ? THEME.gold : THEME.muted,
                            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'all 0.2s',
                        }}>
                            {t.label} {t.count !== undefined ? `(${t.count})` : ''}
                        </button>
                    ))}
                </div>

                {/* ═══ ÇİZİMLER TAB ═══ */}
                {tab === 'drawings' && (
                    <>
                        {/* Toplu işlemler */}
                        <div style={{
                            display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
                            alignItems: 'center',
                        }}>
                            <button onClick={selectAll} style={{
                                padding: '8px 14px', borderRadius: 10, border: `1px solid ${THEME.border}`,
                                background: THEME.card, color: THEME.text,
                                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                {selected.size === drawings.length ? '☑️ Seçimi Kaldır' : '☐ Tümünü Seç'}
                            </button>

                            {selected.size > 0 && (
                                <button onClick={deleteSelected} style={{
                                    padding: '8px 14px', borderRadius: 10, border: 'none',
                                    background: 'rgba(255,107,107,0.15)', color: THEME.red,
                                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                }}>
                                    🗑️ Seçilenleri Sil ({selected.size})
                                </button>
                            )}

                            <div style={{ flex: 1 }} />

                            <button onClick={deleteAll} style={{
                                padding: '8px 14px', borderRadius: 10, border: `1px solid rgba(255,59,48,0.3)`,
                                background: 'rgba(255,59,48,0.06)', color: THEME.red,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                ⚠️ Tümünü Sil
                            </button>
                        </div>

                        {/* Çizim Grid */}
                        {drawings.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: 60, color: THEME.muted,
                                fontSize: 16,
                            }}>🎨 Henüz çizim yok</div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: 12,
                            }}>
                                {drawings.map(d => (
                                    <DrawingCard
                                        key={d.id}
                                        drawing={d}
                                        selected={selected.has(d.id)}
                                        onSelect={toggleSelect}
                                        onDelete={deleteDrawing}
                                        onRetryAI={retryAI}
                                        serverUrl={serverUrl}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ═══ AYARLAR TAB ═══ */}
                {tab === 'settings' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Max Çizim */}
                        <div style={{
                            background: THEME.card, borderRadius: 16, padding: 20,
                            border: `1px solid ${THEME.border}`,
                        }}>
                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                                🎨 Maksimum Çizim Sayısı
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <input
                                    type="range"
                                    min={12} max={60} value={maxDrawings}
                                    onChange={(e) => updateMaxDrawings(parseInt(e.target.value))}
                                    style={{ flex: 1, accentColor: THEME.gold }}
                                />
                                <span style={{
                                    fontSize: 28, fontWeight: 900, color: THEME.gold,
                                    minWidth: 50, textAlign: 'right',
                                }}>{maxDrawings}</span>
                            </div>
                            <div style={{ fontSize: 11, color: THEME.muted, marginTop: 6 }}>
                                Halıdaki toplam motif sayısı (ızgara otomatik ayarlanır)
                            </div>
                        </div>

                        {/* AI Toggle */}
                        <div style={{
                            background: THEME.card, borderRadius: 16, padding: 20,
                            border: `1px solid ${THEME.border}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>🤖 AI Motif Dönüşümü</div>
                                <div style={{ fontSize: 11, color: THEME.muted, marginTop: 4 }}>
                                    {aiEnabled ? 'Çizimler otomatik kilim motifine dönüştürülüyor' : 'AI devre dışı — sadece orijinal çizimler'}
                                </div>
                            </div>
                            <button onClick={toggleAI} style={{
                                width: 56, height: 30, borderRadius: 15, border: 'none',
                                background: aiEnabled
                                    ? `linear-gradient(135deg, ${THEME.green}, #27ae60)`
                                    : 'rgba(255,255,255,0.1)',
                                cursor: 'pointer', position: 'relative',
                                transition: 'background 0.3s',
                            }}>
                                <div style={{
                                    width: 24, height: 24, borderRadius: 12,
                                    background: '#fff', position: 'absolute',
                                    top: 3, left: aiEnabled ? 29 : 3,
                                    transition: 'left 0.3s',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }} />
                            </button>
                        </div>

                        {/* AI Pipeline Durumu */}
                        {aiStatus && (
                            <div style={{
                                background: THEME.card, borderRadius: 16, padding: 20,
                                border: `1px solid ${THEME.border}`,
                            }}>
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                                    📡 AI Pipeline Durumu
                                </div>
                                {[aiStatus.primary, aiStatus.fallback].filter(Boolean).map((s, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 0', borderBottom: i === 0 ? `1px solid ${THEME.border}` : 'none',
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                                            <div style={{ fontSize: 10, color: THEME.muted }}>{s.model}</div>
                                        </div>
                                        <div style={{
                                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                                            background: s.available ? 'rgba(78,205,196,0.15)' : 'rgba(255,107,107,0.15)',
                                            color: s.available ? THEME.green : THEME.red,
                                        }}>
                                            {s.available ? '✅ Aktif' : `❌ Devre Dışı (${s.failCount})`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Halıyı Sıfırla */}
                        <div style={{
                            background: 'rgba(255,59,48,0.04)', borderRadius: 16, padding: 20,
                            border: '1px solid rgba(255,59,48,0.2)',
                        }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: THEME.red }}>
                                ⚠️ Tehlikeli Bölge
                            </div>
                            <div style={{ fontSize: 12, color: THEME.muted, margin: '8px 0 14px' }}>
                                Tüm çizimleri ve motif dosyalarını siler, yeni oturum başlatır.
                            </div>
                            <button onClick={resetCarpet} style={{
                                padding: '12px 24px', borderRadius: 12, border: 'none',
                                background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                                color: '#fff', fontWeight: 800, fontSize: 14,
                                cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                                🔄 Halıyı Sıfırla
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
