import React from 'react';

const SiteFooter: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-6xl px-6 pb-5">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 text-xs text-muted">
          <span className="uppercase tracking-wider text-muted/70">Made by</span>
          <span className="font-semibold text-text">Jonathan Reed</span>
          <span className="text-muted/50">•</span>
          <a
            className="text-iris hover:text-foam transition-colors"
            href="https://bsky.app/profile/thereedy.bsky.social"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bluesky
          </a>
          <span className="text-muted/50">•</span>
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
    </footer>
  );
};

export default SiteFooter;
