import React, { useState, useRef, useEffect } from 'react';
import { IconClose } from '../icons';
import PaneResizer from './PaneResizer';

interface ScratchpadProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

const MIN = 300;
const MAX = 800;

const Scratchpad: React.FC<ScratchpadProps> = ({ value, onChange, onClose }) => {
  const [width, setWidth] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current?.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        const newWidth = rect.right - e.clientX;
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
      className="draft-pane draft-pane-end"
      style={{ '--pane-w': `${width}px` } as React.CSSProperties}
      aria-labelledby="draft-scratchpad-title"
    >
      <PaneResizer
        label="Resize scratchpad"
        value={width}
        min={MIN}
        max={MAX}
        grows={-1}
        dragging={isDragging}
        onStart={() => setIsDragging(true)}
        onStep={delta => setWidth(w => Math.max(MIN, Math.min(MAX, w + delta)))}
      />

      <div className="draft-pane-head">
        <h3 id="draft-scratchpad-title" className="draft-pane-title">Scratchpad</h3>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close scratchpad">
          <IconClose />
        </button>
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        className="scratchpad-text"
        placeholder="Notes to yourself. Kept with this draft, never part of it."
        spellCheck={false}
        aria-label="Scratchpad"
      />
    </aside>
  );
};

export default Scratchpad;
