import React, { useState, useCallback } from 'react';
import { saveSettings, resetAllData, type Settings, applySettingsSideEffects } from '../utils/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-muted hover:text-text transition-colors"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="space-y-5">
        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Profile</h3>
          <div className="grid grid-cols-2 gap-3 items-center">
          <Label htmlFor="profile" className="text-text">Profile</Label>
          <Select
            value={settings.profile || 'Practice'}
            onValueChange={(p: NonNullable<Settings['profile']>) => {
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
          >
            <SelectTrigger id="profile" className="bg-surface border border-muted/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Minimal">Minimal</SelectItem>
              <SelectItem value="Practice">Practice</SelectItem>
              <SelectItem value="Meditative">Meditative</SelectItem>
            </SelectContent>
          </Select>
        </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Accessibility</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="reducedMotion" className="text-text">Reduced Motion</Label>
              <Checkbox
                id="reducedMotion"
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => handleSettingChange('reducedMotion', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="highContrast" className="text-text">High Contrast</Label>
              <Checkbox
                id="highContrast"
                checked={settings.highContrast}
                onCheckedChange={(checked) => handleSettingChange('highContrast', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="showStats" className="text-text">Show Stats</Label>
              <Checkbox
                id="showStats"
                checked={settings.showStats}
                onCheckedChange={(checked) => handleSettingChange('showStats', checked)}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Flow</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label htmlFor="zenPreset" className="text-text">Flow Preset</Label>
              <Select
                value={settings.zenPreset}
                onValueChange={(v: Settings['zenPreset']) => {
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
              >
                <SelectTrigger id="zenPreset" className="bg-surface border border-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Calm">Calm</SelectItem>
                  <SelectItem value="Neutral">Neutral</SelectItem>
                  <SelectItem value="Energetic">Energetic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <Label className="text-text">Fade (sec)</Label>
                <span className="text-muted">{(settings.fadeSec ?? 4).toFixed(1)}</span>
              </div>
              <Slider
                min={2}
                max={8}
                step={0.5}
                value={[settings.fadeSec ?? 4]}
                onValueChange={([value]) => handleSettingChange('fadeSec', value)}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <Label className="text-text">Drift amplitude</Label>
                <span className="text-muted">{(settings.driftAmp ?? 6).toFixed(1)} px</span>
              </div>
              <Slider
                min={2}
                max={12}
                step={0.5}
                value={[settings.driftAmp ?? 6]}
                onValueChange={([value]) => handleSettingChange('driftAmp', value)}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <Label className="text-text">Spawn density</Label>
                <span className="text-muted">{(settings.spawnDensity ?? 1.0).toFixed(2)}</span>
              </div>
              <Slider
                min={0.5}
                max={1.5}
                step={0.05}
                value={[settings.spawnDensity ?? 1.0]}
                onValueChange={([value]) => handleSettingChange('spawnDensity', value)}
                className="w-full"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Focus</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label htmlFor="laneStyle" className="text-text">Focus lanes</Label>
              <Select
                value={settings.laneStyle ?? 'soft'}
                onValueChange={(value: Settings['laneStyle']) => handleSettingChange('laneStyle', value)}
              >
                <SelectTrigger id="laneStyle" className="bg-surface border border-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="soft">Soft</SelectItem>
                  <SelectItem value="tight">Tight</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="breath" className="text-text">Breathing overlay</Label>
              <Checkbox
                id="breath"
                checked={settings.breath}
                onCheckedChange={(checked) => handleSettingChange('breath', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="themeShiftLocked" className="text-text">Lock theme shift</Label>
              <Checkbox
                id="themeShiftLocked"
                checked={settings.themeShiftLocked || false}
                onCheckedChange={(checked) => handleSettingChange('themeShiftLocked', checked)}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Quote Mode</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="autoAdvanceQuotes" className="text-text">Auto-Advance Quotes</Label>
              <Checkbox
                id="autoAdvanceQuotes"
                checked={!!settings.autoAdvanceQuotes}
                onCheckedChange={(checked) => handleSettingChange('autoAdvanceQuotes', checked)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label htmlFor="autoAdvanceDelayMs" className="text-text">Auto-Advance Delay (ms)</Label>
              <Input
                id="autoAdvanceDelayMs"
                type="number"
                min={0}
                max={3000}
                value={Math.max(0, Math.min(3000, settings.autoAdvanceDelayMs ?? 0))}
                onChange={(e) => handleSettingChange('autoAdvanceDelayMs', Math.max(0, Math.min(3000, Number(e.target.value))))}
                className="bg-surface border-muted/20"
                disabled={!settings.autoAdvanceQuotes}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">Performance</h3>
          <div className="flex items-center justify-between">
            <Label htmlFor="performanceMode" className="text-text">Performance mode (low-power)</Label>
            <Checkbox
              id="performanceMode"
              checked={!!settings.performanceMode}
              onCheckedChange={(checked) => handleSettingChange('performanceMode', checked)}
            />
          </div>
        </section>

        <section>
          <h3 className="text-sm uppercase tracking-[0.25em] text-muted/80 mb-3">History & Recovery</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="sessionMarkers" className="text-text">Show session markers</Label>
              <Checkbox
                id="sessionMarkers"
                checked={settings.markersEveryMin > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    const next = settings.markersEveryMin <= 0 ? 2 : settings.markersEveryMin;
                    handleSettingChange('markersEveryMin', next);
                  } else {
                    handleSettingChange('markersEveryMin', 0);
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label htmlFor="markersEveryMin" className="text-text">Marker interval (min)</Label>
              <Input
                id="markersEveryMin"
                type="number"
                min={0}
                max={5}
                value={settings.markersEveryMin}
                disabled={settings.markersEveryMin <= 0}
                onChange={(e) => {
                  const next = Math.max(0, Math.min(5, Number(e.target.value)));
                  handleSettingChange('markersEveryMin', next);
                }}
                className="bg-surface border-muted/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Label htmlFor="ghostWindowMin" className="text-text">Ghost window (min)</Label>
              <Input
                id="ghostWindowMin"
                type="number"
                min={2}
                max={5}
                value={settings.ghostWindowMin}
                onChange={(e) => handleSettingChange('ghostWindowMin', Math.max(2, Math.min(5, Number(e.target.value))))}
                className="bg-surface border-muted/20"
              />
            </div>
            <div>
              <Button
                onClick={() => {
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
                variant="outline"
                className="w-full bg-gold/15 hover:bg-gold/25 border-gold/30 text-gold"
              >
                Restore from Ghost
              </Button>
              {ghostPreview && (
                <div className="mt-3">
                  <textarea className="w-full bg-surface/70 border border-muted/20 rounded p-3 text-sm" rows={4} value={ghostPreview} readOnly></textarea>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="outline"
                      className="bg-iris/20 border-iris/40 text-iris"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('restoreGhost', { detail: { text: ghostPreview } }));
                        setGhostPreview('');
                      }}
                    >
                      Insert into input
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-surface/60 border-muted/30 text-text"
                      onClick={() => setGhostPreview('')}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="settings-footer">
          <Button
            onClick={() => resetAllData()}
            variant="outline"
            className="w-full bg-love/15 hover:bg-love/25 border-love/30 text-love"
          >
            Clear local stats & telemetry
          </Button>
        </section>
      </div>
    </>
  );
};
