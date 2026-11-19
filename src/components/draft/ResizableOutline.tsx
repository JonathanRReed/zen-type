import React, { useState, useRef, useEffect } from 'react';
import type { OutlineItem } from '../../lib/textMetrics';
import { IconClose } from '../icons';
import PaneResizer from './PaneResizer';

interface ResizableOutlineProps {
  items: OutlineItem[];
  onItemClick: (startIndex: number) => void;
  onClose: () => void;
}

const MIN = 200;
const MAX = 500;

const ResizableOutline: React.FC<ResizableOutlineProps> = ({ items, onItemClick, onClose }) => {
  const [width, setWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (containerRef.current) {
        const newWidth = e.clientX - containerRef.current.getBoundingClientRect().left;
        setWidth(Math.max(MIN, Math.min(MAX, newWidth)));
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  return (
    <aside
      ref={containerRef}
      className="draft-pane draft-pane-start"
      style={{ '--pane-w': `${width}px` } as React.CSSProperties}
      aria-labelledby="draft-outline-title"
    >
      <div className="draft-pane-head">
        <h3 id="draft-outline-title" className="draft-pane-title">Outline</h3>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close outline">
          <IconClose />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="draft-pane-note">
          Start a line with <code>#</code> to make a heading. Short paragraphs that end in a full stop show up here too.
        </p>
      ) : (
        <nav aria-label="Outline">
          <ul className="outline-list">
            {items.map((item) => (
              <li key={`${item.startIndex}_${item.text}`}>
                <button
                  type="button"
                  onClick={() => onItemClick(item.startIndex)}
                  className={`outline-item${item.level > 0 ? ' is-heading' : ''}`}
                  style={{ '--depth': Math.max(0, item.level - 1) } as React.CSSProperties}
                >
                  <span>{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <PaneResizer
        label="Resize outline"
        value={width}
        min={MIN}
        max={MAX}
        dragging={isDragging}
        onStart={() => setIsDragging(true)}
        onStep={delta => setWidth(w => Math.max(MIN, Math.min(MAX, w + delta)))}
      />
    </aside>
  );
};

export default ResizableOutline;
