import { useState, useEffect } from 'react';
import HostPage from './HostPage';
import ClientPage from './ClientPage';
import DownloadPage from './DownloadPage';

export default function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role');

    if (urlRole === 'client') {
      setRole('client');
    } else if (urlRole === 'download') {
      setRole('download');
    } else {
      // Varsayılan: Host (halı ekranı)
      setRole('host');
    }
  }, []);

  if (!role) return null;

  if (role === 'download') return <DownloadPage />;
  return role === 'host' ? <HostPage /> : <ClientPage />;
}
