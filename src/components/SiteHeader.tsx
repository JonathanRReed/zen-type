import React, { useEffect } from 'react';
import ThemeToggle from './ThemeToggle';
import { Mark, IconShuffle, IconPen, IconPage, IconSoundOn, IconSoundOff, IconMenu } from './icons';
import { getSettings, updateSettings, syncTypingFont } from '../utils/storage';
import { useSettings } from '../hooks/useSettings';

interface SiteHeaderProps {
  mode: 'zen' | 'quote';
}

const SiteHeader: React.FC<SiteHeaderProps> = ({ mode }) => {
  const settings = useSettings();
  const soundOn = !!settings.soundEnabled;

  useEffect(() => {
    // Stored font and caret choices must apply on first paint, not only after
    // a setting is touched.
    const initial = getSettings();
    if (initial.fontFamily) syncTypingFont(initial.fontFamily);
    if (initial.caretStyle) document.documentElement.setAttribute('data-caret', initial.caretStyle);
  }, []);

  const toggleSound = () => {
    const current = getSettings();
    const next = !current.soundEnabled;
    updateSettings({
      soundEnabled: next,
      switchSound: next && current.switchSound === 'none' ? 'thock' : (current.switchSound ?? 'thock'),
    });
  };

  return (
    <header className="masthead">
      <div className="masthead-start">
        <a className="wordmark" href="/" aria-label="Zen Typer home">
          <Mark />
          <span>Zen Typer</span>
        </a>
        <nav aria-label="Mode" className="modes">
          <a href="/quote/" aria-current={mode === 'quote' ? 'page' : undefined}>Quote</a>
          <a href="/zen/" aria-current={mode === 'zen' ? 'page' : undefined}>Zen</a>
        </nav>
      </div>

      <div className="masthead-end">
        {mode === 'quote' && (
          <>
            <button
              id="header-new-quote"
              type="button"
              className="act"
              onClick={() => window.dispatchEvent(new CustomEvent('newQuote'))}
            >
              <IconShuffle />
              <span>New quote</span>
            </button>
            <button
              id="header-custom-quote"
              type="button"
              className="act act-roomy"
              onClick={() => window.dispatchEvent(new CustomEvent('openCustomText'))}
            >
              <IconPen />
              <span>Custom text</span>
            </button>
          </>
        )}
        {mode === 'zen' && (
          <button
            type="button"
            className="act"
            onClick={() => window.dispatchEvent(new CustomEvent('toggleArchive', { detail: true }))}
          >
            <IconPage />
            <span>Drafts</span>
          </button>
        )}
        <i className="masthead-rule" aria-hidden="true" />
        <button
          type="button"
          className="act act-icon"
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
          title={soundOn ? 'Sound on (Ctrl+M)' : 'Sound off (Ctrl+M)'}
          onClick={toggleSound}
        >
          {soundOn ? <IconSoundOn /> : <IconSoundOff />}
        </button>
        <ThemeToggle />
        <button
          type="button"
          className="act act-icon"
          aria-label="Open menu"
          title="Menu (Esc)"
          onClick={() => window.dispatchEvent(new CustomEvent('togglePause', { detail: true }))}
        >
          <IconMenu />
        </button>
      </div>
    </header>
  );
};

export default SiteHeader;
