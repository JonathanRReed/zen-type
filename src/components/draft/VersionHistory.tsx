import React, { useEffect, useRef, useState, useMemo } from 'react';
import { diffLines } from 'diff';
import type { DraftSnapshot } from '../../lib/draftStore';
import { computeTextMetrics } from '../../lib/textMetrics';
import { useModal } from '../../hooks/useModal';
import { IconClose } from '../icons';

interface VersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: DraftSnapshot[];
  currentBody: string;
  onRestore: (snapshotId: string) => void;
}

const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  const day = date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${time}`;
};

const DIFF_OPTIONS = { ignoreNewlineAtEof: true };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

const VersionHistory: React.FC<VersionHistoryProps> = ({
  isOpen,
  onClose,
  snapshots,
  currentBody: _currentBody,
  onRestore,
}) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<DraftSnapshot | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useModal(backdropRef, onClose, isOpen);

  // Line diffs are deferred while the panel is closed, then reused across
  // its own state changes until the snapshots change or it is reopened.
  const snapshotItems = useMemo(() => {
    if (!isOpen) return [];
    const reversed = [...snapshots].reverse();
    return reversed.map((snapshot, index) => {
      const prevSnapshot = index < reversed.length - 1 ? reversed[index + 1] : null;
      // A draft rarely ends in a newline; without this, writing one more line
      // reads as the old last line removed and two added.
      const diff = prevSnapshot ? diffLines(prevSnapshot.body, snapshot.body, DIFF_OPTIONS) : null;
      // Count lines, not changed blocks: one block can span many lines.
      let addedLines = 0;
      let removedLines = 0;
      if (diff) {
        for (const change of diff) {
          if (change.added) addedLines += change.count ?? 1;
          if (change.removed) removedLines += change.count ?? 1;
        }
      }
      return { snapshot, addedLines, removedLines, words: computeTextMetrics(snapshot.body).words };
    });
  }, [isOpen, snapshots]);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (selectedSnapshot) confirmRef.current?.focus();
  }, [selectedSnapshot]);

  if (!isOpen) return null;

  const confirmRestore = () => {
    if (selectedSnapshot) {
      onRestore(selectedSnapshot.id);
      setSelectedSnapshot(null);
      onClose();
    }
  };

  return (
    <div ref={backdropRef} className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="draft-history-title">
      <div className="overlay-dismiss" aria-hidden="true" onClick={onClose} />
      <div className="overlay-card sheet sheet-lg">
        <div className="sheet-head">
          <h2 id="draft-history-title" className="sheet-title">
            {selectedSnapshot ? 'Restore this version?' : 'Version history'}
          </h2>
          <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="Close version history">
            <IconClose />
          </button>
        </div>

        {selectedSnapshot ? (
          <div className="history-confirm">
            <p className="sheet-lede">
              The draft goes back to how it was on {formatTimestamp(selectedSnapshot.ts)}. What is on the page now is kept as a version first, so you can come back to it.
            </p>
            <p className="history-excerpt">{excerpt(selectedSnapshot.body)}</p>
            <div className="sheet-foot">
              <div className="sheet-actions">
                <button type="button" className="btn" onClick={() => setSelectedSnapshot(null)}>Cancel</button>
                <button ref={confirmRef} type="button" className="btn btn-primary" onClick={confirmRestore}>Restore</button>
              </div>
            </div>
          </div>
        ) : snapshotItems.length === 0 ? (
          <p className="sheet-lede">
            No versions yet. One is kept every two minutes while you write, and whenever you press Ctrl+S (Cmd+S on a Mac).
          </p>
        ) : (
          <>
            <p className="sheet-lede">Kept every two minutes while you write, and whenever you press Ctrl+S. The newest is first.</p>
            <ul className="history-list">
              {snapshotItems.map(({ snapshot, addedLines, removedLines, words }) => {
                return (
                  <li key={snapshot.id} className="history-item">
                    <div>
                      <p className="history-when">{formatTimestamp(snapshot.ts)}</p>
                      <p className="history-meta">
                        {snapshot.isRestore ? 'Restored here. ' : ''}
                        {plural(words, 'word', 'words')}
                        {addedLines > 0 && <>, <span className="history-added">{plural(addedLines, 'line', 'lines')} added</span></>}
                        {removedLines > 0 && <>, <span className="history-removed">{plural(removedLines, 'line', 'lines')} removed</span></>}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => setSelectedSnapshot(snapshot)}
                      aria-label={`Restore the version from ${formatTimestamp(snapshot.ts)}`}
                    >
                      Restore
                    </button>
                    {snapshot.body.trim() && <p className="history-excerpt">{excerpt(snapshot.body)}</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

function excerpt(body: string): string {
  const text = body.trim();
  return text.length > 220 ? `${text.slice(0, 220).trimEnd()}…` : text || 'An empty page.';
}

export default VersionHistory;
