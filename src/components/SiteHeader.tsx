import React, { useEffect, useState, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import IconButton from './IconButton';
import { getSettings, updateSettings, type Settings, syncTypingFont } from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import { Button } from '@/components/ui/button';

interface SiteHeaderProps {
  mode: 'landing' | 'zen' | 'quote';
}

const SiteHeader: React.FC<SiteHeaderProps> = ({ mode }) => {
  const settings = useSettings();
  const autoNext = !!settings.autoAdvanceQuotes;
  const [showQuick, setShowQuick] = useState(false);
  const quickWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Stored font and caret choices must apply on first paint, not only after
    // a setting is touched.
    const initial = getSettings();
    if (initial.fontFamily) syncTypingFont(initial.fontFamily);
    if (initial.caretStyle && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-caret', initial.caretStyle);
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

  const _updateSetting = (key: keyof Settings, value: boolean) => {
    updateSettings({ [key]: value } as Partial<Settings>);
  };

  const handleSoundToggle = () => {
    const current = getSettings();
    const nextEnabled = !current.soundEnabled;
    updateSettings({
      soundEnabled: nextEnabled,
      switchSound: nextEnabled && current.switchSound === 'none' ? 'thock' : (current.switchSound ?? 'thock'),
    });
  };

  const handleAutoNextToggle = (checked: boolean) => {
    updateSettings({ autoAdvanceQuotes: checked });
  };

  const navLinkClass = (active: boolean) =>
    `inline-flex items-center justify-center px-3 sm:px-3.5 h-10 rounded-full text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/70 ${
      active
        ? 'bg-tint/20 border-tint/60 text-text shadow-sm'
        : 'border-muted/30 text-muted hover:text-text hover:border-muted/50'
    }`;

  // Phones get icon-only pills; the labels come back from the sm breakpoint.
  const primaryButtonClass =
    'group inline-flex items-center justify-center gap-2 h-11 w-11 sm:w-auto sm:px-5 sm:min-w-[10rem] rounded-xl border border-tint/25 bg-[color:var(--rp-surface)]/45 text-sm font-medium text-tint transition-colors shadow-[0_8px_20px_-16px_color-mix(in_oklab,var(--theme-accent)_45%,transparent)] hover:bg-[color:var(--rp-surface)]/60 hover:border-tint/45 hover:text-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/55';

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
    <header className="fixed top-0 left-0 right-0 z-40 px-3 py-3 sm:px-6 sm:py-5 bg-base/80 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-4 md:gap-6">
        <div className="flex flex-nowrap items-center gap-2 sm:gap-3 min-w-0">
          <nav aria-label="Mode toggle" className="flex items-center gap-2">
            <a
              href="/zen/"
              aria-current={mode === 'zen' ? 'page' : undefined}
              className={navLinkClass(mode === 'zen')}
            >
              Zen
            </a>
            <a
              href="/quote/"
              aria-current={mode === 'quote' ? 'page' : undefined}
              className={navLinkClass(mode === 'quote')}
            >
              Quote
            </a>
          </nav>

          {mode === 'zen' && (
            <Button
              type="button"
              className={primaryButtonClass}
              aria-label="Open drafts"
              variant="outline"
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
                <span className="font-medium hidden sm:inline">Drafts</span>
              </span>
            </Button>
          )}

          {mode === 'quote' && (
            <Button
              id="header-new-quote"
              type="button"
              className={primaryButtonClass}
              variant="outline"
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
                <span className="font-medium hidden sm:inline">New quote</span>
              </span>
            </Button>
          )}

          {mode === 'quote' && (
            <Button
              id="header-custom-quote"
              type="button"
              className={primaryButtonClass}
              variant="outline"
              aria-label="Practice custom text"
              onClick={() => {
                const text = window.prompt("Enter or paste custom text to practice:");
                if (text && text.trim()) {
                  // Cap length: QuoteTyper renders one span per character, so
                  // an unbounded paste would hang the tab building DOM nodes.
                  const MAX_CUSTOM_QUOTE_CHARS = 1200;
                  const trimmed = text.trim().slice(0, MAX_CUSTOM_QUOTE_CHARS);
                  window.dispatchEvent(new CustomEvent('loadCustomQuote', { detail: { text: trimmed } }));
                }
              }}
            >
              <span className="relative z-10 flex items-center gap-1.5 text-sm tracking-wide">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span className="font-medium hidden sm:inline">Custom</span>
              </span>
            </Button>
          )}
        </div>

        <div className="flex flex-nowrap items-center gap-1.5 sm:gap-2.5 justify-end shrink-0">
          {mode === 'quote' && (
            <IconButton
              subtle
              active={autoNext}
              aria-pressed={autoNext}
              aria-label={autoNext ? 'Auto next, disable auto advance' : 'Auto next, enable auto advance'}
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
            subtle
            active={!!settings?.soundEnabled}
            aria-pressed={!!settings?.soundEnabled}
            aria-label={settings?.soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            title={settings?.soundEnabled ? 'Sound: On' : 'Sound: Off'}
            onClick={() => handleSoundToggle()}
          >
            {settings?.soundEnabled ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
            <span className="sr-only">Toggle sound</span>
          </IconButton>

          <Button
            type="button"
            variant="outline"
            className={`${primaryButtonClass} uppercase tracking-[0.26em] text-[0.72rem] font-semibold sm:px-6 sm:min-w-[9rem] justify-center`}
            aria-label="Open settings menu"
            onClick={() => window.dispatchEvent(new CustomEvent('togglePause', { detail: true }))}
          >
            <span className="relative z-10 flex items-center gap-2">
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
              <span className="hidden sm:inline">Settings</span>
            </span>
          </Button>

          <div ref={quickWrapperRef} className="relative hidden sm:block">
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
                      checked={!!settings?.reducedMotion}
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
                      checked={!!settings?.highContrast}
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
                      checked={!!settings?.showStats}
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
                      checked={!!settings?.performanceMode}
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
