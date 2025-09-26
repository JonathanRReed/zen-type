import React, { useEffect, useState } from 'react';
import SimpleDrafts from './SimpleDrafts';

// Overlay that shows the new Library system
// Opens/closes via `toggleArchive` CustomEvent

const ArchiveOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [initialSessionId, setInitialSessionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  // Log mount
  useEffect(() => {
    console.log('[ArchiveOverlay] Component mounted');
    return () => console.log('[ArchiveOverlay] Component unmounted');
  }, []);

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

  // Show error banner if Library crashes
  if (error) {
    return (
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[2100] bg-love/90 text-white px-4 py-2 rounded-lg">
        Library Error: {error}
      </div>
    );
  }

  // Visual debug indicator when open is true but Library might not be visible
  if (open) {
    console.log('[ArchiveOverlay] Rendering Library with open=true');
  }

  return (
    <SimpleDrafts 
      isOpen={open} 
      onClose={() => {
        console.log('[ArchiveOverlay] SimpleDrafts onClose called');
        setOpen(false);
      }}
    />
  );
};

export default ArchiveOverlay;
