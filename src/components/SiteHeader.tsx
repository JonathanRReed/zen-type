import React, { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { getSettings, saveSettings, type Settings } from '../utils/storage';

interface SiteHeaderProps {
  mode: 'landing' | 'zen' | 'quote';
}

const SiteHeader: React.FC<SiteHeaderProps> = ({ mode }) => {
  const [settings, setSettings] = useState<Settings>(() => getSettings());
  const [autoNext, setAutoNext] = useState<boolean>(() => !!getSettings().autoAdvanceQuotes);

  useEffect(() => {
    const onSettings = (e: Event) => {
      try {
        const s = (e as CustomEvent).detail as Settings;
        setSettings(s);
        setAutoNext(!!s.autoAdvanceQuotes);
      } catch {}
    };
    window.addEventListener('settingsChanged', onSettings as EventListener);
    return () => window.removeEventListener('settingsChanged', onSettings as EventListener);
  }, []);

  const updateSetting = (key: keyof Settings, value: any) => {
    const next = { ...settings, [key]: value } as Settings;
    setSettings(next);
    try { saveSettings(next); } catch {}
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
  };

  const handleAutoNextToggle = (checked: boolean) => {
    setAutoNext(checked);
    // Ensure immediate advance by default when toggled on
    const next = { ...settings, autoAdvanceQuotes: checked, autoAdvanceDelayMs: checked ? 0 : (settings.autoAdvanceDelayMs ?? 0) } as Settings;
    setSettings(next);
    try { saveSettings(next); } catch {}
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 p-6 flex justify-between items-center bg-base/80 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {mode === 'quote' ? (
          <a href="/" className="text-muted hover:text-text transition-colors text-sm">Home</a>
        ) : (
          <div className="glass rounded-full px-3 py-1 border border-iris/20">
            <span className="font-mono text-xs tracking-wide text-muted">Zen Typer</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {mode === 'zen' && (
          <button
            className="button-ghost px-3 py-2 rounded-lg text-sm"
            aria-label="Open drafts"
            onClick={() => window.dispatchEvent(new CustomEvent('toggleArchive', { detail: true }))}
          >
            Drafts
          </button>
        )}
        {mode === 'quote' && (
          <>
            <button
              id="header-new-quote"
              className="px-4 py-2 text-sm bg-surface/60 hover:bg-surface/80 border border-muted/20 rounded-lg text-text font-sans transition-all"
              onClick={() => window.dispatchEvent(new CustomEvent('newQuote'))}
            >
              New Quote
            </button>
            <label className="flex items-center gap-2 text-sm text-muted select-none">
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(e) => handleAutoNextToggle(e.target.checked)}
                className="w-5 h-5 rounded accent-iris"
              />
              Auto Next
            </label>
          </>
        )}
        <button 
          className="button-ghost px-3 py-2 rounded-lg text-sm"
          aria-label="Open help"
          onClick={() => window.dispatchEvent(new CustomEvent('toggleHelp', { detail: true }))}
        >
          ?
        </button>
        <button 
          className="button-ghost px-3 py-2 rounded-lg text-sm"
          aria-label="Open pause menu"
          onClick={() => window.dispatchEvent(new CustomEvent('togglePause', { detail: true }))}
        >
          ||
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default SiteHeader;
