import React, { useState, useCallback } from 'react';
import { saveSettings, resetAllData, type Settings, applySettingsSideEffects } from '../utils/storage';

interface SettingsPanelProps {
  settings: Settings;
  onSettingChange: (key: keyof Settings, value: any) => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingChange, onClose }) => {
  const [ghostPreview, setGhostPreview] = useState<string>('');

  const applySettingsPatch = useCallback((patch: Partial<Settings>, broadcast = true) => {
    const next = { ...settings, ...patch } as Settings;
    saveSettings(next);
    Object.entries(patch).forEach(([key, value]) => {
      onSettingChange(key as keyof Settings, value);
    });
    if (broadcast) {
      window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
    }

    applySettingsSideEffects(patch, next, { broadcast });

    return next;
  }, [settings, onSettingChange]);

  const handleSettingChange = (key: keyof Settings, value: any) => {
    applySettingsPatch({ [key]: value } as Partial<Settings>);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-sans text-foam">Settings</h2>
        <button
          onClick={onClose}
          className="text-muted hover:text-text transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="space-y-5">
        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Profile</h3>
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
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Accessibility</h3>
          <div className="space-y-3">
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
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Flow</h3>
          <div className="space-y-3">
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
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Focus</h3>
          <div className="space-y-3">
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
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Quote Mode</h3>
          <div className="space-y-3">
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
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Performance</h3>
          <label className="flex items-center justify-between">
            <span className="text-text">Performance mode (low-power)</span>
            <input
              type="checkbox"
              checked={!!settings.performanceMode}
              onChange={(e) => handleSettingChange('performanceMode', e.target.checked)}
              className="w-5 h-5 rounded accent-iris"
            />
          </label>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">History & Recovery</h3>
          <div className="space-y-3">
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
          </div>
        </section>

        <section className="settings-footer">
          <button
            onClick={() => resetAllData()}
            className="w-full px-6 py-3 bg-love/15 hover:bg-love/25 border border-love/30 rounded-lg text-love"
          >
            Clear local stats & telemetry
          </button>
        </section>
      </div>
    </>
  );
};
