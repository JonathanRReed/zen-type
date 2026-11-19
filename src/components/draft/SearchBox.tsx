import React, { useState, useEffect, useRef } from 'react';
import { IconChevronDown, IconChevronUp, IconClose } from '../icons';

interface SearchBoxProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, caseSensitive: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  currentMatch: number;
  totalMatches: number;
}

// Find in the draft. Not modal: it floats over the page so the matches stay
// in sight while you step through them.
const SearchBox: React.FC<SearchBoxProps> = ({
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
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    onSearch(val, caseSensitive);
  };

  const handleCaseChange = (val: boolean) => {
    setCaseSensitive(val);
    onSearch(query, val);
  };

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

  const status = !query.trim()
    ? ''
    : totalMatches === 0
      ? 'No matches'
      : `${currentMatch + 1} of ${totalMatches}`;

  return (
    <div className="sheet draft-find" role="search" aria-label="Find in draft" data-draft-find="">
      <div className="draft-find-row">
        <input
          ref={inputRef}
          type="search"
          aria-label="Find in draft"
          enterKeyHint="search"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in this draft"
          className="field"
        />
        <button
          type="button"
          className="icon-btn"
          onClick={onPrevious}
          disabled={totalMatches === 0}
          aria-label="Previous match"
          title="Previous match (Shift+Enter)"
        >
          <IconChevronUp />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onNext}
          disabled={totalMatches === 0}
          aria-label="Next match"
          title="Next match (Enter)"
        >
          <IconChevronDown />
        </button>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close find">
          <IconClose />
        </button>
      </div>

      <div className="draft-find-row">
        <button
          type="button"
          className="btn btn-toggle"
          aria-pressed={caseSensitive}
          onClick={() => handleCaseChange(!caseSensitive)}
        >
          Match case
        </button>
        <p className="sheet-meta" role="status" aria-live="polite">{status}</p>
      </div>
    </div>
  );
};

export default SearchBox;
