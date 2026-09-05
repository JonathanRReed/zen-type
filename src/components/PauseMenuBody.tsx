// The pause menu's markup and controls. Everything in this file is behind the
// dynamic import in PauseMenu.tsx, which is why the Radix select, switch,
// checkbox, and label primitives can live at the top of the module: none of
// them reach the browser until the menu is primed or opened.
import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { getSettings, updateSettings, getStats, getStreak, type Settings, DEFAULT_STATS_BAR_METRICS, type StatsBarMetricKey } from '../utils/storage';
// Both panels are one click deep inside a menu that is closed at first paint,
// so they load on demand instead of shipping with the initial bundle.
const SettingsPanel = lazy(() =>
  import('./SettingsPanel').then(m => ({ default: m.SettingsPanel })),
);
const AboutPanel = lazy(() =>
  import('./AboutPanel').then(m => ({ default: m.AboutPanel })),
);

const PanelFallback = () => (
  <div className="py-10 text-center" role="status" aria-live="polite">
    <span className="animate-pulse text-sm text-muted">Loading…</span>
  </div>
);

interface PauseMenuBodyProps {
  mode: 'zen' | 'quote';
  /**
   * Owned by the shell so the `togglePause` listener can stay eager. The body
   * deliberately keeps rendering (as null) while closed instead of unmounting,
   * so reopening the menu lands on whatever sub-view you left it on, the same
   * as before the split.
   */
  open: boolean;
  onClose: () => void;
}

const PauseMenuBody: React.FC<PauseMenuBodyProps> = ({ mode: _mode, open, onClose: closeMenu }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [settings, setSettings] = useState<Settings>(getSettings);
  const [stats, setStats] = useState(getStats);
  const [streak, setStreak] = useState<number>(0);
  const [markers, setMarkers] = useState<number[]>([]);
  const [statsMetricMode, setStatsMetricMode] = useState<'zen' | 'quote'>('zen');
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Re-read persisted state every time the menu opens. This used to live in the
  // `togglePause` handler; that listener now sits in the shell, so the refresh
  // hangs off the prop it used to set.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(getSettings());
    setStats(getStats());
    setStreak(getStreak());
    setStatsMetricMode(_mode);
  }, [open, _mode]);

  // Lock background scroll and close on Escape when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeMenu]);

  // Keyboard access to the dialog. The typing surface holds focus for the
  // whole session, so opening the menu left focus outside it: nothing was
  // announced, and Shift+Tab walked into the header instead of the dialog.
  // Move focus in on open, keep Tab inside while it is open, and hand focus
  // back to whatever opened it on close.
  useEffect(() => {
    if (!open) return;
    const backdrop = backdropRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();

    const FOCUSABLE = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !backdrop) return;
      const items = Array.from(backdrop.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Bound on the backdrop, not the window: Radix renders its select popover
    // into a portal outside this subtree and manages focus itself, so those
    // keypresses never reach this handler and are left alone.
    backdrop?.addEventListener('keydown', onKeyDown);
    return () => {
      backdrop?.removeEventListener('keydown', onKeyDown);
      // document.body means nothing owns focus; the typing surface reclaims it
      // on its own, so leave that path alone.
      if (
        previouslyFocused &&
        previouslyFocused.isConnected &&
        previouslyFocused !== document.body &&
        previouslyFocused !== document.documentElement
      ) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  // Listen for session markers updates
  useEffect(() => {
    const handler = (e: Event) => {
      const arr = (e as CustomEvent).detail as number[];
      setMarkers(arr);
    };
    window.addEventListener('markersUpdated', handler as EventListener);
    return () => window.removeEventListener('markersUpdated', handler as EventListener);
  }, []);

  const applySettingsPatch = useCallback((patch: Partial<Settings>) => {
    setSettings(updateSettings(patch));
  }, []);

  // The reduce-motion / high-contrast / perf-mode class hydration that used to
  // run here has moved to PauseMenu.tsx. It has to happen at first paint, and
  // this module no longer loads until the menu is primed.

  if (!open) {
    return null;
  }

  // The dialog's accessible name must track the sub-view: the root "Paused"
  // heading unmounts when Settings/About open, which used to leave
  // aria-labelledby pointing at a node that no longer exists.
  const dialogLabelId = showSettings
    ? 'pause-settings-title'
    : showAbout
      ? 'pause-about-title'
      : 'pause-title';

  return (
    <div
      ref={backdropRef}
      className="overlay-backdrop fixed inset-0 z-[2000] flex items-center justify-center bg-base/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogLabelId}
    >
      {/* Backdrop dismiss is a plain layer, not a tab stop: a focusable
          fullscreen control put an invisible element in the tab order. */}
      <div
        className="absolute inset-0 bg-transparent"
        aria-hidden="true"
        onClick={closeMenu}
      />
      <div
        ref={cardRef}
        className={`overlay-card glass rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto overscroll-contain relative z-10 ${showSettings ? 'settings-shell settings-scroll' : ''}`}
        tabIndex={-1}
      >
        {!showSettings && !showAbout ? (
          <>
            <h2 id="pause-title" className="text-2xl font-sans text-tint mb-6">Paused</h2>

            <div className="space-y-3">
              <Button
                onClick={closeMenu}
                variant="outline"
                className="w-full px-6 py-3 bg-tint/20 hover:bg-tint/30 border-tint/45 text-tint font-sans transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--theme-accent)_55%,transparent)] focus-visible:ring-2 focus-visible:ring-tint/50 active:scale-[0.98]"
              >
                Resume
              </Button>
              
              {/* A function prop cannot cross the island boundary (Astro
                  serialises props to JSON), so the menu asks the typing
                  surface to reset itself. The canvas records what was typed
                  and reloads; the quote page draws a fresh quote. Live stats
                  are only published once a second, so the surface, not the
                  menu, is the one with accurate numbers. */}
              <Button
                  onClick={() => {
                    closeMenu();
                    window.dispatchEvent(new CustomEvent('resetSession'));
                  }}
                  variant="outline"
                  className="w-full px-6 py-3 bg-love/20 hover:bg-love/30 border-love/40 text-love font-sans transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-love/50 focus-visible:ring-2 focus-visible:ring-love/50 active:scale-[0.98]"
                >
                  Reset Session
                </Button>

              <div className="grid gap-3">
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 border-muted/20 text-text font-sans transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-muted/40 focus-visible:ring-2 focus-visible:ring-muted/40 active:scale-[0.98]"
                >
                  Settings
                </Button>

                <Button
                  onClick={() => {
                    closeMenu();
                    const opener = (window as any).openLibraryOverlay as undefined | (() => void);
                    if (typeof opener === 'function') {
                      opener();
                    } else {
                      window.dispatchEvent(new CustomEvent('toggleArchive', { detail: { force: true } }));
                    }
                  }}
                  variant="outline"
                  className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 border-muted/20 text-text font-sans transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-muted/40 focus-visible:ring-2 focus-visible:ring-muted/40 active:scale-[0.98]"
                >
                  Notes & Drafts
                </Button>

                <Button
                  onClick={() => {
                    closeMenu();
                    window.dispatchEvent(new CustomEvent('toggleProgress', { detail: true }));
                  }}
                  variant="outline"
                  className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 border-muted/20 text-text font-sans transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-muted/40 focus-visible:ring-2 focus-visible:ring-muted/40 active:scale-[0.98]"
                >
                  Progress
                </Button>

                <Button
                  onClick={() => setShowAbout(true)}
                  variant="outline"
                  className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 border-muted/20 text-text font-sans transition-colors duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-muted/40 focus-visible:ring-2 focus-visible:ring-muted/40 active:scale-[0.98]"
                >
                  About
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-text">
                  <span id="pause-reduced-motion-label">Reduced motion</span>
                  <Switch
                    aria-labelledby="pause-reduced-motion-label"
                    checked={!!settings?.reducedMotion}
                    onCheckedChange={(checked) => applySettingsPatch({ reducedMotion: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-text">
                  <span id="pause-high-contrast-label">High contrast</span>
                  <Switch
                    aria-labelledby="pause-high-contrast-label"
                    checked={!!settings?.highContrast}
                    onCheckedChange={(checked) => applySettingsPatch({ highContrast: !!checked })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Stats metrics</span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={statsMetricMode === 'zen' ? 'default' : 'outline'}
                      className="px-3 py-1 text-xs"
                      onClick={() => setStatsMetricMode('zen')}
                    >
                      Zen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={statsMetricMode === 'quote' ? 'default' : 'outline'}
                      className="px-3 py-1 text-xs"
                      onClick={() => setStatsMetricMode('quote')}
                    >
                      Quote
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 rounded-xl border border-muted/20 bg-surface/60 p-3">
                  {([...DEFAULT_STATS_BAR_METRICS[statsMetricMode], 'streak'] as StatsBarMetricKey[]).map(metric => {
                    const metricsForMode = settings.statsBarMetrics?.[statsMetricMode] ?? DEFAULT_STATS_BAR_METRICS[statsMetricMode];
                    const checked = metricsForMode.includes(metric);
                    const disabled = checked && metricsForMode.length === 1;
                    const labelMap: Record<StatsBarMetricKey, string> = {
                      time: 'Time elapsed',
                      words: 'Words typed',
                      wpm: 'Words per minute',
                      accuracy: 'Accuracy',
                      streak: 'Day streak',
                    };
                      return (
                      <div key={metric} className="flex items-center justify-between text-sm text-text gap-3">
                        <span id={`pause-metric-${statsMetricMode}-${metric}`}>{labelMap[metric]}</span>
                        <Checkbox
                          aria-labelledby={`pause-metric-${statsMetricMode}-${metric}`}
                          checked={checked}
                          disabled={disabled || (statsMetricMode === 'zen' && metric === 'accuracy')}
                          onCheckedChange={() => {
                            const base = settings.statsBarMetrics?.[statsMetricMode] ?? DEFAULT_STATS_BAR_METRICS[statsMetricMode];
                            const hasMetric = base.includes(metric);
                            if (hasMetric && base.length === 1) {
                              return;
                            }
                            const baseOrder: StatsBarMetricKey[] = [...DEFAULT_STATS_BAR_METRICS[statsMetricMode], 'streak'];
                            const nextMetrics = !checked
                              ? [...base, metric].sort((a, b) => baseOrder.indexOf(a) - baseOrder.indexOf(b))
                              : base.filter(item => item !== metric);
                            applySettingsPatch({
                              statsBarMetrics: {
                                zen: [...(settings.statsBarMetrics?.zen ?? DEFAULT_STATS_BAR_METRICS.zen)],
                                quote: [...(settings.statsBarMetrics?.quote ?? DEFAULT_STATS_BAR_METRICS.quote)],
                                [statsMetricMode]: nextMetrics,
                              },
                            });
                          }}
                          className="border-muted/30"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-6 pt-6 border-t border-muted/20">
              <h3 className="text-sm font-sans text-muted mb-3">So far</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted">Words</span>
                  <span className="ml-2 text-foam font-mono">{stats.totalWords}</span>
                </div>
                <div>
                  <span className="text-muted">Best WPM</span>
                  <span className="ml-2 text-gold font-mono">{stats.bestWpm}</span>
                </div>
                <div>
                  <span className="text-muted">Day streak</span>
                  <span className="ml-2 text-rose font-mono">{streak}</span>
                </div>
              </div>
              {/* Session markers */}
              {markers.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-muted mb-2">Markers</div>
                  <div className="flex flex-wrap gap-2">
                    {markers.map((sec) => (
                      <Button
                        key={sec}
                        variant="ghost"
                        size="sm"
                        className="px-2 py-1 rounded-full text-xs bg-surface/70 border border-muted/20 hover:bg-surface/90"
                        onClick={() => {
                          const windowMin = getSettings().ghostWindowMin || 5;
                          const start = Math.max(0, sec - windowMin * 60);
                          const end = sec;
                          const handler = (_e: Event) => {
                            window.removeEventListener('ghostText', handler as EventListener);
                          };
                          window.addEventListener('ghostText', handler as EventListener);
                          window.dispatchEvent(new CustomEvent('requestGhost', { detail: { startSec: start, endSec: end } }));
                        }}
                      >
                        {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : showSettings ? (
          <Suspense fallback={<PanelFallback />}>
            <SettingsPanel
              settings={settings}
              onSettingChange={(key, value) => {
                applySettingsPatch({ [key]: value });
              }}
              onClose={() => setShowSettings(false)}
            />
          </Suspense>
        ) : showAbout ? (
          <Suspense fallback={<PanelFallback />}>
            <AboutPanel onClose={() => setShowAbout(false)} />
          </Suspense>
        ) : null}
      </div>
    </div>
  );
};

export default PauseMenuBody;
