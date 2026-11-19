import React, { useEffect, useState } from 'react';
import { getHints, markHint } from '../utils/storage';
import { IconClose } from './icons';

// One line, shown on a first visit, never again. It marks itself as seen the
// moment it renders, so a reload does not bring it back, and it leaves as
// soon as the first key lands.
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
    const hide = () => setVisible(false);
    const timer = window.setTimeout(hide, 20000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) hide();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!visible) return null;

  const touch = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
  const text = mode === 'quote'
    ? (touch ? 'Tap the quote and type it out.' : 'Just start typing. The clock starts on your first key.')
    : (touch ? 'Tap the line below and write.' : 'Just start writing. Each word drifts up when you finish it.');

  return (
    <div className="first-run-hint" role="status">
      <span>{text}</span>
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss hint">
        <IconClose width={14} height={14} />
      </button>
    </div>
  );
};

export default FirstRunHint;
