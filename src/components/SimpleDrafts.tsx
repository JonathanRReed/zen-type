import React, { Suspense, lazy } from 'react';
import { createPortal } from 'react-dom';

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
  if (!isOpen || typeof document === 'undefined') return null;

  // Rendered into <body>: the app stage isolates its own stacking context, so
  // a fixed screen left inside it sat under the notes that follow the stage
  // and showed them through on a phone.
  return createPortal(
    <Suspense
      fallback={
        // The drafts stylesheet arrives with the screen itself, so the
        // moment before it does borrows the dialog backdrop.
        <div className="overlay-backdrop" role="status" aria-live="polite">
          <span className="sheet-meta">Opening your drafts…</span>
        </div>
      }
    >
      <DraftManager isOpen={isOpen} onClose={onClose} />
    </Suspense>,
    document.body,
  );
};

export default SimpleDrafts;
