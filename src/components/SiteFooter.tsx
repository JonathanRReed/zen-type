import React from 'react';
import KeyboardHint from './KeyboardHint';

const SiteFooter: React.FC = React.memo(() => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-6xl px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Keyboard shortcuts hint row: keyboards only */}
        <div className="pointer-events-auto hidden sm:flex items-center justify-center gap-4 mb-3 opacity-60 hover:opacity-100 transition-opacity">
          <KeyboardHint keyLabel="Tab" description="Switch mode" />
          <KeyboardHint keyLabel="Esc" description="Pause" />
          <KeyboardHint keyLabel="Ctrl H" description="Shortcuts" />
        </div>

        {/* Attribution row */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
          <img
            src="/zen_type_assets/zen-type-logo-footer-512w.png"
            alt="Zen Typer"
            width={73}
            height={20}
            className="h-5 w-auto object-contain opacity-80 hidden sm:inline-block"
            loading="lazy"
          />
          <span className="text-muted/50 hidden sm:inline">/</span>
          <span className="font-semibold text-text">Made by Jonathan R. Reed</span>
          <span className="text-muted/50">•</span>
          <a className="text-iris hover:text-foam transition-colors" href="/about/">
            About
          </a>
          <span className="text-muted/50">•</span>
          <a className="text-iris hover:text-foam transition-colors" href="/whats-new/">
            What's new
          </a>
          <span className="text-muted/50 hidden sm:inline">•</span>
          <a className="text-iris hover:text-foam transition-colors hidden sm:inline" href="/contact/">
            Contact
          </a>
          <span className="text-muted/50">•</span>
          <a className="text-iris hover:text-foam transition-colors" href="/privacy/">
            Privacy
          </a>
          <span className="text-muted/50 hidden sm:inline">•</span>
          <a className="text-iris hover:text-foam transition-colors hidden sm:inline" href="/subprocessors/">
            Subprocessors
          </a>
          <span className="text-muted/50 hidden sm:inline">•</span>
          <a
            className="text-iris hover:text-foam transition-colors hidden sm:inline"
            href="https://jonathanrreed.com/projects/"
            target="_blank"
            rel="noopener noreferrer"
          >
            More projects
          </a>
          <span className="text-muted/50 hidden sm:inline">•</span>
          <a
            className="text-iris hover:text-foam transition-colors hidden sm:inline"
            href="https://bsky.app/profile/thereedy.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bluesky
          </a>
        </div>
      </div>
    </footer>
  );
});

SiteFooter.displayName = 'SiteFooter';

export default SiteFooter;
