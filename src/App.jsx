import { useState, useEffect } from 'react';
import HostPage from './HostPage';
import ClientPage from './ClientPage';

export default function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role');
    if (urlRole) setRole(urlRole);
    else setRole('select');
  }, []);

  if (role === 'select') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'radial-gradient(circle at top right, #1a1a2e, #0f0f1a)',
        color: 'white', fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '42px', margin: 0, letterSpacing: '-2px', fontWeight: '800' }}>HALI MOZAİK</h1>
          <p style={{ opacity: 0.5, letterSpacing: '2px', fontSize: '12px' }}>V4.0 PROFESYONEL SİSTEM</p>
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => setRole('host')} style={{
            padding: '40px 30px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px', color: 'white', cursor: 'pointer', backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'
          }}>
            <span style={{ fontSize: '48px' }}>📺</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '18px' }}>HALI EKRANI</div>
              <div style={{ fontSize: '11px', opacity: 0.5 }}>Ana Sergi Ünitesi</div>
            </div>
          </button>

          <button onClick={() => setRole('client')} style={{
            padding: '40px 30px', background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none',
            borderRadius: '24px', color: 'white', cursor: 'pointer', shadow: '0 10px 30px rgba(102, 126, 234, 0.4)',
            transition: 'all 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'
          }}>
            <span style={{ fontSize: '48px' }}>📱</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '18px' }}>DOKUMA PANELİ</div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>Katılımcı Terminali</div>
            </div>
          </button>
        </div>

        <p style={{ marginTop: '50px', fontSize: '10px', opacity: 0.3 }}>KADİM DOKUMA TEKNOLOJİLERİ © 2026</p>
      </div>
    );
  }

  return role === 'host' ? <HostPage /> : <ClientPage />;
}
