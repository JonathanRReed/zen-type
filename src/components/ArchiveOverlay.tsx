import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getArchive,
  updateArchiveEntry,
  type ArchiveEntry,
} from '../utils/storage';

// Overlay that shows Archive Browser and inline Editor for Zen Mode sessions
// Opens/closes via `toggleArchive` CustomEvent

type View = 'list' | 'editor';

const formatDateTime = (iso: string | undefined) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const ArchiveOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('list');
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

  const active = useMemo(() => entries.find(e => e.id === activeId) || null, [entries, activeId]);

  // Open/close handler
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as boolean | undefined;
      const next = typeof d === 'boolean' ? d : !open;
      if (next) {
        setEntries([...getArchive()].sort((a, b) => {
          const at = new Date(a.endedAt || a.startedAt).getTime();
          const bt = new Date(b.endedAt || b.startedAt).getTime();
          return bt - at;
        }));
        setView('list');
        setActiveId(null);
      }
      setOpen(next);
    };
    window.addEventListener('toggleArchive', handler as EventListener);
    return () => window.removeEventListener('toggleArchive', handler as EventListener);
  }, [open]);

  // Esc closes editor or overlay
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'editor') {
          setView('list');
          setActiveId(null);
        } else {
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, view]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-base/80 backdrop-blur-md relative"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-transparent"
        aria-label="Close archive overlay"
        onClick={() => setOpen(false)}
      />
      {view === 'list' && (
        <div className="relative z-10 glass rounded-2xl p-6 w-full max-w-3xl mx-4 max-h-[80vh] overflow-auto snap-y">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-sans text-foam">Archive</h2>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded bg-surface/60 border border-muted/20 text-text hover:bg-surface/80"
                onClick={() => setOpen(false)}
                aria-label="Close archive"
              >Close</button>
            </div>
          </div>
          {entries.length === 0 ? (
            <div className="text-muted">No sessions yet. Your next Zen session will be archived automatically.</div>
          ) : (
            <ul className="divide-y divide-muted/20">
              {entries.map((e) => (
                <li key={e.id} className="snap-item py-3 flex items-start justify-between">
                  <div className="min-w-0 pr-4">
                    <div className="text-text font-mono text-sm">{formatDateTime(e.startedAt)} → {formatDateTime(e.endedAt)}</div>
                    <div className="text-muted text-sm truncate">{e.text.slice(0, 120) || '—'}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs text-muted font-mono">{e.wordCount} words</div>
                    <button
                      className="px-3 py-1.5 rounded bg-iris/20 border border-iris/40 text-iris hover:bg-iris/30"
                      onClick={() => { setActiveId(e.id); setView('editor'); setTimeout(() => editorRef.current?.focus(), 0); }}
                      aria-label="Open editor"
                    >Open</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === 'editor' && active && (
        <div className="relative z-10 glass rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[86vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                className="px-3 py-1.5 rounded bg-surface/60 border border-muted/20 text-text hover:bg-surface/80"
                onClick={() => { setView('list'); setActiveId(null); }}
                aria-label="Back to archive list"
              >Back</button>
              <div className="text-xs text-muted font-mono">{formatDateTime(active.startedAt)} → {formatDateTime(active.endedAt)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded bg-foam/20 border border-foam/40 text-foam hover:bg-foam/30"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(editorRef.current?.innerText || '');
                    setCopyOk(true);
                    setTimeout(() => setCopyOk(false), 1500);
                  } catch {}
                }}
                aria-label="Copy to clipboard"
              >{copyOk ? 'Copied' : 'Copy'}</button>
              <button
                className="px-3 py-1.5 rounded bg-iris/20 border border-iris/40 text-iris hover:bg-iris/30"
                disabled={saving}
                onClick={async () => {
                  const text = editorRef.current?.innerText || '';
                  const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
                  const chars = text.length;
                  setSaving(true);
                  try {
                    updateArchiveEntry(active.id, { text, wordCount: words, charCount: chars, endedAt: active.endedAt || new Date().toISOString() });
                    // refresh list entry
                    setEntries(prev => prev.map(x => x.id === active.id ? { ...x, text, wordCount: words, charCount: chars } : x));
                  } finally {
                    setSaving(false);
                  }
                }}
                aria-label="Save changes"
              >{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>

          <div className="relative flex-1 overflow-auto">
            <div
              ref={editorRef}
              className="editor-panel glass rounded-xl p-6 min-h-[60vh] whitespace-pre-wrap outline-none focus:ring-2 focus:ring-iris/30"
              contentEditable
              suppressContentEditableWarning
              style={{ caretColor: 'var(--rp-iris)' }}
              spellCheck={false}
            >
              {active.text || ''}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveOverlay;
