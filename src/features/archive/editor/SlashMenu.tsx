// Slash menu component for block insertion
import React, { useEffect, useRef, useState } from 'react';
import { BlockType } from './markdown';

interface SlashMenuProps {
  position: { x: number; y: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

interface MenuItem {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
}

const menuItems: MenuItem[] = [
  { type: 'paragraph', label: 'Text', icon: 'T', description: 'Plain text paragraph' },
  { type: 'heading', label: 'Heading 1', icon: 'H1', description: 'Large heading' },
  { type: 'heading', label: 'Heading 2', icon: 'H2', description: 'Medium heading' },
  { type: 'heading', label: 'Heading 3', icon: 'H3', description: 'Small heading' },
  { type: 'list', label: 'Bullet List', icon: '•', description: 'Unordered list' },
  { type: 'list', label: 'Numbered List', icon: '1.', description: 'Ordered list' },
  { type: 'checklist', label: 'Checklist', icon: '[]', description: 'Task list with checkboxes' },
  { type: 'quote', label: 'Quote', icon: '"', description: 'Blockquote' },
  { type: 'code', label: 'Code Block', icon: '<>', description: 'Code with syntax highlighting' },
  { type: 'divider', label: 'Divider', icon: '-', description: 'Horizontal line' },
];

export const SlashMenu: React.FC<SlashMenuProps> = ({ position, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filter, setFilter] = useState('');
  
  const filteredItems = menuItems.filter(item =>
    item.label.toLowerCase().includes(filter.toLowerCase()) ||
    item.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(filteredItems.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            const item = filteredItems[selectedIndex];
            // Handle heading levels
            if (item.label.includes('Heading')) {
              const level = parseInt(item.label.slice(-1)) as 1 | 2 | 3;
              onSelect('heading' as BlockType);
            } else {
              onSelect(item.type);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Backspace':
          if (filter === '') {
            onClose();
          } else {
            setFilter(prev => prev.slice(0, -1));
          }
          break;
        default:
          if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            setFilter(prev => prev + e.key);
          }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedIndex, filteredItems, filter, onSelect, onClose]);

  return (
    <div
      ref={menuRef}
      className="slash-menu fixed z-50 glass rounded-xl border border-muted/20 shadow-lg overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '280px',
        maxHeight: '320px'
      }}
    >
      {filter && (
        <div className="px-3 py-2 border-b border-muted/20 text-xs text-muted">
          Searching: {filter}
        </div>
      )}
      
      <div className="py-2 overflow-y-auto max-h-[280px]">
        {filteredItems.map((item, index) => (
          <button
            key={`${item.type}-${item.label}`}
            className={`
              w-full px-3 py-2 flex items-center gap-3 hover:bg-surface/60 transition-colors
              ${index === selectedIndex ? 'bg-iris/10 text-iris' : 'text-text'}
            `}
            onClick={() => {
              if (item.label.includes('Heading')) {
                const level = parseInt(item.label.slice(-1)) as 1 | 2 | 3;
                onSelect('heading' as BlockType);
              } else {
                onSelect(item.type);
              }
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="w-6 h-6 flex items-center justify-center text-sm font-mono opacity-60">
              {item.icon}
            </span>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{item.label}</div>
              <div className="text-xs text-muted">{item.description}</div>
            </div>
          </button>
        ))}
      </div>
      
      {filteredItems.length === 0 && (
        <div className="px-3 py-8 text-center text-sm text-muted">
          No matching commands
        </div>
      )}
    </div>
  );
};
