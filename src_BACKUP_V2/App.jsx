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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 20, color: 'white' }}>
        <h1>Halı Tezgahı 🦅🧵</h1>
        <button onClick={() => setRole('host')} style={{ padding: '20px', fontSize: 24 }}>📺 Halı (Ekran)</button>
        <button onClick={() => setRole('client')} style={{ padding: '20px', fontSize: 24 }}>📱 Dokuma (Tablet)</button>
      </div>
    );
  }

  return role === 'host' ? <HostPage /> : <ClientPage />;
}
