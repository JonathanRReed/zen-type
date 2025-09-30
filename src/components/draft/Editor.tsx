import React, { useRef, useEffect, useCallback } from 'react';
import type { Draft } from '../../lib/draftStore';
import type { GrammarIssue } from '../../lib/grammar';
import type { SearchMatch } from '../../lib/textMetrics';

interface EditorProps {
  draft: Draft;
  onChange: (body: string) => void;
  grammarIssues: GrammarIssue[];
  searchMatches: SearchMatch[];
  currentMatchIndex: number;
  highlightedWords: Set<string>;
  onSelectionChange?: (start: number, end: number) => void;
}

export const Editor: React.FC<EditorProps> = ({
  draft,
  onChange,
  grammarIssues: _grammarIssues,
  searchMatches,
  currentMatchIndex,
  highlightedWords: _highlightedWords,
  onSelectionChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== draft.body) {
      textareaRef.current.value = draft.body;
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

  // Scroll to current search match
  useEffect(() => {
    if (searchMatches.length > 0 && currentMatchIndex >= 0 && textareaRef.current) {
      const match = searchMatches[currentMatchIndex];
      if (match) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(match.index, match.index + match.length);
      }
    }
  }, [searchMatches, currentMatchIndex]);

  // Public method to move caret to position
  useEffect(() => {
    const handleJumpTo = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.index === 'number' && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(detail.index, detail.index);
        textareaRef.current.scrollTop = detail.index / 10; // Rough scroll estimate
      }
    };

    window.addEventListener('draftJumpTo', handleJumpTo as EventListener);
    return () => {
      window.removeEventListener('draftJumpTo', handleJumpTo as EventListener);
    };
  }, []);

  return (
    <div className="relative h-full bg-base">
      <textarea
        ref={textareaRef}
        value={draft.body}
        onChange={handleChange}
        className="w-full h-full resize-none bg-base px-6 py-4 font-mono text-base text-text focus:outline-none leading-relaxed"
        placeholder="Start writing..."
        spellCheck={false}
        aria-label="Draft editor"
        style={{ color: 'var(--rp-text, #e0def4)' }}
      />
    </div>
  );
};

export default Editor;
