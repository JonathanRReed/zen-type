import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import '../../styles/drafts.css';
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
  setActiveDraftId,
  getActiveDraftId,
  type Draft,
  type DraftPrefs,
} from '../../lib/draftStore';
import { computeTextMetrics, extractOutline, getKeywordFrequencies, findInText, getDraftPreview, extractRecentLinesWithOffsets, type SearchMatch } from '../../lib/textMetrics';
import { checkGrammar } from '../../lib/grammar';
import Editor from './Editor';
import ToolsPanel from './ToolsPanel';
import ResizableOutline from './ResizableOutline';
import CommandPalette, { type DraftLine } from './CommandPalette';
import SearchBox from './SearchBox';
import VersionHistory from './VersionHistory';
import Scratchpad from './Scratchpad';
import { IconCheck, IconClose, IconCopy, IconDownload, IconHistory, IconPlus, IconSearch, IconSliders } from '../icons';

interface DraftManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DraftManager: React.FC<DraftManagerProps> = ({ isOpen, onClose }) => {
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
    setPersistError('Could not save. This browser is blocking storage, or it is full. Your text is still on screen, so copy it somewhere safe.');
  }, []);

  const loadDrafts = useCallback(async () => {
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
      // A sheet open on top (tools, history) traps Tab itself and has already
      // moved focus; do not move it a second time.
      if (e.key !== 'Tab' || !overlay || e.defaultPrevented) return;
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

  // Refresh the list and the active draft every 2 seconds while open, so a
  // Zen session autosaving in the background shows up without a reopen.
  useEffect(() => {
    if (!isOpen) return;

    const syncInterval = setInterval(() => {
      getAllDrafts()
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
    const draft = await createDraft('');
    setDrafts(prev => [draft, ...prev]);
    setCurrentDraft(draft);
    // Set this as the active draft for zen mode
    setActiveDraftId(draft.id);
    window.setTimeout(() => {
      overlayRef.current?.querySelector<HTMLInputElement>('input[aria-label="Draft title"]')?.focus();
    }, 0);
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
    if (!confirm(`Delete all ${drafts.length} ${drafts.length === 1 ? 'draft' : 'drafts'}? This cannot be undone.`)) return;
    
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

  // Update preferences
  const handlePrefsChange = useCallback((updates: Partial<DraftPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...updates };
      return next;
    });
    const current = getDraftPrefs();
    saveDraftPrefs({ ...current, ...updates });
  }, []);

  // Derived text work is keyed on the body, not on `currentDraft`. Changing
  // the title, tags, scratchpad, snapshots or sync timestamps makes a new
  // draft object, and none of that should re-run metrics, grammar checks,
  // outline extraction, keyword counts or search over unchanged text.
  const draftBody = currentDraft?.body;

  const metrics = useMemo(() => {
    return draftBody !== undefined ? computeTextMetrics(draftBody) : null;
  }, [draftBody]);

  const outline = useMemo(() => {
    return draftBody && prefs.outline ? extractOutline(draftBody) : [];
  }, [draftBody, prefs.outline]);

  const grammarIssues = useMemo(() => {
    return draftBody && prefs.grammar ? checkGrammar(draftBody) : [];
  }, [draftBody, prefs.grammar]);

  const keywordFrequencies = useMemo(() => {
    return draftBody && prefs.keywordHighlighter ? getKeywordFrequencies(draftBody) : [];
  }, [draftBody, prefs.keywordHighlighter]);

  const highlightedWords = useMemo(() => new Set(keywordFrequencies.map(kf => kf.word)), [keywordFrequencies]);

  const searchMatches = useMemo(() => {
    if (!draftBody || !searchQuery.trim()) return [];
    return findInText(draftBody, searchQuery, searchCaseSensitive);
  }, [draftBody, searchQuery, searchCaseSensitive]);

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

  // Only needed while the jump palette is open, so a closed palette costs
  // nothing per keystroke. Each line keeps its real offset in the draft.
  const recentLines = useMemo<DraftLine[]>(() => {
    if (!draftBody || !commandPaletteOpen || !prefs.quickJump) return [];
    return extractRecentLinesWithOffsets(draftBody);
  }, [draftBody, commandPaletteOpen, prefs.quickJump]);

  const closeTools = useCallback(() => setToolsPanelOpen(false), []);
  const closeHistory = useCallback(() => setVersionHistoryOpen(false), []);
  const closeCommandPalette = useCallback(() => setCommandPaletteOpen(false), []);

  // Closing the find bar hands the page back with the current match
  // selected, so you land where you were looking.
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    const match = searchMatches[currentSearchIndex];
    if (match) {
      window.dispatchEvent(new CustomEvent('draftJumpTo', { detail: { index: match.index, length: match.length } }));
    } else {
      overlayRef.current?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Draft editor"]')?.focus();
    }
  }, [searchMatches, currentSearchIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return undefined;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const userAgent = navigator.userAgent?.toLowerCase() ?? '';
      const isMac = userAgent.includes('mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        // Escape closes the topmost thing: the jump palette, version history,
        // the tools, the find bar, and only then the drafts screen. Stop the
        // event either way: the page-level Escape handler would otherwise
        // open the pause menu on top of the still-open screen. (The palette
        // and find bar used to be left to close themselves, which only worked
        // while their own field had focus; anywhere else Escape did nothing.)
        e.preventDefault();
        e.stopPropagation();
        if (commandPaletteOpen) {
          closeCommandPalette();
        } else if (versionHistoryOpen) {
          setVersionHistoryOpen(false);
        } else if (toolsPanelOpen) {
          setToolsPanelOpen(false);
        } else if (searchOpen) {
          closeSearch();
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
        if (searchOpen) closeSearch();
        else setSearchOpen(true);
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
  }, [isOpen, handleManualSnapshot, commandPaletteOpen, searchOpen, versionHistoryOpen, toolsPanelOpen, onClose, closeSearch, closeCommandPalette, prefs.quickJump, prefs.search]);


  if (!isOpen) return null;

  const listDate = (ts: number) => {
    const d = new Date(ts);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    const day = d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${day}, ${time}`;
  };

  const showNotes = (prefs.grammar && grammarIssues.length > 0) || (prefs.keywordHighlighter && keywordFrequencies.length > 0);

  return (
    <div ref={overlayRef} tabIndex={-1} className="drafts-screen" role="dialog" aria-modal="true" aria-labelledby="drafts-title">
      <div className="drafts-layout">
        {/* The list of drafts */}
        <div className="drafts-side">
          <div className="drafts-side-head">
            <h2 id="drafts-title" className="drafts-side-title">Notes and drafts</h2>
            <button type="button" className="sheet-close" onClick={onClose} aria-label="Close notes and drafts">
              <IconClose />
            </button>
          </div>

          <button type="button" className="btn btn-outline btn-block drafts-new" onClick={handleCreateDraft}>
            <IconPlus />
            New draft
          </button>

          {drafts.length === 0 ? (
            <p className="drafts-empty">Nothing here yet. Words you type in Zen mode are kept here, or start a new draft.</p>
          ) : (
            <ul className="drafts-list" aria-label="Drafts">
              {drafts.map(draft => {
                const isActive = currentDraft?.id === draft.id;
                const displayTitle = draft.title.trim() || 'Untitled';
                const previewText = getDraftPreview(draft.body);
                const tagsToShow = draft.tags.slice(0, 2);

                return (
                  <li key={draft.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectDraft(draft.id)}
                      className="draft-item"
                      aria-current={isActive ? 'true' : undefined}
                    >
                      <span className="draft-item-title" title={displayTitle}>{displayTitle}</span>
                      {previewText && <span className="draft-item-preview">{previewText}</span>}
                      <span className="draft-item-meta">
                        {listDate(draft.updatedAt)}
                        {tagsToShow.length > 0 && `, tagged ${tagsToShow.join(', ')}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="drafts-side-foot">
            <button type="button" className="btn" onClick={handleExportAll} disabled={drafts.length === 0}>
              Export all
            </button>
            <button type="button" className="btn btn-danger" onClick={handleClearAll} disabled={drafts.length === 0}>
              Delete all drafts
            </button>
            <p className="sheet-meta">{drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'}</p>
          </div>
        </div>

        {/* The page */}
        <div className="drafts-main">
          {currentDraft ? (
            <>
              <div className="drafts-bar">
                {prefs.counters && metrics ? (
                  <p className="drafts-count">
                    <b>{metrics.words.toLocaleString()}</b> {metrics.words === 1 ? 'word' : 'words'}
                    <span className="drafts-count-more">, <b>{metrics.chars.toLocaleString()}</b> characters</span>
                    {prefs.readTime && metrics.words > 0 && (
                      <span className="drafts-count-more">, <b>{metrics.readTimeMinutes}</b> min to read</span>
                    )}
                  </p>
                ) : <span />}
                <div className="drafts-actions">
                  {prefs.search && (
                    <button
                      type="button"
                      className="act"
                      onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                      aria-pressed={searchOpen}
                      title="Find in draft (Ctrl+F)"
                    >
                      <IconSearch />
                      <span>Find</span>
                    </button>
                  )}
                  <button type="button" className="act" onClick={handleCopyDraft} title="Copy the text of this draft">
                    {copied ? <IconCheck /> : <IconCopy />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button type="button" className="act" onClick={handleExportDraft} title="Download as a Markdown file">
                    <IconDownload />
                    <span>Download</span>
                  </button>
                  <button type="button" className="act" onClick={() => setVersionHistoryOpen(true)} title="Earlier versions of this draft">
                    <IconHistory />
                    <span>History</span>
                  </button>
                  <button
                    type="button"
                    className="act"
                    onClick={() => setToolsPanelOpen(true)}
                    aria-label="Writing tools"
                    title="Writing tools (T)"
                  >
                    <IconSliders />
                    <span>Tools</span>
                  </button>
                </div>
              </div>

              {/* Storage failure: drafts look saved by default, so a failed
                  write must say so out loud. */}
              {persistError && (
                <div role="alert" className="drafts-alert">
                  <p>{persistError}</p>
                  <button type="button" className="sheet-close" onClick={() => setPersistError(null)} aria-label="Dismiss">
                    <IconClose />
                  </button>
                </div>
              )}

              <div className="drafts-body">
                {prefs.outline && (
                  <ResizableOutline
                    items={outline}
                    onItemClick={handleJumpTo}
                    onClose={() => handlePrefsChange({ outline: false })}
                  />
                )}

                <div className="draft-column">
                  <div className="draft-head">
                    <input
                      type="text"
                      aria-label="Draft title"
                      value={currentDraft.title}
                      onChange={e => handleTitleChange(e.target.value)}
                      className="draft-title"
                      placeholder="Untitled"
                    />
                    {prefs.tags && (
                      <div className="draft-tags">
                        {currentDraft.tags.map(tag => (
                          <span key={tag} className="draft-tag">
                            {tag}
                            <button type="button" onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>
                              <IconClose />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          aria-label="Add a tag"
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                          placeholder="Add a tag"
                          enterKeyHint="done"
                          className="draft-tag-input"
                        />
                      </div>
                    )}
                  </div>

                  <Editor
                    draft={currentDraft}
                    onChange={handleBodyChange}
                    grammarIssues={grammarIssues}
                    searchMatches={searchOpen ? searchMatches : NO_MATCHES}
                    currentMatchIndex={currentSearchIndex}
                    highlightedWords={highlightedWords}
                  />

                  {showNotes && (
                    <div className="draft-notes">
                      <div className="draft-notes-inner">
                        {prefs.grammar && grammarIssues.length > 0 && (
                          <section aria-labelledby="draft-notes-writing">
                            <h3 id="draft-notes-writing">Writing notes</h3>
                            <ul>
                              {grammarIssues.slice(0, 5).map(issue => (
                                <li key={`${issue.startIndex}_${issue.message}`}>{issue.message}</li>
                              ))}
                            </ul>
                          </section>
                        )}
                        {prefs.keywordHighlighter && keywordFrequencies.length > 0 && (
                          <section aria-labelledby="draft-notes-repeated">
                            <h3 id="draft-notes-repeated">Repeated words</h3>
                            <ul className="repeated-words">
                              {keywordFrequencies.map(kf => (
                                <li key={kf.word}>
                                  {kf.word}
                                  <b>{kf.count}<span className="sr-only"> times</span></b>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {prefs.scratchpad && (
                  <Scratchpad
                    value={currentDraft.scratchpad || ''}
                    onChange={handleScratchpadChange}
                    onClose={() => handlePrefsChange({ scratchpad: false })}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="drafts-blank">
              <p>{drafts.length === 0 ? 'A blank page.' : 'Pick a draft from the list, or start a new one.'}</p>
              <button type="button" className="btn btn-primary" onClick={handleCreateDraft}>
                <IconPlus />
                New draft
              </button>
            </div>
          )}
        </div>
      </div>

      <ToolsPanel
        isOpen={toolsPanelOpen}
        onClose={closeTools}
        prefs={prefs}
        onPrefsChange={handlePrefsChange}
      />

      {prefs.quickJump && (
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={closeCommandPalette}
          outlineItems={outline}
          recentLines={recentLines}
          onJumpTo={handleJumpTo}
        />
      )}

      {prefs.search && (
        <SearchBox
          isOpen={searchOpen}
          onClose={closeSearch}
          onSearch={handleSearch}
          onNext={handleNextMatch}
          onPrevious={handlePreviousMatch}
          currentMatch={currentSearchIndex}
          totalMatches={searchMatches.length}
        />
      )}

      {currentDraft && (
        <VersionHistory
          // A fresh instance per opening, so a half-finished restore does not
          // greet you the next time.
          key={versionHistoryOpen ? 'open' : 'closed'}
          isOpen={versionHistoryOpen}
          onClose={closeHistory}
          snapshots={currentDraft.snapshots}
          currentBody={currentDraft.body}
          onRestore={handleRestoreSnapshot}
        />
      )}
    </div>
  );
};

const NO_MATCHES: SearchMatch[] = [];


export default DraftManager;
