import React, { useEffect, useState, useRef } from 'react';

interface HelpSheetProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const HelpSheet: React.FC<HelpSheetProps> = ({ isOpen = false, onClose }) => {
  const [open, setOpen] = useState<boolean>(isOpen);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as boolean;
      setOpen(detail);
    };
    window.addEventListener('toggleHelp', handler as EventListener);
    return () => window.removeEventListener('toggleHelp', handler as EventListener);
  }, []);

  // Escape-only close, focus management, and body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    // focus the close button for accessibility
    closeBtnRef.current?.focus();
    // lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-base/80 backdrop-blur-md"
      role="presentation"
      tabIndex={-1}
      onClick={(e) => {
        // Only close when clicking on the overlay background, not the dialog content
        if (e.currentTarget === e.target) {
          setOpen(false);
          onClose?.();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
          onClose?.();
        }
      }}
    >
      <div
        className="glass rounded-2xl p-8 max-w-lg w-full mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="help-title" className="text-2xl font-sans text-foam">Keyboard Shortcuts</h2>
          <button
            ref={closeBtnRef}
            onClick={() => { setOpen(false); onClose?.(); }}
            className="text-muted hover:text-text transition-colors"
            aria-label="Close help"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="space-y-6">
          {/* General shortcuts */}
          <div>
            <h3 className="text-sm font-bold text-iris mb-3 uppercase tracking-wider">General</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Tab</kbd>
                <span className="text-text">Switch between Zen and Quote modes</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">Esc</kbd>
                <span className="text-text">Open pause menu</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">F</kbd>
                <span className="text-text">Toggle fullscreen</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">B</kbd>
                <span className="text-text">Toggle breathing overlay</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">T</kbd>
                <span className="text-text">Toggle stats bar</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">?</kbd>
                <span className="text-text">Show this help menu</span>
              </div>
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">A</kbd>
                <span className="text-text">Open Drafts / Library</span>
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
              <div className="flex items-center justify-between">
                <kbd className="px-3 py-1.5 bg-surface rounded font-mono text-sm">R</kbd>
                <span className="text-text">Reset current quote (in pause menu)</span>
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
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Uppercase shortcuts like F, T, B, A and ? are active when not typing</span>
              </li>
            </ul>
            {/* Live demo line */}
            <div className="mt-4 p-3 rounded-lg bg-surface/60 border border-muted/20 flex items-center justify-center gap-3">
              <kbd className="px-3 py-1.5 bg-overlay rounded font-mono text-sm">Tab</kbd>
              <span className="text-muted">switch mode</span>
              <kbd className="px-3 py-1.5 bg-overlay rounded font-mono text-sm">Esc</kbd>
              <span className="text-muted">pause</span>
              <kbd className="px-3 py-1.5 bg-overlay rounded font-mono text-sm">F</kbd>
              <span className="text-muted">fullscreen</span>
              <kbd className="px-3 py-1.5 bg-overlay rounded font-mono text-sm">T</kbd>
              <span className="text-muted">stats</span>
              <kbd className="px-3 py-1.5 bg-overlay rounded font-mono text-sm">B</kbd>
              <span className="text-muted">breath</span>
              <kbd className="px-3 py-1.5 bg-overlay rounded font-mono text-sm">?</kbd>
              <span className="text-muted">help</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpSheet;
