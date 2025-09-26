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

  const handleSettingChange = (key: keyof Settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
    // Broadcast to listeners
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: newSettings }));
    
    // Apply settings immediately
    if (key === 'reducedMotion') {
      document.documentElement.classList.toggle('reduce-motion', value);
    } else if (key === 'highContrast') {
      document.documentElement.classList.toggle('high-contrast', value);
    } else if (key === 'showStats') {
      // Broadcast to StatsBar and persist
      window.dispatchEvent(new CustomEvent('toggleStats', { detail: value }));
    } else if (key === 'performanceMode') {
      // Low-power mode: reduce visuals
      document.documentElement.classList.toggle('perf-mode', value);
    }
  };

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
                    const patch: Partial<Settings> = { profile: p };
                    if (p === 'Minimal') {
                      Object.assign(patch, { showStats: false, reducedMotion: true, fadeSec: 3, driftAmp: 3, spawnDensity: 0.9, laneStyle: 'none', breath: false });
                    } else if (p === 'Practice') {
                      Object.assign(patch, { showStats: true, reducedMotion: false, fadeSec: 4, driftAmp: 6, spawnDensity: 1.0, laneStyle: 'soft', breath: false });
                    } else if (p === 'Meditative') {
                      Object.assign(patch, { showStats: false, reducedMotion: false, fadeSec: 5, driftAmp: 4, spawnDensity: 0.9, laneStyle: 'soft', breath: true });
                    }
                    // Apply bundle
                    for (const [k, v] of Object.entries(patch)) {
                      // @ts-ignore
                      handleSettingChange(k as keyof Settings, v);
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
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-sans text-foam">About</h2>
              <button
                onClick={() => setShowAbout(false)}
                className="text-muted hover:text-text transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 text-text">
              <p>
                <strong className="text-iris">Zen Typer v1.1</strong>
              </p>
              <p className="text-sm leading-relaxed">
                A minimalist typing experience with two modes: free-flow Zen typing and 
                structured Quote practice. Built for focus, flow, and mindful practice.
              </p>
              <div className="pt-4 border-t border-muted/20">
                <h3 className="text-sm font-bold mb-2">Keyboard Shortcuts</h3>
                <div className="space-y-1 text-xs font-mono">
                  <div><kbd className="px-2 py-1 bg-surface rounded">Tab</kbd> Switch modes</div>
                  <div><kbd className="px-2 py-1 bg-surface rounded">Esc</kbd> Pause menu</div>
                  <div><kbd className="px-2 py-1 bg-surface rounded">F</kbd> Fullscreen</div>
                  <div><kbd className="px-2 py-1 bg-surface rounded">T</kbd> Toggle stats</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PauseMenu;
