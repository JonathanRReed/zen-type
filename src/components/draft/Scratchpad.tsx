import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface ScratchpadProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export const Scratchpad: React.FC<ScratchpadProps> = ({ value, onChange, onClose }) => {
  const [width, setWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current?.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
        setWidth(Math.max(300, Math.min(800, newWidth)));
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
      className="h-full bg-surface/30 backdrop-blur-sm border-l border-muted/20 flex flex-col relative"
      style={{ width: `${width}px` }}
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-iris/40 transition-colors z-10 border-0 bg-transparent p-0"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        aria-label="Resize scratchpad"
      />

      <div className="p-3 border-b border-muted/20 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foam">Scratchpad</h3>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-muted hover:text-text transition-colors"
          aria-label="Close scratchpad"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Button>
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex-1 resize-none bg-transparent px-4 py-3 font-mono text-sm text-text focus:outline-none"
        placeholder="Quick notes, ideas, snippets..."
        spellCheck={false}
        aria-label="Scratchpad textarea"
        style={{ color: 'var(--rp-text, #e0def4)' }}
      />
    </div>
  );
};

export default Scratchpad;
