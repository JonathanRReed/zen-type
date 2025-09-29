import React, { useEffect, useState, useRef, useMemo } from 'react';
import ThemeToggle from './ThemeToggle';
import IconButton from './IconButton';
import { getSettings, saveSettings, type Settings, syncTypingFont, applySettingsSideEffects } from '../utils/storage';
import { debounce } from '../utils/debounce';

interface SiteHeaderProps {
  mode: 'landing' | 'zen' | 'quote';
}

const SiteHeader: React.FC<SiteHeaderProps> = ({ mode }) => {
  const [settings, setSettings] = useState<Settings>(() => getSettings());
  const [autoNext, setAutoNext] = useState<boolean>(() => !!getSettings().autoAdvanceQuotes);
  const [showQuick, setShowQuick] = useState(false);
  const quickWrapperRef = useRef<HTMLDivElement | null>(null);
  const persistSettings = useMemo(() => debounce((next: Settings) => {
    try {
      saveSettings(next);
    } catch (error) {
      console.error('[SiteHeader] Failed to persist settings', error);
    }
  }, 250), []);

  useEffect(() => {
    const onSettings = (e: Event) => {
      try {
        const s = (e as CustomEvent).detail as Settings;
        setSettings(s);
        setAutoNext(!!s.autoAdvanceQuotes);
        if (s.fontFamily) {
          syncTypingFont(s.fontFamily);
        }
      } catch {}
    };
    window.addEventListener('settingsChanged', onSettings as EventListener);
    return () => window.removeEventListener('settingsChanged', onSettings as EventListener);
  }, []);

  useEffect(() => {
    const initial = getSettings().fontFamily;
    if (initial) {
      syncTypingFont(initial);
    }
  }, []);

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      const wrapper = quickWrapperRef.current;
      if (!wrapper) return;
      if (!wrapper.contains(event.target as Node)) {
        setShowQuick(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowQuick(false);
      }
    };

    window.addEventListener('mousedown', handleClickAway);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClickAway);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const _updateSetting = (key: keyof Settings, value: any) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value } as Settings;
      persistSettings(next);
      applySettingsSideEffects({ [key]: value } as Partial<Settings>, next);
      window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
      return next;
    });
  };

  const handleAutoNextToggle = (checked: boolean) => {
    setAutoNext(checked);
    // Ensure immediate advance by default when toggled on
    setSettings(prev => {
      const patch: Partial<Settings> = {
        autoAdvanceQuotes: checked,
        autoAdvanceDelayMs: checked ? 0 : (prev.autoAdvanceDelayMs ?? 0),
      };
      const next = { ...prev, ...patch } as Settings;
      persistSettings(next);
      applySettingsSideEffects(patch, next);
      window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
      return next;
    });
  };

  const navLinkClass = (active: boolean) =>
    `inline-flex items-center justify-center px-3.5 h-10 rounded-full text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris/70 ${
      active
        ? 'bg-iris/20 border-iris/60 text-text shadow-sm'
        : 'border-muted/30 text-muted hover:text-text hover:border-muted/50'
    }`;

  const primaryButtonClass =
    'group inline-flex items-center justify-center gap-2 px-5 h-11 min-w-[10rem] rounded-xl border border-iris/25 bg-[color:var(--rp-surface)]/45 text-sm font-medium text-foam/90 transition-colors shadow-[0_8px_20px_-16px_rgba(102,76,255,0.45)] hover:bg-[color:var(--rp-surface)]/60 hover:border-iris/40 hover:text-foam focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris/55';

  const quickSettingIcons = {
    reducedMotion: (
      <svg
        className="h-4 w-4 text-muted"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3.5 6.5c1.2 0 1.2 2 2.4 2s1.2-2 2.4-2 1.2 2 2.4 2 1.2-2 2.4-2"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4.8 11.5c1 .8 2 .8 3 0s2-.8 3 0"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    highContrast: (
      <svg
        className="h-4 w-4 text-muted"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="9" cy="9" r="4.2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M9 4.8v8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M9 4.8a4.2 4.2 0 0 1 0 8.4V4.8Z" fill="currentColor" fillOpacity="0.28" />
      </svg>
    ),
    showStats: (
      <svg
        className="h-4 w-4 text-muted"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M3.5 12.5h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M4.8 12.5V9.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.2 12.5V8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    performanceMode: (
      <svg
        className="h-4 w-4 text-muted"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3 10.5l2.8-3.8 2.1 4.5 2.1-5.4 3.8 7"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  } as const;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-6 py-5 bg-base/80 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Mode toggle" className="flex items-center gap-2">
            <a
              href="/zen"
              aria-current={mode === 'zen' ? 'page' : undefined}
              className={navLinkClass(mode === 'zen')}
            >
              Zen
            </a>
            <a
              href="/quote"
              aria-current={mode === 'quote' ? 'page' : undefined}
              className={navLinkClass(mode === 'quote')}
            >
              Quote
            </a>
          </nav>

          {mode === 'zen' && (
            <button
              type="button"
              className={primaryButtonClass}
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
              <span className="relative z-10 flex items-center gap-2 text-sm tracking-wide">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M5.25 4.5A1.25 1.25 0 0 1 6.5 3.25h4.4a1.25 1.25 0 0 1 .884.366l1.966 1.934A1.25 1.25 0 0 1 14 6.435V12.5A1.5 1.5 0 0 1 12.5 14h-6A1.5 1.5 0 0 1 5 12.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 9h4.5M7 11.5h3"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="font-medium">Drafts</span>
              </span>
            </button>
          )}

          {mode === 'quote' && (
            <button
              id="header-new-quote"
              type="button"
              className={primaryButtonClass}
              onClick={() => window.dispatchEvent(new CustomEvent('newQuote'))}
            >
              <span className="relative z-10 flex items-center gap-2 text-sm tracking-wide">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M9 4v10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 9h10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-medium">New Quote</span>
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 justify-end md:justify-end">
          {mode === 'quote' && (
            <IconButton
              subtle
              active={autoNext}
              aria-pressed={autoNext}
              aria-label={autoNext ? 'Disable auto advance' : 'Enable auto advance'}
              title={autoNext ? 'Auto Next: On' : 'Auto Next: Off'}
              onClick={() => handleAutoNextToggle(!autoNext)}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M5 5L10 10L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 5L16 10L11 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">Auto next</span>
            </IconButton>
          )}

          <IconButton
            shape="pill"
            subtle
            className="uppercase tracking-[0.28em] text-[0.7rem] font-semibold px-5"
            aria-label="Open settings menu"
            onClick={() => window.dispatchEvent(new CustomEvent('togglePause', { detail: true }))}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M7.25 3.75h3.5l0.62 1.74a1 1 0 0 0 .6.6l1.74.62v3.5l-1.74.62a1 1 0 0 0-.6.6l-.62 1.74h-3.5l-.62-1.74a1 1 0 0 0-.6-.6l-1.74-.62v-3.5l1.74-.62a1 1 0 0 0 .6-.6Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="9" r="1.9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span>Settings</span>
          </IconButton>

          <div ref={quickWrapperRef} className="relative">
            <IconButton
              subtle
              active={showQuick}
              aria-haspopup="menu"
              aria-expanded={showQuick}
              onClick={() => setShowQuick(prev => !prev)}
              title="Quick settings"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M4 5.5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="7.5" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 9h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="11.5" cy="9" r="1.6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 12.5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="6.5" cy="12.5" r="1.6" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <span className="sr-only">Quick settings</span>
            </IconButton>
            {showQuick && (
              <div
                role="menu"
                className="glass absolute top-12 right-0 z-50 rounded-2xl p-6 w-72 shadow-xl border border-muted/30 text-sm flex flex-col gap-4"
                aria-label="Quick settings"
              >
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-widest text-muted">Accessibility</div>
                  <label className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-text">
                      {quickSettingIcons.reducedMotion}
                      <span>Reduced motion</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!settings.reducedMotion}
                      onChange={(e) => _updateSetting('reducedMotion', e.target.checked)}
                      className="w-5 h-5 accent-iris"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-text">
                      {quickSettingIcons.highContrast}
                      <span>High contrast</span>
                    </span>
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
                    <span className="flex items-center gap-2 text-text">
                      {quickSettingIcons.showStats}
                      <span>Show stats bar</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!settings.showStats}
                      onChange={(e) => _updateSetting('showStats', e.target.checked)}
                      className="w-5 h-5 accent-iris"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-text">
                      {quickSettingIcons.performanceMode}
                      <span>Performance mode</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!settings.performanceMode}
                      onChange={(e) => _updateSetting('performanceMode', e.target.checked)}
                      className="w-5 h-5 accent-iris"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <ThemeToggle className="ml-1" />
        </div>
      </div>
    </header>
  );
}
;

export default SiteHeader;
