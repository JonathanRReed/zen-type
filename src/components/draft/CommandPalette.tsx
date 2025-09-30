import React, { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import type { OutlineItem } from '../../lib/textMetrics';
import { Button } from '@/components/ui/button';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  outlineItems: OutlineItem[];
  recentLines: string[];
  onJumpTo: (index: number) => void;
}

interface SearchItem {
  type: 'heading' | 'line';
  text: string;
  index: number;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  outlineItems,
  recentLines,
  onJumpTo,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    outlineItems.forEach(item => {
      items.push({
        type: 'heading',
        text: item.text,
        index: item.startIndex,
      });
    });

    recentLines.forEach((line, idx) => {
      items.push({
        type: 'line',
        text: line,
        index: idx * 100, // Approximate index
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
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
      className="fixed inset-0 z-[60] bg-base/80 backdrop-blur-sm flex items-start justify-center pt-32"
      role="dialog"
      aria-modal="true"
      aria-label="Quick jump palette"
    >
      <div
        className="w-full max-w-2xl bg-surface/95 border border-muted/20 rounded-xl shadow-2xl overflow-hidden"
        role="document"
      >
        <div className="p-4 border-b border-muted/20">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to heading or line..."
            className="w-full bg-transparent text-lg text-text placeholder-muted/60 focus:outline-none"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-muted/60">No results found</div>
          ) : (
            <div className="p-2">
              {filteredItems.map((item, index) => (
                <Button
                  key={index}
                  onClick={() => handleItemClick(item)}
                  variant="ghost"
                  className={`w-full justify-start text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                    index === selectedIndex
                      ? 'bg-iris/20 text-iris'
                      : 'hover:bg-overlay/40 text-text/80'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-medium ${
                      item.type === 'heading'
                        ? 'bg-foam/20 text-foam'
                        : 'bg-muted/20 text-muted'
                    }`}
                  >
                    {item.type === 'heading' ? '#' : 'L'}
                  </div>
                  <span className="flex-1 truncate text-sm">{item.text}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-muted/20 flex items-center gap-4 text-xs text-muted/60">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
