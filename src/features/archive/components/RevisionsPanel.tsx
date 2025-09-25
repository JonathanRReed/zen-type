// Revisions panel for viewing and restoring document history
import React, { useEffect, useState } from 'react';
import { RevisionStore, type Revision } from '../db';

interface RevisionsPanelProps {
  documentId: string;
  onClose: () => void;
  onRestore: () => void;
}

export const RevisionsPanel: React.FC<RevisionsPanelProps> = ({
  documentId,
  onClose,
  onRestore
}) => {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [selectedRevision, setSelectedRevision] = useState<Revision | null>(null);
  const [diffView, setDiffView] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRevisions = async () => {
      setLoading(true);
      const revs = await RevisionStore.getRevisions(documentId);
      setRevisions(revs);
      setLoading(false);
    };
    loadRevisions();
  }, [documentId]);


  const handleSelectRevision = (revision: Revision) => {
    setSelectedRevision(revision);
    
    if (revision.type === 'diff') {
      // Parse and display diff
      const changes = JSON.parse(revision.content);
      let html = '';
      
      changes.forEach((change: any) => {
        if (change.added) {
          html += `<span class="bg-foam/20 text-foam">${escapeHtml(change.value)}</span>`;
        } else if (change.removed) {
          html += `<span class="bg-love/20 text-love line-through">${escapeHtml(change.value)}</span>`;
        } else {
          html += escapeHtml(change.value);
        }
      });
      
      setDiffView(html);
    } else {
      // Show full snapshot
      setDiffView(escapeHtml(revision.content));
    }
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const handleRestore = async () => {
    if (!selectedRevision || !selectedRevision.id) return;
    
    if (confirm('Restore this revision? Current changes will be saved as a new revision.')) {
      await RevisionStore.restoreRevision(documentId, selectedRevision.id);
      onRestore();
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-60 bg-base/80 backdrop-blur-sm flex items-center justify-center">
      <div className="glass rounded-xl w-full max-w-6xl h-[80vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-muted/20 flex items-center justify-between px-6">
          <h2 className="text-lg font-medium text-text">Document Revisions</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface/60 text-muted"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Revision List */}
          <div className="w-80 border-r border-muted/20 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-muted">Loading...</div>
            ) : revisions.length === 0 ? (
              <div className="p-4 text-center text-muted">No revisions yet</div>
            ) : (
              <div className="p-2">
                {revisions.map((revision) => (
                  <button
                    key={revision.id}
                    className={`
                      w-full p-3 mb-1 rounded-lg text-left transition-colors
                      ${selectedRevision?.id === revision.id ? 'bg-iris/10 text-iris' : 'hover:bg-surface/60'}
                    `}
                    onClick={() => handleSelectRevision(revision)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`
                        px-1.5 py-0.5 rounded text-xs font-mono
                        ${revision.type === 'snapshot' ? 'bg-foam/20 text-foam' : 'bg-gold/20 text-gold'}
                      `}>
                        {revision.type}
                      </span>
                      <span className="text-xs text-muted">
                        {formatDate(revision.timestamp)}
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      {revision.summary}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {revision.wordCount} words, {revision.charCount} chars
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Diff Viewer */}
          <div className="flex-1 flex flex-col">
            {selectedRevision ? (
              <>
                <div className="p-4 border-b border-muted/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-text">
                        {selectedRevision.type === 'snapshot' ? 'Full Snapshot' : 'Changes'}
                      </div>
                      <div className="text-xs text-muted">
                        {formatDate(selectedRevision.timestamp)}
                      </div>
                    </div>
                    <button
                      onClick={handleRestore}
                      className="px-4 py-2 bg-iris/20 border border-iris/40 text-iris rounded-lg hover:bg-iris/30 transition-colors"
                    >
                      Restore This Version
                    </button>
                  </div>
                </div>
                
                <div 
                  className="flex-1 p-6 overflow-y-auto font-mono text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: diffView }}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted">
                Select a revision to view
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
