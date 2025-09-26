// Simple localStorage-based drafts viewer - no complex dependencies
import React, { useState, useEffect, useMemo } from 'react';
import { getArchive, deleteArchiveEntry, saveArchive, updateArchiveEntry, type ArchiveEntry } from '../utils/storage';

interface SimpleDraftsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SimpleDrafts: React.FC<SimpleDraftsProps> = ({ isOpen, onClose }) => {
  const [drafts, setDrafts] = useState<ArchiveEntry[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<ArchiveEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingText, setEditingText] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load drafts from localStorage
      try {
        const entries = getArchive();
        // Sort by most recent first
        const sorted = entries.sort((a, b) => 
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        setDrafts(sorted);
        setSelectedDraft(sorted[0] ?? null);
      } catch (e) {
        console.error('[SimpleDrafts] Failed to load drafts:', e);
        setDrafts([]);
        setSelectedDraft(null);
      }
    }
  }, [isOpen]);

  const filteredDrafts = useMemo(() => {
    if (!searchTerm.trim()) return drafts;
    const query = searchTerm.toLowerCase();
    return drafts.filter(draft =>
      draft.text.toLowerCase().includes(query) ||
      formatDate(draft.startedAt).toLowerCase().includes(query)
    );
  }, [drafts, searchTerm]);

  useEffect(() => {
    if (!filteredDrafts.length) {
      setSelectedDraft(null);
      return;
    }
    if (!selectedDraft || !filteredDrafts.some(d => d.id === selectedDraft.id)) {
      setSelectedDraft(filteredDrafts[0]);
    }
  }, [filteredDrafts, selectedDraft]);

  useEffect(() => {
    if (selectedDraft) {
      setEditingText(selectedDraft.text);
      setIsDirty(false);
    } else {
      setEditingText('');
      setIsDirty(false);
    }
  }, [selectedDraft]);

  const handleDelete = (id: string) => {
    if (confirm('Delete this draft?')) {
      deleteArchiveEntry(id);
      setDrafts(drafts.filter(d => d.id !== id));
      if (selectedDraft?.id === id) {
        setSelectedDraft(null);
      }
    }
  };

  const handleClearAll = () => {
    if (drafts.length === 0) return;
    if (confirm('This will permanently delete all drafts. Continue?')) {
      saveArchive([]);
      setDrafts([]);
      setSelectedDraft(null);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(drafts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zen-drafts-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const stats = useMemo(() => {
    const totalWords = drafts.reduce((sum, d) => sum + d.wordCount, 0);
    const totalChars = drafts.reduce((sum, d) => sum + d.charCount, 0);
    const avgWords = drafts.length ? Math.round(totalWords / drafts.length) : 0;
    const latest = drafts[0]?.startedAt ?? null;
    return { totalWords, totalChars, avgWords, latest };
  }, [drafts]);

  const editingStats = useMemo(() => {
    const text = editingText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text === '' ? 0 : text.split(/\n/).length;
    return { words, chars, lines };
  }, [editingText]);

  const handleSave = () => {
    if (!selectedDraft) return;
    const updated: ArchiveEntry = {
      ...selectedDraft,
      text: editingText,
      wordCount: editingStats.words,
      charCount: editingStats.chars,
      endedAt: new Date().toISOString(),
    };
    updateArchiveEntry(selectedDraft.id, updated);
    setDrafts(prev => prev.map(d => (d.id === updated.id ? updated : d)));
    setSelectedDraft(updated);
    setIsDirty(false);
  };

  const handleRestoreToCanvas = () => {
    try {
      window.dispatchEvent(new CustomEvent('restoreDraft', { detail: { text: editingText } }));
      window.dispatchEvent(new CustomEvent('toggleArchive', { detail: false }));
    } catch (e) {
      console.error('Unable to restore draft to editor', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-base/95 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="h-full flex">
        {/* Sidebar */}
        <div className="w-80 bg-surface/50 border-r border-muted/20 flex flex-col">
          <div className="p-4 border-b border-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-sans text-foam">Drafts</h2>
              <button
                onClick={onClose}
                className="text-muted hover:text-text transition-colors"
                aria-label="Close drafts"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="bg-overlay/30 border border-muted/20 rounded-lg p-3 text-xs text-muted space-y-1">
              <div className="flex justify-between">
                <span>Total drafts</span>
                <span className="text-foam">{drafts.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total words</span>
                <span>{stats.totalWords}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg words per draft</span>
                <span>{stats.avgWords}</span>
              </div>
              {stats.latest && (
                <div className="flex justify-between">
                  <span>Latest</span>
                  <span>{formatDate(stats.latest)}</span>
                </div>
              )}
            </div>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search drafts..."
              className="w-full px-3 py-2 text-sm bg-overlay/40 border border-muted/20 rounded-lg focus:outline-none focus:border-iris/40 focus:ring-1 focus:ring-iris/40"
            />
          </div>

          {/* Draft list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {drafts.length === 0 ? (
              <p className="text-muted text-center py-8">No drafts yet. Start typing in Zen mode!</p>
            ) : filteredDrafts.length === 0 ? (
              <p className="text-muted text-center py-8">No drafts match “{searchTerm}”.</p>
            ) : (
              filteredDrafts.map(draft => (
                <div
                  key={draft.id}
                  role="button"
                  tabIndex={0}
                  className={`p-3 rounded-lg cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40 ${
                    selectedDraft?.id === draft.id 
                      ? 'bg-iris/20 border border-iris/40' 
                      : 'bg-overlay/40 hover:bg-overlay/60 border border-transparent'
                  }`}
                  onClick={() => setSelectedDraft(draft)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDraft(draft);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foam truncate">
                        {formatDate(draft.startedAt)}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        {draft.wordCount} words • {draft.charCount} chars
                      </p>
                      <p className="text-sm text-text/80 mt-1 truncate">
                        {draft.text.substring(0, 50) || '(empty)'}...
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(draft.id);
                      }}
                      className="text-love/60 hover:text-love ml-2"
                      aria-label={`Delete draft from ${formatDate(draft.startedAt)}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-muted/20 space-y-2">
            <button
              onClick={handleExport}
              className="w-full px-4 py-2 bg-surface/60 hover:bg-surface/80 border border-muted/20 rounded-lg text-sm"
              disabled={drafts.length === 0}
            >
              Export All Drafts
            </button>
            <button
              onClick={handleClearAll}
              className="w-full px-4 py-2 bg-love/20 hover:bg-love/30 border border-love/40 rounded-lg text-sm text-love"
              disabled={drafts.length === 0}
            >
              Clear All Drafts
            </button>
            <p className="text-xs text-muted text-center">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''} • {drafts.reduce((sum, d) => sum + d.wordCount, 0)} total words
            </p>
          </div>
        </div>

        {/* Content viewer */}
        <div className="flex-1 flex flex-col">
          {selectedDraft ? (
            <>
              <div className="p-4 border-b border-muted/20 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg text-text">
                    {formatDate(selectedDraft.startedAt)}
                  </h3>
                  <p className="text-sm text-muted mt-1 flex flex-wrap items-center gap-3">
                    <span>{editingStats.words} words</span>
                    <span>{editingStats.chars} characters</span>
                    <span>{editingStats.lines} lines</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingText(selectedDraft.text);
                      setIsDirty(false);
                    }}
                    className="px-4 py-2 bg-surface/40 hover:bg-surface/60 border border-muted/30 rounded-lg text-sm"
                    disabled={!isDirty}
                  >
                    Revert
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-foam/20 hover:bg-foam/30 border border-foam/40 rounded-lg text-sm text-foam font-medium disabled:opacity-50"
                    disabled={!isDirty}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden p-6">
                <textarea
                  value={editingText}
                  onChange={(e) => {
                    setEditingText(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full h-full resize-none rounded-2xl border border-muted/20 bg-overlay/30 px-5 py-4 font-mono text-sm text-text/90 focus:outline-none focus:border-iris/40 focus:ring-1 focus:ring-iris/40"
                  spellCheck={false}
                  aria-label="Edit draft text"
                />
              </div>
              <div className="p-4 border-t border-muted/20 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(editingText);
                    alert('Copied to clipboard!');
                  }}
                  className="px-4 py-2 bg-surface/60 hover:bg-surface/80 border border-muted/20 rounded-lg text-sm"
                >
                  Copy Text
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([editingText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `draft-${selectedDraft.id}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-surface/60 hover:bg-surface/80 border border-muted/20 rounded-lg text-sm"
                >
                  Download as .txt
                </button>
                <button
                  onClick={handleRestoreToCanvas}
                  className="px-4 py-2 bg-iris/20 hover:bg-iris/30 border border-iris/40 rounded-lg text-sm text-iris"
                >
                  Load into Zen mode
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted">
              <div className="text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 opacity-50">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
                <p>Select a draft to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleDrafts;
