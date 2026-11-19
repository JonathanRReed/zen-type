import React, { useCallback, useEffect, useState } from 'react';
import SimpleDrafts from './SimpleDrafts';
import { markInteractiveReady } from '../utils/interactiveReady';

// Notes and drafts. Opens on a `toggleArchive` event: `true` opens, `false`
// closes, no detail flips it (that is what Ctrl/Cmd+D sends).
const ArchiveOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('focusTyping'));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOpen(prev => (typeof detail === 'boolean' ? detail : !prev));
    };
    window.addEventListener('toggleArchive', handler);
    const releaseReady = markInteractiveReady('archive');
    return () => {
      releaseReady();
      window.removeEventListener('toggleArchive', handler);
    };
  }, []);

  return <SimpleDrafts isOpen={open} onClose={close} />;
};

export default ArchiveOverlay;
