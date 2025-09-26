import React, { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings, getStats, updateStats, updateStreak, type Settings, FONT_OPTIONS, applySettingsSideEffects } from '../utils/storage';
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
      performanceMode: settings.performanceMode,
      fontFamily: settings.fontFamily,
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
      <button
        type="button"
        className="absolute inset-0 bg-transparent focus:outline-none"
        onClick={closeMenu}
        aria-label="Close pause menu"
      />
      <div
        className={`glass rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto overscroll-contain relative z-10 ${showSettings ? 'settings-shell settings-scroll' : ''}`}
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

              <div className="space-y-2">
                <label htmlFor="pause-font-select" className="block text-sm text-muted/80 font-sans">
                  Typing font
                </label>
                <select
                  id="pause-font-select"
                  value={settings.fontFamily ?? FONT_OPTIONS[0]}
                  onChange={(e) => applySettingsPatch({ fontFamily: e.target.value as Settings['fontFamily'] })}
                  className="w-full px-3 py-2 bg-surface/60 hover:bg-surface/70 border border-muted/20 rounded-lg text-text transition-all focus:outline-none focus:ring-2 focus:ring-iris/50"
                >
                  {FONT_OPTIONS.map(font => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </select>
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
                      <button
                        key={sec}
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
                      </button>
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
              const next = { ...settings, [key]: value } as Settings;
              setSettings(next);
              saveSettings(next);
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
