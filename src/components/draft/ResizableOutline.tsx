import React, { useState, useRef, useEffect } from 'react';
import type { OutlineItem } from '../../lib/textMetrics';

interface ResizableOutlineProps {
  items: OutlineItem[];
  onItemClick: (startIndex: number) => void;
  onClose: () => void;
}

export const ResizableOutline: React.FC<ResizableOutlineProps> = ({ items, onItemClick, onClose }) => {
  const [width, setWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const newWidth = e.clientX - (containerRef.current.getBoundingClientRect().left);
        setWidth(Math.max(200, Math.min(500, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="h-full border-r border-muted/20 bg-surface/30 flex flex-col relative"
      style={{ width: `${width}px` }}
    >
      <div className="p-3 border-b border-muted/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Outline</h3>
        <button
          onClick={onClose}
          className="text-muted hover:text-text transition-colors p-1"
          aria-label="Close outline"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm text-muted/60 text-center">
            No outline items found. Add headings with # or structured paragraphs.
          </div>
        ) : (
          <nav className="p-4 space-y-1" aria-label="Document outline">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => onItemClick(item.startIndex)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-overlay/40 focus:outline-none focus:ring-2 focus:ring-iris/40 ${
                  item.level > 0 ? 'text-foam font-medium' : 'text-text/70'
                }`}
                style={{ paddingLeft: `${(item.level || 0) * 12 + 12}px` }}
              >
                <span className="line-clamp-2">{item.text}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Resize handle */}
      <button
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-iris/40 transition-colors border-0 bg-transparent p-0"
        onMouseDown={() => setIsDragging(true)}
        aria-label="Resize outline panel"
        type="button"
      />
    </div>
  );
};

export default ResizableOutline;
