import React from 'react';
import type { OutlineItem } from '../../lib/textMetrics';
import { Button } from '@/components/ui/button';

interface OutlineProps {
  items: OutlineItem[];
  onItemClick: (startIndex: number) => void;
}

export const Outline: React.FC<OutlineProps> = ({ items, onItemClick }) => {
  if (items.length === 0) {
    return (
      <div className="p-4 text-sm text-muted/60 text-center">
        No outline items found. Add headings with # or structured paragraphs.
      </div>
    );
  }

  return (
    <nav className="p-4 space-y-1" aria-label="Document outline">
      {items.map((item, index) => (
        <Button
          key={index}
          onClick={() => onItemClick(item.startIndex)}
          variant="ghost"
          className={`w-full justify-start text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-overlay/40 focus-visible:ring-iris/40 ${
            item.level > 0 ? 'text-foam font-medium' : 'text-text/70'
          }`}
          style={{ paddingLeft: `${(item.level || 0) * 12 + 12}px` }}
        >
          <span className="line-clamp-2">{item.text}</span>
        </Button>
      ))}
    </nav>
  );
};

export default Outline;
