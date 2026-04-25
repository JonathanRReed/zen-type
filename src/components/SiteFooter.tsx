import React from 'react';
import KeyboardHint from './KeyboardHint';

const SiteFooter: React.FC = React.memo(() => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-6xl px-6 pb-5">
        {/* Keyboard shortcuts hint row */}
        <div className="pointer-events-auto flex items-center justify-center gap-4 mb-3 opacity-60 hover:opacity-100 transition-opacity">
          <KeyboardHint keyLabel="Tab" description="Switch mode" />
          <KeyboardHint keyLabel="Esc" description="Settings" />
          <KeyboardHint keyLabel="⌘ /" description="Help" />
        </div>

        {/* Attribution row */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          <img
            src="/zen_type_assets/zen-type-logo-footer-transparent.png"
            alt="Zen Typer"
            className="h-5 w-auto object-contain opacity-80"
            loading="lazy"
          />
          <span className="text-muted/50">/</span>
          <span className="font-semibold text-text">Made by Jonathan R Reed</span>
          <span className="text-muted/50">/</span>
          <span className="text-muted/70">Cybersecurity & AI developer</span>
          <span className="text-muted/50">•</span>
          <a className="text-iris hover:text-foam transition-colors" href="/about/">
            About
          </a>
          <span className="text-muted/50">•</span>
          <a className="text-iris hover:text-foam transition-colors" href="/contact/">
            Contact
          </a>
          <span className="text-muted/50">•</span>
          <a className="text-iris hover:text-foam transition-colors" href="/privacy/">
            Privacy
          </a>
          <span className="text-muted/50">•</span>
          <a
            className="text-iris hover:text-foam transition-colors"
            href="https://jonathanrreed.com/projects/"
            target="_blank"
            rel="noopener noreferrer"
          >
            See more projects by Jonathan R Reed
          </a>
          <span className="text-muted/50">•</span>
          <a
            className="text-iris hover:text-foam transition-colors"
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
