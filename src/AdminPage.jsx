import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const THEME = {
    bgGradient: 'radial-gradient(circle at top right, #151A23 0%, #0B0E14 100%)',
    surface: 'rgba(22, 27, 34, 0.55)',
    surfaceHover: 'rgba(32, 38, 48, 0.75)',
    border: 'rgba(255, 255, 255, 0.06)',
    borderActive: 'rgba(0, 229, 255, 0.3)',
    primary: '#00E5FF',
    primaryGradient: 'linear-gradient(135deg, #00E5FF 0%, #0077FF 100%)',
    success: '#00E676',
    danger: '#FF3D00',
    dangerGradient: 'linear-gradient(135deg, #FF3D00 0%, #D50000 100%)',
    text: '#F8F9FA',
    textMuted: '#9BA4B5',
    glass: {
        background: 'rgba(22, 27, 34, 0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
    }
};

// ═══════════════════════════════════════════════════
// TOAST BİLDİRİM SİSTEMİ
// ═══════════════════════════════════════════════════
function ToastContainer({ toasts }) {
    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: 12,
            pointerEvents: 'none'
        }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    ...THEME.glass, borderRadius: 12, padding: '14px 20px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderLeft: `4px solid ${t.type === 'success' ? THEME.success : t.type === 'error' ? THEME.danger : THEME.primary}`,
                    animation: 'slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    color: THEME.text, fontSize: 13, fontWeight: 600, minWidth: 280
                }}>
                    <span style={{ fontSize: 18 }}>
                        {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
                    </span>
                    {t.msg}
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════
// PIN GİRİŞ EKRANI (FROSTED GLASS)
// ═══════════════════════════════════════════════════
function PinScreen({ onAuth }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (pin.length < 4) return;
        setLoading(true);
        setError(false);
        onAuth(pin, (success) => {
            setLoading(false);
            if (!success) {
                setError(true);
                setPin('');
                setTimeout(() => setError(false), 500); // Shake süresi
            }
        });
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: THEME.bgGradient,
            fontFamily: "'Inter', sans-serif",
            position: 'relative', overflow: 'hidden'
        }}>
            {/* Arka plan aurora efektleri */}
            <div style={{
                position: 'absolute', width: 600, height: 600,
                background: 'radial-gradient(circle, rgba(0,229,255,0.05) 0%, transparent 70%)',
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                pointerEvents: 'none'
            }} />

            <div style={{
                ...THEME.glass, borderRadius: 32, padding: '48px 40px',
                width: 380, textAlign: 'center',
                transform: error ? 'translateX(0)' : 'none',
                animation: error ? 'shake 0.4s ease-in-out' : 'fadeInUp 0.6s ease-out',
                position: 'relative', zIndex: 1
            }}>
                <div style={{
                    width: 72, height: 72, borderRadius: 24,
                    background: 'rgba(0, 229, 255, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 24px', border: `1px solid rgba(0, 229, 255, 0.2)`
                }}>
                    <span style={{ fontSize: 32 }}>🔐</span>
                </div>

                <h1 style={{ fontSize: 24, fontWeight: 800, color: THEME.text, marginBottom: 8, letterSpacing: -0.5 }}>
                    Sistem Erişimi
                </h1>
                <p style={{ color: THEME.textMuted, fontSize: 13, marginBottom: 32, fontWeight: 500 }}>
                    Halı Tezgahı yönetim paneline girmek için yetkilendirme PIN kodunu girin.
                </p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••"
                        style={{
                            width: '100%', padding: '18px', borderRadius: 16,
                            border: `1px solid ${error ? THEME.danger : THEME.border}`,
                            background: 'rgba(0,0,0,0.2)',
                            color: THEME.text, fontSize: 32, fontWeight: 700,
                            textAlign: 'center', letterSpacing: 24,
                            outline: 'none', fontFamily: 'inherit',
                            transition: 'all 0.3s ease',
                            boxShadow: error ? `0 0 0 2px rgba(255,61,0,0.2)` :
                                pin.length > 0 ? `0 0 0 1px ${THEME.primary}` : 'none'
                        }}
                    />

                    <button type="submit" disabled={loading || pin.length < 4} style={{
                        display: 'block', width: '100%', marginTop: '24px',
                        padding: '16px', borderRadius: 16, border: 'none',
                        background: pin.length >= 4 ? THEME.primaryGradient : 'rgba(255,255,255,0.05)',
                        color: pin.length >= 4 ? '#000' : THEME.textMuted,
                        fontWeight: 700, fontSize: 14, cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
                        fontFamily: 'inherit', transition: 'all 0.3s ease',
                        boxShadow: pin.length >= 4 ? '0 8px 20px rgba(0, 229, 255, 0.25)' : 'none'
                    }}>
                        {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
                    </button>
                </form>
            </div>

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-8px); }
                    40%, 80% { transform: translateX(8px); }
                }
            `}</style>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// STAT CARD (MİNİMAL)
// ═══════════════════════════════════════════════════
function StatCard({ icon, label, value, subtext, color = THEME.primary }) {
    return (
        <div className="stat-card" style={{
            ...THEME.glass, padding: '24px', borderRadius: 20,
            flex: '1 1 200px', display: 'flex', flexDirection: 'column',
            transition: 'transform 0.3s ease, background 0.3s ease',
            cursor: 'default',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.1)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, color: color
                }}>
                    {icon}
                </div>
                {subtext && <div style={{ fontSize: 12, fontWeight: 600, color: THEME.textMuted }}>{subtext}</div>}
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: THEME.text, marginBottom: 4, letterSpacing: -1 }}>
                {value}
            </div>
            <div style={{ fontSize: 13, color: THEME.textMuted, fontWeight: 500 }}>
                {label}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// CONFIRM MODAL (UYARI MODALI)
// ═══════════════════════════════════════════════════
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, dangerous = false }) {
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease', padding: 20
        }}>
            <div style={{
                ...THEME.glass, borderRadius: 24, padding: 32, maxWidth: 420, width: '100%',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                animation: 'zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)',
                border: `1px solid ${dangerous ? 'rgba(255,61,0,0.3)' : THEME.border}`
            }}>
                <div style={{
                    width: 56, height: 56, borderRadius: 28, margin: '0 auto 20px',
                    background: dangerous ? 'rgba(255,61,0,0.1)' : 'rgba(0,229,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, color: dangerous ? THEME.danger : THEME.primary
                }}>
                    {dangerous ? '⚠️' : '❓'}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: THEME.text, marginBottom: 12, textAlign: 'center' }}>
                    {title}
                </h3>
                <p style={{ fontSize: 14, color: THEME.textMuted, marginBottom: 32, textAlign: 'center', lineHeight: 1.5 }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" onClick={onCancel} style={{
                        flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                        background: 'rgba(255,255,255,0.05)', color: THEME.text,
                        fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'background 0.2s'
                    }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.05)'}>
                        İptal
                    </button>
                    <button type="button" onClick={onConfirm} style={{
                        flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                        background: dangerous ? THEME.dangerGradient : THEME.primaryGradient,
                        color: dangerous ? '#fff' : '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: dangerous ? '0 8px 20px rgba(255,61,0,0.3)' : '0 8px 20px rgba(0,229,255,0.3)'
                    }}>
                        {dangerous ? 'Evet, Sil' : 'Onayla'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// IMAGE MODAL (TAM EKRAN ÖNİZLEME)
// ═══════════════════════════════════════════════════
function ImageModal({ isOpen, src, title, onClose }) {
    if (!isOpen) return null;
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(5, 7, 10, 0.9)', backdropFilter: 'blur(16px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease', padding: 40
        }}>
            <button type="button" onClick={onClose} style={{
                position: 'absolute', top: 24, right: 32,
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                width: 44, height: 44, color: '#fff', fontSize: 20, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s'
            }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}>
                ✕
            </button>
            <div style={{ fontSize: 16, fontWeight: 700, color: THEME.text, marginBottom: 20 }}>
                {title || 'Önizleme'}
            </div>
            <button type="button" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }} style={{
                background: 'transparent', border: 'none', padding: 0, cursor: 'default'
            }}>
                <img
                    src={src}
                    alt="Büyük Önizleme"
                    style={{
                        maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain',
                        borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
                    }}
                />
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// ÇİZİM KARTI (GALLERY ITEM)
// ═══════════════════════════════════════════════════
function DrawingCard({ drawing, selected, onSelect, onPreview, serverUrl }) {
    const aiSrc = drawing.aiFile ? `${serverUrl}/motifs/${drawing.aiFile}` : null;
    const drawingSrc = drawing.drawingFile ? `${serverUrl}/motifs/${drawing.drawingFile}` : null;

    // Status color
    const statusColor = drawing.aiStatus === 'done' ? THEME.success
        : drawing.aiStatus === 'failed' ? THEME.danger
            : drawing.aiStatus === 'processing' ? THEME.primary
                : THEME.textMuted;

    return (
        <div style={{
            background: selected ? 'rgba(0, 229, 255, 0.05)' : THEME.surface,
            borderRadius: 16,
            border: `1px solid ${selected ? THEME.primary : THEME.border}`,
            overflow: 'hidden', transition: 'all 0.3s ease',
            cursor: 'pointer', position: 'relative',
            boxShadow: selected ? '0 8px 24px rgba(0, 229, 255, 0.15)' : 'none',
            transform: selected ? 'translateY(-2px)' : 'none'
        }}>

            {/* Selection Indicator */}
            <div style={{
                position: 'absolute', top: 12, left: 12, zIndex: 10,
                width: 22, height: 22, borderRadius: 6,
                background: selected ? THEME.primary : 'rgba(0,0,0,0.5)',
                border: `2px solid ${selected ? THEME.primary : 'rgba(255,255,255,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', backdropFilter: 'blur(4px)'
            }}>
                <input
                    type="checkbox"
                    aria-label="Seç"
                    checked={selected}
                    onChange={() => onSelect(drawing.id)}
                    style={{ width: 14, height: 14, accentColor: THEME.primary, cursor: 'pointer' }}
                />
            </div>

            {/* Görseller */}
            <div style={{ display: 'flex', height: 160, position: 'relative', background: '#000' }}>
                {drawingSrc && (
                    <button
                        type="button"
                        onClick={() => onPreview(drawingSrc, `${drawing.userName} - Orijinal`)}
                        style={{
                            flex: 1, position: 'relative', overflow: 'hidden',
                            border: 'none', padding: 0, background: 'transparent', cursor: 'pointer'
                        }}
                    >
                        <img src={drawingSrc} alt="çizim" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                        <div style={{ position: 'absolute', bottom: 6, left: 6, fontSize: 10, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4, color: '#fff' }}>Orijinal</div>
                    </button>
                )}
                <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
                {aiSrc ? (
                    <button
                        type="button"
                        onClick={() => onPreview(aiSrc, `${drawing.userName} - AI Motif`)}
                        style={{
                            flex: 1, position: 'relative', overflow: 'hidden',
                            border: 'none', padding: 0, background: 'transparent', cursor: 'pointer'
                        }}
                    >
                        <img src={aiSrc} alt="motif" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', bottom: 6, right: 6, fontSize: 10, background: 'rgba(0, 229, 255, 0.2)', padding: '2px 6px', borderRadius: 4, color: THEME.primary }}>AI Motif</div>
                    </button>
                ) : (
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: THEME.textMuted, background: 'transparent'
                    }}>
                        {drawing.aiStatus === 'processing' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 20, height: 20, border: `2px solid ${THEME.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                <span>İşleniyor</span>
                            </div>
                        ) : '—'}
                    </div>
                )}
            </div>

            {/* Bilgiler */}
            <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{
                        fontSize: 14, fontWeight: 700, color: THEME.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {drawing.userName || 'Anonim'}
                    </div>
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: statusColor,
                        boxShadow: `0 0 8px ${statusColor}`
                    }} title={`Durum: ${drawing.aiStatus}`} />
                </div>
                <div style={{ fontSize: 12, color: THEME.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⏱️</span>
                    {new Date(drawing.timestamp).toLocaleString('tr-TR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                    })}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// ANA ADMIN PANELİ (PREMIUM LAYOUT)
// ═══════════════════════════════════════════════════
export default function AdminPage() {
    const [authed, setAuthed] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);
    const [drawings, setDrawings] = useState([]);
    const [stats, setStats] = useState(null);
    const [aiStatus, setAiStatus] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [activeMenu, setActiveMenu] = useState('dashboard');
    const [maxDrawings, setMaxDrawings] = useState(28);
    const [aiEnabled, setAiEnabled] = useState(true);

    // Arşiv & Oturum & Kullanıcı State
    const [archiveData, setArchiveData] = useState([]);
    const [sessionsData, setSessionsData] = useState([]);
    const [usersData, setUsersData] = useState([]);

    // UI State
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
    const [previewModal, setPreviewModal] = useState({ isOpen: false, src: '', title: '' });
    const [toasts, setToasts] = useState([]);
    const [activities, setActivities] = useState([]);
    const [showQR, setShowQR] = useState(false);
    const [celebrationQrVisible, setCelebrationQrVisible] = useState(false);
    const [promptText, setPromptText] = useState('');
    const [promptPresets, setPromptPresets] = useState([]);
    const [eventsData, setEventsData] = useState([]);
    const [newEventName, setNewEventName] = useState('');
    const [newEventLocation, setNewEventLocation] = useState('');
    const [archiveSearch, setArchiveSearch] = useState('');
    const [archiveSelected, setArchiveSelected] = useState(new Set());

    const socketRef = useRef(null);
    const pinRef = useRef(localStorage.getItem('admin-pin') || '');
    const serverUrl = window.location.origin;

    // Toast Function
    const addToast = useCallback((msg, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(p => [...p, { id, msg, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    }, []);

    const bootstrapAdminData = useCallback((pin = '') => {
        const socket = socketRef.current;
        if (!socket) return;
        socket.emit('admin:get-stats', { pin });
        socket.emit('admin:get-activity', { pin });
        socket.emit('admin:get-events', { pin });
    }, []);

    // Socket bağlantısı
    useEffect(() => {
        const socketUrl = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')
            ? `http://${window.location.hostname}:3003`
            : window.location.origin;

        const socket = io(socketUrl, { transports: ['polling', 'websocket'], upgrade: true });
        socketRef.current = socket;

        socket.on('connect', () => {
            const savedPin = localStorage.getItem('admin-pin') || '';
            pinRef.current = savedPin;
            setAuthChecking(true);
            socket.emit('admin:auth', { pin: savedPin });
        });

        socket.on('admin:auth-result', ({ success }) => {
            setAuthChecking(false);
            if (success) {
                setAuthed(true);
                bootstrapAdminData(pinRef.current || '');
            } else {
                setAuthed(false);
                localStorage.removeItem('admin-pin');
                pinRef.current = '';
                addToast('Oturum süresi doldu veya yetkisiz erişim.', 'error');
            }
        });

        socket.on('admin:stats', (data) => {
            setStats(data);
            if (data.maxDrawings) setMaxDrawings(data.maxDrawings);
            if (data.aiEnabled !== undefined) setAiEnabled(data.aiEnabled);
        });

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
            addToast('Veritabanı tamamen temizlendi.', 'success');
        });

        socket.on('new-drawing', (d) => {
            setDrawings(prev => [...prev, d]);
            addToast(`Yeni çizim geldi: ${d.userName || 'Anonim'}`, 'info');
        });

        socket.on('ai-drawing-ready', ({ id, aiDataUrl, aiFile }) => {
            setDrawings(prev => {
                const updated = prev.map(d => d.id === id ? { ...d, aiDataUrl, aiFile, aiStatus: 'done' } : d);
                const drawing = updated.find(d => d.id === id);
                if (drawing) addToast(`AI motif tamamlandı: ${drawing.userName || 'Anonim'}`, 'success');
                return updated;
            });
        });

        socket.on('ai-status', (s) => setAiStatus(s));

        // Arşiv & Oturum & Kullanıcı event'leri
        socket.on('admin:archive', ({ archive }) => setArchiveData(archive || []));
        socket.on('admin:sessions', ({ sessions }) => setSessionsData(sessions || []));
        socket.on('admin:users', ({ users }) => setUsersData(users || []));
        socket.on('admin:activity-feed', ({ activities }) => setActivities(activities || []));
        socket.on('admin:activity', (entry) => setActivities(prev => [entry, ...prev].slice(0, 50)));
        socket.on('admin:info', ({ message }) => addToast(message, 'info'));
        socket.on('admin:prompt', ({ prompt, presets }) => { setPromptText(prompt || ''); setPromptPresets(presets || []); });
        socket.on('admin:prompt-updated', () => addToast('AI prompt güncellendi! ✅', 'success'));
        socket.on('admin:events', ({ events }) => setEventsData(events || []));
        socket.on('admin:celebration-qr-state', ({ visible }) => setCelebrationQrVisible(visible));
        socket.on('toggle-celebration-qr', ({ show }) => setCelebrationQrVisible(!!show));

        socket.on('admin:error', ({ message }) => {
            addToast(message, 'error');
        });

        return () => socket.close();
    }, [addToast, bootstrapAdminData]);

    const handleAuth = (inputPin, callback) => {
        pinRef.current = inputPin;
        const socket = socketRef.current;
        if (!socket || !socket.connected) return callback(false);

        setAuthChecking(true);
        socket.emit('admin:auth', { pin: inputPin });
        const onResult = ({ success }) => {
            socket.off('admin:auth-result', onResult);
            setAuthChecking(false);
            if (success) {
                setAuthed(true);
                localStorage.setItem('admin-pin', inputPin);
                bootstrapAdminData(inputPin);
                socket.emit('admin:get-archive', { pin: inputPin });
                socket.emit('admin:get-sessions', { pin: inputPin });
                socket.emit('admin:get-users', { pin: inputPin });
                addToast('Sisteme başarıyla giriş yapıldı.', 'success');
            }
            callback(success);
        };
        socket.on('admin:auth-result', onResult);
    };

    // Aksiyonlar
    const deleteSelected = () => {
        if (selected.size === 0) return;
        const isDeleteAll = selected.size === drawings.length && drawings.length > 0;
        setConfirmDialog({
            isOpen: true, title: 'Seçilenleri Sil',
            message: isDeleteAll
                ? 'Tüm çizimleri silmek istediğinize emin misiniz? Bu işlem oturum olarak arşivlenir.'
                : `${selected.size} adet çizimi kalıcı olarak silmek istediğinize emin misiniz?`,
            dangerous: true,
            onConfirm: () => {
                if (isDeleteAll) {
                    socketRef.current?.emit('admin:delete-all', { pin: pinRef.current });
                } else {
                    selected.forEach((id) => {
                        socketRef.current?.emit('admin:delete-drawing', { id, pin: pinRef.current });
                    });
                }
                setSelected(new Set());
                setConfirmDialog({ isOpen: false });
                addToast(isDeleteAll ? 'Tüm çizimler silindi.' : `${selected.size} çizim silindi.`, 'success');
            },
            onCancel: () => setConfirmDialog({ isOpen: false })
        });
    };

    const retryAISelected = () => {
        if (selected.size === 0) return;
        selected.forEach((id) => {
            socketRef.current?.emit('admin:retry-ai', { id, pin: pinRef.current });
        });
        setSelected(new Set());
        addToast(`${selected.size} çizim için AI yeniden başlatıldı.`, 'info');
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === drawings.length && drawings.length > 0) setSelected(new Set());
        else setSelected(new Set(drawings.map(d => d.id)));
    };

    const updateMaxDrawings = (val) => {
        setMaxDrawings(val);
        socketRef.current?.emit('admin:set-max', { value: val, pin: pinRef.current });
    };

    const toggleAI = () => {
        const next = !aiEnabled;
        setAiEnabled(next);
        socketRef.current?.emit('admin:toggle-ai', { enabled: next, pin: pinRef.current });
        addToast(`AI Dönüşümü ${next ? 'açıldı' : 'kapatıldı'}.`, next ? 'success' : 'info');
    };

    const resetCarpet = () => {
        setConfirmDialog({
            isOpen: true, title: 'Tüm Veriyi Sıfırla',
            message: 'DİKKAT! Tüm çizimler, motifler ve veritabanı kayıtları silinecek. Yeni bir oturum başlatılacak. Emin misiniz?',
            dangerous: true,
            onConfirm: () => {
                socketRef.current?.emit('admin:reset-carpet', { pin: pinRef.current });
                setConfirmDialog({ isOpen: false });
            },
            onCancel: () => setConfirmDialog({ isOpen: false })
        });
    };

    const logout = () => {
        localStorage.removeItem('admin-pin');
        setAuthed(false);
        setAuthChecking(false);
        pinRef.current = '';
        window.location.href = '/';
    };

    const openPreview = (src, title) => setPreviewModal({ isOpen: true, src, title });

    if (authChecking) return (
        <>
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: THEME.bgGradient,
                color: THEME.text,
                fontFamily: "'Inter', sans-serif"
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 42, marginBottom: 16 }}>🧵</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>Admin workspace aciliyor...</div>
                </div>
            </div>
            <ToastContainer toasts={toasts} />
        </>
    );

    if (!authed) return (
        <>
            <PinScreen onAuth={handleAuth} />
            <ToastContainer toasts={toasts} />
        </>
    );

    const aiDone = drawings.filter(d => d.aiStatus === 'done').length;
    const aiFailed = drawings.filter(d => d.aiStatus === 'failed').length;

    // Sidebar Menu Items
    const menuItems = [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'gallery', icon: '🖼️', label: 'Çizim Galerisi', badge: drawings.length },
        { id: 'events', icon: '🎪', label: 'Etkinlikler', badge: eventsData.filter(e => e.status === 'active').length || undefined },
        { id: 'archive', icon: '📦', label: 'Arşiv / Geçmiş', badge: archiveData.length || undefined },
        { id: 'users', icon: '👥', label: 'Kullanıcılar' },
        { id: 'settings', icon: '⚙️', label: 'Sistem Ayarları' }
    ];

    return (
        <div style={{
            minHeight: '100vh', display: 'flex',
            background: THEME.bgGradient,
            fontFamily: "'Inter', -apple-system, sans-serif",
            color: THEME.text, overflow: 'hidden'
        }} className="admin-layout">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
                
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(50px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes zoomIn {
                    0% { opacity: 0; transform: scale(0.95); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

                .stat-card:hover {
                    transform: translateY(-4px);
                }

                /* 📱 Responsive */
                @media (max-width: 1024px) {
                    .admin-sidebar { width: 220px !important; padding: 24px 14px !important; }
                    .admin-sidebar .sidebar-title { display: none !important; }
                    .admin-content { padding: 24px !important; }
                    .dashboard-live-grid { grid-template-columns: 1fr !important; }
                }
                @media (max-width: 768px) {
                    .admin-layout { flex-direction: column !important; }
                    .admin-sidebar {
                        width: 100% !important; flex-direction: row !important;
                        overflow-x: auto !important; padding: 8px 12px !important;
                        border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important;
                        position: sticky !important; top: 0 !important; z-index: 100 !important;
                        gap: 4px !important;
                    }
                    .admin-sidebar .sidebar-title { display: none !important; }
                    .admin-sidebar button {
                        padding: 10px 12px !important; font-size: 12px !important;
                        min-width: auto !important; white-space: nowrap !important;
                    }
                    .admin-content { padding: 16px !important; min-height: auto !important; }
                    .dashboard-live-grid { grid-template-columns: 1fr !important; }
                    .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
                }
            `}</style>

            <div className="admin-sidebar" style={{
                width: 260, flexShrink: 0,
                background: 'rgba(11, 14, 20, 0.8)',
                borderRight: `1px solid ${THEME.border}`,
                display: 'flex', flexDirection: 'column',
                padding: '32px 20px', zIndex: 50,
                backdropFilter: 'blur(40px)'
            }}>
                <div className="sidebar-title" style={{ marginBottom: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: THEME.primaryGradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, boxShadow: '0 4px 12px rgba(0,229,255,0.3)'
                    }}>🧶</div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.5 }}>Halı Tezgahı</div>
                        <div style={{ fontSize: 11, color: THEME.primary, fontWeight: 600 }}>Admin Workspace</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {menuItems.map(item => (
                        <button type="button" key={item.id} onClick={() => {
                            setActiveMenu(item.id);
                            const pin = pinRef.current || '';
                            const socket = socketRef.current;
                            if (!socket) return;
                            // Sekmeye özel veri yükle
                            if (item.id === 'archive') {
                                socket.emit('admin:get-archive', { pin });
                                socket.emit('admin:get-sessions', { pin });
                            } else if (item.id === 'users') {
                                socket.emit('admin:get-users', { pin });
                            } else if (item.id === 'dashboard') {
                                socket.emit('admin:get-stats', { pin });
                                socket.emit('admin:get-activity', { pin });
                            } else if (item.id === 'settings') {
                                socket.emit('admin:get-prompt', { pin });
                            } else if (item.id === 'events') {
                                socket.emit('admin:get-events', { pin });
                            }
                        }} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '14px 16px', borderRadius: 12, border: 'none',
                            background: activeMenu === item.id ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                            color: activeMenu === item.id ? THEME.primary : THEME.textMuted,
                            fontWeight: activeMenu === item.id ? 700 : 500, fontSize: 14,
                            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                            transition: 'all 0.2s ease'
                        }} onMouseEnter={e => { if (activeMenu !== item.id) e.currentTarget.style.color = THEME.text; }}
                            onMouseLeave={e => { if (activeMenu !== item.id) e.currentTarget.style.color = THEME.textMuted; }}>
                            <span style={{ fontSize: 18, filter: activeMenu === item.id ? 'drop-shadow(0 0 8px rgba(0,229,255,0.4))' : 'none' }}>{item.icon}</span>
                            <span style={{ flex: 1 }}>{item.label}</span>
                            {item.badge !== undefined && (
                                <span style={{
                                    background: activeMenu === item.id ? THEME.primary : 'rgba(255,255,255,0.1)',
                                    color: activeMenu === item.id ? '#000' : THEME.text,
                                    padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700
                                }}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div style={{ paddingTop: 24, borderTop: `1px solid ${THEME.border}` }}>
                    <button type="button" onClick={logout} style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '14px 16px', borderRadius: 12, border: 'none',
                        background: 'transparent', color: THEME.textMuted,
                        fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.2s ease'
                    }} onMouseEnter={e => { e.currentTarget.style.color = THEME.danger; e.currentTarget.style.background = 'rgba(255,61,0,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = THEME.textMuted; e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ fontSize: 18 }}>🚪</span>
                        Oturumu Kapat
                    </button>
                </div>
            </div>

            <div className="admin-content" style={{ flex: 1, padding: '40px 60px', overflowY: 'auto' }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>

                    {/* Header Top */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                        <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>
                            {menuItems.find(m => m.id === activeMenu)?.label}
                        </h2>
                        <a href="/galeri" target="_blank" rel="noreferrer" style={{
                            padding: '10px 20px', borderRadius: 12,
                            background: THEME.surface, color: THEME.text,
                            fontSize: 13, fontWeight: 600, textDecoration: 'none',
                            border: THEME.glass.border, display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'background 0.2s'
                        }} onMouseEnter={e => e.currentTarget.style.background = THEME.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = THEME.surface}>
                            <span>🌐</span> Canlı Ekranı Aç
                        </a>
                    </div>

                    {/* DASHBOARD VIEW */}
                    {activeMenu === 'dashboard' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Stats Grid */}
                            <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                                <StatCard icon="🎨" label="Toplam Çizim" value={drawings.length} subtext={`Max: ${maxDrawings}`} color={THEME.primary} />
                                <StatCard icon="✨" label="Başarılı AI Motif" value={aiDone} color={THEME.success} />
                                <StatCard icon="⚠️" label="Üretilemeyen Motif" value={aiFailed} color={THEME.danger} />
                                <StatCard icon="📱" label="Bağlı Kullanıcı" value={stats?.clientCount || 0} color="#a29bfe" />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(250px, 1fr)', gap: 24 }}>
                                {/* Kapasite */}
                                <div style={{ ...THEME.glass, padding: 32, borderRadius: 24 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Halının Doluluk Durumu</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ fontSize: 14, color: THEME.textMuted }}>Kullanılan Alan</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: drawings.length >= maxDrawings ? THEME.danger : THEME.text }}>
                                            {Math.round((drawings.length / maxDrawings) * 100) || 0}%
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: 16, borderRadius: 8, background: 'rgba(0,0,0,0.3)', overflow: 'hidden', border: `1px solid ${THEME.border}` }}>
                                        <div style={{
                                            width: `${Math.min(100, (drawings.length / maxDrawings) * 100)}%`, height: '100%', borderRadius: 8,
                                            background: drawings.length >= maxDrawings ? THEME.dangerGradient : THEME.primaryGradient,
                                            transition: 'width 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                        }} />
                                    </div>
                                    <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ color: THEME.textMuted, fontSize: 13 }}>Disk Kullanımı</div>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{stats?.diskUsage ? (stats.diskUsage / (1024 * 1024)).toFixed(1) : '0'} MB</div>
                                    </div>
                                </div>

                                {/* Liderlik */}
                                <div style={{ ...THEME.glass, padding: 32, borderRadius: 24, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>En Çok Çizenler</div>
                                    {!stats?.leaderboard?.length ? (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.textMuted, fontSize: 13 }}>Henüz veri yok</div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {stats.leaderboard.slice(0, 5).map((u, i) => (
                                                <div key={u.userName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i !== 4 ? `1px solid ${THEME.border}` : 'none' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : THEME.textMuted, fontWeight: 800, fontSize: 16 }}>#{i + 1}</div>
                                                        <div style={{ fontSize: 14, fontWeight: 500 }}>{u.userName}</div>
                                                    </div>
                                                    <div style={{ background: THEME.surface, padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{u.count}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 🖥️ Canlı Halı Önizleme + Hızlı Aksiyonlar */}
                            <div className="dashboard-live-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 2fr) minmax(250px, 1fr)', gap: 24 }}>
                                {/* Canlı Halı */}
                                <div style={{ ...THEME.glass, borderRadius: 24, overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${THEME.border}` }}>
                                        <div style={{ fontSize: 16, fontWeight: 700 }}>🖥️ Canlı Halı</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: THEME.success, animation: 'pulse 2s ease infinite' }} />
                                            <span style={{ fontSize: 11, color: THEME.success, fontWeight: 600 }}>CANLI</span>
                                        </div>
                                    </div>
                                    <iframe
                                        src={(() => {
                                            const base = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.')
                                                ? `http://${window.location.hostname}:3002`
                                                : window.location.origin;
                                            return `${base}/?role=host&embed=1`;
                                        })()}
                                        style={{ width: '100%', height: 320, border: 'none', background: '#000' }}
                                        title="Canlı Halı"
                                    />
                                </div>

                                {/* Hızlı Aksiyonlar */}
                                <div style={{ ...THEME.glass, borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>⚡ Hızlı Aksiyonlar</div>
                                    <button type="button" onClick={() => {
                                        socketRef.current?.emit('admin:retry-all-failed', { pin: pinRef.current });
                                        addToast('Başarısız motifler yeniden deneniyor...', 'info');
                                    }} style={{
                                        padding: '14px 16px', borderRadius: 12, border: 'none',
                                        background: 'rgba(0,229,255,0.08)', color: THEME.primary,
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s'
                                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,229,255,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,229,255,0.08)'}>
                                        <span style={{ fontSize: 18 }}>🔄</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div>Başarısızları Yeniden Dene</div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>{drawings.filter(d => d.aiStatus === 'failed').length} motif bekliyor</div>
                                        </div>
                                    </button>
                                    <button type="button" onClick={() => setShowQR(!showQR)} style={{
                                        padding: '14px 16px', borderRadius: 12, border: 'none',
                                        background: showQR ? 'rgba(0,230,118,0.15)' : 'rgba(0,230,118,0.08)', color: THEME.success,
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s'
                                    }}>
                                        <span style={{ fontSize: 18 }}>📱</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div>{showQR ? 'QR Kodu Gizle' : 'QR Kodu Göster'}</div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>Ziyaretçi bağlantı kodu</div>
                                        </div>
                                    </button>
                                    <button type="button" onClick={() => {
                                        const newVal = !celebrationQrVisible;
                                        setCelebrationQrVisible(newVal);
                                        socketRef.current?.emit('admin:toggle-celebration-qr', { pin: pinRef.current, show: newVal });
                                        addToast(newVal ? 'Kutlama QR açıldı' : 'Kutlama QR kapatıldı', 'info');
                                    }} style={{
                                        padding: '14px 16px', borderRadius: 12, border: 'none',
                                        background: celebrationQrVisible ? 'rgba(255,183,77,0.18)' : 'rgba(255,183,77,0.08)',
                                        color: '#ffb74d',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.2s'
                                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,183,77,0.22)'}
                                        onMouseLeave={e => e.currentTarget.style.background = celebrationQrVisible ? 'rgba(255,183,77,0.18)' : 'rgba(255,183,77,0.08)'}>
                                        <span style={{ fontSize: 18 }}>🎉</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div>{celebrationQrVisible ? 'Kutlama QR Kapat' : 'Kutlama QR Göster'}</div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>Host ekranındaki indirme QR</div>
                                        </div>
                                    </button>
                                    <a href={`${serverUrl}/?role=host`} target="_blank" rel="noreferrer" style={{
                                        padding: '14px 16px', borderRadius: 12, border: 'none',
                                        background: 'rgba(162,155,254,0.08)', color: '#a29bfe',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', transition: 'background 0.2s'
                                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(162,155,254,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(162,155,254,0.08)'}>
                                        <span style={{ fontSize: 18 }}>🖥️</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div>Tam Ekran Halı</div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>Yeni sekmede aç</div>
                                        </div>
                                    </a>
                                    <a href={`${serverUrl}/galeri`} target="_blank" rel="noreferrer" style={{
                                        padding: '14px 16px', borderRadius: 12, border: 'none',
                                        background: 'rgba(253,203,110,0.08)', color: '#fdcb6e',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', transition: 'background 0.2s'
                                    }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(253,203,110,0.15)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(253,203,110,0.08)'}>
                                        <span style={{ fontSize: 18 }}>🌐</span>
                                        <div style={{ textAlign: 'left' }}>
                                            <div>Galeri Sayfası</div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>Tüm motifler</div>
                                        </div>
                                    </a>
                                </div>
                            </div>

                            {/* QR Kod */}
                            {showQR && (
                                <div style={{ ...THEME.glass, borderRadius: 24, padding: 32, textAlign: 'center' }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📱 Ziyaretçi Bağlantı QR Kodu</div>
                                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://${window.location.host}/?role=client`)}`} alt="QR" style={{ borderRadius: 12 }} />
                                    <div style={{ marginTop: 12, fontSize: 12, color: THEME.textMuted, wordBreak: 'break-all' }}>{`https://${window.location.host}/?role=client`}</div>
                                </div>
                            )}

                            {/* 📢 Aktivite Feed */}
                            <div style={{ ...THEME.glass, borderRadius: 24, padding: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700 }}>📢 Son Aktiviteler</div>
                                    <span style={{ fontSize: 11, color: THEME.textMuted }}>{activities.length} kayıt</span>
                                </div>
                                {activities.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: THEME.textMuted, padding: '20px 0', fontSize: 13 }}>Henüz aktivite yok...</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                                        {activities.slice(0, 20).map((a, i) => {
                                            const colors = { drawing: THEME.primary, 'ai-success': THEME.success, 'ai-failed': THEME.danger, admin: '#a29bfe' };
                                            const icons = { drawing: '🎨', 'ai-success': '✨', 'ai-failed': '⚠️', admin: '🔧' };
                                            return (
                                                <div key={`${a.timestamp}-${a.type}-${a.message}`} style={{
                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                    padding: '10px 14px', borderRadius: 10,
                                                    background: i === 0 ? 'rgba(0,229,255,0.04)' : 'transparent',
                                                    borderLeft: `3px solid ${colors[a.type] || THEME.textMuted}`,
                                                    animation: i === 0 ? 'fadeIn 0.5s ease' : 'none'
                                                }}>
                                                    <span style={{ fontSize: 16 }}>{icons[a.type] || '📌'}</span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 13, fontWeight: 500 }}>{a.message}</div>
                                                    </div>
                                                    <div style={{ fontSize: 11, color: THEME.textMuted, whiteSpace: 'nowrap' }}>
                                                        {new Date(a.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* GALLERY VIEW */}
                    {activeMenu === 'gallery' && (
                        <div style={{ position: 'relative' }}>
                            {/* Toolbar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <button type="button" onClick={selectAll} style={{
                                        padding: '10px 16px', borderRadius: 10, border: THEME.glass.border,
                                        background: THEME.surface, color: THEME.text, fontSize: 13, fontWeight: 600,
                                        cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s'
                                    }} onMouseEnter={e => e.target.style.background = THEME.surfaceHover} onMouseLeave={e => e.target.style.background = THEME.surface}>
                                        {selected.size === drawings.length && drawings.length > 0 ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                                    </button>
                                    <span style={{ fontSize: 13, color: THEME.textMuted }}>{drawings.length} kayıt listeleniyor</span>
                                </div>
                            </div>

                            {/* Grid */}
                            {drawings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '100px 0', color: THEME.textMuted }}>
                                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🖼️</div>
                                    <div style={{ fontSize: 16, fontWeight: 500 }}>Henüz çizim bulunmuyor.</div>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20, paddingBottom: 100 }}>
                                    {drawings.map(d => (
                                        <DrawingCard
                                            key={d.id} drawing={d} selected={selected.has(d.id)}
                                            onSelect={toggleSelect} onPreview={openPreview} serverUrl={serverUrl}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Floating Action Bar */}
                            <div style={{
                                position: 'fixed', bottom: 40, left: '50%', transform: `translateX(-50%) translateY(${selected.size > 0 ? '0' : '100px'})`,
                                ...THEME.glass, padding: '12px 24px', borderRadius: 20,
                                display: 'flex', alignItems: 'center', gap: 20,
                                opacity: selected.size > 0 ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                zIndex: 100, border: `1px solid ${THEME.primary}`
                            }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>
                                    <span style={{ color: THEME.primary }}>{selected.size}</span> öğe seçildi
                                </div>
                                <div style={{ width: 1, height: 24, background: THEME.borderLight }} />
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button type="button" onClick={retryAISelected} style={{
                                        padding: '8px 16px', borderRadius: 8, border: 'none', background: 'rgba(0,229,255,0.1)',
                                        color: THEME.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                    }}>🔄 AI Yenile</button>
                                    <button type="button" onClick={() => {
                                        if (selected.size === 1) {
                                            const id = Array.from(selected)[0];
                                            window.location.href = `${serverUrl}/api/motifs/${id}/download`;
                                        } else {
                                            addToast('Çoklu indirme henüz desteklenmiyor. Tek tek indirin.', 'info');
                                        }
                                    }} style={{
                                        padding: '8px 16px', borderRadius: 8, border: 'none', background: THEME.surfaceHover,
                                        color: THEME.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                    }}>📥 İndir</button>
                                    <button type="button" onClick={deleteSelected} style={{
                                        padding: '8px 16px', borderRadius: 8, border: 'none', background: 'rgba(255,61,0,0.1)',
                                        color: THEME.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                    }}>🗑️ Sil</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EVENTS VIEW */}
                    {activeMenu === 'events' && (
                        <div style={{ maxWidth: 800 }}>
                            {/* Yeni Etkinlik Formu */}
                            <div style={{ ...THEME.glass, borderRadius: 24, padding: 32, marginBottom: 24 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ color: THEME.primary }}>🎪</span> Yeni Etkinlik Oluştur
                                </h3>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    <input
                                        value={newEventName} onChange={e => setNewEventName(e.target.value)}
                                        placeholder="Etkinlik Adı *" style={{
                                            flex: 2, minWidth: 200, padding: '12px 16px', borderRadius: 10,
                                            background: THEME.surface, border: `1px solid ${THEME.border}`,
                                            color: THEME.text, fontSize: 14, fontFamily: 'inherit', outline: 'none'
                                        }}
                                    />
                                    <input
                                        value={newEventLocation} onChange={e => setNewEventLocation(e.target.value)}
                                        placeholder="Konum (opsiyonel)" style={{
                                            flex: 1, minWidth: 150, padding: '12px 16px', borderRadius: 10,
                                            background: THEME.surface, border: `1px solid ${THEME.border}`,
                                            color: THEME.text, fontSize: 14, fontFamily: 'inherit', outline: 'none'
                                        }}
                                    />
                                    <button type="button" onClick={() => {
                                        socketRef.current?.emit('admin:create-event', {
                                            pin: pinRef.current, name: newEventName, location: newEventLocation
                                        });
                                        setNewEventName(''); setNewEventLocation('');
                                    }} disabled={!newEventName.trim()} style={{
                                        padding: '12px 24px', borderRadius: 10, border: 'none',
                                        background: newEventName.trim() ? THEME.primaryGradient : THEME.surface,
                                        color: newEventName.trim() ? '#000' : THEME.textMuted,
                                        fontSize: 14, fontWeight: 700, cursor: newEventName.trim() ? 'pointer' : 'default',
                                        fontFamily: 'inherit', transition: 'all 0.2s'
                                    }}>+ Oluştur</button>
                                </div>
                            </div>

                            {/* Etkinlik Listesi */}
                            {eventsData.length === 0 ? (
                                <div style={{ ...THEME.glass, borderRadius: 24, padding: 48, textAlign: 'center' }}>
                                    <div style={{ fontSize: 40, marginBottom: 16 }}>🎪</div>
                                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Henüz etkinlik yok</div>
                                    <div style={{ fontSize: 13, color: THEME.textMuted }}>Yukarıdan yeni bir etkinlik oluşturun</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {eventsData.map(evt => {
                                        const statusColors = { draft: THEME.textMuted, active: THEME.success, completed: THEME.primary, paused: '#fdcb6e' };
                                        const statusLabels = { draft: 'Taslak', active: '🟢 Aktif', completed: '✅ Tamamlandı', paused: '⏸ Duraklatıldı' };
                                        const duration = evt.startedAt && evt.endedAt
                                            ? Math.round((evt.endedAt - evt.startedAt) / 60000) + ' dk'
                                            : evt.startedAt ? 'Devam ediyor...' : '-';
                                        return (
                                            <div key={evt.id} style={{
                                                ...THEME.glass, borderRadius: 20, padding: 24,
                                                borderLeft: `4px solid ${statusColors[evt.status] || THEME.border}`
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                    <div>
                                                        <div style={{ fontSize: 17, fontWeight: 700 }}>{evt.name}</div>
                                                        {evt.location && <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>📍 {evt.location}</div>}
                                                    </div>
                                                    <div style={{
                                                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                                                        background: `${statusColors[evt.status]}20`, color: statusColors[evt.status]
                                                    }}>{statusLabels[evt.status]}</div>
                                                </div>

                                                {/* İstatistikler */}
                                                {evt.status !== 'draft' && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                                                        {[
                                                            { label: 'Çizim', value: evt.stats?.totalDrawings || 0, icon: '🎨' },
                                                            { label: 'AI Başarılı', value: evt.stats?.aiSuccessCount || 0, icon: '✨' },
                                                            { label: 'Katılımcı', value: evt.stats?.uniqueUsers || 0, icon: '👥' },
                                                            { label: 'Süre', value: duration, icon: '⏱️' }
                                                        ].map((s) => (
                                                            <div key={s.label} style={{ background: THEME.surface, padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
                                                                <div style={{ fontSize: 14 }}>{s.icon}</div>
                                                                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
                                                                <div style={{ fontSize: 10, color: THEME.textMuted }}>{s.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Aksiyonlar */}
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {(evt.status === 'draft' || evt.status === 'paused') && (
                                                        <button type="button" onClick={() => socketRef.current?.emit('admin:start-event', { pin: pinRef.current, eventId: evt.id })} style={{
                                                            padding: '8px 16px', borderRadius: 8, border: 'none',
                                                            background: 'rgba(0,230,118,0.1)', color: THEME.success,
                                                            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                                        }}>🚀 Başlat</button>
                                                    )}
                                                    {evt.status === 'active' && (
                                                        <button type="button" onClick={() => {
                                                            if (confirm(`"${evt.name}" etkinliğini bitirmek istediğinize emin misiniz?`)) {
                                                                socketRef.current?.emit('admin:end-event', { pin: pinRef.current, eventId: evt.id });
                                                            }
                                                        }} style={{
                                                            padding: '8px 16px', borderRadius: 8, border: 'none',
                                                            background: 'rgba(255,61,0,0.1)', color: THEME.danger,
                                                            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                                        }}>🏁 Bitir</button>
                                                    )}
                                                    {evt.stats?.snapshotFile && (
                                                        <a href={`${serverUrl}/motifs/snapshots/${evt.stats.snapshotFile}`} target="_blank" rel="noreferrer" style={{
                                                            padding: '8px 16px', borderRadius: 8, border: 'none',
                                                            background: 'rgba(162,155,254,0.1)', color: '#a29bfe',
                                                            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none'
                                                        }}>📸 Snapshot</a>
                                                    )}
                                                </div>

                                                <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 12 }}>
                                                    Oluşturulma: {new Date(evt.createdAt).toLocaleString('tr-TR')}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SETTINGS VIEW */}
                    {activeMenu === 'settings' && (
                        <div style={{ maxWidth: 700 }}>
                            <div style={{ ...THEME.glass, borderRadius: 24, padding: 32, marginBottom: 24 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ color: THEME.primary }}>⚙️</span> Genel Ayarlar
                                </h3>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, borderBottom: `1px solid ${THEME.border}`, marginBottom: 24 }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 600 }}>Maksimum Çizim Sayısı</div>
                                        <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>Halının alabileceği toplam motif sayısı</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <input type="range" min={12} max={60} value={maxDrawings} onChange={e => updateMaxDrawings(parseInt(e.target.value))} style={{ width: 120, accentColor: THEME.primary }} />
                                        <div style={{ fontSize: 20, fontWeight: 800, color: THEME.primary, width: 40, textAlign: 'right' }}>{maxDrawings}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 600 }}>AI Dönüşüm Motoru</div>
                                        <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>Yeni çizimlerin otomatik motif generasyonu</div>
                                    </div>
                                    <button type="button" onClick={toggleAI} style={{
                                        width: 52, height: 32, borderRadius: 16, border: 'none',
                                        background: aiEnabled ? THEME.success : 'rgba(255,255,255,0.1)',
                                        position: 'relative', cursor: 'pointer', transition: 'background 0.3s ease'
                                    }}>
                                        <div style={{
                                            width: 26, height: 26, borderRadius: 13, background: '#fff',
                                            position: 'absolute', top: 3, left: aiEnabled ? 23 : 3,
                                            transition: 'left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                        }} />
                                    </button>
                                </div>
                            </div>

                            {/* Service Status */}
                            {aiStatus && (
                                <div style={{ ...THEME.glass, borderRadius: 24, padding: 32, marginBottom: 24 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ color: THEME.primary }}>📡</span> Servis Durumu
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {[aiStatus.primary, aiStatus.fallback].filter(Boolean).map((s, i) => (
                                            <div key={s.name || s.model || `svc-${i}`} style={{ background: THEME.surface, padding: '16px 20px', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                                                    <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>{s.model}</div>
                                                </div>
                                                <div style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: s.available ? 'rgba(0,230,118,0.1)' : 'rgba(255,61,0,0.1)', color: s.available ? THEME.success : THEME.danger }}>
                                                    {s.available ? 'Operasyonel' : `Kesinti (${s.failCount})`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 🎨 AI Prompt Editor */}
                            <div style={{ ...THEME.glass, borderRadius: 24, padding: 32, marginBottom: 24 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ color: THEME.primary }}>🎨</span> AI Motif Prompt'u
                                </h3>
                                <p style={{ fontSize: 13, color: THEME.textMuted, marginBottom: 20 }}>
                                    Çizimlerin hangi stile dönüştürüleceğini belirleyen AI talimatı. Hazır preset seçin veya kendi prompt'unuzu yazın.
                                </p>

                                {/* Preset Butonları */}
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                    {promptPresets.map(p => (
                                        <button type="button" key={p.id} onClick={() => setPromptText(p.prompt)} style={{
                                            padding: '10px 16px', borderRadius: 10, border: `1px solid ${THEME.border}`,
                                            background: promptText === p.prompt ? 'rgba(0,229,255,0.12)' : THEME.surface,
                                            color: promptText === p.prompt ? THEME.primary : THEME.text,
                                            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                            transition: 'all 0.2s'
                                        }}>{p.name}</button>
                                    ))}
                                </div>

                                {/* Textarea */}
                                <textarea
                                    value={promptText}
                                    onChange={e => setPromptText(e.target.value)}
                                    style={{
                                        width: '100%', minHeight: 180, padding: 16, borderRadius: 12,
                                        background: THEME.surface, border: `1px solid ${THEME.border}`,
                                        color: THEME.text, fontSize: 13, fontFamily: 'monospace',
                                        resize: 'vertical', lineHeight: 1.6, outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = THEME.primary}
                                    onBlur={e => e.target.style.borderColor = THEME.border}
                                />

                                {/* Alt Bar */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                                    <span style={{
                                        fontSize: 12,
                                        color: promptText.length > 3000 ? THEME.danger : THEME.textMuted
                                    }}>{promptText.length} / 3000 karakter</span>
                                    <button type="button" onClick={() => {
                                        socketRef.current?.emit('admin:update-prompt', { pin: pinRef.current, prompt: promptText });
                                    }} style={{
                                        padding: '10px 24px', borderRadius: 10, border: 'none',
                                        background: THEME.primaryGradient, color: '#000',
                                        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                        transition: 'opacity 0.2s'
                                    }} onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                        💾 Prompt'u Kaydet
                                    </button>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div style={{ borderRadius: 24, padding: 32, border: `1px solid rgba(255, 61, 0, 0.3)`, background: 'rgba(255, 61, 0, 0.02)' }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: THEME.danger, marginBottom: 8 }}>Danger Zone</h3>
                                <p style={{ fontSize: 13, color: THEME.textMuted, marginBottom: 24 }}>Aşağıdaki işlemler geri alınamaz ve veri kaybına yol açar.</p>

                                <button type="button" onClick={resetCarpet} style={{
                                    width: '100%', padding: '16px', borderRadius: 12, border: 'none',
                                    background: 'rgba(255,61,0,0.1)', color: THEME.danger,
                                    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'background 0.2s'
                                }} onMouseEnter={e => e.target.style.background = 'rgba(255,61,0,0.2)'} onMouseLeave={e => e.target.style.background = 'rgba(255,61,0,0.1)'}>
                                    Sistemi ve Veritabanını Sıfırla
                                </button>
                            </div>
                        </div>
                    )}


                    {/* ARŞİV VIEW */}
                    {activeMenu === 'archive' && (
                        <div>
                            {/* Oturum Geçmişi */}
                            {sessionsData.length > 0 && (
                                <div style={{ marginBottom: 32 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>📋</span> Oturum Geçmişi
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                        {sessionsData.slice().reverse().map((s, i) => {
                                            const downloadUrl = `${serverUrl}/api/sessions/${s.sessionId}/download`;
                                            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(downloadUrl)}`;
                                            const hasFiles = Array.isArray(s.files) && s.files.length > 0;
                                            return (
                                                <div key={s.sessionId} style={{ ...THEME.glass, borderRadius: 20, padding: 24 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: THEME.primary }}>Oturum #{sessionsData.length - i}</div>
                                                        <div style={{ fontSize: 11, color: THEME.textMuted }}>
                                                            {new Date(s.endedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                                                            <div style={{ fontSize: 22, fontWeight: 800 }}>{s.totalDrawings}</div>
                                                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Toplam Çizim</div>
                                                        </div>
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                                                            <div style={{ fontSize: 22, fontWeight: 800 }}>{s.userCount}</div>
                                                            <div style={{ fontSize: 11, color: THEME.textMuted }}>Katılımcı</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ background: 'rgba(0,230,118,0.1)', color: THEME.success, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>✅ {s.aiSuccessCount} AI</span>
                                                        {s.aiFailedCount > 0 && <span style={{ background: 'rgba(255,61,0,0.1)', color: THEME.danger, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>❌ {s.aiFailedCount} Başarısız</span>}
                                                    </div>
                                                    <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                                        {hasFiles ? (
                                                            <>
                                                                <a href={downloadUrl} style={{
                                                                    padding: '6px 10px', borderRadius: 8, border: 'none',
                                                                    background: THEME.surfaceHover, color: THEME.text, fontSize: 11,
                                                                    fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit'
                                                                }}>📥 Oturumu indir</a>
                                                                <div style={{ width: 54, height: 54, background: '#fff', borderRadius: 8, padding: 4, boxSizing: 'border-box' }}>
                                                                    <img src={qrUrl} alt="Oturum QR" style={{ width: '100%', height: '100%', display: 'block' }} />
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span style={{ fontSize: 11, color: THEME.textMuted }}>Oturum dosyası yok</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Arama + Toplu Aksiyon */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                    value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)}
                                    placeholder="🔍 Kullanıcı adı veya tarih ara..." style={{
                                        flex: 1, minWidth: 200, padding: '12px 16px', borderRadius: 10,
                                        background: THEME.surface, border: `1px solid ${THEME.border}`,
                                        color: THEME.text, fontSize: 14, fontFamily: 'inherit', outline: 'none'
                                    }}
                                />
                                {archiveSelected.size > 0 && (
                                    <a href={`${serverUrl}/api/archive/download?ids=${[...archiveSelected].join(',')}`}
                                        style={{
                                            padding: '12px 20px', borderRadius: 10, border: 'none',
                                            background: THEME.primaryGradient, color: '#000',
                                            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6
                                        }}>📥 {archiveSelected.size} dosya indir (ZIP)
                                    </a>
                                )}
                            </div>

                            {/* Silinmiş Çizimler */}
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>🗑️</span> Silinmiş Çizimler ({(() => {
                                    const q = archiveSearch.toLowerCase().trim();
                                    return q ? archiveData.filter(a => (a.userName || '').toLowerCase().includes(q) || new Date(a.timestamp).toLocaleDateString('tr-TR').includes(q)).length : archiveData.length;
                                })()})
                            </h3>
                            {archiveData.length === 0 ? (
                                <div style={{ ...THEME.glass, borderRadius: 20, padding: 60, textAlign: 'center', color: THEME.textMuted }}>
                                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📦</div>
                                    Arşivde hiç kayıt yok.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                    {archiveData.slice().reverse().filter(a => {
                                        const q = archiveSearch.toLowerCase().trim();
                                        if (!q) return true;
                                        return (a.userName || '').toLowerCase().includes(q) || new Date(a.timestamp).toLocaleDateString('tr-TR').includes(q);
                                    }).map(a => {
                                        const isSelected = archiveSelected.has(a.id || a.originalId);
                                        const archiveUrl = a.archivedDrawingFile ? `${serverUrl}/motifs/archive/${a.archivedDrawingFile}` : null;
                                        const archiveAiUrl = a.archivedAiFile ? `${serverUrl}/motifs/archive/${a.archivedAiFile}` : null;
                                        return (
                                            <div key={a.id} style={{ ...THEME.glass, borderRadius: 16, overflow: 'hidden', border: isSelected ? `2px solid ${THEME.primary}` : '2px solid transparent', transition: 'border-color 0.2s' }}>
                                                {/* Seçim checkbox */}
                                                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${THEME.border}` }}>
                                                    <input type="checkbox" checked={isSelected} onChange={() => {
                                                        const next = new Set(archiveSelected);
                                                        const key = a.id || a.originalId;
                                                        if (next.has(key)) next.delete(key); else next.add(key);
                                                        setArchiveSelected(next);
                                                    }} style={{ accentColor: THEME.primary }} />
                                                    <span style={{ fontSize: 12, color: THEME.textMuted }}>{isSelected ? 'Seçili' : 'Seç'}</span>
                                                </div>
                                                <div style={{ display: 'flex', height: 120, background: '#000' }}>
                                                    {archiveUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewModal({ isOpen: true, src: archiveUrl, title: `${a.userName} - Orijinal (Arşiv)` })}
                                                            style={{ flex: 1, height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
                                                        >
                                                            <img src={archiveUrl} alt="çizim" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                                        </button>
                                                    )}
                                                    {archiveAiUrl && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewModal({ isOpen: true, src: archiveAiUrl, title: `${a.userName} - AI Motif (Arşiv)` })}
                                                            style={{ flex: 1, height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
                                                        >
                                                            <img src={archiveAiUrl} alt="motif" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                                        </button>
                                                    )}
                                                    {!archiveUrl && !archiveAiUrl && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: THEME.textMuted, fontSize: 12 }}>Dosya yok</div>}
                                                </div>
                                                <div style={{ padding: '14px 16px' }}>
                                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{a.userName || 'Anonim'}</div>
                                                    <div style={{ fontSize: 11, color: THEME.textMuted, marginBottom: 4 }}>
                                                        Oluşturuldu: {new Date(a.timestamp).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: THEME.danger, marginBottom: 12 }}>
                                                        Silindi: {new Date(a.deletedAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        {a.deleteReason === 'session-reset' && ' (Oturum sıfırlaması)'}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button type="button" onClick={() => { socketRef.current?.emit('admin:restore-drawing', { id: a.id, pin: pinRef.current }); addToast(`"${a.userName}" geri yüklendi.`, 'success'); }} style={{
                                                            flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                                                            background: 'rgba(0,229,255,0.1)', color: THEME.primary,
                                                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                                        }}>🔄 Geri Yükle</button>
                                                        <button type="button" onClick={() => setConfirmDialog({
                                                            isOpen: true, title: 'Kalıcı Sil', message: 'Bu çizimi arşivden de kalıcı olarak silmek istediğinize emin misiniz?', dangerous: true,
                                                            onConfirm: () => { socketRef.current?.emit('admin:hard-delete', { id: a.id, pin: pinRef.current }); setConfirmDialog({ isOpen: false }); addToast('Kalıcı olarak silindi.', 'error'); },
                                                            onCancel: () => setConfirmDialog({ isOpen: false })
                                                        })} style={{
                                                            flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                                                            background: 'rgba(255,61,0,0.1)', color: THEME.danger,
                                                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                                                        }}>🗑️ Kalıcı Sil</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* KULLANICILAR VIEW */}
                    {activeMenu === 'users' && (
                        <div>
                            <div style={{ marginBottom: 20, color: THEME.textMuted, fontSize: 14 }}>
                                Sisteme katılmış toplam <strong style={{ color: THEME.text }}>{usersData.length}</strong> benzersiz kullanıcı
                            </div>
                            {usersData.length === 0 ? (
                                <div style={{ ...THEME.glass, borderRadius: 20, padding: 60, textAlign: 'center', color: THEME.textMuted }}>
                                    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>👥</div>
                                    Henüz kullanıcı verisi yok.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                    {usersData.map((u, i) => (
                                        <div key={u.userName} style={{ ...THEME.glass, borderRadius: 20, padding: 24 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{
                                                        width: 40, height: 40, borderRadius: 12,
                                                        background: i === 0 ? 'rgba(255,215,0,0.15)' : i === 1 ? 'rgba(192,192,192,0.15)' : i === 2 ? 'rgba(205,127,50,0.15)' : THEME.surface,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 16, fontWeight: 800, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : THEME.textMuted
                                                    }}>#{i + 1}</div>
                                                    <div>
                                                        <div style={{ fontSize: 16, fontWeight: 700 }}>{u.userName}</div>
                                                        <div style={{ fontSize: 11, color: THEME.textMuted }}>
                                                            {new Date(u.firstSeen).toLocaleDateString('tr-TR')} → {new Date(u.lastSeen).toLocaleDateString('tr-TR')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 800, color: THEME.primary }}>{u.totalCount}</div>
                                                    <div style={{ fontSize: 10, color: THEME.textMuted }}>Toplam</div>
                                                </div>
                                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 800, color: THEME.success }}>{u.activeCount}</div>
                                                    <div style={{ fontSize: 10, color: THEME.textMuted }}>Aktif</div>
                                                </div>
                                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, textAlign: 'center' }}>
                                                    <div style={{ fontSize: 20, fontWeight: 800 }}>{u.archivedCount}</div>
                                                    <div style={{ fontSize: 10, color: THEME.textMuted }}>Arşiv</div>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${THEME.border}` }}>
                                                <span style={{ fontSize: 13, color: THEME.textMuted }}>AI Başarı Oranı</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 80, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                                                        <div style={{ width: `${u.aiSuccessRate}%`, height: '100%', borderRadius: 3, background: u.aiSuccessRate > 70 ? THEME.success : u.aiSuccessRate > 40 ? '#FFA726' : THEME.danger }} />
                                                    </div>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: u.aiSuccessRate > 70 ? THEME.success : u.aiSuccessRate > 40 ? '#FFA726' : THEME.danger }}>%{u.aiSuccessRate}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            <ConfirmModal {...confirmDialog} />
            <ImageModal {...previewModal} onClose={() => setPreviewModal({ isOpen: false, src: '', title: '' })} />
            <ToastContainer toasts={toasts} />
        </div>
    );
}
