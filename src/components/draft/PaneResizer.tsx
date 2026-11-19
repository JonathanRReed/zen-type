import React from 'react';

interface PaneResizerProps {
  label: string;
  value: number;
  min: number;
  max: number;
  dragging: boolean;
  /** 1 when the pane grows to the right (outline), -1 when it grows left (scratchpad). */
  grows?: 1 | -1;
  onStart: () => void;
  onStep: (delta: number) => void;
}

// The drag edge between a side pane and the page. A focusable separator, so
// the arrow keys resize it too; it used to answer to the mouse only.
const PaneResizer: React.FC<PaneResizerProps> = ({ label, value, min, max, dragging, grows = 1, onStart, onStep }) => (
  // A focusable separator is a widget in ARIA; the a11y rules do not know that.
  // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    aria-valuenow={Math.round(value)}
    aria-valuemin={min}
    aria-valuemax={max}
    // eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex
    tabIndex={0}
    className={`pane-resize${dragging ? ' is-dragging' : ''}`}
    onPointerDown={(e) => {
      e.preventDefault();
      onStart();
    }}
    onKeyDown={(e) => {
      const step = e.shiftKey ? 48 : 16;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onStep(step * grows);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onStep(-step * grows);
      }
    }}
  />
);

export default PaneResizer;
