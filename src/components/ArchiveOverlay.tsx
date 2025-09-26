import React, { useEffect, useState } from 'react';
import { Library } from '../features/archive/Library';

// Overlay that shows the new Library system
// Opens/closes via `toggleArchive` CustomEvent

const ArchiveOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [initialSessionId, setInitialSessionId] = useState<string | undefined>();

  // Open if header requested before mount
  useEffect(() => {
    try {
      const pending = localStorage.getItem('zt.openArchiveNext');
      if (pending === '1') {
        console.debug('[ArchiveOverlay] open via pending flag');
        localStorage.removeItem('zt.openArchiveNext');
        setOpen(true);
        (window as any).__zt_lastArchiveOpen = Date.now();
      }
    } catch (e) {
      console.warn('[ArchiveOverlay] pending flag check failed', e);
    }
  }, []);

  // Imperative global open helper for reliability (used by header button)
  useEffect(() => {
    (window as any).openLibraryOverlay = (sessionId?: string) => {
      console.debug('[ArchiveOverlay] openLibraryOverlay called', sessionId);
      if (sessionId) setInitialSessionId(sessionId);
      setOpen(true);
      (window as any).__zt_lastArchiveOpen = Date.now();
    };
    return () => { try { delete (window as any).openLibraryOverlay; } catch {} };
  }, []);

  // Open/close handler via event (stable listener)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      console.debug('[ArchiveOverlay] toggleArchive received', detail);
      if (detail && typeof detail === 'object') {
        if ('sessionId' in detail && detail.sessionId) {
          setInitialSessionId(String(detail.sessionId));
        }
        // Any object detail implies an explicit open request
        setOpen(true);
        (window as any).__zt_lastArchiveOpen = Date.now();
        return;
      }
      if (typeof detail === 'boolean') {
        setOpen(detail);
      } else {
        setOpen((prev) => !prev);
      }
      (window as any).__zt_lastArchiveOpen = Date.now();
    };
    window.addEventListener('toggleArchive', handler as EventListener);
    return () => window.removeEventListener('toggleArchive', handler as EventListener);
  }, []);

  return (
    <Library 
      isOpen={open} 
      onClose={() => setOpen(false)}
      initialSessionId={initialSessionId}
    />
  );
};

export default ArchiveOverlay;
