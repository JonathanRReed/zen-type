import React from 'react';
import { Button } from '@/components/ui/button';

interface AboutPanelProps {
  onClose: () => void;
}

export const AboutPanel: React.FC<AboutPanelProps> = ({ onClose }) => {
  const shortcuts = [
    { key: 'Tab', description: 'Switch between Zen and Quote modes' },
    { key: 'Esc', description: 'Open or close the pause menu' },
    { key: 'Space', description: 'Commit word and release a token (Zen)' },
    { key: 'Enter', description: 'Force commit the current word (Zen)' },
    { key: 'Backspace', description: 'Correct the previous character (Quote)' },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-muted/20 bg-surface/70 px-6 pb-6 pt-7 shadow-[0_24px_70px_rgba(10,4,22,0.55)]">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-[color-mix(in_oklab,var(--rp-iris)75%,#0a0415_25%)]/40 via-transparent to-transparent pointer-events-none" />
      <div className="relative flex items-start justify-between mb-6">
        <h2 className="text-[clamp(1.4rem,2vw,1.8rem)] font-semibold tracking-tight text-foam">About</h2>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 text-muted/80 shadow-[0_6px_14px_rgba(12,6,24,0.45)] backdrop-blur-md transition-transform duration-200 hover:text-foam hover:scale-105"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </Button>
      </div>

      <div className="relative space-y-4 text-text">
        <p className="text-sm leading-relaxed">
          Zen Typer is a minimalist typing retreat for mindful practice. Drift in <strong className="text-iris">Zen mode </strong>
          to let your thoughts float upward, or refine precision in <strong className="text-foam">Quote mode</strong> with gentle pacing cues.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          The interface leans on Rosé Pine hues, soft gradients, and motion that respects reduced-motion settings. Everything runs locally so your flow stays private.
        </p>
      </div>

      <div className="relative mt-7 rounded-2xl border border-muted/18 bg-base/30 p-5 shadow-[0_12px_32px_rgba(9,4,18,0.45)]">
        <h3 className="text-xs font-semibold tracking-[0.36em] text-iris/80 uppercase mb-4">Keyboard Shortcuts</h3>
        <div className="grid gap-3">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
              <kbd className="px-3 py-1.5 rounded-xl border border-muted/35 bg-surface/80 text-text/90 shadow-[0_6px_16px_rgba(12,6,24,0.25)]">
                {key}
              </kbd>
              <span className="font-sans text-sm">{description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mt-6 pt-5 border-t border-muted/20 text-xs text-muted space-y-2">
        <div className="uppercase tracking-[0.28em] text-muted/60">Made by Jonathan Reed</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <a
            className="text-iris hover:text-foam transition-colors"
            href="https://jonathanrreed.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Website
          </a>
          <span className="text-muted/40">•</span>
          <a
            className="text-iris hover:text-foam transition-colors"
            href="https://bsky.app/profile/thereedy.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bluesky
          </a>
          <span className="text-muted/40">•</span>
          <a
            className="text-iris hover:text-foam transition-colors"
            href="https://www.linkedin.com/in/jonathanrreed0/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
};
