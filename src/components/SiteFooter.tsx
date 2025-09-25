import React from 'react';

const SiteFooter: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-6xl px-6 pb-5">
        <div className="pointer-events-auto glass rounded-full px-4 py-2 flex items-center justify-between text-xs text-muted">
          <span>Zen Typer v1.1 • Built with Rosé Pine</span>
          <div className="flex items-center gap-3">
            <button
              className="px-3 py-1 rounded-lg bg-surface/60 border border-muted/20 hover:bg-surface/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40"
              onClick={() => window.dispatchEvent(new CustomEvent('toggleAbout', { detail: true }))}
            >About</button>
            <button
              className="px-3 py-1 rounded-lg bg-surface/60 border border-muted/20 hover:bg-surface/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40"
              onClick={() => window.dispatchEvent(new CustomEvent('toggleHelp', { detail: true }))}
            >Help</button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
