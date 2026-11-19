import React from 'react';
import { IconBack } from './icons';

interface AboutPanelProps {
  onClose: () => void;
}

export const AboutPanel: React.FC<AboutPanelProps> = ({ onClose }) => (
  <>
    <div className="sheet-head">
      <h2 id="pause-about-title" className="sheet-title">About</h2>
      <button type="button" className="sheet-close" onClick={onClose} aria-label="Back to menu">
        <IconBack />
      </button>
    </div>
    <div className="sheet-prose">
      <p>
        Zen Typer is a small typing app with two modes. Quote mode gives you one short passage from an old book at a
        time, with words per minute and accuracy at the end. Zen mode is a blank page: every word you finish drifts
        up and away, and what you wrote is kept as a draft.
      </p>
      <p>
        Everything runs in your browser. There is no account, and nothing you type is sent anywhere.
      </p>
      <p>
        Made by <a href="https://jonathanrreed.com" target="_blank" rel="noopener noreferrer">Jonathan R. Reed</a>.
        There is more on the <a href="/about/">about page</a>, release notes in <a href="/whats-new/">what&apos;s new</a>,
        and a way to <a href="/contact/">get in touch</a>.
      </p>
    </div>
  </>
);
