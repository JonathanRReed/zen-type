// Find and replace component
import React, { useEffect, useRef, useState } from 'react';

interface FindReplaceProps {
  content: string;
  onReplace: (newContent: string) => void;
  onClose: () => void;
}

export const FindReplace: React.FC<FindReplaceProps> = ({ content, onReplace, onClose }) => {
  const findInputRef = useRef<HTMLInputElement>(null);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  useEffect(() => {
    findInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!findText) {
      setMatchCount(0);
      setCurrentMatch(0);
      return;
    }

    try {
      const pattern = useRegex ? findText : escapeRegex(findText);
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(pattern, flags);
      const matches = content.match(regex);
      setMatchCount(matches?.length || 0);
      setCurrentMatch(matches?.length ? 1 : 0);
    } catch (error) {
      // Invalid regex
      setMatchCount(0);
      setCurrentMatch(0);
    }
  }, [findText, content, useRegex, caseSensitive]);

  const escapeRegex = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const handleReplace = () => {
    if (!findText) return;

    try {
      const pattern = useRegex ? findText : escapeRegex(findText);
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(pattern, flags);
      const newContent = content.replace(regex, replaceText);
      onReplace(newContent);
      
      // Re-calculate matches
      const matches = newContent.match(regex);
      setMatchCount(matches?.length || 0);
    } catch (error) {
      console.error('Replace error:', error);
    }
  };

  const handleReplaceAll = () => {
    handleReplace();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Previous match
        setCurrentMatch(prev => Math.max(1, prev - 1));
      } else if (e.altKey) {
        // Replace all
        handleReplaceAll();
      } else {
        // Next match
        setCurrentMatch(prev => Math.min(matchCount, prev + 1));
      }
    }
  };

  return (
    <div className="find-replace fixed top-4 right-4 z-50 glass rounded-xl border border-muted/20 shadow-xl p-4 w-96">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text">Find & Replace</h3>
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface/60 text-muted hover:text-text"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <input
            ref={findInputRef}
            type="text"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find..."
            className="w-full px-3 py-1.5 bg-surface/60 border border-muted/20 rounded-lg outline-none focus:border-iris/40 text-sm"
          />
          {matchCount > 0 && (
            <div className="mt-1 text-xs text-muted">
              {currentMatch} of {matchCount} matches
            </div>
          )}
        </div>

        <div>
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Replace with..."
            className="w-full px-3 py-1.5 bg-surface/60 border border-muted/20 rounded-lg outline-none focus:border-iris/40 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="rounded"
            />
            <span>Case sensitive</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              className="rounded"
            />
            <span>Regex</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex-1 px-3 py-1.5 bg-surface/60 border border-muted/20 rounded-lg text-xs hover:bg-surface/80 transition-colors"
            onClick={handleReplace}
            disabled={!findText || matchCount === 0}
          >
            Replace
          </button>
          <button
            className="flex-1 px-3 py-1.5 bg-iris/20 border border-iris/40 rounded-lg text-xs text-iris hover:bg-iris/30 transition-colors"
            onClick={handleReplaceAll}
            disabled={!findText || matchCount === 0}
          >
            Replace All
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-muted/20 text-xs text-muted">
        <div>Enter: Next match</div>
        <div>Shift+Enter: Previous match</div>
        <div>Alt+Enter: Replace all</div>
      </div>
    </div>
  );
};
