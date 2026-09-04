import React, { useEffect, useState } from 'react';
import { getHints, markHint } from '../utils/storage';

// One line, shown on a first visit, never again. It marks itself as seen the
// moment it renders, so a reload does not bring it back.
const FirstRunHint: React.FC<{ mode: 'zen' | 'quote' }> = ({ mode }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (getHints().firstRun) return;
      markHint('firstRun');
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 25000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const touch = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const text = touch
    ? (mode === 'quote' ? 'Tap the quote to start. The gear opens settings.' : 'Type in the box below. The gear opens settings.')
    : 'Tab switches mode. Esc pauses. Ctrl+H lists the shortcuts.';

  return (
    <div className="first-run-hint" role="status">
      <span>{text}</span>
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss hint">×</button>
    </div>
  );
};

export default FirstRunHint;
