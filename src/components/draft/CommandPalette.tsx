import React, { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { OutlineItem } from '../../lib/textMetrics';

export interface DraftLine {
  text: string;
  /** Offset of the line's first character in the draft. */
  index: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  outlineItems: OutlineItem[];
  recentLines: DraftLine[];
  onJumpTo: (index: number) => void;
}

interface SearchItem {
  type: 'heading' | 'paragraph' | 'line';
  text: string;
  index: number;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  outlineItems,
  recentLines,
  onJumpTo,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    outlineItems.forEach(item => {
      items.push({
        type: item.level > 0 ? 'heading' : 'paragraph',
        text: item.text,
        index: item.startIndex,
      });
    });

    // Lines carry their real offset. They used to be given `position * 100`,
    // so choosing one put the caret somewhere unrelated.
    const seen = new Set(outlineItems.map(item => item.startIndex));
    recentLines.forEach(line => {
      if (seen.has(line.index)) return;
      items.push({
        type: 'line',
        text: line.text,
        index: line.index,
      });
    });

    return items;
  }, [outlineItems, recentLines]);

  const fuse = useMemo(
    () =>
      new Fuse(searchItems, {
        keys: ['text'],
        threshold: 0.3,
        includeScore: true,
      }),
    [searchItems]
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return searchItems.slice(0, 10);
    }
    return fuse.search(query).map(result => result.item).slice(0, 10);
  }, [query, fuse, searchItems]);

  useEffect(() => {
    if (!isOpen || !inputRef.current) {
      return undefined;
    }
    inputRef.current.focus();
    const timer = window.setTimeout(() => {
      setQuery('');
      setSelectedIndex(0);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Keep the highlighted option in view as the arrows move it.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`#cmd-palette-option-${selectedIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        onJumpTo(item.index);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleItemClick = (item: SearchItem) => {
    onJumpTo(item.index);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="overlay-backdrop overlay-top"
      role="dialog"
      aria-modal="true"
      aria-label="Jump to a heading or line"
    >
      <div className="overlay-dismiss" aria-hidden="true" onClick={onClose} />
      <div className="overlay-card sheet sheet-md jump-card">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Jump to heading or line"
          aria-autocomplete="list"
          aria-expanded={filteredItems.length > 0}
          aria-controls="cmd-palette-listbox"
          aria-activedescendant={filteredItems.length > 0 ? `cmd-palette-option-${selectedIndex}` : undefined}
          value={query}
          onChange={e => {
            setSelectedIndex(0);
            setQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a heading or line"
          className="jump-input"
        />

        {filteredItems.length === 0 ? (
          <p className="jump-empty">
            {searchItems.length === 0 ? 'Nothing to jump to yet. Headings and longer lines show up here.' : 'Nothing matches.'}
          </p>
        ) : (
          <ul ref={listRef} className="jump-list" role="listbox" id="cmd-palette-listbox" aria-label="Matching headings and lines">
            {filteredItems.map((item, index) => (
              <li
                key={`${item.type}_${item.index}_${index}`}
                id={`cmd-palette-option-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                tabIndex={-1}
                className={`jump-option${item.type === 'heading' ? ' is-heading' : ''}`}
                onClick={() => handleItemClick(item)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                onMouseMove={() => {
                  if (index !== selectedIndex) setSelectedIndex(index);
                }}
              >
                <span className="jump-text">{item.text}</span>
                <span className="jump-kind">{item.type === 'heading' ? 'Heading' : item.type === 'paragraph' ? 'Paragraph' : 'Line'}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="jump-foot" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
          <span><kbd>Enter</kbd> to jump</span>
          <span><kbd>Esc</kbd> to close</span>
        </p>
      </div>
    </div>
  );
};

export default CommandPalette;
