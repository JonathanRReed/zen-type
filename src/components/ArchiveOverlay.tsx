import React, { useCallback, useEffect, useState } from 'react';
import SimpleDrafts from './SimpleDrafts';

// Overlay that shows the local drafts viewer.
// Opens/closes via `toggleArchive` CustomEvent or the global helper.

const ArchiveOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);

  const clearPendingFlag = useCallback(() => {
    try { localStorage.removeItem('zt.openArchiveNext'); } catch {}
  }, []);

  const openOverlay = useCallback(() => {
    clearPendingFlag();
    setOpen(true);
  }, [clearPendingFlag]);

  const closeOverlay = useCallback(() => {
    clearPendingFlag();
    setOpen(false);
  }, [clearPendingFlag]);

  // Open if header requested before mount
  useEffect(() => {
    try {
      const pending = localStorage.getItem('zt.openArchiveNext');
      if (pending === '1') {
        openOverlay();
      }
    } catch {
      // ignore localStorage errors
    }
  }, [openOverlay]);

  // Imperative global open helper for reliability (used by header/pause buttons)
  useEffect(() => {
    (window as any).openLibraryOverlay = () => openOverlay();
    return () => {
      try { delete (window as any).openLibraryOverlay; } catch {}
    };
  }, [openOverlay]);

  // Open/close handler via event (stable listener)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'boolean') {
        if (detail) {
          openOverlay();
        } else {
          closeOverlay();
        }
        return;
      }
      if (detail && typeof detail === 'object') {
        openOverlay();
        return;
      }
      setOpen(prev => {
        const next = !prev;
        if (next) {
          clearPendingFlag();
        }
        return next;
      });
    };
    window.addEventListener('toggleArchive', handler as EventListener);
    return () => window.removeEventListener('toggleArchive', handler as EventListener);
  }, [openOverlay, closeOverlay, clearPendingFlag]);

  return (
    <SimpleDrafts
      isOpen={open}
      onClose={closeOverlay}
    />
  );
};

export default ArchiveOverlay;
