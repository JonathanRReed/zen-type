import React, { useEffect, useState } from 'react';

interface AboutOverlayProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const AboutOverlay: React.FC<AboutOverlayProps> = ({ isOpen = false, onClose }) => {
  const [open, setOpen] = useState<boolean>(isOpen);

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-base/80 backdrop-blur-md" role="dialog" aria-modal="true">
      {/* background click to close */}
      <button type="button" className="absolute inset-0 z-0 bg-transparent" aria-label="Close about overlay" onClick={() => { setOpen(false); onClose?.(); }} />

      <div className="relative z-10 glass rounded-2xl p-8 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-sans text-foam">About Zen Typer</h2>
          <button
            className="text-muted hover:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40 rounded"
            onClick={() => { setOpen(false); onClose?.(); }}
            aria-label="Close about"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-4 text-text">
          <p className="leading-relaxed">
            Zen Typer is a minimalist typing experience designed to cultivate focus and flow. It offers two complementary modes:
            <strong className="text-iris"> Zen</strong> for free-form expression that drifts away like thoughts, and
            <strong className="text-foam"> Quote</strong> for structured practice with real-time precision feedback.
          </p>
          <p className="leading-relaxed text-muted">
            Visual design is inspired by the Rosé Pine palette — soft contrast, calm gradients, and subtle glass textures.
            Animations honor reduced-motion preferences and keep performance responsive on any device.
          </p>
          <p className="leading-relaxed text-muted">
            Your settings and progress are stored locally on your device. No accounts, no distractions — just you and the rhythm of keys.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg bg-surface/70 border border-muted/20 hover:bg-surface/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40"
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
