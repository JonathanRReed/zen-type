import React, { Suspense, lazy } from 'react';

// DraftManager pulls in Dexie, the whole draft editor tree, and the grammar +
// text-metrics helpers. The overlay is closed at first paint on every page, so
// none of that belongs in the initial download. Loading it here on first open
// keeps ~180KB of JS off the critical path.
const DraftManager = lazy(() => import('./draft/DraftManager'));

interface SimpleDraftsProps {
  isOpen: boolean;
  onClose: () => void;
}

const SimpleDrafts: React.FC<SimpleDraftsProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Suspense
      fallback={
        <div
          className="overlay-backdrop fixed inset-0 z-[1000] flex items-center justify-center glass-theme"
          role="status"
          aria-live="polite"
        >
          <span className="animate-pulse text-sm text-muted">Opening drafts…</span>
        </div>
      }
    >
      <DraftManager isOpen={isOpen} onClose={onClose} />
    </Suspense>
  );
};

export default SimpleDrafts;
