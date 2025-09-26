import React, { useEffect, useState } from 'react';

interface AboutOverlayProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const AboutOverlay: React.FC<AboutOverlayProps> = ({ isOpen = false, onClose }) => {
  const [open, setOpen] = useState<boolean>(isOpen);
  const shortcuts = [
    { key: 'Tab', description: 'Switch between Zen and Quote modes' },
    { key: 'Esc', description: 'Open or close the pause menu' },
    { key: 'Space', description: 'Commit word and release a token (Zen)' },
    { key: 'Enter', description: 'Force commit the current word (Zen)' },
    { key: 'Backspace', description: 'Correct the previous character (Quote)' },
  ];

  useEffect(() => { setOpen(isOpen); }, [isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as boolean | undefined;
      setOpen(typeof detail === 'boolean' ? detail : !open);
    };
    window.addEventListener('toggleAbout', handler as EventListener);
    return () => window.removeEventListener('toggleAbout', handler as EventListener);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base/82 backdrop-blur-lg" role="dialog" aria-modal="true">
      {/* background click to close */}
      <button type="button" className="absolute inset-0 z-0 bg-transparent" aria-label="Close about overlay" onClick={() => { setOpen(false); onClose?.(); }} />

      <div className="relative z-10 w-full max-w-2xl mx-4 overflow-hidden rounded-3xl border border-muted/20 bg-surface/70 backdrop-blur-xl shadow-[0_28px_80px_rgba(10,4,22,0.45)]">
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-[color-mix(in_oklab,var(--rp-iris)80%,#0b0614_20%)]/38 via-transparent to-transparent">
          <h2 className="text-[clamp(1.6rem,2vw,2.1rem)] font-semibold tracking-tight text-foam drop-shadow-[0_1px_8px_rgba(196,167,231,0.35)]">About Zen Typer</h2>
          <button
            className="absolute top-6 right-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 text-muted/80 shadow-[0_6px_14px_rgba(12,6,24,0.45)] backdrop-blur-md transition-transform duration-200 hover:text-foam hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40"
            onClick={() => { setOpen(false); onClose?.(); }}
            aria-label="Close about"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-8 pb-8 pt-4">
          <div className="space-y-4 text-text">
            <p className="text-base leading-relaxed">
              Zen Typer is a minimalist typing retreat for mindful practice. Drift in <strong className="text-iris">Zen mode</strong>
              to write freely as your words float upward, or sharpen accuracy in <strong className="text-foam">Quote mode</strong>
              with gentle pacing cues.
            </p>
            <p className="leading-relaxed text-muted">
              The experience leans on Rosé Pine hues, soft gradients, and respectful motion. Reduced-motion preferences are
              honored, and everything runs locally for a distraction-free flow.
            </p>
            <p className="leading-relaxed text-muted">
              Settings, streaks, and archives stay on your device—no logins, no telemetry, just the cadence of your typing.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-muted/18 bg-base/35 p-6 shadow-[0_12px_36px_rgba(9,4,18,0.45)]">
            <h3 className="text-xs font-semibold tracking-[0.38em] text-iris/80 uppercase mb-5">Keyboard Shortcuts</h3>
            <div className="grid gap-3">
              {shortcuts.map(({ key, description }) => (
                <div key={key} className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <kbd className="px-3 py-1.5 rounded-xl border border-muted/40 bg-surface/80 font-mono text-[0.85rem] tracking-wide text-text/90 shadow-[0_6px_16px_rgba(12,6,24,0.25)]">
                    {key}
                  </kbd>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-muted/20">
            <div className="text-xs uppercase tracking-[0.28em] text-muted/60">Made by Jonathan Reed</div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <a className="text-iris transition-colors hover:text-foam" href="https://jonathanrreed.com" target="_blank" rel="noopener noreferrer">
                Website
              </a>
              <span className="text-muted/30">•</span>
              <a className="text-iris transition-colors hover:text-foam" href="https://bsky.app/profile/thereedy.bsky.social" target="_blank" rel="noopener noreferrer">
                Bluesky
              </a>
              <span className="text-muted/30">•</span>
              <a className="text-iris transition-colors hover:text-foam" href="https://www.linkedin.com/in/jonathanrreed0/" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 flex items-center justify-end gap-3">
          <button
            className="px-5 py-2.5 rounded-xl bg-iris/18 border border-iris/30 text-iris font-medium shadow-[0_10px_24px_rgba(80,40,140,0.35)] transition-transform hover:bg-iris/28 hover:-translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40"
            onClick={() => { setOpen(false); onClose?.(); }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutOverlay;
