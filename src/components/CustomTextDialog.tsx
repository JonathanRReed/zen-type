import React, { useRef, useState } from 'react';
import { useModal } from '../hooks/useModal';
import { CUSTOM_TEXT_MAX, normalizeCustomText } from '../utils/quotes';

interface CustomTextDialogProps {
  onSubmit: (text: string) => void;
  onClose: () => void;
}

// Paste or write a passage to practice on. It replaces the browser prompt()
// the header used to open, which could not show a length limit, wrapped
// nothing, and looked like an error.
const CustomTextDialog: React.FC<CustomTextDialogProps> = ({ onSubmit, onClose }) => {
  const [value, setValue] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);
  useModal(backdropRef, onClose);

  const text = normalizeCustomText(value);
  const words = text ? text.split(' ').length : 0;
  const tooLong = value.trim().length > CUSTOM_TEXT_MAX;

  const submit = () => {
    if (text) onSubmit(text);
  };

  return (
    <div
      ref={backdropRef}
      className="overlay-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-text-title"
    >
      <div className="overlay-dismiss" aria-hidden="true" onClick={onClose} />
      <form
        className="overlay-card sheet sheet-md"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <h2 id="custom-text-title" className="sheet-title">Type your own text</h2>
        <p className="sheet-lede">
          Paste or write anything up to {CUSTOM_TEXT_MAX.toLocaleString()} characters. Line breaks become spaces, and curly quotes and long dashes become the ones on your keyboard.
        </p>
        <textarea
          // The dialog exists to be typed into; focus belongs here on open.
          // eslint-disable-next-line jsx-a11y-x/no-autofocus
          autoFocus
          className="field field-area"
          aria-label="Text to practice"
          rows={6}
          value={value}
          spellCheck={false}
          placeholder="A paragraph you are learning, a speech, the opening of a book…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="sheet-foot">
          <p className="sheet-meta" role="status">
            {tooLong
              ? `Only the first ${CUSTOM_TEXT_MAX.toLocaleString()} characters will be used.`
              : text
                ? `${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}, ${text.length.toLocaleString()} characters`
                : 'Nothing is saved or sent anywhere.'}
          </p>
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!text}>Start typing</button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CustomTextDialog;
