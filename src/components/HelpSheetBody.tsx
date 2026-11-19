// The help sheet's markup. Behind the dynamic import in HelpSheet.tsx, so none
// of this reaches the browser until the sheet is primed or asked for.
import React, { useEffect, useRef } from 'react';
import { useModal } from '../hooks/useModal';
import { IconClose } from './icons';

interface HelpSheetBodyProps {
  /** Owned by the shell, which keeps the `toggleHelp` and Ctrl+H listeners eager. */
  open: boolean;
  onClose: () => void;
}

const GROUPS: ReadonlyArray<{ title: string; keys: ReadonlyArray<{ combo: string[]; does: string }> }> = [
  {
    title: 'Anywhere',
    keys: [
      { combo: ['Tab'], does: 'Switch between Quote and Zen' },
      { combo: ['Shift', 'Tab'], does: 'Leave the typing field for the page controls' },
      { combo: ['Esc'], does: 'Open or close the menu' },
      { combo: ['Ctrl', 'D'], does: 'Notes and drafts' },
      { combo: ['Ctrl', 'P'], does: 'Progress' },
      { combo: ['Ctrl', 'M'], does: 'Sound on or off' },
      { combo: ['Ctrl', 'H'], does: 'This list' },
    ],
  },
  {
    title: 'Quote mode',
    keys: [
      { combo: ['Backspace'], does: 'Go back to your last mistake' },
      { combo: ['Enter'], does: 'Next quote, once you have finished one' },
    ],
  },
  {
    title: 'Zen mode',
    keys: [
      { combo: ['Space'], does: 'Send the word up. Punctuation does it too' },
      { combo: ['Enter'], does: 'Send the word up and start a new line in the draft' },
    ],
  },
];

const HelpSheetBody = React.memo(({ open, onClose }: HelpSheetBodyProps) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModal(backdropRef, onClose, open);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div ref={backdropRef} className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="overlay-dismiss" aria-hidden="true" onClick={onClose} />
      <div className="overlay-card sheet">
        <div className="sheet-head">
          <h2 id="help-title" className="sheet-title">Keyboard shortcuts</h2>
          <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="Close shortcuts">
            <IconClose />
          </button>
        </div>
        {GROUPS.map(group => (
          <section key={group.title} className="settings-group">
            <h3>{group.title}</h3>
            <ul className="keys">
              {group.keys.map(key => (
                <li key={key.combo.join('+')}>
                  <span>{key.does}</span>
                  <span className="keys-combo">
                    {key.combo.map(k => <kbd key={k}>{k}</kbd>)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="sheet-meta" style={{ marginTop: '1rem' }}>On a Mac, Cmd works in place of Ctrl for drafts, progress, and sound.</p>
      </div>
    </div>
  );
});

HelpSheetBody.displayName = 'HelpSheetBody';

export default HelpSheetBody;
