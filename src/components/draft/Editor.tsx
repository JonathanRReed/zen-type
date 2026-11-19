import React, { useRef, useEffect, useCallback } from 'react';
import type { Draft } from '../../lib/draftStore';
import type { GrammarIssue } from '../../lib/grammar';
import type { SearchMatch } from '../../lib/textMetrics';
import { audio } from '../../utils/audio';

interface EditorProps {
  draft: Draft;
  onChange: (body: string) => void;
  grammarIssues: GrammarIssue[];
  /** Matches for the find bar. Empty while the find bar is closed. */
  searchMatches: SearchMatch[];
  currentMatchIndex: number;
  highlightedWords: Set<string>;
  onSelectionChange?: (start: number, end: number) => void;
}

/** The text of the marks layer: the draft with every find match wrapped. */
function renderMarks(body: string, matches: SearchMatch[], current: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.index < cursor) return;
    out.push(body.slice(cursor, m.index));
    out.push(
      <mark key={m.index} className={i === current ? 'is-current' : undefined}>
        {body.slice(m.index, m.index + m.length)}
      </mark>,
    );
    cursor = m.index + m.length;
  });
  // A trailing newline in a textarea still takes a line; give the copy one too.
  out.push(`${body.slice(cursor)}\n`);
  return out;
}

const Editor: React.FC<EditorProps> = ({
  draft,
  onChange,
  grammarIssues: _grammarIssues,
  searchMatches,
  currentMatchIndex,
  highlightedWords: _highlightedWords,
  onSelectionChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const marksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      // Only update if draft changed AND the textarea doesn't have focus
      const isActive = document.activeElement === textareaRef.current;
      if (!isActive && textareaRef.current.value !== draft.body) {
        textareaRef.current.value = draft.body;
      }
    }
  }, [draft.id, draft.body]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleSelectionChange = useCallback(() => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    onSelectionChange?.(start, end);
  }, [onSelectionChange]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener('select', handleSelectionChange);
    textarea.addEventListener('click', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);

    return () => {
      textarea.removeEventListener('select', handleSelectionChange);
      textarea.removeEventListener('click', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const syncMarksScroll = useCallback(() => {
    if (marksRef.current && textareaRef.current) {
      marksRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Where a character offset sits vertically in the text, measured on the
  // marks layer, which wraps exactly like the textarea.
  const offsetTop = useCallback((index: number): number | null => {
    const layer = marksRef.current;
    if (!layer) return null;
    const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    let remaining = index;
    let node = walker.nextNode() as Text | null;
    while (node) {
      const len = node.data.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.setEnd(node, Math.min(len, remaining + 1));
        // Layout is not always available (a detached tree, a test DOM).
        if (typeof range.getClientRects !== 'function') return null;
        const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
        const box = layer.getBoundingClientRect();
        return rect.top - box.top + layer.scrollTop;
      }
      remaining -= len;
      node = walker.nextNode() as Text | null;
    }
    return null;
  }, []);

  const scrollToOffset = useCallback((index: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const y = offsetTop(index);
    if (y === null) return;
    textarea.scrollTop = Math.max(0, y - textarea.clientHeight / 3);
    syncMarksScroll();
  }, [offsetTop, syncMarksScroll]);

  // Keep the current find match in view. The find field keeps focus while
  // you type and step through matches; the marks layer shows where they are.
  // (This used to focus the textarea and select the match on every change,
  // which pulled focus out of the find field after one letter and, once a
  // search had run, re-selected the match after every keystroke in the draft.)
  const match = searchMatches[currentMatchIndex];
  const matchIndex = match?.index;
  const matchLength = match?.length ?? 0;
  useEffect(() => {
    if (matchIndex === undefined) return;
    // While the find field has focus, park the selection on the match so
    // closing find leaves the caret there. Never while the draft itself is
    // being typed in: that would move the caret under the typist.
    const textarea = textareaRef.current;
    if (textarea && document.activeElement !== textarea) {
      textarea.setSelectionRange(matchIndex, matchIndex + matchLength);
    }
    scrollToOffset(matchIndex);
  }, [matchIndex, matchLength, scrollToOffset]);

  // Move the caret (or select a range) and bring it into view. Sent by the
  // outline, the jump palette, and the find bar when it closes.
  useEffect(() => {
    const handleJumpTo = (e: Event) => {
      const detail = (e as CustomEvent<{ index?: number; length?: number }>).detail;
      const textarea = textareaRef.current;
      if (!detail || typeof detail.index !== 'number' || !textarea) return;
      const start = Math.max(0, Math.min(detail.index, textarea.value.length));
      const end = Math.min(textarea.value.length, start + (detail.length ?? 0));
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(start, end);
      scrollToOffset(start);
    };

    window.addEventListener('draftJumpTo', handleJumpTo as EventListener);
    return () => {
      window.removeEventListener('draftJumpTo', handleJumpTo as EventListener);
    };
  }, [scrollToOffset]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key !== 'Escape') {
      audio.keyDown(e.key, { repeat: e.repeat });
    }
  };
  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    audio.keyUp(e.key);
  };

  return (
    <div className="draft-editor">
      <div ref={marksRef} className="draft-editor-marks" aria-hidden="true">
        {renderMarks(draft.body, searchMatches, currentMatchIndex)}
      </div>
      <textarea
        ref={textareaRef}
        defaultValue={draft.body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onScroll={syncMarksScroll}
        className="draft-editor-text"
        placeholder="Start writing"
        spellCheck={false}
        aria-label="Draft editor"
      />
    </div>
  );
};

export default Editor;
