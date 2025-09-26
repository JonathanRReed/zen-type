import React, { useEffect, useState } from 'react';
import SimpleDrafts from './SimpleDrafts';

// Overlay that shows the local drafts viewer.
// Opens/closes via `toggleArchive` CustomEvent or the global helper.

const ArchiveOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);

  // Open if header requested before mount
  useEffect(() => {
    try {
      const pending = localStorage.getItem('zt.openArchiveNext');
      if (pending === '1') {
        localStorage.removeItem('zt.openArchiveNext');
        setOpen(true);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  // Imperative global open helper for reliability (used by header/pause buttons)
  useEffect(() => {
    (window as any).openLibraryOverlay = () => setOpen(true);
    return () => {
      try { delete (window as any).openLibraryOverlay; } catch {}
    };
  }, []);

  // Open/close handler via event (stable listener)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'boolean') {
        setOpen(detail);
        return;
      }
      if (detail && typeof detail === 'object') {
        setOpen(true);
        return;
      }
      setOpen(prev => !prev);
    };
    window.addEventListener('toggleArchive', handler as EventListener);
    return () => window.removeEventListener('toggleArchive', handler as EventListener);
  }, []);

  return (
    <SimpleDrafts
      isOpen={open}
      onClose={() => setOpen(false)}
    />
  );
};

export default ArchiveOverlay;
