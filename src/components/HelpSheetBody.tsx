// The help sheet's markup and in-dialog key handling. Behind the dynamic import
// in HelpSheet.tsx, so none of this reaches the browser until the sheet is
// primed by a first interaction or actually asked for.
import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

export interface HelpSheetBodyProps {
  /** Owned by the shell, which keeps the `toggleHelp` and Ctrl+H listeners eager. */
  open: boolean;
  onClose: () => void;
}

const HelpSheetBody = React.memo((props: HelpSheetBodyProps) => {
  const { open, onClose } = props;
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const quickRefs = [
    { key: 'Tab', label: 'switch mode' },
    { key: 'Esc', label: 'pause menu' },
    { key: 'Space', label: 'commit word (Zen)' },
    { key: 'Enter', label: 'force commit (Zen)' },
    { key: 'Backspace', label: 'correct character (Quote)' },
  ];

  // Escape-only close, focus management, and body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      // Capture phase plus stopPropagation, the same shape as the drafts
      // overlay: the page-level Escape handler is bound on `document` and
      // would otherwise toggle the pause menu open behind the sheet that this
      // very keypress is closing.
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    // focus the close button for accessibility, and remember where focus came
    // from so closing the sheet hands it back
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    // lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (
        previouslyFocused &&
        previouslyFocused.isConnected &&
        previouslyFocused !== document.body &&
        previouslyFocused !== document.documentElement
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay-backdrop fixed inset-0 z-[1100] flex items-center justify-center bg-base/80 backdrop-blur-md"
      role="presentation"
      tabIndex={-1}
      onClick={(e) => {
        // Only close when clicking on the overlay background, not the dialog content
        if (e.currentTarget === e.target) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        className="overlay-card glass rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto overscroll-contain"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="help-title" className="text-2xl font-sans text-foam">Keyboard Shortcuts</h2>
          <Button
            ref={closeBtnRef}
            onClick={() => onClose()}
            variant="ghost"
            size="icon"
            className="text-muted hover:text-text transition-colors"
            aria-label="Close help"
          >
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </Button>
        </div>
        <div className="space-y-6 pb-8">
          {/* General shortcuts */}
          <div>
            <h3 className="text-sm font-bold text-iris mb-3 uppercase tracking-wider">General</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Tab</kbd>
                <span className="text-text">Switch between Zen and Quote modes</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Shift + Tab</kbd>
                <span className="text-text">Leave the typing field for the page controls</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Esc</kbd>
                <span className="text-text">Open pause menu</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Ctrl / Cmd + D</kbd>
                <span className="text-text">Open Notes & Drafts</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Ctrl / Cmd + M</kbd>
                <span className="text-text">Toggle audio sound effects</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Ctrl + H</kbd>
                <span className="text-text">Toggle this help sheet</span>
              </div>
            </div>
          </div>
          {/* Mode-specific shortcuts */}
          <div>
            <h3 className="text-sm font-bold text-iris mb-3 uppercase tracking-wider">Zen Mode</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Space</kbd>
                <span className="text-text">Commit word and spawn token</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Enter</kbd>
                <span className="text-text">Force commit current word</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-iris mb-3 uppercase tracking-wider">Quote Mode</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Backspace</kbd>
                <span className="text-text">Correct previous character</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="pt-4 border-t border-muted/20">
            <h3 className="text-sm font-bold text-iris mb-3 uppercase tracking-wider">Tips</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>In Zen Mode, punctuation also triggers word spawning</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Your settings and stats are saved locally</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Enable reduced motion in settings for accessibility</span>
              </li>
            </ul>
            {/* Live demo line */}
            <div className="mt-4 mb-2 p-3 rounded-lg bg-surface/60 border border-muted/20 grid gap-3 sm:grid-cols-2">
              {quickRefs.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <kbd className="px-3 py-1.5 bg-overlay rounded font-mono text-sm">{key}</kbd>
                  <span className="text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

HelpSheetBody.displayName = 'HelpSheetBody';

export default HelpSheetBody;
