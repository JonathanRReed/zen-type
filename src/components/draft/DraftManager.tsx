import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getAllDrafts,
  getDraft,
  createDraft,
  updateDraft,
  deleteDraft,
  addSnapshot,
  restoreSnapshot,
  getDraftPrefs,
  saveDraftPrefs,
  syncFromArchive,
  type Draft,
  type DraftPrefs,
} from '../../lib/draftStore';
import { computeTextMetrics, extractOutline, getKeywordFrequencies, findInText } from '../../lib/textMetrics';
import { checkGrammar } from '../../lib/grammar';
import Editor from './Editor';
import ToolsPanel from './ToolsPanel';
import ResizableOutline from './ResizableOutline';
import CommandPalette from './CommandPalette';
import SearchBox from './SearchBox';
import VersionHistory from './VersionHistory';
import Scratchpad from './Scratchpad';

interface DraftManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DraftManager: React.FC<DraftManagerProps> = ({ isOpen, onClose }) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [prefs, setPrefs] = useState<DraftPrefs>(getDraftPrefs());
  const [toolsPanelOpen, setToolsPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [newTagInput, setNewTagInput] = useState('');

  const autoSaveTimerRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const lastBodyRef = useRef<string>('');

  const loadDrafts = useCallback(async () => {
    // Sync from Zen mode archive first
    await syncFromArchive();
    
    const allDrafts = await getAllDrafts();
    setDrafts(allDrafts);
    if (allDrafts.length > 0 && !currentDraft) {
      setCurrentDraft(allDrafts[0] || null);
    }
  }, [currentDraft]);

  // Load drafts on mount and sync from archive
  useEffect(() => {
    if (isOpen) {
      loadDrafts();
    }
  }, [isOpen, loadDrafts]);

  // Auto-sync from archive every 5 seconds while open
  useEffect(() => {
    if (!isOpen) return;

    const syncInterval = setInterval(() => {
      syncFromArchive().then(() => {
        // Refresh draft list if new entries were synced
        getAllDrafts().then(allDrafts => {
          setDrafts(allDrafts);
        });
      });
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [isOpen]);

  const handleCreateDraft = async () => {
    const draft = await createDraft();
    setDrafts(prev => [draft, ...prev]);
    setCurrentDraft(draft);
  };

  const handleExportAll = () => {
    if (drafts.length === 0) return;
    const data = JSON.stringify(drafts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zen-drafts-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    if (drafts.length === 0) return;
    if (!confirm(`This will permanently delete all ${drafts.length} drafts. This action cannot be undone. Continue?`)) return;
    
    // Delete all drafts
    for (const draft of drafts) {
      await deleteDraft(draft.id);
    }
    
    setDrafts([]);
    setCurrentDraft(null);
  };

  const handleSelectDraft = async (id: string) => {
    const draft = await getDraft(id);
    if (draft) {
      setCurrentDraft(draft);
      lastBodyRef.current = draft.body;
    }
  };

  // Auto-save with debounce (1s)
  const handleBodyChange = useCallback((body: string) => {
    if (!currentDraft) return;

    setCurrentDraft(prev => prev ? { ...prev, body } : null);

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      updateDraft(currentDraft.id, { body });
      lastBodyRef.current = body;
    }, 1000);
  }, [currentDraft]);

  // Periodic snapshots (120s)
  useEffect(() => {
    if (!currentDraft) return;

    snapshotTimerRef.current = window.setInterval(() => {
      if (currentDraft.body !== lastBodyRef.current) {
        addSnapshot(currentDraft.id, currentDraft.body);
        lastBodyRef.current = currentDraft.body;
      }
    }, 120000);

    return () => {
      if (snapshotTimerRef.current !== null) {
        window.clearInterval(snapshotTimerRef.current);
      }
    };
  }, [currentDraft]);

  // Manual snapshot (Cmd+S)
  const handleManualSnapshot = useCallback(() => {
    if (!currentDraft) return;
    addSnapshot(currentDraft.id, currentDraft.body);
    lastBodyRef.current = currentDraft.body;
  }, [currentDraft]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return undefined;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 't' && !mod && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setToolsPanelOpen(prev => !prev);
        }
      }

      if (mod && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      if (mod && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }

      if (mod && e.key === '1') {
        e.preventDefault();
        setPrefs(prev => ({ ...prev, outline: !prev.outline }));
      }

      if (mod && e.key === '2') {
        e.preventDefault();
        setPrefs(prev => ({ ...prev, scratchpad: !prev.scratchpad }));
      }

      if (mod && e.key === 's') {
        e.preventDefault();
        handleManualSnapshot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleManualSnapshot]);

  // Update preferences
  const handlePrefsChange = useCallback((updates: Partial<DraftPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...updates };
      saveDraftPrefs(next);
      return next;
    });
  }, []);

  // Computed values
  const metrics = useMemo(() => {
    return currentDraft ? computeTextMetrics(currentDraft.body) : null;
  }, [currentDraft]);

  const outline = useMemo(() => {
    return currentDraft && prefs.outline ? extractOutline(currentDraft.body) : [];
  }, [currentDraft, prefs.outline]);

  const grammarIssues = useMemo(() => {
    return currentDraft && prefs.grammar ? checkGrammar(currentDraft.body) : [];
  }, [currentDraft, prefs.grammar]);

  const keywordFrequencies = useMemo(() => {
    return currentDraft && prefs.keywordHighlighter ? getKeywordFrequencies(currentDraft.body) : [];
  }, [currentDraft, prefs.keywordHighlighter]);

  const searchMatches = useMemo(() => {
    if (!currentDraft || !searchQuery.trim()) return [];
    return findInText(currentDraft.body, searchQuery, searchCaseSensitive);
  }, [currentDraft, searchQuery, searchCaseSensitive]);

  const handleSearch = useCallback((query: string, caseSensitive: boolean) => {
    setSearchQuery(query);
    setSearchCaseSensitive(caseSensitive);
    setCurrentSearchIndex(0);
  }, []);

  const handleNextMatch = useCallback(() => {
    setCurrentSearchIndex(prev => (prev + 1) % Math.max(1, searchMatches.length));
  }, [searchMatches.length]);

  const handlePreviousMatch = useCallback(() => {
    setCurrentSearchIndex(prev => (prev - 1 + searchMatches.length) % Math.max(1, searchMatches.length));
  }, [searchMatches.length]);

  const handleJumpTo = useCallback((index: number) => {
    window.dispatchEvent(new CustomEvent('draftJumpTo', { detail: { index } }));
  }, []);

  const handleRestoreSnapshot = useCallback(async (snapshotId: string) => {
    if (!currentDraft) return;
    await restoreSnapshot(currentDraft.id, snapshotId);
    const updated = await getDraft(currentDraft.id);
    if (updated) {
      setCurrentDraft(updated);
      lastBodyRef.current = updated.body;
    }
  }, [currentDraft]);

  const handleTitleChange = useCallback((title: string) => {
    if (!currentDraft) return;
    setCurrentDraft(prev => prev ? { ...prev, title } : null);
    updateDraft(currentDraft.id, { title });
  }, [currentDraft]);

  const handleAddTag = useCallback(() => {
    if (!currentDraft || !newTagInput.trim()) return;
    const newTags = [...currentDraft.tags, newTagInput.trim()];
    setCurrentDraft(prev => prev ? { ...prev, tags: newTags } : null);
    updateDraft(currentDraft.id, { tags: newTags });
    setNewTagInput('');
  }, [currentDraft, newTagInput]);

  const handleRemoveTag = useCallback((tag: string) => {
    if (!currentDraft) return;
    const newTags = currentDraft.tags.filter(t => t !== tag);
    setCurrentDraft(prev => prev ? { ...prev, tags: newTags } : null);
    updateDraft(currentDraft.id, { tags: newTags });
  }, [currentDraft]);

  const handleScratchpadChange = useCallback((scratchpad: string) => {
    if (!currentDraft) return;
    setCurrentDraft(prev => prev ? { ...prev, scratchpad } : null);
    updateDraft(currentDraft.id, { scratchpad });
  }, [currentDraft]);

  const recentLines = useMemo(() => {
    if (!currentDraft) return [];
    return currentDraft.body
      .split('\n')
      .filter(line => line.trim().length > 10)
      .slice(-50);
  }, [currentDraft]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-base flex" role="dialog" aria-modal="true">
      {/* Sidebar */}
      <div className="w-72 bg-surface/50 border-r border-muted/20 flex flex-col">
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
          <button
            onClick={handleCreateDraft}
            className="w-full px-4 py-2 bg-foam/20 hover:bg-foam/30 border border-foam/40 rounded-lg text-sm text-foam font-medium transition-colors"
          >
            + New Draft
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {drafts.length === 0 ? (
            <p className="text-muted text-center py-8 text-sm">No drafts yet. Create your first draft!</p>
          ) : (
            drafts.map(draft => (
              <button
                key={draft.id}
                onClick={() => handleSelectDraft(draft.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentDraft?.id === draft.id
                    ? 'bg-iris/20 border border-iris/40'
                    : 'bg-overlay/30 hover:bg-overlay/50 border border-transparent'
                }`}
              >
                <p className="text-sm font-medium text-text truncate">{draft.title}</p>
                <p className="text-xs text-muted mt-1">
                  {new Date(draft.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-muted/20 space-y-2">
          <button
            onClick={handleExportAll}
            className="w-full px-4 py-2 bg-surface/60 hover:bg-surface/80 border border-muted/20 rounded-lg text-sm transition-colors"
            disabled={drafts.length === 0}
          >
            Export All Drafts
          </button>
          <button
            onClick={handleClearAll}
            className="w-full px-4 py-2 bg-love/20 hover:bg-love/30 border border-love/40 rounded-lg text-sm text-love transition-colors"
            disabled={drafts.length === 0}
          >
            Clear All Drafts
          </button>
          <p className="text-xs text-muted text-center pt-1">
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {currentDraft ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-muted/20 flex items-center justify-between bg-surface/30">
              <div className="flex-1 mr-4">
                <input
                  type="text"
                  value={currentDraft.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-text focus:outline-none placeholder-muted/50"
                  placeholder="Untitled"
                />
                {prefs.tags && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {currentDraft.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-iris/20 text-iris text-xs rounded flex items-center gap-1.5"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-love text-base leading-none"
                          aria-label={`Remove tag ${tag}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add tag..."
                      className="px-2 py-1 bg-overlay/30 text-xs rounded focus:outline-none focus:ring-1 focus:ring-iris/40"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {prefs.counters && metrics && (
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span className="font-medium">{metrics.words} words</span>
                    <span>{metrics.chars} chars</span>
                    {prefs.readTime && <span>{metrics.readTimeMinutes} min read</span>}
                  </div>
                )}
                <button
                  onClick={() => setVersionHistoryOpen(true)}
                  className="px-4 py-2 bg-overlay/40 hover:bg-overlay/60 rounded-lg text-sm font-medium transition-colors"
                  title="Version history"
                >
                  History
                </button>
                <button
                  onClick={() => setToolsPanelOpen(true)}
                  className="p-2 bg-overlay/40 hover:bg-overlay/60 rounded-lg transition-colors"
                  aria-label="Open tools panel"
                  title="Tools (T)"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m5.2-14.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.8 5.2l-4.2-4.2m0-6l-4.2-4.2"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Editor area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Outline sidebar */}
              {prefs.outline && (
                <ResizableOutline
                  items={outline}
                  onItemClick={handleJumpTo}
                  onClose={() => handlePrefsChange({ outline: false })}
                />
              )}

              {/* Editor */}
              <div className="flex-1 overflow-hidden">
                <Editor
                  draft={currentDraft}
                  onChange={handleBodyChange}
                  grammarIssues={grammarIssues}
                  searchMatches={searchMatches}
                  currentMatchIndex={currentSearchIndex}
                  highlightedWords={new Set(keywordFrequencies.map(kf => kf.word))}
                />
              </div>

              {/* Scratchpad */}
              {prefs.scratchpad && (
                <Scratchpad
                  value={currentDraft.scratchpad || ''}
                  onChange={handleScratchpadChange}
                  onClose={() => handlePrefsChange({ scratchpad: false })}
                />
              )}
            </div>

            {/* Grammar/Keyword panel */}
            {(prefs.grammar || prefs.keywordHighlighter) && (grammarIssues.length > 0 || keywordFrequencies.length > 0) && (
              <div className="border-t border-muted/20 bg-surface/30 p-4 max-h-48 overflow-y-auto">
                {prefs.grammar && grammarIssues.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-text mb-2">Writing Issues</h4>
                    <div className="space-y-1">
                      {grammarIssues.slice(0, 5).map((issue, idx) => (
                        <div key={idx} className="text-xs text-muted bg-overlay/30 rounded px-2 py-1">
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {prefs.keywordHighlighter && keywordFrequencies.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-text mb-2">Repeated Words</h4>
                    <div className="flex flex-wrap gap-2">
                      {keywordFrequencies.map(kf => (
                        <span key={kf.word} className="text-xs bg-gold/20 text-gold px-2 py-1 rounded">
                          {kf.word} ({kf.count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted">
            <div className="text-center">
              <p className="mb-4">No draft selected</p>
              <button
                onClick={handleCreateDraft}
                className="px-4 py-2 bg-foam/20 hover:bg-foam/30 border border-foam/40 rounded-lg text-sm text-foam"
              >
                Create First Draft
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ToolsPanel
        isOpen={toolsPanelOpen}
        onClose={() => setToolsPanelOpen(false)}
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />

      {prefs.quickJump && (
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          outlineItems={outline}
          recentLines={recentLines}
          onJumpTo={handleJumpTo}
        />
      )}

      {prefs.search && (
        <SearchBox
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSearch={handleSearch}
          onNext={handleNextMatch}
          onPrevious={handlePreviousMatch}
          currentMatch={currentSearchIndex}
          totalMatches={searchMatches.length}
        />
      )}

      {currentDraft && (
        <VersionHistory
          isOpen={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          snapshots={currentDraft.snapshots}
          currentBody={currentDraft.body}
          onRestore={handleRestoreSnapshot}
        />
      )}
    </div>
  );
};

export default DraftManager;
