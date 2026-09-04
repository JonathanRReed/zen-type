import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  setActiveDraftId,
  getActiveDraftId,
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
  const [prefs, setPrefs] = useState<DraftPrefs>(() => getDraftPrefs());
  const [toolsPanelOpen, setToolsPanelOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [newTagInput, setNewTagInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);

  const autoSaveTimerRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef<number | null>(null);
  const lastBodyRef = useRef<string>('');
  // True while keystrokes are waiting out the 1s autosave debounce. The
  // background sync below must not overwrite the editor while this is set.
  const dirtyRef = useRef<boolean>(false);
  // Render-mirror so interval callbacks always see the latest draft without
  // re-subscribing (re-subscribing is what used to reset the snapshot timer
  // on every keystroke).
  const currentDraftRef = useRef<Draft | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const flagPersistError = useCallback(() => {
    setPersistError('Could not save — browser storage is blocked or full. Your text is still on screen, so copy it somewhere safe.');
  }, []);

  const loadDrafts = useCallback(async () => {
    // Sync from Zen mode archive first
    await syncFromArchive();
    
    const allDrafts = await getAllDrafts();
    setDrafts(allDrafts);
    
    // If there's an active draft, load it
    const activeDraftId = getActiveDraftId();
    if (activeDraftId) {
      const activeDraft = await getDraft(activeDraftId);
      if (activeDraft) {
        setCurrentDraft(activeDraft);
        return;
      }
    }
    
    if (allDrafts.length > 0 && !currentDraft) {
      setCurrentDraft(allDrafts[0] || null);
    }
  }, [currentDraft]);

  // Load drafts on mount and sync from archive
  useEffect(() => {
    if (isOpen) {
      void Promise.resolve().then(loadDrafts);
    }
  }, [isOpen, loadDrafts]);

  // Mirror for interval callbacks (see dirtyRef/snapshot notes below).
  useEffect(() => {
    currentDraftRef.current = currentDraft;
  }, [currentDraft]);

  // Focus choreography for the full-screen overlay: move focus in on open
  // (the draft title when it has rendered), contain Tab while open, lock
  // background scroll, and hand focus back to the opener on close.
  useEffect(() => {
    if (!isOpen) return;
    const overlay = overlayRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const title = overlay?.querySelector<HTMLInputElement>('input[aria-label="Draft title"]');
      if (title) title.focus();
      else overlay?.focus();
    }, 0);

    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !overlay) return;
      const items = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    overlay?.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      overlay?.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (
        previouslyFocused &&
        previouslyFocused.isConnected &&
        previouslyFocused !== document.body &&
        previouslyFocused !== document.documentElement
      ) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  // Auto-sync from archive and refresh active draft every 2 seconds while open
  useEffect(() => {
    if (!isOpen) return;

    const syncInterval = setInterval(() => {
      syncFromArchive()
        .then(() => getAllDrafts())
        .then(allDrafts => {
          setDrafts(allDrafts);

          // Never clobber keystrokes that are still waiting out the autosave
          // debounce: if dirty, our pending save wins and the refresh waits.
          const ref = currentDraftRef.current;
          if (!ref || dirtyRef.current) return;
          const activeDraftId = getActiveDraftId();
          if (activeDraftId === ref.id) {
            getDraft(activeDraftId)
              .then(updated => {
                if (updated && updated.body !== currentDraftRef.current?.body) {
                  setCurrentDraft(updated);
                  lastBodyRef.current = updated.body;
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(syncInterval);
  }, [isOpen]);

  const handleCreateDraft = async () => {
    const draft = await createDraft('New Draft');
    setDrafts(prev => [draft, ...prev]);
    setCurrentDraft(draft);
    // Set this as the active draft for zen mode
    setActiveDraftId(draft.id);
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

  const handleCopyDraft = async () => {
    if (!currentDraft) return;
    try {
      await navigator.clipboard.writeText(currentDraft.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access fallback
    }
  };

  const handleExportDraft = () => {
    if (!currentDraft) return;
    const safeTitle = (currentDraft.title || 'draft').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const blob = new Blob([currentDraft.body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAll = async () => {
    if (drafts.length === 0) return;
    if (!confirm(`This will permanently delete all ${drafts.length} drafts. This action cannot be undone. Continue?`)) return;
    
    // Delete all drafts
    await Promise.all(drafts.map(draft => deleteDraft(draft.id)));
    
    setDrafts([]);
    setCurrentDraft(null);
  };

  const handleSelectDraft = async (id: string) => {
    const draft = await getDraft(id);
    if (draft) {
      setCurrentDraft(draft);
      lastBodyRef.current = draft.body;
      // Set this as the active draft for zen mode
      setActiveDraftId(id);
    }
  };

  // Auto-save with debounce (1s). Failures are surfaced, never swallowed:
  // an unhandled IndexedDB rejection used to leave the UI looking saved.
  const handleBodyChange = useCallback((body: string) => {
    if (!currentDraft) return;

    setCurrentDraft(prev => prev ? { ...prev, body } : null);
    dirtyRef.current = true;
    setPersistError(null);

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      updateDraft(currentDraft.id, { body })
        .then(() => {
          dirtyRef.current = false;
          lastBodyRef.current = body;
        })
        .catch(() => {
          flagPersistError();
        });
    }, 1000);
  }, [currentDraft, flagPersistError]);

  // Periodic snapshots (120s). Keyed on the draft id with a ref mirror, so
  // typing no longer resubscribes (and starves) the timer on every keystroke.
  const currentDraftId = currentDraft?.id;
  useEffect(() => {
    if (!currentDraftId) return;

    snapshotTimerRef.current = window.setInterval(() => {
      const ref = currentDraftRef.current;
      if (ref && ref.id === currentDraftId && ref.body !== lastBodyRef.current) {
        addSnapshot(currentDraftId, ref.body)
          .then(() => {
            lastBodyRef.current = ref.body;
          })
          .catch(() => {});
      }
    }, 120000);

    return () => {
      if (snapshotTimerRef.current !== null) {
        window.clearInterval(snapshotTimerRef.current);
      }
    };
  }, [currentDraftId]);

  // Manual snapshot (Cmd+S)
  const handleManualSnapshot = useCallback(() => {
    if (!currentDraft) return;
    addSnapshot(currentDraft.id, currentDraft.body)
      .then(() => {
        lastBodyRef.current = currentDraft.body;
      })
      .catch(() => {
        flagPersistError();
      });
  }, [currentDraft, flagPersistError]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return undefined;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const userAgent = navigator.userAgent?.toLowerCase() ?? '';
      const isMac = userAgent.includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        // The command palette and search box close themselves on Escape, so
        // let those win first. Otherwise close the drafts overlay and stop the
        // event: the page-level Escape handler would otherwise open the pause
        // menu on top of the still-open overlay instead of dismissing it.
        if (commandPaletteOpen || searchOpen) return;
        e.preventDefault();
        e.stopPropagation();
        if (versionHistoryOpen) {
          setVersionHistoryOpen(false);
        } else if (toolsPanelOpen) {
          setToolsPanelOpen(false);
        } else {
          onClose();
        }
        return;
      }

      if (e.key === 't' && !mod && !e.shiftKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setToolsPanelOpen(prev => !prev);
        }
      }

      if (mod && e.key === 'k' && prefs.quickJump) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      if (mod && e.key === 'f' && prefs.search) {
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

    // Capture phase: the page-level Escape handler is bound on `document`, so a
    // bubble-phase listener here would run after it and could not stop the
    // pause menu from opening behind the overlay.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, handleManualSnapshot, commandPaletteOpen, searchOpen, versionHistoryOpen, toolsPanelOpen, onClose, prefs.quickJump, prefs.search]);

  // Update preferences
  const handlePrefsChange = useCallback((updates: Partial<DraftPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...updates };
      return next;
    });
    const current = getDraftPrefs();
    saveDraftPrefs({ ...current, ...updates });
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
    try {
      await restoreSnapshot(currentDraft.id, snapshotId);
      const updated = await getDraft(currentDraft.id);
      if (updated) {
        setCurrentDraft(updated);
        lastBodyRef.current = updated.body;
      }
    } catch {
      flagPersistError();
    }
  }, [currentDraft, flagPersistError]);

  const handleTitleChange = useCallback((title: string) => {
    if (!currentDraft) return;
    setCurrentDraft(prev => prev ? { ...prev, title } : null);
    updateDraft(currentDraft.id, { title }).catch(() => flagPersistError());
  }, [currentDraft, flagPersistError]);

  const handleAddTag = useCallback(() => {
    if (!currentDraft || !newTagInput.trim()) return;
    const newTags = [...currentDraft.tags, newTagInput.trim()];
    setCurrentDraft(prev => prev ? { ...prev, tags: newTags } : null);
    updateDraft(currentDraft.id, { tags: newTags }).catch(() => flagPersistError());
    setNewTagInput('');
  }, [currentDraft, newTagInput, flagPersistError]);

  const handleRemoveTag = useCallback((tag: string) => {
    if (!currentDraft) return;
    const newTags = currentDraft.tags.filter(t => t !== tag);
    setCurrentDraft(prev => prev ? { ...prev, tags: newTags } : null);
    updateDraft(currentDraft.id, { tags: newTags }).catch(() => flagPersistError());
  }, [currentDraft, flagPersistError]);

  const handleScratchpadChange = useCallback((scratchpad: string) => {
    if (!currentDraft) return;
    setCurrentDraft(prev => prev ? { ...prev, scratchpad } : null);
    updateDraft(currentDraft.id, { scratchpad }).catch(() => flagPersistError());
  }, [currentDraft, flagPersistError]);

  const recentLines = useMemo(() => {
    if (!currentDraft) return [];
    return currentDraft.body
      .split('\n')
      .filter(line => line.trim().length > 10)
      .slice(-50);
  }, [currentDraft]);

  if (!isOpen) return null;

  return (
    <div ref={overlayRef} tabIndex={-1} className="overlay-backdrop fixed inset-0 z-[1000] glass-theme" role="dialog" aria-modal="true" aria-label="Drafts Manager">
      <div className="pointer-events-none fixed inset-0 z-0 theme-layer">
        <div className="forest-rays" aria-hidden="true" />
        <div className="ocean-lights" aria-hidden="true" />
      </div>
      <div className="relative z-10 flex h-full flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-72 shrink-0 bg-surface/40 backdrop-blur-sm border-b md:border-b-0 md:border-r border-muted/20 flex flex-col">
        <div className="p-4 border-b border-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-sans text-foam">Drafts</h2>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-muted hover:text-text transition-colors"
              aria-label="Close drafts"
            >
              <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </Button>
          </div>
          <Button
            onClick={handleCreateDraft}
            variant="ghost"
            className="w-full justify-center rounded-xl border border-foam/40 bg-transparent text-foam text-sm font-medium hover:bg-foam/10 transition-colors"
          >
            + New Draft
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[32vh] md:max-h-none">
          {drafts.length === 0 ? (
            <p className="text-muted text-center py-8 text-sm">No drafts yet. Use New Draft to start one.</p>
          ) : (
            drafts.map(draft => {
              const isActive = currentDraft?.id === draft.id;
              const updatedAt = new Date(draft.updatedAt);
              const dateLabel = updatedAt.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const timeLabel = updatedAt.toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
              });
              const displayTitle = (draft.title && draft.title.trim().length > 0)
                ? draft.title.trim()
                : `Zen Session: ${updatedAt.toLocaleString()}`;
              const previewLine = draft.body
                .split('\n')
                .map(line => line.trim())
                .find(line => line.length > 0);
              const previewText = previewLine
                ? previewLine.length > 140
                  ? `${previewLine.slice(0, 140).trim()}…`
                  : previewLine
                : '';
              const tagsToShow = draft.tags.slice(0, 2);

              return (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => handleSelectDraft(draft.id)}
                  className={cn(
                    'group relative w-full text-left px-5 py-4 rounded-xl border transition-all bg-surface/45 flex flex-col items-stretch justify-start whitespace-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface/60',
                    isActive
                      ? 'border-iris/55 bg-iris/20 shadow-[0_12px_28px_rgba(26,12,48,0.38)]'
                      : 'border-muted/25 hover:border-iris/45 hover:bg-surface/60 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(26,12,48,0.32)]'
                  )}
                >
                  <div className="flex w-full flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          title={displayTitle}
                          className="text-[15px] font-semibold text-text leading-[1.45] overflow-hidden line-clamp-2 break-words"
                        >
                          {displayTitle}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] uppercase ${
                            isActive
                              ? 'border-iris/40 bg-iris/10 text-iris'
                              : 'border-muted/30 bg-transparent text-muted/70'
                          }`}
                        >
                          {isActive ? 'Active' : 'Draft'}
                        </span>
                      </div>
                    </div>

                    {previewText && (
                      <p className="text-sm text-muted/90 leading-relaxed line-clamp-2">
                        {previewText}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted/80">
                      <span className="flex items-center gap-1">
                        <svg
                          className="h-3.5 w-3.5 text-muted/70"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{dateLabel}</span>
                      </span>
                      <span className="text-muted/60">•</span>
                      <span>{timeLabel}</span>
                      {tagsToShow.length > 0 && (
                        <span className="text-muted/60">•</span>
                      )}
                      {tagsToShow.map(tag => (
                        <span
                          key={tag}
                          className="rounded-full border border-iris/40 bg-iris/10 px-2 py-0.5 text-[11px] font-medium text-iris"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-muted/20 space-y-2">
          <Button
            onClick={handleExportAll}
            variant="ghost"
            className="w-full justify-center rounded-lg border border-muted/25 bg-surface/40 text-sm text-text hover:bg-surface/55"
            disabled={drafts.length === 0}
          >
            Export All Drafts
          </Button>
          <Button
            onClick={handleClearAll}
            variant="ghost"
            className="w-full justify-center rounded-lg border border-love/40 bg-love/15 text-sm text-love hover:bg-love/25"
            disabled={drafts.length === 0}
          >
            Clear All Drafts
          </Button>
          <p className="text-xs text-muted text-center pt-1">
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
          </p>
        </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0">
        {currentDraft ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-muted/20 flex items-center justify-between bg-surface/30">
              <div className="flex-1 mr-4">
                <input
                  type="text"
                  aria-label="Draft title"
                  value={currentDraft.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="draft-focusable w-full bg-transparent text-2xl font-bold text-text placeholder-muted"
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
                        <Button
                          onClick={() => handleRemoveTag(tag)}
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 min-h-6 min-w-6 p-0 hover:text-love"
                          aria-label={`Remove tag ${tag}`}
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                    <input
                      type="text"
                      aria-label="Add tag"
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
                <Button
                  onClick={handleCopyDraft}
                  variant="ghost"
                  className="px-3 py-2 rounded-lg border border-overlay/40 bg-overlay/30 text-sm font-medium hover:bg-overlay/45 text-text"
                  title="Copy draft text to clipboard"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  onClick={handleExportDraft}
                  variant="ghost"
                  className="px-3 py-2 rounded-lg border border-overlay/40 bg-overlay/30 text-sm font-medium hover:bg-overlay/45 text-text"
                  title="Export draft as Markdown (.md)"
                >
                  Export .md
                </Button>
                <Button
                  onClick={() => setVersionHistoryOpen(true)}
                  variant="ghost"
                  className="px-4 py-2 rounded-lg border border-overlay/40 bg-overlay/30 text-sm font-medium hover:bg-overlay/45"
                  title="Version history"
                >
                  History
                </Button>
                <Button
                  onClick={() => setToolsPanelOpen(true)}
                  variant="ghost"
                  size="icon"
                  className="rounded-lg border border-overlay/40 bg-overlay/30 hover:bg-overlay/50 transition-colors"
                  aria-label="Open tools panel"
                  title="Tools (T)"
                >
                  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                    <path d="M9.67 5h4.67l.82 2.32a1.33 1.33 0 0 0 .82.82l2.32.82v4.67l-2.32.82a1.33 1.33 0 0 0-.82.82l-.82 2.32H9.67l-.82-2.32a1.33 1.33 0 0 0-.82-.82l-2.32-.82V9.66l2.32-.82a1.33 1.33 0 0 0 .82-.82Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                </Button>
              </div>
            </div>

            {/* Storage failure banner: drafts look saved by default, so a
                failed write must say so out loud. */}
            {persistError && (
              <div
                role="alert"
                className="px-4 py-2 text-xs bg-love/15 border-b border-love/30 text-love flex items-center justify-between gap-3"
              >
                <span>{persistError}</span>
                <Button
                  onClick={() => setPersistError(null)}
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-love/80 hover:text-love underline"
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* Editor area */}
            <div className="flex-1 flex overflow-hidden min-h-0">
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
                    <h3 className="text-sm font-semibold text-text mb-2">Writing Issues</h3>
                    <div className="space-y-1">
                      {grammarIssues.slice(0, 5).map((issue) => (
                        <div key={`${issue.startIndex}_${issue.message}`} className="text-xs text-muted bg-overlay/30 rounded px-2 py-1">
                          {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {prefs.keywordHighlighter && keywordFrequencies.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-text mb-2">Repeated Words</h3>
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
              <Button
                onClick={handleCreateDraft}
                variant="ghost"
                className="px-4 py-2 rounded-lg border border-foam/40 bg-foam/15 text-sm text-foam hover:bg-foam/25"
              >
                Create First Draft
              </Button>
            </div>
          </div>
        )}
        </div>
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
