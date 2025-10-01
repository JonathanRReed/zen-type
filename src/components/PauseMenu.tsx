import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getSettings, saveSettings, getStats, updateStats, updateStreak, type Settings, FONT_OPTIONS, applySettingsSideEffects, DEFAULT_STATS_BAR_METRICS, type StatsBarMetricKey, type FontOption } from '../utils/storage';
import { SettingsPanel } from './SettingsPanel';
import { AboutPanel } from './AboutPanel';

interface PauseMenuProps {
  onReset?: () => void;
  mode: 'zen' | 'quote';
}

const PauseMenu: React.FC<PauseMenuProps> = ({ onReset, mode: _mode }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [stats, setStats] = useState(getStats());
  const [markers, setMarkers] = useState<number[]>([]);
  const [statsMetricMode, setStatsMetricMode] = useState<'zen' | 'quote'>('zen');

  const closeMenu = useCallback(() => {
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent('focusTyping'));
      window.dispatchEvent(new CustomEvent('togglePause', { detail: false }));
    } catch {}
  }, []);

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

  // Respond to global toggle events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Accept boolean or undefined (toggle)
      if (typeof detail === 'boolean') {
        setOpen(detail);
      } else {
        setOpen(prev => !prev);
      }
      if (detail !== false) {
        // Close other overlays when opening pause
        try { window.dispatchEvent(new CustomEvent('toggleHelp', { detail: false })); } catch {}
        const nextSettings = getSettings();
        setSettings(nextSettings);
        setStatsMetricMode(_mode);
        setStats(getStats());
      }
    };
    window.addEventListener('togglePause', handler as EventListener);
    return () => window.removeEventListener('togglePause', handler as EventListener);
  }, [_mode]);

  // Listen for session markers updates
  useEffect(() => {
    const handler = (e: Event) => {
      const arr = (e as CustomEvent).detail as number[];
      setMarkers(arr);
    };
    window.addEventListener('markersUpdated', handler as EventListener);
    return () => window.removeEventListener('markersUpdated', handler as EventListener);
  }, []);

  const applySettingsPatch = useCallback((patch: Partial<Settings>, broadcast = true) => {
    setSettings(prev => {
      const next = { ...prev, ...patch } as Settings;
      saveSettings(next);
      if (broadcast) {
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
      }

      applySettingsSideEffects(patch, next, { broadcast });

      return next;
    });
  }, []);

  useEffect(() => {
    // Hydrate UI-affecting classes without rebroadcasting
    applySettingsPatch({
      reducedMotion: settings.reducedMotion,
      highContrast: settings.highContrast,
      showStats: settings.showStats,
      performanceMode: settings.performanceMode ?? false,
      ...(settings.fontFamily && { fontFamily: settings.fontFamily }),
    }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-base/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 bg-transparent p-0 hover:bg-transparent"
        onClick={closeMenu}
        aria-label="Close pause menu"
      >
        <span className="sr-only">Dismiss pause menu</span>
      </Button>
      <div
        className={`glass rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto overscroll-contain relative z-10 ${showSettings ? 'settings-shell settings-scroll' : ''}`}
        tabIndex={-1}
      >
        {!showSettings && !showAbout ? (
          <>
            <h2 id="pause-title" className="text-2xl font-sans text-foam mb-6">Paused</h2>
            
            <div className="space-y-3">
              <Button
                onClick={closeMenu}
                variant="outline"
                className="w-full px-6 py-3 bg-iris/20 hover:bg-iris/30 border-iris/40 text-iris font-sans transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-iris/50 focus-visible:ring-2 focus-visible:ring-iris/50 active:scale-[0.98]"
              >
                Resume
              </Button>
              
              {onReset && (
                <Button
                  onClick={() => {
                    try {
                      const z = (window as any).__zenStats || { time: 0, words: 0, chars: 0 };
                      const endedAt = new Date();
                      const startedAt = new Date(endedAt.getTime() - (z.time || 0) * 1000);
                      updateStats({
                        mode: 'zen',
                        startedAt,
                        endedAt,
                        wordsTyped: z.words || 0,
                        charactersTyped: z.chars || 0,
                      });
                      updateStreak();
                      // Finalize archive entry for this session
                      window.dispatchEvent(new CustomEvent('finalizeArchive'));
                    } catch (e) {
                      console.error('Failed to persist zen session', e);
                    }
                    onReset?.();
                    closeMenu();
                  }}
                  variant="outline"
                  className="w-full px-6 py-3 bg-love/20 hover:bg-love/30 border-love/40 text-love font-sans transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-love/50 focus-visible:ring-2 focus-visible:ring-love/50 active:scale-[0.98]"
                >
                  Reset Session
                </Button>
              )}

              <div className="grid gap-3">
                <Button
                  onClick={() => setShowSettings(true)}
                  variant="outline"
                  className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 border-muted/20 text-text font-sans transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-muted/40 focus-visible:ring-2 focus-visible:ring-muted/40 active:scale-[0.98]"
                >
                  Settings
                </Button>

                <Button
                  onClick={() => setShowAbout(true)}
                  variant="outline"
                  className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 border-muted/20 text-text font-sans transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px] hover:shadow-muted/40 focus-visible:ring-2 focus-visible:ring-muted/40 active:scale-[0.98]"
                >
                  About
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pause-font-select" className="text-sm text-muted/80 font-sans">
                  Typing font
                </Label>
                <Select
                  value={settings.fontFamily ?? FONT_OPTIONS[0]}
                  onValueChange={(value) => applySettingsPatch({ fontFamily: value as FontOption })}
                >
                  <SelectTrigger id="pause-font-select" className="w-full bg-surface/60 border-muted/20 text-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(font => (
                      <SelectItem key={font} value={font}>{font}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-text">
                  <span>Reduced motion</span>
                  <Switch
                    checked={!!settings?.reducedMotion}
                    onCheckedChange={(checked) => applySettingsPatch({ reducedMotion: !!checked })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-text">
                  <span>High contrast</span>
                  <Switch
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
                  {DEFAULT_STATS_BAR_METRICS[statsMetricMode].map(metric => {
                    const metricsForMode = settings.statsBarMetrics?.[statsMetricMode] ?? DEFAULT_STATS_BAR_METRICS[statsMetricMode];
                    const checked = metricsForMode.includes(metric);
                    const disabled = checked && metricsForMode.length === 1;
                    const labelMap: Record<StatsBarMetricKey, string> = {
                      time: 'Time elapsed',
                      words: 'Words typed',
                      wpm: 'Words per minute',
                      accuracy: 'Accuracy',
                    };
                    return (
                      <div key={metric} className="flex items-center justify-between text-sm text-text gap-3">
                        <span>{labelMap[metric]}</span>
                        <Checkbox
                          checked={checked}
                          disabled={disabled || (statsMetricMode === 'zen' && metric === 'accuracy')}
                          onCheckedChange={() => {
                            setSettings(prev => {
                              const base = prev.statsBarMetrics?.[statsMetricMode] ?? DEFAULT_STATS_BAR_METRICS[statsMetricMode];
                              const hasMetric = base.includes(metric);
                              if (hasMetric && base.length === 1) {
                                return prev;
                              }
                              const baseOrder = DEFAULT_STATS_BAR_METRICS[statsMetricMode];
                              const nextMetrics = hasMetric
                                ? base.filter(item => item !== metric)
                                : [...base, metric].sort((a, b) => baseOrder.indexOf(a) - baseOrder.indexOf(b));
                              const nextSettings = {
                                ...prev,
                                statsBarMetrics: {
                                  zen: [...(prev.statsBarMetrics?.zen ?? DEFAULT_STATS_BAR_METRICS.zen)],
                                  quote: [...(prev.statsBarMetrics?.quote ?? DEFAULT_STATS_BAR_METRICS.quote)],
                                  [statsMetricMode]: nextMetrics,
                                },
                              } as Settings;
                              saveSettings(nextSettings);
                              window.dispatchEvent(new CustomEvent('settingsChanged', { detail: nextSettings }));
                              return nextSettings;
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
              <h3 className="text-sm font-sans text-muted mb-3">Session Stats</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted">Total Words:</span>
                  <span className="ml-2 text-foam font-mono">{stats.totalWords}</span>
                </div>
                <div>
                  <span className="text-muted">Best WPM:</span>
                  <span className="ml-2 text-gold font-mono">{stats.bestWpm}</span>
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
          <SettingsPanel
            settings={settings}
            onSettingChange={(key, value) => {
              setSettings(prev => {
                const next = { ...prev, [key]: value } as Settings;
                saveSettings(next);
                return next;
              });
            }}
            onClose={() => setShowSettings(false)}
          />
        ) : showAbout ? (
          <AboutPanel onClose={() => setShowAbout(false)} />
        ) : null}
      </div>
    </div>
  );
};

export default PauseMenu;
