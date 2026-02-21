import { useState, useEffect } from 'react';
import HostPage from './HostPage';
import ClientPage from './ClientPage';
import DownloadPage from './DownloadPage';
import AdminPage from './AdminPage';
import GalleryPage from './GalleryPage';

export default function App() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role');

    if (urlRole === 'client') {
      setRole('client');
    } else if (urlRole === 'download') {
      setRole('download');
    } else if (urlRole === 'admin') {
      setRole('admin');
    } else if (urlRole === 'gallery') {
      setRole('gallery');
    } else {
      // Varsayılan: Host (halı ekranı)
      setRole('host');
    }
  }, []);

  if (!role) return null;

  if (role === 'download') return <DownloadPage />;
  if (role === 'admin') return <AdminPage />;
  if (role === 'gallery') return <GalleryPage />;
  return role === 'host' ? <HostPage /> : <ClientPage />;
}

