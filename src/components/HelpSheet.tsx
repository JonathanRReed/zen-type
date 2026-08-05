import React, { useState, useEffect, useCallback, useRef } from 'react';
import { deferModule, useDeferredModule, primeOnFirstInteraction } from '../utils/deferOverlay';

// Same split as the pause menu. The sheet is closed on arrival on every page,
// so its markup sits behind a dynamic import and only the two things that have
// to be listening from the first frame stay here: the `toggleHelp` contract and
// the Ctrl+H shortcut.
const bodyModule = deferModule(() => import('./HelpSheetBody'));

interface HelpSheetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const HelpSheet = React.memo((props: HelpSheetProps) => {
  const { isOpen = false, onClose } = props;
  const [open, setOpen] = useState<boolean>(isOpen);
  const [everOpened, setEverOpened] = useState<boolean>(isOpen);
  // `toggleHelp` and Ctrl+H both mean "flip it", so the handlers need the
  // current value without re-subscribing every time it changes.
  const openRef = useRef<boolean>(isOpen);
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
    onClose?.();
  }, [setOpenState, onClose]);

  useEffect(() => {
    setOpenState(isOpen);
  }, [isOpen, setOpenState]);

  // Fetch the sheet on the first sign of a human so Ctrl+H opens it from
  // memory rather than waiting on a round trip.
  useEffect(() => primeOnFirstInteraction(bodyModule.load), []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // A bare `toggleHelp` with no detail means toggle, the same contract
      // PauseMenu uses for `togglePause`. This used to run setOpen(undefined),
      // so a dispatch without a detail could only ever leave the sheet closed.
      setOpenState(typeof detail === 'boolean' ? detail : !openRef.current);
    };
    window.addEventListener('toggleHelp', handler as EventListener);
    return () => window.removeEventListener('toggleHelp', handler as EventListener);
  }, [setOpenState]);

  // Ctrl+H toggles the sheet. The shortcut used to live in the global
  // KeyboardManager, which no page ever imported, so it never reached the
  // browser at all. Capture phase keeps it ahead of the typing surface's own
  // key handling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'h') return;
      e.preventDefault();
      if (openRef.current) {
        close();
      } else {
        setOpenState(true);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, setOpenState]);

  if (!everOpened) return null;

  const HelpSheetBody = loaded?.default;
  if (!HelpSheetBody) return null;

  return <HelpSheetBody open={open} onClose={close} />;
});

HelpSheet.displayName = 'HelpSheet';

export default HelpSheet;
