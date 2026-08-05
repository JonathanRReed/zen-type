import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getSettings, applySettingsSideEffects } from '../utils/storage';
import { deferModule, useDeferredModule, primeOnFirstInteraction } from '../utils/deferOverlay';

// The pause menu is closed on arrival on every page, but it used to be the
// single heaviest thing in the initial download: Radix select, switch,
// checkbox, and label, ~85KB, parsed and hydrated at first paint for a dialog
// nobody had asked for yet. All of that now lives in PauseMenuBody behind a
// dynamic import. What stays here is the part that has to be listening from the
// first frame: the `togglePause` contract and the settings classes that decide
// whether the page animates.
const bodyModule = deferModule(() => import('./PauseMenuBody'));

interface PauseMenuProps {
  onReset?: () => void;
  mode: 'zen' | 'quote';
}

// Only ever seen if someone hits Escape before their first pointer move or
// keystroke has primed the import. It carries `overlay-backdrop` and
// `role="dialog"` on purpose: the page-level Tab handler looks for exactly
// those to tell whether an overlay owns the keyboard, and that check has to
// hold for the frame or two this is on screen.
const MenuFallback = () => (
  <div
    className="overlay-backdrop fixed inset-0 z-[2000] flex items-center justify-center bg-base/80 backdrop-blur-md"
    role="dialog"
    aria-modal="true"
    aria-label="Paused"
    aria-busy="true"
  >
    <span className="animate-pulse text-sm text-muted">Paused</span>
  </div>
);

const PauseMenu: React.FC<PauseMenuProps> = ({ onReset, mode }) => {
  const [open, setOpen] = useState(false);
  // Latches on the first open and never clears. Keeping the body mounted while
  // closed is what preserves the old behaviour of reopening onto the sub-view
  // you left.
  const [everOpened, setEverOpened] = useState(false);
  // The `togglePause` contract allows a bare dispatch meaning "flip it", so the
  // handler has to read the current value. A ref rather than the state variable
  // keeps the listener stable across renders.
  const openRef = useRef(false);
  const loaded = useDeferredModule(bodyModule);

  const closeMenu = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent('focusTyping'));
      window.dispatchEvent(new CustomEvent('togglePause', { detail: false }));
    } catch {}
  }, []);

  // Start fetching the menu on the first sign of a human. Escape is almost
  // never the very first thing anyone does, so in practice the module is
  // resolved before the menu is asked for and it renders in the same commit as
  // the keypress.
  useEffect(() => primeOnFirstInteraction(bodyModule.load), []);

  // These classes drive whether the page animates and how it contrasts, so they
  // cannot wait for the menu body to load. Reading them straight from storage
  // and applying them without a broadcast matches what the menu did on mount
  // before the split, minus the pointless re-save of unchanged settings.
  useEffect(() => {
    const settings = getSettings();
    applySettingsSideEffects(
      {
        reducedMotion: settings.reducedMotion,
        highContrast: settings.highContrast,
        showStats: settings.showStats,
        performanceMode: settings.performanceMode ?? false,
        ...(settings.fontFamily ? { fontFamily: settings.fontFamily } : {}),
      },
      settings,
      { broadcast: false },
    );
  }, []);

  // Respond to global toggle events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Accept boolean or undefined (toggle)
      const next = typeof detail === 'boolean' ? detail : !openRef.current;
      openRef.current = next;
      setOpen(next);
      if (next) {
        setEverOpened(true);
        // Belt and braces: if the primer somehow has not run, the dispatch that
        // opens the menu starts the fetch itself.
        void bodyModule.load();
      }
      if (detail !== false) {
        // Close other overlays when opening pause
        try { window.dispatchEvent(new CustomEvent('toggleHelp', { detail: false })); } catch {}
      }
    };
    window.addEventListener('togglePause', handler as EventListener);
    return () => window.removeEventListener('togglePause', handler as EventListener);
  }, []);

  if (!everOpened) return null;

  const PauseMenuBody = loaded?.default;
  if (!PauseMenuBody) return open ? <MenuFallback /> : null;

  return <PauseMenuBody open={open} onClose={closeMenu} onReset={onReset} mode={mode} />;
};

export default PauseMenu;
