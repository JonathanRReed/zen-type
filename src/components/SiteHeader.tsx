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

  const _updateSetting = (key: keyof Settings, value: any) => {
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
        <nav aria-label="Primary" className="flex items-center gap-2">
          <a
            href="/zen"
            aria-current={mode === 'zen' ? 'page' : undefined}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${mode === 'zen' ? 'bg-surface/80 text-text border-muted/30' : 'button-ghost border-muted/20 text-muted hover:text-text'}`}
          >
            Zen Mode
          </a>
          <a
            href="/quote"
            aria-current={mode === 'quote' ? 'page' : undefined}
            className={`px-3 py-2 rounded-lg text-sm border transition-colors ${mode === 'quote' ? 'bg-surface/80 text-text border-muted/30' : 'button-ghost border-muted/20 text-muted hover:text-text'}`}
          >
            Quote Mode
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        {mode === 'zen' && (
          <button
            className="button-ghost px-3 py-2 rounded-lg text-sm"
            aria-label="Open drafts"
            onClick={() => {
              try { localStorage.setItem('zt.openArchiveNext', '1'); } catch {}
              const opener = (window as any).openLibraryOverlay as undefined | ((sessionId?: string) => void);
              // Fire both: direct open (if available) and event, so we don't depend on mount order.
              try {
                if (typeof opener === 'function') {
                  console.debug('[Drafts] calling openLibraryOverlay()');
                  opener();
                }
              } catch (e) {
                console.warn('[Drafts] openLibraryOverlay failed', e);
              }
              try {
                console.debug('[Drafts] dispatch toggleArchive {force:true}');
                window.dispatchEvent(new CustomEvent('toggleArchive', { detail: { force: true } }));
              } catch (e) {
                console.warn('[Drafts] dispatch toggleArchive failed', e);
              }
              // Retry once shortly after in case the overlay mounts a tick later
              window.setTimeout(() => {
                const o2 = (window as any).openLibraryOverlay as undefined | ((sessionId?: string) => void);
                try {
                  if (typeof o2 === 'function') {
                    console.debug('[Drafts] retry openLibraryOverlay()');
                    o2();
                  }
                } catch (e) {
                  console.warn('[Drafts] retry openLibraryOverlay failed', e);
                }
                try {
                  console.debug('[Drafts] retry dispatch toggleArchive {force:true}');
                  window.dispatchEvent(new CustomEvent('toggleArchive', { detail: { force: true } }));
                } catch (e) {
                  console.warn('[Drafts] retry dispatch toggleArchive failed', e);
                }
              }, 80);
            }}
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
