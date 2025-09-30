import React, { useState } from 'react';
import { diffLines } from 'diff';
import type { DraftSnapshot } from '../../lib/draftStore';
import { Button } from '@/components/ui/button';

interface VersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: DraftSnapshot[];
  currentBody: string;
  onRestore: (snapshotId: string) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  isOpen,
  onClose,
  snapshots,
  currentBody: _currentBody,
  onRestore,
}) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<DraftSnapshot | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isOpen) return null;

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const now = Date.now();
    const diff = now - ts;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDiff = (oldText: string, newText: string) => {
    const changes = diffLines(oldText, newText);
    return changes;
  };

  const handleRestore = (snapshot: DraftSnapshot) => {
    setSelectedSnapshot(snapshot);
    setShowConfirm(true);
  };

  const confirmRestore = () => {
    if (selectedSnapshot) {
      onRestore(selectedSnapshot.id);
      setShowConfirm(false);
      setSelectedSnapshot(null);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-base/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Version history"
    >
      <div
        className="w-full max-w-4xl bg-surface/95 border border-muted/20 rounded-xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        role="document"
      >
        <div className="p-4 border-b border-muted/20 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foam">Version History</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="text-muted hover:text-text transition-colors"
            aria-label="Close version history"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {snapshots.length === 0 ? (
            <div className="text-center py-12 text-muted/60">
              <p>No snapshots yet. Snapshots are created automatically every 2 minutes or when you press ⌘S.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...snapshots].reverse().map((snapshot, index) => {
                const prevSnapshot = index < snapshots.length - 1 ? snapshots[snapshots.length - 2 - index] : null;
                const diff = prevSnapshot ? getDiff(prevSnapshot.body, snapshot.body) : null;
                const addedLines = diff ? diff.filter(d => d.added).length : 0;
                const removedLines = diff ? diff.filter(d => d.removed).length : 0;

                return (
                  <div
                    key={snapshot.id}
                    className="border border-muted/20 rounded-lg p-4 hover:bg-overlay/20 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text">
                            {formatTimestamp(snapshot.ts)}
                          </span>
                          {snapshot.isRestore && (
                            <span className="px-2 py-0.5 bg-iris/20 text-iris text-xs rounded">
                              Restore Point
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {snapshot.body.split(/\s+/).length} words • {snapshot.body.length} chars
                        </p>
                        {(addedLines > 0 || removedLines > 0) && (
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            {addedLines > 0 && (
                              <span className="text-foam">+{addedLines} lines</span>
                            )}
                            {removedLines > 0 && (
                              <span className="text-love">-{removedLines} lines</span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={() => handleRestore(snapshot)}
                        variant="outline"
                        className="px-3 py-1.5 bg-foam/20 hover:bg-foam/30 border-foam/40 text-xs text-foam"
                      >
                        Restore
                      </Button>
                    </div>
                    <div className="mt-2 p-3 bg-overlay/30 rounded text-xs font-mono text-text/70 line-clamp-3">
                      {snapshot.body.substring(0, 150)}...
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && selectedSnapshot && (
        <div
          className="fixed inset-0 z-[70] bg-base/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface border border-muted/20 rounded-xl p-6 max-w-md"
            role="document"
          >
            <h3 className="text-lg font-semibold text-text mb-2">Restore Snapshot?</h3>
            <p className="text-sm text-muted mb-4">
              This will replace your current draft with the selected snapshot. Your current version will be saved as a new snapshot.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <Button
                onClick={() => setShowConfirm(false)}
                variant="ghost"
                className="px-4 py-2 bg-overlay/40 hover:bg-overlay/60 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRestore}
                variant="outline"
                className="px-4 py-2 bg-foam/20 hover:bg-foam/30 border-foam/40 text-sm text-foam"
              >
                Restore
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionHistory;
