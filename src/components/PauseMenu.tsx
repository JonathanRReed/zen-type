import React, { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings, getStats, updateStats, updateStreak, resetAllData, type Settings } from '../utils/storage';

interface PauseMenuProps {
  isOpen?: boolean;
  onClose?: () => void;
  onReset?: () => void;
  mode: 'zen' | 'quote';
}

const PauseMenu: React.FC<PauseMenuProps> = ({ isOpen = false, onClose, onReset, mode: _mode }) => {
  const [open, setOpen] = useState<boolean>(isOpen);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [ghostPreview, setGhostPreview] = useState<string>('');
  const [stats, setStats] = useState(getStats());
  const [markers, setMarkers] = useState<number[]>([]);
  const aboutShortcuts = [
    { key: 'Tab', description: 'Switch modes' },
    { key: 'Esc', description: 'Pause menu' },
    { key: 'Space', description: 'Commit word (Zen)' },
    { key: 'Enter', description: 'Force commit word (Zen)' },
    { key: 'Backspace', description: 'Correct character (Quote)' },
  ];

  const closeMenu = useCallback(() => {
    setOpen(false);
    onClose?.();
    try { window.dispatchEvent(new CustomEvent('focusTyping')); } catch {}
  }, [onClose]);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

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
        setSettings(getSettings());
        setStats(getStats());
      }
    };
    window.addEventListener('togglePause', handler as EventListener);
    return () => window.removeEventListener('togglePause', handler as EventListener);
  }, []);

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

      if ('reducedMotion' in patch && broadcast) {
        document.documentElement.classList.toggle('reduce-motion', !!next.reducedMotion);
      }
      if ('highContrast' in patch && broadcast) {
        document.documentElement.classList.toggle('high-contrast', !!next.highContrast);
      }
      if ('showStats' in patch && broadcast) {
        window.dispatchEvent(new CustomEvent('toggleStats', { detail: !!next.showStats }));
      }
      if ('performanceMode' in patch && broadcast) {
        document.documentElement.classList.toggle('perf-mode', !!next.performanceMode);
      }

      return next;
    });
  }, []);

  const handleSettingChange = (key: keyof Settings, value: any) => {
    applySettingsPatch({ [key]: value } as Partial<Settings>);
  };

  useEffect(() => {
    // Hydrate UI-affecting classes without rebroadcasting
    applySettingsPatch({
      reducedMotion: settings.reducedMotion,
      highContrast: settings.highContrast,
      showStats: settings.showStats,
      performanceMode: settings.performanceMode,
    }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-base/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div
        role="presentation"
        tabIndex={-1}
        className="absolute inset-0"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && e.button === 0) closeMenu();
        }}
        onTouchEnd={(e) => {
          if (e.target === e.currentTarget) closeMenu();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            closeMenu();
          }
        }}
      />
      <div
        className="glass rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto overscroll-contain relative z-10"
        tabIndex={-1}
      >
        {!showSettings && !showAbout ? (
          <>
            <h2 id="pause-title" className="text-2xl font-sans text-foam mb-6">Paused</h2>
            
            <div className="space-y-3">
              <button
                onClick={closeMenu}
                className="w-full px-6 py-3 bg-iris/20 hover:bg-iris/30 
                         border border-iris/40 rounded-lg
                         text-iris font-sans transition-all"
              >
                Resume
              </button>
              
              {onReset && (
                <button
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
                  className="w-full px-6 py-3 bg-love/20 hover:bg-love/30 
                           border border-love/40 rounded-lg
                           text-love font-sans transition-all"
                >
                  Reset Session
                </button>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 
                         border border-muted/20 rounded-lg
                         text-text font-sans transition-all"
              >
                Settings
              </button>
              
              <button
                onClick={() => setShowAbout(true)}
                className="w-full px-6 py-3 bg-surface/60 hover:bg-surface/80 
                         border border-muted/20 rounded-lg
                         text-text font-sans transition-all"
              >
                About
              </button>
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
                      <button
                        key={sec}
                        className="px-2 py-1 rounded-full text-xs bg-surface/70 border border-muted/20 hover:bg-surface/90"
                        onClick={() => {
                          const windowMin = getSettings().ghostWindowMin || 5;
                          const start = Math.max(0, sec - windowMin * 60);
                          const end = sec;
                          const handler = (e: Event) => {
                            const { text } = (e as CustomEvent).detail as { text: string };
                            setGhostPreview(text || '');
                            window.removeEventListener('ghostText', handler as EventListener);
                          };
                          window.addEventListener('ghostText', handler as EventListener);
                          window.dispatchEvent(new CustomEvent('requestGhost', { detail: { startSec: start, endSec: end } }));
                        }}
                      >
                        {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : showSettings ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-sans text-foam">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-muted hover:text-text transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Profiles */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <span className="text-text">Profile</span>
                <select
                  value={settings.profile || 'Practice'}
                  onChange={(e) => {
                    const p = e.target.value as NonNullable<Settings['profile']>;
                    if (p === 'Minimal') {
                      applySettingsPatch({
                        profile: p,
                        showStats: false,
                        reducedMotion: true,
                        fadeSec: 3,
                        driftAmp: 3,
                        spawnDensity: 0.9,
                        laneStyle: 'none',
                        breath: false,
                      });
                    } else if (p === 'Practice') {
                      applySettingsPatch({
                        profile: p,
                        showStats: true,
                        reducedMotion: false,
                        fadeSec: 4,
                        driftAmp: 6,
                        spawnDensity: 1.0,
                        laneStyle: 'soft',
                        breath: false,
                      });
                    } else if (p === 'Meditative') {
                      applySettingsPatch({
                        profile: p,
                        showStats: false,
                        reducedMotion: false,
                        fadeSec: 5,
                        driftAmp: 4,
                        spawnDensity: 0.9,
                        laneStyle: 'soft',
                        breath: true,
                      });
                    }
                  }}
                  className="bg-surface border border-muted/20 rounded px-3 py-2"
                >
                  <option>Minimal</option>
                  <option>Practice</option>
                  <option>Meditative</option>
                </select>
              </div>
              <label className="flex items-center justify-between">
                <span className="text-text">Reduced Motion</span>
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => handleSettingChange('reducedMotion', e.target.checked)}
                  className="w-5 h-5 rounded accent-iris"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-text">High Contrast</span>
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={(e) => handleSettingChange('highContrast', e.target.checked)}
                  className="w-5 h-5 rounded accent-iris"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-text">Show Stats</span>
                <input
                  type="checkbox"
                  checked={settings.showStats}
                  onChange={(e) => handleSettingChange('showStats', e.target.checked)}
                  className="w-5 h-5 rounded accent-iris"
                />
              </label>

              {/* Flow Preset */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <span className="text-text">Flow Preset</span>
                <select
                  value={settings.zenPreset}
                  onChange={(e) => {
                    const v = e.target.value as Settings['zenPreset'];
                    const preset = {
                      Calm: { fadeSec: 6, driftAmp: 4, spawnDensity: 0.8 },
                      Neutral: { fadeSec: 4, driftAmp: 6, spawnDensity: 1.0 },
                      Energetic: { fadeSec: 3, driftAmp: 8, spawnDensity: 1.2 },
                    }[v];
                    handleSettingChange('zenPreset', v);
                    handleSettingChange('fadeSec', preset.fadeSec);
                    handleSettingChange('driftAmp', preset.driftAmp);
                    handleSettingChange('spawnDensity', preset.spawnDensity);
                  }}
                  className="bg-surface border border-muted/20 rounded px-3 py-2"
                >
                  <option>Calm</option>
                  <option>Neutral</option>
                  <option>Energetic</option>
                </select>
              </div>

              {/* Fade duration */}
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-text">Fade (sec)</span>
                  <span className="text-muted">{(settings.fadeSec ?? 4).toFixed(1)}</span>
                </div>
                <input
                  type="range" min={2} max={8} step={0.5}
                  value={settings.fadeSec ?? 4}
                  onChange={(e) => handleSettingChange('fadeSec', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Drift amplitude */}
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-text">Drift amplitude</span>
                  <span className="text-muted">{(settings.driftAmp ?? 6).toFixed(1)} px</span>
                </div>
                <input
                  type="range" min={2} max={12} step={0.5}
                  value={settings.driftAmp ?? 6}
                  onChange={(e) => handleSettingChange('driftAmp', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Spawn density */}
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-text">Spawn density</span>
                  <span className="text-muted">{(settings.spawnDensity ?? 1.0).toFixed(2)}</span>
                </div>
                <input
                  type="range" min={0.5} max={1.5} step={0.05}
                  value={settings.spawnDensity ?? 1.0}
                  onChange={(e) => handleSettingChange('spawnDensity', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Focus lanes */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <span className="text-text">Focus lanes</span>
                <select
                  value={settings.laneStyle ?? 'soft'}
                  onChange={(e) => handleSettingChange('laneStyle', e.target.value as Settings['laneStyle'])}
                  className="bg-surface border border-muted/20 rounded px-3 py-2"
                >
                  <option value="none">None</option>
                  <option value="soft">Soft</option>
                  <option value="tight">Tight</option>
                </select>
              </div>

              {/* Breathing overlay */}
              <label className="flex items-center justify-between">
                <span className="text-text">Breathing overlay</span>
                <input
                  type="checkbox"
                  checked={settings.breath}
                  onChange={(e) => handleSettingChange('breath', e.target.checked)}
                  className="w-5 h-5 rounded accent-iris"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-text">Lock theme shift</span>
                <input
                  type="checkbox"
                  checked={settings.themeShiftLocked || false}
                  onChange={(e) => handleSettingChange('themeShiftLocked', e.target.checked)}
                  className="w-5 h-5 rounded accent-iris"
                />
              </label>

              {/* Quote Mode */}
              <label className="flex items-center justify-between">
                <span className="text-text">Auto-Advance Quotes</span>
                <input
                  type="checkbox"
                  checked={!!settings.autoAdvanceQuotes}
                  onChange={(e) => handleSettingChange('autoAdvanceQuotes', e.target.checked)}
                  className="w-5 h-5 rounded accent-iris"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 items-center">
                <span className="text-text">Auto-Advance Delay (ms)</span>
                <input
                  type="number" min={0} max={3000}
                  value={Math.max(0, Math.min(3000, settings.autoAdvanceDelayMs ?? 0))}
                  onChange={(e) => handleSettingChange('autoAdvanceDelayMs', Math.max(0, Math.min(3000, Number(e.target.value))))}
                  className="bg-surface border border-muted/20 rounded px-3 py-2 disabled:opacity-60"
                  disabled={!settings.autoAdvanceQuotes}
                />
              </div>

              {/* Performance */}
              <label className="flex items-center justify-between">
                <span className="text-text">Performance mode (low-power)</span>
                <input
                  type="checkbox"
                  checked={!!settings.performanceMode}
                  onChange={(e) => handleSettingChange('performanceMode', e.target.checked)}
                  className="w-5 h-5 rounded accent-iris"
                />
              </label>

              {/* Session markers and ghost */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <span className="text-text">Markers (min)</span>
                <input
                  type="number" min={1} max={5}
                  value={settings.markersEveryMin}
                  onChange={(e) => handleSettingChange('markersEveryMin', Math.max(1, Math.min(5, Number(e.target.value))))}
                  className="bg-surface border border-muted/20 rounded px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <span className="text-text">Ghost window (min)</span>
                <input
                  type="number" min={2} max={5}
                  value={settings.ghostWindowMin}
                  onChange={(e) => handleSettingChange('ghostWindowMin', Math.max(2, Math.min(5, Number(e.target.value))))}
                  className="bg-surface border border-muted/20 rounded px-3 py-2"
                />
              </div>
              <div>
                <button
                  onClick={() => {
                    // Request last ghost window segment
                    const now = (window as any).__zenStats?.time || 0;
                    const end = now;
                    const start = Math.max(0, end - settings.ghostWindowMin * 60);
                    const handler = (e: Event) => {
                      const { text } = (e as CustomEvent).detail as { text: string };
                      setGhostPreview(text || '');
                      window.removeEventListener('ghostText', handler as EventListener);
                    };
                    window.addEventListener('ghostText', handler as EventListener);
                    window.dispatchEvent(new CustomEvent('requestGhost', { detail: { startSec: start, endSec: end } }));
                  }}
                  className="w-full px-6 py-3 bg-gold/15 hover:bg-gold/25 border border-gold/30 rounded-lg text-gold"
                >
                  Restore from Ghost
                </button>
                {ghostPreview && (
                  <div className="mt-3">
                    <textarea className="w-full bg-surface/70 border border-muted/20 rounded p-3 text-sm" rows={4} value={ghostPreview} readOnly></textarea>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="px-3 py-2 bg-iris/20 border border-iris/40 rounded text-iris"
                        onClick={() => {
                          // Ask ZenCanvas to inject into input
                          window.dispatchEvent(new CustomEvent('restoreGhost', { detail: { text: ghostPreview } }));
                          setGhostPreview('');
                        }}
                      >
                        Insert into input
                      </button>
                      <button
                        className="px-3 py-2 bg-surface/60 border border-muted/30 rounded text-text"
                        onClick={() => setGhostPreview('')}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-muted/20">
                <button
                  onClick={() => resetAllData()}
                  className="w-full px-6 py-3 bg-love/15 hover:bg-love/25 border border-love/30 rounded-lg text-love"
                >
                  Clear local stats & telemetry
                </button>
              </div>
            </div>
          </>
        ) : showAbout ? (
          <div className="relative overflow-hidden rounded-3xl border border-muted/20 bg-surface/70 px-6 pb-6 pt-7 shadow-[0_24px_70px_rgba(10,4,22,0.55)]">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-[color-mix(in_oklab,var(--rp-iris)75%,#0a0415_25%)]/40 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex items-start justify-between mb-6">
              <h2 className="text-[clamp(1.4rem,2vw,1.8rem)] font-semibold tracking-tight text-foam">About</h2>
              <button
                onClick={() => setShowAbout(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 text-muted/80 shadow-[0_6px_14px_rgba(12,6,24,0.45)] backdrop-blur-md transition-transform duration-200 hover:text-foam hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-iris/40"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="relative space-y-4 text-text">
              <p className="text-sm leading-relaxed">
                Zen Typer is a minimalist typing retreat for mindful practice. Drift in <strong className="text-iris">Zen mode </strong>
                to let your thoughts float upward, or refine precision in <strong className="text-foam">Quote mode</strong> with gentle pacing cues.
              </p>
              <p className="text-sm leading-relaxed text-muted">
                The interface leans on Rosé Pine hues, soft gradients, and motion that respects reduced-motion settings. Everything runs locally so your flow stays private.
              </p>
            </div>

            <div className="relative mt-7 rounded-2xl border border-muted/18 bg-base/30 p-5 shadow-[0_12px_32px_rgba(9,4,18,0.45)]">
              <h3 className="text-xs font-semibold tracking-[0.36em] text-iris/80 uppercase mb-4">Keyboard Shortcuts</h3>
              <div className="grid gap-3">
                {aboutShortcuts.map(({ key, description }) => (
                  <div key={key} className="flex flex-wrap items-center gap-3 text-xs font-mono text-muted">
                    <kbd className="px-3 py-1.5 rounded-xl border border-muted/35 bg-surface/80 text-text/90 shadow-[0_6px_16px_rgba(12,6,24,0.25)]">
                      {key}
                    </kbd>
                    <span className="font-sans text-sm">{description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-6 pt-5 border-t border-muted/20 text-xs text-muted space-y-2">
              <div className="uppercase tracking-[0.28em] text-muted/60">Made by Jonathan Reed</div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <a
                  className="text-iris hover:text-foam transition-colors"
                  href="https://jonathanrreed.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Website
                </a>
                <span className="text-muted/40">•</span>
                <a
                  className="text-iris hover:text-foam transition-colors"
                  href="https://bsky.app/profile/thereedy.bsky.social"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Bluesky
                </a>
                <span className="text-muted/40">•</span>
                <a
                  className="text-iris hover:text-foam transition-colors"
                  href="https://www.linkedin.com/in/jonathanrreed0/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PauseMenu;
