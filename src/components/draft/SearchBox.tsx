import React, { useState, useEffect, useRef } from 'react';

interface SearchBoxProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, caseSensitive: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  currentMatch: number;
  totalMatches: number;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  isOpen,
  onClose,
  onSearch,
  onNext,
  onPrevious,
  currentMatch,
  totalMatches,
}) => {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    onSearch(query, caseSensitive);
  }, [query, caseSensitive, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevious();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-surface/95 backdrop-blur-sm border border-muted/20 rounded-lg shadow-xl p-4 w-80">
      <div className="flex items-center gap-2 mb-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in draft..."
          className="flex-1 px-3 py-2 bg-overlay/40 border border-muted/20 rounded-lg text-sm text-text placeholder-muted/60 focus:outline-none focus:border-iris/40 focus:ring-1 focus:ring-iris/40"
        />
        <button
          onClick={onClose}
          className="text-muted hover:text-text transition-colors p-2"
          aria-label="Close search"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={e => setCaseSensitive(e.target.checked)}
            className="w-3 h-3 rounded border-muted/40 bg-overlay/40 text-iris focus:ring-iris/40"
          />
          <span>Case sensitive</span>
        </label>

        <div className="flex items-center gap-2">
          {totalMatches > 0 && (
            <span className="text-xs text-muted">
              {currentMatch + 1} / {totalMatches}
            </span>
          )}
          <button
            onClick={onPrevious}
            disabled={totalMatches === 0}
            className="p-1.5 bg-overlay/40 hover:bg-overlay/60 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous match"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={onNext}
            disabled={totalMatches === 0}
            className="p-1.5 bg-overlay/40 hover:bg-overlay/60 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next match"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-muted/20 text-xs text-muted/60">
        <div className="flex justify-between">
          <span>Enter: Next</span>
          <span>Shift+Enter: Previous</span>
        </div>
      </div>
    </div>
  );
};

export default SearchBox;
