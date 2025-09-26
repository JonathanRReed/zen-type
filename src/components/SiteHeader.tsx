import React, { useEffect, useState, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import { getSettings, saveSettings, type Settings, FONT_OPTIONS, getFontStack } from '../utils/storage';

interface SiteHeaderProps {
  mode: 'landing' | 'zen' | 'quote';
}

const SiteHeader: React.FC<SiteHeaderProps> = ({ mode }) => {
  const detectPopoverSupport = () =>
    typeof window !== 'undefined' && typeof HTMLElement !== 'undefined' && 'togglePopover' in (HTMLElement.prototype as any);

  const [settings, setSettings] = useState<Settings>(() => getSettings());
  const [autoNext, setAutoNext] = useState<boolean>(() => !!getSettings().autoAdvanceQuotes);
  const [fontFamily, setFontFamily] = useState<Settings['fontFamily']>(() => getSettings().fontFamily ?? FONT_OPTIONS[0]);
  const [hasPopover, setHasPopover] = useState<boolean>(detectPopoverSupport);
  const quickSettingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const popoverId = 'header-quick-settings';

  useEffect(() => {
    const onSettings = (e: Event) => {
      try {
        const s = (e as CustomEvent).detail as Settings;
        setSettings(s);
        setAutoNext(!!s.autoAdvanceQuotes);
        if (s.fontFamily) {
          setFontFamily(s.fontFamily);
          document.documentElement.style.setProperty('--typing-font', getFontStack(s.fontFamily));
        }
      } catch {}
    };
    window.addEventListener('settingsChanged', onSettings as EventListener);
    return () => window.removeEventListener('settingsChanged', onSettings as EventListener);
  }, []);

  useEffect(() => {
    setHasPopover(detectPopoverSupport());
    const initial = getSettings().fontFamily ?? FONT_OPTIONS[0];
    setFontFamily(initial);
    document.documentElement.style.setProperty('--typing-font', getFontStack(initial));
  }, []);

  useEffect(() => {
    const btn = quickSettingsButtonRef.current;
    if (!btn) return;
    if (hasPopover) {
      btn.setAttribute('popovertarget', popoverId);
      btn.setAttribute('popovertargetaction', 'toggle');
    } else {
      btn.removeAttribute('popovertarget');
      btn.removeAttribute('popovertargetaction');
    }
  }, [hasPopover, popoverId]);

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

  const handleFontChange = (value: Settings['fontFamily']) => {
    const next = { ...settings, fontFamily: value } as Settings;
    setSettings(next);
    setFontFamily(value);
    try { saveSettings(next); } catch {}
    document.documentElement.style.setProperty('--typing-font', getFontStack(value ?? FONT_OPTIONS[0]));
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
    window.dispatchEvent(new CustomEvent('fontChanged', { detail: value }));
  };

  const togglePopoverFallback = () => {
    if (hasPopover || typeof document === 'undefined') return;
    const el = document.getElementById(popoverId);
    if (!el) return;
    if (el.hasAttribute('hidden')) {
      el.removeAttribute('hidden');
      el.setAttribute('data-popover-open', 'true');
      el.focus({ preventScroll: true });
    } else {
      el.setAttribute('hidden', '');
      el.removeAttribute('data-popover-open');
    }
  };

  const closePopover = () => {
    if (typeof document === 'undefined') return;
    const el = document.getElementById(popoverId);
    if (!el) return;
    if (hasPopover) {
      (el as any).hidePopover?.();
      return;
    }
    el.setAttribute('hidden', '');
    el.removeAttribute('data-popover-open');
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
        <div className="hidden md:block">
          <label className="sr-only" htmlFor="font-select">Select typing font</label>
          <select
            id="font-select"
            className="font-select"
            value={fontFamily}
            onChange={(e) => handleFontChange(e.target.value as Settings['fontFamily'])}
          >
            {FONT_OPTIONS.map(font => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </div>
        {mode === 'zen' && (
          <>
            <button
              className="button-ghost px-3 py-2 rounded-lg text-sm"
              aria-label="Open drafts"
              onClick={() => {
              try { localStorage.setItem('zt.openArchiveNext', '1'); } catch {}
              const opener = (window as any).openLibraryOverlay as undefined | ((sessionId?: string) => void);
              // Fire both: direct open (if available) and event, so we don't depend on mount order.
              try {
                if (typeof opener === 'function') {
                  opener();
                }
              } catch (e) {
                console.warn('[Drafts] openLibraryOverlay failed', e);
              }
              try {
                window.dispatchEvent(new CustomEvent('toggleArchive', { detail: { force: true } }));
              } catch (e) {
                console.warn('[Drafts] dispatch toggleArchive failed', e);
              }
              // Retry once shortly after in case the overlay mounts a tick later
              window.setTimeout(() => {
                const o2 = (window as any).openLibraryOverlay as undefined | ((sessionId?: string) => void);
                try {
                  if (typeof o2 === 'function') {
                    o2();
                  }
                } catch (e) {
                  console.warn('[Drafts] retry openLibraryOverlay failed', e);
                }
                try {
                  window.dispatchEvent(new CustomEvent('toggleArchive', { detail: { force: true } }));
                } catch (e) {
                  console.warn('[Drafts] retry dispatch toggleArchive failed', e);
                }
              }, 80);
            }}
          >
            Drafts
          </button>
          </>
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
          className="pause-btn"
          aria-label="Open pause menu"
          onClick={() => window.dispatchEvent(new CustomEvent('togglePause', { detail: true }))}
        >
          <span className="pause-btn-icon" aria-hidden="true">
            <svg width="14" height="16" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="4" height="14" rx="1.5" />
              <rect x="9" y="1" width="4" height="14" rx="1.5" />
            </svg>
          </span>
          <span className="pause-btn-label">Pause</span>
        </button>
        <button
          type="button"
          className="button-ghost px-3 py-2 rounded-lg text-sm"
          aria-haspopup="dialog"
          aria-controls={popoverId}
          ref={quickSettingsButtonRef}
          onClick={() => {
            if (!hasPopover) {
              togglePopoverFallback();
            }
          }}
        >
          Quick Settings
        </button>
        <ThemeToggle />
      </div>
      <div
        id={popoverId}
        popover="auto"
        hidden
        role="dialog"
        className="glass absolute top-16 right-6 z-50 rounded-2xl p-6 w-72 shadow-xl border border-muted/30 text-sm flex flex-col gap-4"
        aria-label="Quick settings"
      >
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted">Accessibility</div>
          <label className="flex items-center justify-between gap-3">
            <span>Reduced motion</span>
            <input
              type="checkbox"
              checked={!!settings.reducedMotion}
              onChange={(e) => _updateSetting('reducedMotion', e.target.checked)}
              className="w-5 h-5 accent-iris"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>High contrast</span>
            <input
              type="checkbox"
              checked={!!settings.highContrast}
              onChange={(e) => _updateSetting('highContrast', e.target.checked)}
              className="w-5 h-5 accent-iris"
            />
          </label>
        </div>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted">Display</div>
          <label className="flex items-center justify-between gap-3">
            <span>Show stats bar</span>
            <input
              type="checkbox"
              checked={!!settings.showStats}
              onChange={(e) => _updateSetting('showStats', e.target.checked)}
              className="w-5 h-5 accent-iris"
            />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>Performance mode</span>
            <input
              type="checkbox"
              checked={!!settings.performanceMode}
              onChange={(e) => _updateSetting('performanceMode', e.target.checked)}
              className="w-5 h-5 accent-iris"
            />
          </label>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-surface/60 hover:bg-surface/80 border border-muted/30 rounded-lg text-sm"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('togglePause', { detail: true }));
            window.dispatchEvent(new CustomEvent('openSettingsPanel', { detail: true }));
            closePopover();
          }}
        >
          Full settings…
        </button>
      </div>
    </header>
  );
};

export default SiteHeader;
