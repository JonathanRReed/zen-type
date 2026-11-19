import React, { useState, useCallback, useRef, useId, useLayoutEffect } from 'react';
import {
  updateSettings,
  resetAllData,
  FONT_OPTIONS,
  FONT_LABELS,
  DEFAULT_STATS_BAR_METRICS,
  type FontOption,
  type Settings,
  type QuoteLength,
  type StatsBarMetricKey,
} from '../utils/storage';
import { QUOTE_TAGS } from '../utils/quotes';
import { downloadBackup, restoreFromFile, clearAllLocalData } from '../utils/backup';
import { audio } from '../utils/audio';
import type { SwitchSoundProfile, AmbientSoundscape } from '../utils/storage';
import { THEMES } from './ThemeToggle';
import { IconBack } from './icons';

interface SettingsPanelProps {
  settings: Settings;
  mode: 'zen' | 'quote';
  onSettingChange: (key: keyof Settings, value: unknown) => void;
  onClose: () => void;
}

type TabId = 'look' | 'quote' | 'zen' | 'sound' | 'data';

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'look', label: 'Look' },
  { id: 'quote', label: 'Quote' },
  { id: 'zen', label: 'Zen' },
  { id: 'sound', label: 'Sound' },
  { id: 'data', label: 'Your data' },
];

const METRIC_LABELS: Record<StatsBarMetricKey, string> = {
  time: 'Time',
  words: 'Words',
  wpm: 'WPM',
  accuracy: 'Accuracy',
  streak: 'Day streak',
};

const PRESETS: Record<NonNullable<Settings['profile']>, Partial<Settings>> = {
  Minimal: { showStats: false, reducedMotion: true, fadeSec: 3, driftAmp: 3, spawnDensity: 0.9, laneStyle: 'none', breath: false },
  Practice: { showStats: true, reducedMotion: false, fadeSec: 4, driftAmp: 6, spawnDensity: 1.0, laneStyle: 'soft', breath: false },
  Meditative: { showStats: false, reducedMotion: false, fadeSec: 5, driftAmp: 4, spawnDensity: 0.9, laneStyle: 'soft', breath: true },
};

const ZEN_FEEL: Record<Settings['zenPreset'], Partial<Settings>> = {
  Calm: { fadeSec: 6, driftAmp: 4, spawnDensity: 0.8 },
  Neutral: { fadeSec: 4, driftAmp: 6, spawnDensity: 1.0 },
  Energetic: { fadeSec: 3, driftAmp: 8, spawnDensity: 1.2 },
};

// -- small building blocks ----------------------------------------------------

const Toggle: React.FC<{
  label: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, note, checked, disabled, onChange }) => {
  const id = useId();
  return (
    <div className="setting">
      <label htmlFor={id} className="setting-label">{label}</label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {note && <p className="setting-note">{note}</p>}
    </div>
  );
};

const Choice: React.FC<{
  label: string;
  note?: string;
  value: string;
  disabled?: boolean;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}> = ({ label, note, value, disabled, options, onChange }) => {
  const id = useId();
  return (
    <div className="setting setting-wide">
      <label htmlFor={id} className="setting-label">{label}</label>
      <select id={id} className="select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {note && <p className="setting-note">{note}</p>}
    </div>
  );
};

const Range: React.FC<{
  label: string;
  note?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  format: (value: number) => string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}> = ({ label, note, value, min, max, step, disabled, format, onChange, onCommit }) => {
  const id = useId();
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div className="setting setting-stack">
      <label htmlFor={id} className="setting-label">{label}</label>
      <span className="setting-value">{format(value)}</span>
      <input
        id={id}
        type="range"
        className="range"
        style={{ '--range-fill': fill } as React.CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
      {note && <p className="setting-note">{note}</p>}
    </div>
  );
};

/** The caret on three words, placed by measuring like the real one. */
const CaretPreview: React.FC<{ watch: string }> = ({ watch }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const nowRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const box = boxRef.current;
      const now = nowRef.current;
      const caret = caretRef.current;
      if (!box || !now || !caret) return;
      const r = now.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      caret.style.transform = `translate3d(${r.left - b.left}px, ${r.top - b.top}px, 0)`;
      caret.style.setProperty('--cw', `${r.width}px`);
      caret.style.setProperty('--ch', `${r.height}px`);
    };
    place();
    // The chosen font may still be on its way; place again when it lands.
    void document.fonts?.ready.then(place).catch(() => {});
    const timer = window.setTimeout(place, 250);
    return () => window.clearTimeout(timer);
  }, [watch]);

  return (
    <div ref={boxRef} className="caret-preview" aria-hidden="true">
      <span className="q-done">Still&nbsp;</span>
      <span ref={nowRef} className="q-now">w</span>ater
      <span ref={caretRef} className="passage-caret is-idle" />
    </div>
  );
};

// -- tabs ---------------------------------------------------------------------

type SetSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => void;
type PatchSettings = (changes: Partial<Settings>) => void;

interface TabProps {
  settings: Settings;
  set: SetSetting;
}

const LookTab: React.FC<TabProps & { mode: 'zen' | 'quote'; patch: PatchSettings }> = ({ settings, mode, set, patch }) => {
  const [metricMode, setMetricMode] = useState<'zen' | 'quote'>(mode);
  const metrics = settings.statsBarMetrics?.[metricMode] ?? DEFAULT_STATS_BAR_METRICS[metricMode];
  const metricChoices: StatsBarMetricKey[] = [...DEFAULT_STATS_BAR_METRICS[metricMode], 'streak'];
  const toggleMetric = (metric: StatsBarMetricKey) => {
    const on = metrics.includes(metric);
    if (on && metrics.length === 1) return;
    const next = on
      ? metrics.filter(m => m !== metric)
      : [...metrics, metric].sort((a, b) => metricChoices.indexOf(a) - metricChoices.indexOf(b));
    patch({
      statsBarMetrics: {
        zen: [...(settings.statsBarMetrics?.zen ?? DEFAULT_STATS_BAR_METRICS.zen)],
        quote: [...(settings.statsBarMetrics?.quote ?? DEFAULT_STATS_BAR_METRICS.quote)],
        [metricMode]: next,
      },
    });
  };

  return (
    <>
      <section className="settings-group">
        <div className="setting setting-stack">
          <span className="setting-label" id="settings-theme-label">Theme</span>
          <span className="setting-value">{settings.theme}</span>
          <div className="theme-swatches" role="group" aria-labelledby="settings-theme-label">
            {THEMES.map(t => (
              <button
                key={t.name}
                type="button"
                className="theme-swatch"
                aria-pressed={settings.theme === t.name}
                title={t.note}
                onClick={() => set('theme', t.name)}
              >
                <i className="swatch" style={{ '--swatch-a': t.swatch[0], '--swatch-b': t.swatch[1] } as React.CSSProperties} />
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <Choice
          label="Typing font"
          value={settings.fontFamily ?? FONT_OPTIONS[0]}
          options={FONT_OPTIONS.map(f => ({ value: f, label: FONT_LABELS[f] }))}
          onChange={(v) => set('fontFamily', v as FontOption)}
        />
        <Choice
          label="Caret style"
          value={settings.caretStyle ?? 'line'}
          options={[
            { value: 'line', label: 'Line' },
            { value: 'block', label: 'Block' },
            { value: 'underline', label: 'Underline' },
            { value: 'glow', label: 'Glow' },
          ]}
          onChange={(v) => set('caretStyle', v as NonNullable<Settings['caretStyle']>)}
        />
        <CaretPreview watch={`${settings.caretStyle}|${settings.fontFamily}`} />
      </section>

      <section className="settings-group">
        <h3>Stats line</h3>
        <Toggle label="Show the stats line" checked={settings.showStats} onChange={(v) => set('showStats', v)} />
        <div className="setting setting-stack">
          <span className="setting-label" id="settings-metrics-label">Numbers shown</span>
          <span className="chips" role="group" aria-label="Mode">
            {(['quote', 'zen'] as const).map(m => (
              <button key={m} type="button" className="chip" aria-pressed={metricMode === m} onClick={() => setMetricMode(m)}>
                {m === 'quote' ? 'In Quote' : 'In Zen'}
              </button>
            ))}
          </span>
          <div className="chips" role="group" aria-labelledby="settings-metrics-label">
            {metricChoices.map(metric => (
              <button
                key={metric}
                type="button"
                className="chip"
                aria-pressed={metrics.includes(metric)}
                disabled={!settings.showStats}
                onClick={() => toggleMetric(metric)}
              >
                {METRIC_LABELS[metric]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h3>Comfort</h3>
        <Toggle
          label="Reduced motion"
          note="Holds the scene still and drops the small animations."
          checked={settings.reducedMotion}
          onChange={(v) => set('reducedMotion', v)}
        />
        <Toggle label="High contrast" checked={settings.highContrast} onChange={(v) => set('highContrast', v)} />
        <Toggle
          label="Low-power mode"
          note="Stops the moving background and particles to save battery."
          checked={!!settings.performanceMode}
          onChange={(v) => set('performanceMode', v)}
        />
        <Choice
          label="Preset"
          note="Sets the stats line, motion, and Zen drift together."
          value={settings.profile || 'Practice'}
          options={[
            { value: 'Minimal', label: 'Minimal' },
            { value: 'Practice', label: 'Practice' },
            { value: 'Meditative', label: 'Meditative' },
          ]}
          onChange={(v) => {
            const profile = v as NonNullable<Settings['profile']>;
            patch({ profile, ...PRESETS[profile] });
          }}
        />
      </section>
    </>
  );
};

const QuoteTab: React.FC<TabProps> = ({ settings, set }) => (
    <>
      <section className="settings-group">
        <div className="setting setting-stack">
          <span className="setting-label" id="settings-length-label">Length</span>
          <span className="setting-value">{(settings.quoteLengths ?? []).length ? '' : 'Any'}</span>
          <div className="chips" role="group" aria-label="Quote length">
            {(['short', 'medium', 'long'] as QuoteLength[]).map(len => {
              const current = settings.quoteLengths ?? [];
              const on = current.includes(len);
              return (
                <button
                  key={len}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => set('quoteLengths', on ? current.filter(l => l !== len) : [...current, len])}
                >
                  {len === 'short' ? 'Short' : len === 'medium' ? 'Medium' : 'Long'}
                </button>
              );
            })}
          </div>
        </div>
        <div className="setting setting-stack">
          <span className="setting-label">Subjects</span>
          <span className="setting-value">{(settings.quoteTags ?? []).length ? '' : 'All'}</span>
          <div className="chips" role="group" aria-label="Quote subjects">
            {QUOTE_TAGS.map(tag => {
              const current = settings.quoteTags ?? [];
              const on = current.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  title={tag.blurb}
                  onClick={() => set('quoteTags', on ? current.filter(t => t !== tag.id) : [...current, tag.id])}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <p className="setting-note">Nothing selected means everything. Changes apply from the next quote.</p>
        </div>
      </section>

      <section className="settings-group">
        <h3>Pace</h3>
        <Choice
          label="Pace marker"
          note="A quiet underline that moves through the quote at the speed you pick."
          value={String(settings.targetWpm ?? 0)}
          options={[
            { value: '0', label: 'Off' },
            { value: '40', label: '40 wpm' },
            { value: '60', label: '60 wpm' },
            { value: '80', label: '80 wpm' },
            { value: '100', label: '100 wpm' },
            { value: '120', label: '120 wpm' },
          ]}
          onChange={(v) => set('targetWpm', Number(v))}
        />
        <Toggle
          label="Go to the next quote by itself"
          checked={!!settings.autoAdvanceQuotes}
          onChange={(v) => set('autoAdvanceQuotes', v)}
        />
        <Range
          label="Wait before the next quote"
          value={Math.max(0, Math.min(3000, settings.autoAdvanceDelayMs ?? 1500))}
          min={0}
          max={3000}
          step={250}
          disabled={!settings.autoAdvanceQuotes}
          format={(v) => (v === 0 ? 'No wait' : `${v / 1000} s`)}
          onChange={(v) => set('autoAdvanceDelayMs', v)}
        />
        <Range
          label="Ignore repeated keys"
          note="For keyboards that register one press twice. Leave it off unless yours does."
          value={settings.debounceMs ?? 0}
          min={0}
          max={50}
          step={5}
          format={(v) => (v === 0 ? 'Off' : `within ${v} ms`)}
          onChange={(v) => set('debounceMs', v)}
        />
      </section>
    </>
);

const ZenTab: React.FC<TabProps & { patch: PatchSettings }> = ({ settings, set, patch }) => (
    <>
      <section className="settings-group">
        <Choice
          label="Feel"
          note="Sets the three sliders below together."
          value={settings.zenPreset}
          options={[
            { value: 'Calm', label: 'Calm' },
            { value: 'Neutral', label: 'Neutral' },
            { value: 'Energetic', label: 'Energetic' },
          ]}
          onChange={(v) => {
            const zenPreset = v as Settings['zenPreset'];
            patch({ zenPreset, ...ZEN_FEEL[zenPreset] });
          }}
        />
        <Range
          label="How long words linger"
          value={settings.fadeSec ?? 4}
          min={2}
          max={8}
          step={0.5}
          format={(v) => `${v.toFixed(1)} s`}
          onChange={(v) => set('fadeSec', v)}
        />
        <Range
          label="Sway"
          value={settings.driftAmp ?? 6}
          min={2}
          max={12}
          step={0.5}
          format={(v) => `${v.toFixed(1)} px`}
          onChange={(v) => set('driftAmp', v)}
        />
        <Range
          label="How many words rise"
          value={settings.spawnDensity ?? 1}
          min={0.5}
          max={1.5}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => set('spawnDensity', v)}
        />
        <Choice
          label="Where words rise"
          value={settings.laneStyle ?? 'soft'}
          options={[
            { value: 'none', label: 'Anywhere' },
            { value: 'soft', label: 'Three loose columns' },
            { value: 'tight', label: 'Three tight columns' },
          ]}
          onChange={(v) => set('laneStyle', v as Settings['laneStyle'])}
        />
      </section>

      <section className="settings-group">
        <h3>Session</h3>
        <Choice
          label="Timer"
          note="Tells you when the time is up, with a chime if sound is on."
          value={String(settings.timedFlowMinutes ?? 0)}
          options={[
            { value: '0', label: 'Off' },
            { value: '3', label: '3 minutes' },
            { value: '5', label: '5 minutes' },
            { value: '10', label: '10 minutes' },
          ]}
          onChange={(v) => set('timedFlowMinutes', Number(v))}
        />
        <Toggle
          label="Breathing ring"
          note="A slow ring behind the words: four seconds in, four out."
          checked={settings.breath}
          onChange={(v) => set('breath', v)}
        />
      </section>
    </>
);

const SoundTab: React.FC<TabProps & { patch: PatchSettings }> = ({ settings, set, patch }) => {
  const soundOn = !!settings.soundEnabled;
  return (
    <section className="settings-group">
      <Toggle
        label="Sound"
        note="Made in the browser as you type. Nothing is downloaded. Ctrl+M switches it from anywhere."
        checked={soundOn}
        onChange={(enabled) => {
          const profile = settings.switchSound === 'none' ? 'thock' : (settings.switchSound ?? 'thock');
          patch({ soundEnabled: enabled, switchSound: profile });
          if (enabled) window.setTimeout(() => audio.preview(profile), 50);
        }}
      />
      <Choice
        label="Keys"
        value={settings.switchSound || 'none'}
        disabled={!soundOn}
        options={[
          { value: 'none', label: 'Silent' },
          { value: 'thock', label: 'Thock, deep' },
          { value: 'cream', label: 'Cream, soft' },
          { value: 'holy-panda', label: 'Holy Panda, tactile' },
          { value: 'clicky', label: 'Clicky' },
          { value: 'typewriter', label: 'Typewriter, bell on Enter' },
          { value: 'raindrop', label: 'Raindrop' },
        ]}
        onChange={(v) => {
          const value = v as SwitchSoundProfile;
          set('switchSound', value);
          if (value !== 'none') window.setTimeout(() => audio.preview(value), 50);
        }}
      />
      <Range
        label="Key volume"
        value={settings.audioVolume ?? 0.6}
        min={0}
        max={1}
        step={0.05}
        disabled={!soundOn}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => set('audioVolume', v)}
        onCommit={() => window.setTimeout(() => audio.preview(), 30)}
      />
      <Choice
        label="Background"
        value={settings.ambientSound || 'none'}
        disabled={!soundOn}
        options={[
          { value: 'none', label: 'None' },
          { value: 'rain', label: 'Rain' },
          { value: 'wind', label: 'Wind' },
          { value: 'fire', label: 'Fire' },
          { value: 'drone', label: 'Low drone' },
        ]}
        onChange={(v) => set('ambientSound', v as AmbientSoundscape)}
      />
      <Range
        label="Background volume"
        value={settings.ambientVolume ?? 0.4}
        min={0}
        max={1}
        step={0.05}
        disabled={!soundOn}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => set('ambientVolume', v)}
      />
    </section>
  );
};

const DataTab: React.FC = () => {
  const [dataNote, setDataNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="settings-group">
      <p className="sheet-lede">
        Everything lives in this browser. A backup is one file with your settings, history, and drafts. Nothing is uploaded.
      </p>
      <div className="settings-data">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            downloadBackup().then(() => setDataNote('Backup saved.')).catch(() => setDataNote('Could not build the backup.'));
          }}
        >
          Back up everything
        </button>
        <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
          Restore from backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a backup file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            restoreFromFile(file)
              .then((summary) => setDataNote(`Restored ${summary.sessions} sessions and ${summary.drafts} drafts.`))
              .catch((err: unknown) => setDataNote(err instanceof Error ? err.message : 'Restore failed.'));
          }}
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            if (window.confirm('Reset your stats and session history? Settings and drafts stay.')) {
              resetAllData();
              setDataNote('Stats and history cleared.');
            }
          }}
        >
          Reset stats
        </button>
        <button
          type="button"
          className="btn btn-outline btn-danger"
          onClick={() => {
            if (window.confirm('Delete everything Zen Typer keeps in this browser, including every draft? This cannot be undone.')) {
              clearAllLocalData().finally(() => window.location.reload());
            }
          }}
        >
          Delete all data
        </button>
      </div>
      {dataNote && <p className="settings-status" role="status" aria-live="polite">{dataNote}</p>}
    </section>
  );
};

// -- panel --------------------------------------------------------------------

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, mode, onSettingChange, onClose }) => {
  const [tab, setTab] = useState<TabId>('look');
  const patch = useCallback((changes: Partial<Settings>) => {
    updateSettings(changes);
    for (const [key, value] of Object.entries(changes)) onSettingChange(key as keyof Settings, value);
  }, [onSettingChange]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => patch({ [key]: value } as Partial<Settings>);

  const onTabKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const index = TABS.findIndex(t => t.id === tab);
    const next = TABS[(index + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length];
    if (!next) return;
    setTab(next.id);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)?.focus();
  };

  return (
    <>
      <div className="sheet-head">
        <h2 id="pause-settings-title" className="sheet-title">Settings</h2>
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Back to menu">
          <IconBack />
        </button>
      </div>

      {/* eslint-disable-next-line jsx-a11y-x/interactive-supports-focus */}
      <div className="tabs" role="tablist" aria-label="Settings sections" onKeyDown={onTabKey}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`settings-tab-${t.id}`}
            data-tab={t.id}
            className="tab"
            aria-selected={tab === t.id}
            aria-controls="settings-panel"
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'look' && <LookTab settings={settings} mode={mode} set={set} patch={patch} />}
        {tab === 'quote' && <QuoteTab settings={settings} set={set} />}
        {tab === 'zen' && <ZenTab settings={settings} set={set} patch={patch} />}
        {tab === 'sound' && <SoundTab settings={settings} set={set} patch={patch} />}
        {tab === 'data' && <DataTab />}
      </div>
    </>
  );
};
