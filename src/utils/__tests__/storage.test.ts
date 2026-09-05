import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizeSettings,
  getSettings,
  updateSettings,
  subscribeSettings,
  recordSession,
  getStats,
  getHistory,
  getStreak,
  getPracticeDays,
  computeStreak,
  practicedToday,
  getHints,
  markHint,
  resetAllData,
  STORAGE_KEYS,
  HISTORY_LIMIT,
  DEFAULT_SETTINGS,
  __resetStoragePersistenceStateForTests,
} from '../storage';

const iso = (daysAgo: number, hour = 9): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const session = (daysAgo: number, overrides: Partial<Parameters<typeof recordSession>[0]> = {}) => {
  const endedAt = new Date(iso(daysAgo));
  const startedAt = new Date(endedAt.getTime() - 60_000);
  return recordSession({
    mode: 'quote',
    startedAt,
    endedAt,
    wordsTyped: 12,
    charactersTyped: 60,
    wpm: 60,
    accuracy: 96,
    ...overrides,
  });
};

beforeEach(() => {
  __resetStoragePersistenceStateForTests();
});

describe('normalizeSettings', () => {
  it('fills defaults and drops junk', () => {
    const s = normalizeSettings({
      theme: 'Neon',
      caretStyle: 'sparkle',
      switchSound: 'banana',
      ambientSound: 'ocean',
      audioVolume: 7,
      ambientVolume: -1,
      targetWpm: '80',
      timedFlowMinutes: 500,
      quoteLengths: ['short', 'huge'],
      quoteTags: ['stoic', 42, ''],
      statsBarMetrics: { zen: ['accuracy', 'wpm', 'bogus'], quote: [] },
    });
    expect(s.theme).toBe('Void');
    expect(s.caretStyle).toBe('line');
    expect(s.switchSound).toBe('thock');
    expect(s.ambientSound).toBe('none');
    expect(s.audioVolume).toBe(1);
    expect(s.ambientVolume).toBe(0);
    expect(s.targetWpm).toBe(80);
    expect(s.timedFlowMinutes).toBe(60);
    expect(s.quoteLengths).toEqual(['short']);
    expect(s.quoteTags).toEqual(['stoic']);
    expect(s.statsBarMetrics?.zen).toEqual(['wpm']);
    expect(s.statsBarMetrics?.quote).toEqual(['time', 'words', 'wpm', 'accuracy']);
  });

  it('maps the retired Plain theme to Void', () => {
    expect(normalizeSettings({ theme: 'Plain' }).theme).toBe('Void');
  });

  it('keeps every known theme', () => {
    for (const theme of ['Void', 'Cosmic', 'Aurora', 'Ocean', 'Glacier', 'Forest', 'Ember', 'Sakura'] as const) {
      expect(normalizeSettings({ theme }).theme).toBe(theme);
    }
  });
});

describe('settings store', () => {
  it('starts from defaults when nothing is stored', () => {
    expect(getSettings()).toEqual(expect.objectContaining({ theme: 'Void', soundEnabled: false }));
  });

  it('updateSettings persists, notifies subscribers, and broadcasts the legacy event', () => {
    const listener = vi.fn();
    const legacy = vi.fn();
    const unsubscribe = subscribeSettings(listener);
    window.addEventListener('settingsChanged', legacy);
    const next = updateSettings({ soundEnabled: true, switchSound: 'clicky' });
    expect(next.soundEnabled).toBe(true);
    expect(getSettings().switchSound).toBe('clicky');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.SETTINGS)!).switchSound).toBe('clicky');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ soundEnabled: true }));
    expect(legacy).toHaveBeenCalledTimes(1);
    unsubscribe();
    window.removeEventListener('settingsChanged', legacy);
  });

  it('survives a reload: a fresh read returns what was saved', () => {
    updateSettings({ soundEnabled: true, ambientSound: 'rain', audioVolume: 0.3 });
    __resetStoragePersistenceStateForTests();
    const s = getSettings();
    expect(s.soundEnabled).toBe(true);
    expect(s.ambientSound).toBe('rain');
    expect(s.audioVolume).toBe(0.3);
  });

  it('applies document side effects', () => {
    updateSettings({ caretStyle: 'block', performanceMode: true, highContrast: true });
    expect(document.documentElement.getAttribute('data-caret')).toBe('block');
    expect(document.documentElement.classList.contains('perf-mode')).toBe(true);
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true);
    updateSettings({ performanceMode: false, highContrast: false });
  });

  it('exposes defaults for every audio and quote field', () => {
    expect(DEFAULT_SETTINGS.soundEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.quoteLengths).toEqual([]);
    expect(DEFAULT_SETTINGS.quoteTags).toEqual([]);
  });
});

describe('sessions, stats, history', () => {
  it('records a session into stats and history', () => {
    const record = session(0);
    expect(record.mode).toBe('quote');
    expect(record.wpm).toBe(60);
    const stats = getStats();
    expect(stats.sessionsCompleted).toBe(1);
    expect(stats.quoteSessions).toBe(1);
    expect(stats.bestWpm).toBe(60);
    expect(stats.totalWords).toBe(12);
    expect(getHistory()).toHaveLength(1);
  });

  it('keeps best WPM and averages accuracy over quote sessions only', () => {
    session(0, { wpm: 40, accuracy: 90 });
    session(0, { wpm: 70, accuracy: 100 });
    recordSession({ mode: 'zen', startedAt: new Date(Date.now() - 60_000), endedAt: new Date(), wordsTyped: 200, charactersTyped: 1000 });
    const stats = getStats();
    expect(stats.bestWpm).toBe(70);
    expect(stats.averageAccuracy).toBe(95);
    expect(stats.zenSessions).toBe(1);
    expect(stats.quoteSessions).toBe(2);
  });

  it('caps the history', () => {
    const many = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => ({
      id: `r${i}`, mode: 'quote' as const, date: iso(0), timeSec: 10, words: 5, chars: 25, wpm: 50,
    }));
    window.localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(many));
    session(0);
    expect(getHistory()).toHaveLength(HISTORY_LIMIT);
  });

  it('migrates the old ten-entry telemetry log on first read', () => {
    window.localStorage.setItem(STORAGE_KEYS.TELEMETRY, JSON.stringify([
      { date: iso(3), mode: 'quote', timeSec: 30, words: 20, wpm: 55, accuracy: 97 },
      { date: iso(1), mode: 'zen', timeSec: 300, words: 150 },
    ]));
    const history = getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]?.wpm).toBe(55);
    expect(history[1]?.mode).toBe('zen');
    expect(history[1]?.chars).toBe(750);
    expect(window.localStorage.getItem(STORAGE_KEYS.HISTORY)).not.toBeNull();
  });

  it('dispatches sessionRecorded', () => {
    const spy = vi.fn();
    window.addEventListener('sessionRecorded', spy);
    session(0);
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener('sessionRecorded', spy);
  });

  it('resetAllData clears stats and history but not settings', () => {
    updateSettings({ theme: 'Ember' });
    session(0);
    resetAllData();
    expect(getStats().sessionsCompleted).toBe(0);
    expect(getHistory()).toHaveLength(0);
    expect(getSettings().theme).toBe('Ember');
  });
});

describe('streak', () => {
  it('counts consecutive calendar days ending today', () => {
    session(2); session(1); session(0);
    expect(getPracticeDays()).toHaveLength(3);
    expect(getStreak()).toBe(3);
    expect(practicedToday()).toBe(true);
  });

  it('is still alive when the last session was yesterday', () => {
    session(2); session(1);
    expect(getStreak()).toBe(2);
    expect(practicedToday()).toBe(false);
  });

  it('breaks after a missed day', () => {
    session(4); session(3); session(0);
    expect(getStreak()).toBe(1);
  });

  it('is zero when the last session is two days old', () => {
    session(3); session(2);
    expect(getStreak()).toBe(0);
  });

  it('two sessions on one day count once', () => {
    session(0, { wpm: 30 }); session(0, { wpm: 50 });
    expect(getStreak()).toBe(1);
  });

  it('computeStreak treats an early morning after a late night as two days', () => {
    const late = new Date(); late.setDate(late.getDate() - 1); late.setHours(23, 50);
    const early = new Date(); early.setHours(0, 10);
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(computeStreak([key(late), key(early)], early)).toBe(2);
  });

  it('honours a stored streak from before the history existed while it is fresh', () => {
    window.localStorage.setItem(STORAGE_KEYS.STREAK, '7');
    window.localStorage.setItem(STORAGE_KEYS.LAST_SESSION, JSON.stringify({ endedAt: iso(1) }));
    expect(getStreak()).toBe(7);
    window.localStorage.setItem(STORAGE_KEYS.LAST_SESSION, JSON.stringify({ endedAt: iso(5) }));
    expect(getStreak()).toBe(0);
  });
});

describe('hints', () => {
  it('remembers what has been shown', () => {
    expect(getHints()).toEqual({});
    markHint('firstRun');
    expect(getHints().firstRun).toBe(true);
    expect(getHints().audio).toBeUndefined();
  });
});
