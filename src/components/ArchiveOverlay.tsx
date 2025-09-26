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
        localStorage.removeItem('zt.openArchiveNext');
        setOpen(true);
      }
    } catch {}
  }, []);

  // Imperative global open helper for reliability (used by header button)
  useEffect(() => {
    (window as any).openLibraryOverlay = (sessionId?: string) => {
      if (sessionId) setInitialSessionId(sessionId);
      setOpen(true);
    };
    return () => { try { delete (window as any).openLibraryOverlay; } catch {} };
  }, []);

  // Open/close handler via event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      
      if (typeof detail === 'object' && detail?.sessionId) {
        // Opening with a specific session to convert
        setInitialSessionId(detail.sessionId);
        setOpen(true);
      } else {
        // Simple toggle
        const next = typeof detail === 'boolean' ? detail : !open;
        setOpen(next);
      }
    };
    
    window.addEventListener('toggleArchive', handler as EventListener);
    return () => window.removeEventListener('toggleArchive', handler as EventListener);
  }, [open]);

  return (
    <Library 
      isOpen={open} 
      onClose={() => setOpen(false)}
      initialSessionId={initialSessionId}
    />
  );
};

export default ArchiveOverlay;
