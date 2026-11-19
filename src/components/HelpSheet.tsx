import React, { useState, useEffect, useCallback, useRef } from 'react';
import { deferModule, useDeferredModule, primeOnFirstInteraction } from '../utils/deferOverlay';
import { markInteractiveReady } from '../utils/interactiveReady';

// The sheet is closed on arrival on every page, so its markup lives behind a
// dynamic import. What stays here is what has to listen from the first frame:
// the `toggleHelp` event and Ctrl+H.
const bodyModule = deferModule(() => import('./HelpSheetBody'));

const HelpSheet: React.FC = () => {
  const [open, setOpen] = useState(false);
  // Latches on the first open, so the body mounts once and stays.
  const [everOpened, setEverOpened] = useState(false);
  const openRef = useRef(false);
  const loaded = useDeferredModule(bodyModule);

  const setOpenState = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (next) {
      setEverOpened(true);
      void bodyModule.load();
    }
  }, []);

  const close = useCallback(() => {
    setOpenState(false);
    window.dispatchEvent(new CustomEvent('focusTyping'));
  }, [setOpenState]);

  // Start fetching the body on the first sign of a human, so it is usually
  // there before Ctrl+H is pressed.
  useEffect(() => primeOnFirstInteraction(bodyModule.load), []);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOpenState(typeof detail === 'boolean' ? detail : !openRef.current);
    };
    // Ctrl only: Cmd+H is "hide window" on macOS and must reach the system.
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'h') return;
      e.preventDefault();
      setOpenState(!openRef.current);
    };
    window.addEventListener('toggleHelp', onToggle);
    window.addEventListener('keydown', onKey, true);
    const releaseReady = markInteractiveReady('help');
    return () => {
      releaseReady();
      window.removeEventListener('toggleHelp', onToggle);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [setOpenState]);

  if (!everOpened) return null;
  const HelpSheetBody = loaded?.default;
  if (!HelpSheetBody) return null;
  return <HelpSheetBody open={open} onClose={close} />;
};

export default HelpSheet;
