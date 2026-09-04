// Local persistence for Zen Typer: settings, stats, session history, streak,
// and the one-time hint flags. Everything lives in localStorage; drafts live
// in IndexedDB (see lib/draftStore.ts). Nothing here talks to a server.

const STORAGE_PERSISTENCE_ERROR_EVENT = 'zen:storage-persistence-error';

export type StorageFailureDetail = {
  key: string;
  action: 'read' | 'write';
  error: unknown;
};

let storagePersistenceDisabled = false;
let lastStorageFailure: StorageFailureDetail | null = null;

const isStorageAccessible = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

const notifyStorageFailure = (detail: StorageFailureDetail) => {
  lastStorageFailure = detail;
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(STORAGE_PERSISTENCE_ERROR_EVENT, { detail }));
    } catch (eventError) {
      console.warn('Dispatching storage persistence error event failed', eventError);
    }
  }
};

const markPersistenceDisabled = (detail: StorageFailureDetail) => {
  if (storagePersistenceDisabled) return;
  storagePersistenceDisabled = true;
  console.error('[storage] Persistent failures detected. Disabling future writes.', detail.error);
  notifyStorageFailure(detail);
};

export function getJSON<T>(key: string, fallback: T): T {
  if (!isStorageAccessible() || storagePersistenceDisabled) {
    return fallback;
  }
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    notifyStorageFailure({ key, action: 'read', error });
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  if (!isStorageAccessible() || storagePersistenceDisabled) {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
    markPersistenceDisabled({ key, action: 'write', error });
  }
}

export function isStoragePersistenceDisabled(): boolean {
  return storagePersistenceDisabled;
}

export function getLastStorageFailure(): StorageFailureDetail | null {
  return lastStorageFailure;
}

export function getStoragePersistenceErrorEvent(): string {
  return STORAGE_PERSISTENCE_ERROR_EVENT;
}

export function __resetStoragePersistenceStateForTests(): void {
  storagePersistenceDisabled = false;
  lastStorageFailure = null;
  _settingsCache = null;
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export const FONT_OPTIONS = [
  'Nebula Sans',
  'JetBrains Mono',
  'Fira Code',
  'IBM Plex Mono',
  'Source Code Pro',
  'Inter',
  'Manrope',
  'Space Grotesk',
  'Roboto',
  'Lato'
] as const;
export type FontOption = typeof FONT_OPTIONS[number];

const FONT_STACKS: Record<FontOption, string> = {
  'Nebula Sans': "'Nebula Sans', 'Inter', 'Helvetica Neue', Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  'JetBrains Mono': "'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  'Fira Code': "'Fira Code', 'JetBrains Mono', 'IBM Plex Mono', 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  'IBM Plex Mono': "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  'Source Code Pro': "'Source Code Pro', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  'Inter': "'Inter', 'Manrope', 'Space Grotesk', 'Roboto', 'Segoe UI', 'Helvetica Neue', Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'Manrope': "'Manrope', 'Inter', 'Space Grotesk', 'Roboto', 'Segoe UI', 'Helvetica Neue', Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'Space Grotesk': "'Space Grotesk', 'Manrope', 'Inter', 'Roboto', 'Segoe UI', 'Helvetica Neue', Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'Roboto': "'Roboto', 'Inter', 'Manrope', 'Segoe UI', 'Helvetica Neue', Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'Lato': "'Lato', 'Inter', 'Roboto', 'Segoe UI', 'Helvetica Neue', Arial, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

export function getFontStack(font: FontOption): string {
  return FONT_STACKS[font] ?? FONT_STACKS['Nebula Sans'];
}

export function syncTypingFont(font: FontOption): void {
  if (typeof document === 'undefined') return;
  const stack = getFontStack(font);
  document.documentElement.style.setProperty('--typing-font', stack);
  document.documentElement.style.setProperty('--ui-font', stack);

  const fonts = (document as Document & { fonts?: { load?: (spec: string) => Promise<unknown> } }).fonts;
  if (fonts?.load) {
    const family = font.replace(/"/g, '\\"');
    for (const weight of ['400', '500', '600', '700']) {
      void fonts.load(`${weight} 1rem "${family}"`).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type StatsBarMetricKey = 'time' | 'words' | 'wpm' | 'accuracy' | 'streak';

export const DEFAULT_STATS_BAR_METRICS: Readonly<Record<'zen' | 'quote', StatsBarMetricKey[]>> = {
  zen: ['time', 'words', 'wpm'],
  quote: ['time', 'words', 'wpm', 'accuracy'],
};

const ALLOWED_STATS_BAR_METRICS: readonly StatsBarMetricKey[] = ['time', 'words', 'wpm', 'accuracy', 'streak'];

export type ThemeName = 'Void' | 'Forest' | 'Ocean' | 'Cosmic' | 'Ember' | 'Sakura' | 'Aurora' | 'Glacier';
export const THEME_NAMES: readonly ThemeName[] = ['Void', 'Cosmic', 'Aurora', 'Ocean', 'Glacier', 'Forest', 'Ember', 'Sakura'];

export type CaretStyle = 'line' | 'block' | 'underline' | 'glow';
export type SwitchSoundProfile = 'none' | 'thock' | 'cream' | 'raindrop' | 'typewriter' | 'holy-panda' | 'clicky';
export type AmbientSoundscape = 'none' | 'rain' | 'wind' | 'drone' | 'fire';
export type QuoteLength = 'short' | 'medium' | 'long';

export interface Settings {
  theme: ThemeName;
  reducedMotion: boolean;
  showStats: boolean;
  highContrast: boolean;
  fontFamily?: FontOption;
  caretStyle?: CaretStyle;
  autoAdvanceQuotes?: boolean;
  autoAdvanceDelayMs?: number; // 0 for immediate; default 1500
  performanceMode?: boolean;
  // Named presets that set several of the Zen controls at once
  profile?: 'Minimal' | 'Practice' | 'Meditative';
  // Typing feel
  debounceMs?: number; // ignore ultra-fast duplicate keystrokes under this ms (0 = off)
  // Zen controls
  zenPreset: 'Calm' | 'Neutral' | 'Energetic';
  fadeSec: number;          // base fade duration seconds
  driftAmp: number;         // average sway amplitude in px
  spawnDensity: number;     // 0.5 - 1.5 tokens per word
  laneStyle: 'none' | 'soft' | 'tight';
  breath: boolean;          // breathing overlay enabled
  markersEveryMin: number;  // session markers interval minutes
  ghostWindowMin: number;   // rolling ghost buffer window minutes
  statsBarMetrics?: Partial<Record<'zen' | 'quote', StatsBarMetricKey[]>>;
  // Audio
  soundEnabled?: boolean; // master audio toggle (default false)
  switchSound?: SwitchSoundProfile;
  ambientSound?: AmbientSoundscape;
  audioVolume?: number; // 0.0 - 1.0, default 0.6
  ambientVolume?: number; // 0.0 - 1.0, default 0.4
  // Paced ghost and meditation flow
  targetWpm?: number; // target WPM ghost pace (0 = off)
  timedFlowMinutes?: number; // 0 = off, 3, 5, 10
  // Quote pool filters. Empty arrays mean "everything".
  quoteLengths?: QuoteLength[];
  quoteTags?: string[];
}

export interface Stats {
  totalWords: number;
  totalChars: number;
  totalTime: number; // in seconds
  sessionsCompleted: number;
  bestWpm: number;
  averageAccuracy: number;
  zenSessions: number;
  quoteSessions: number;
}

export interface SessionSummary {
  mode: 'zen' | 'quote';
  startedAt: Date;
  endedAt: Date;
  wordsTyped: number;
  charactersTyped: number;
  wpm?: number;
  accuracy?: number;
  quote?: string;
  author?: string;
  quoteId?: string;
  errors?: { slip: number; skip: number; extra: number };
}

export interface SessionCardSummary {
  mode: 'zen' | 'quote';
  date: string; // ISO string
  time: number; // seconds
  words: number; // total words
  wpm?: number; // quote mode
  accuracy?: number; // quote mode
}

/** One finished session, as kept in the local history. */
export interface SessionRecord {
  id: string;
  mode: 'zen' | 'quote';
  date: string; // ISO, session end
  timeSec: number;
  words: number;
  chars: number;
  wpm?: number;
  accuracy?: number;
  quoteId?: string;
  errors?: { slip: number; skip: number; extra: number };
}

/** @deprecated Old 10-entry log shape, kept so older exports still parse. */
export interface TelemetryEntry {
  date: string; // ISO
  mode: 'zen' | 'quote';
  timeSec: number;
  words: number;
  wpm?: number;
  accuracy?: number;
}

export interface Hints {
  firstRun?: boolean;
  audio?: boolean;
  progress?: boolean;
}

export const STORAGE_KEYS = {
  SETTINGS: 'zt.settings',
  STATS: 'zt.stats',
  STREAK: 'zt.streak',
  LAST_SESSION: 'zt.lastSession',
  TELEMETRY: 'zt.telemetry',
  HISTORY: 'zt.history',
  HINTS: 'zt.hints',
} as const;

export const HISTORY_LIMIT = 500;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'Void',
  reducedMotion: false,
  showStats: true,
  highContrast: false,
  fontFamily: FONT_OPTIONS[0],
  caretStyle: 'line',
  autoAdvanceQuotes: false,
  autoAdvanceDelayMs: 1500,
  performanceMode: false,
  profile: 'Practice',
  debounceMs: 0,
  zenPreset: 'Neutral',
  fadeSec: 4,
  driftAmp: 6,
  spawnDensity: 1.0,
  laneStyle: 'soft',
  breath: false,
  markersEveryMin: 2,
  ghostWindowMin: 5,
  statsBarMetrics: {
    zen: [...DEFAULT_STATS_BAR_METRICS.zen],
    quote: [...DEFAULT_STATS_BAR_METRICS.quote],
  },
  soundEnabled: false,
  switchSound: 'thock',
  ambientSound: 'none',
  audioVolume: 0.6,
  ambientVolume: 0.4,
  targetWpm: 0,
  timedFlowMinutes: 0,
  quoteLengths: [],
  quoteTags: [],
};

export const DEFAULT_STATS: Stats = {
  totalWords: 0,
  totalChars: 0,
  totalTime: 0,
  sessionsCompleted: 0,
  bestWpm: 0,
  averageAccuracy: 100,
  zenSessions: 0,
  quoteSessions: 0
};

const ALLOWED_CARETS: readonly CaretStyle[] = ['line', 'block', 'underline', 'glow'];
const ALLOWED_SWITCHES: readonly SwitchSoundProfile[] = ['none', 'thock', 'cream', 'raindrop', 'typewriter', 'holy-panda', 'clicky'];
const ALLOWED_AMBIENT: readonly AmbientSoundscape[] = ['none', 'rain', 'wind', 'drone', 'fire'];
const ALLOWED_LENGTHS: readonly QuoteLength[] = ['short', 'medium', 'long'];

const clamp01 = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
};

/** Coerce whatever is in storage into a Settings object every caller can trust. */
export function normalizeSettings(raw: unknown): Settings {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings> & { theme?: string };
  const normalized = { ...DEFAULT_SETTINGS, ...input } as Settings;

  if ((input.theme as string | undefined) === 'Plain') normalized.theme = 'Void';
  if (!THEME_NAMES.includes(normalized.theme)) normalized.theme = 'Void';

  if (!normalized.fontFamily || !FONT_OPTIONS.includes(normalized.fontFamily)) {
    normalized.fontFamily = DEFAULT_SETTINGS.fontFamily!;
  }
  if (!normalized.caretStyle || !ALLOWED_CARETS.includes(normalized.caretStyle)) {
    normalized.caretStyle = 'line';
  }
  if (!normalized.switchSound || !ALLOWED_SWITCHES.includes(normalized.switchSound)) {
    normalized.switchSound = 'thock';
  }
  if (!normalized.ambientSound || !ALLOWED_AMBIENT.includes(normalized.ambientSound)) {
    normalized.ambientSound = 'none';
  }
  normalized.audioVolume = clamp01(normalized.audioVolume, 0.6);
  normalized.ambientVolume = clamp01(normalized.ambientVolume, 0.4);
  normalized.soundEnabled = !!normalized.soundEnabled;

  const targetWpm = Number(normalized.targetWpm);
  normalized.targetWpm = Number.isFinite(targetWpm) && targetWpm > 0 ? Math.min(300, Math.round(targetWpm)) : 0;
  const flow = Number(normalized.timedFlowMinutes);
  normalized.timedFlowMinutes = Number.isFinite(flow) && flow > 0 ? Math.min(60, flow) : 0;

  normalized.quoteLengths = Array.isArray(normalized.quoteLengths)
    ? normalized.quoteLengths.filter((l): l is QuoteLength => ALLOWED_LENGTHS.includes(l))
    : [];
  normalized.quoteTags = Array.isArray(normalized.quoteTags)
    ? normalized.quoteTags.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length < 40)
    : [];

  const sanitizeMetrics = (mode: 'zen' | 'quote', metrics?: StatsBarMetricKey[]): StatsBarMetricKey[] => {
    const allowedKeys = new Set(ALLOWED_STATS_BAR_METRICS as readonly string[]);
    const list = (metrics && Array.isArray(metrics) ? metrics : []).filter((key): key is StatsBarMetricKey =>
      allowedKeys.has(key)
    );
    // Accuracy is meaningless in Zen mode (there is nothing to be wrong against).
    const unique = Array.from(new Set(list.filter(key => !(mode === 'zen' && key === 'accuracy'))));
    return unique.length > 0 ? unique : [...DEFAULT_STATS_BAR_METRICS[mode]];
  };

  const rawMetrics = input.statsBarMetrics;
  normalized.statsBarMetrics = {
    zen: sanitizeMetrics('zen', rawMetrics?.zen),
    quote: sanitizeMetrics('quote', rawMetrics?.quote),
  };

  return normalized;
}

// In-memory cache so getSettings() is free on every keydown.
let _settingsCache: Settings | null = null;
const settingsListeners = new Set<(settings: Settings) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.SETTINGS || e.key === null) {
      _settingsCache = null;
      const next = getSettings();
      for (const listener of settingsListeners) listener(next);
    }
  });
}

export function getSettings(): Settings {
  if (_settingsCache) return _settingsCache;
  const raw = getJSON<unknown>(STORAGE_KEYS.SETTINGS, null);
  _settingsCache = normalizeSettings(raw);
  return _settingsCache;
}

/** Persist a whole settings object. Prefer updateSettings() for changes. */
export function saveSettings(settings: Settings): void {
  _settingsCache = normalizeSettings(settings);
  setJSON(STORAGE_KEYS.SETTINGS, _settingsCache);
}

export function __invalidateSettingsCacheForTests(): void {
  _settingsCache = null;
}

/**
 * Apply the document-level side effects of a settings change (theme classes,
 * font variables, caret attribute). Broadcasting is handled by updateSettings.
 */
export function applySettingsSideEffects(patch: Partial<Settings>, next: Settings, options?: { broadcast?: boolean }): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const broadcast = options?.broadcast ?? true;
  const root = document.documentElement;

  if ('fontFamily' in patch && next.fontFamily) {
    syncTypingFont(next.fontFamily);
    if (broadcast && patch.fontFamily) {
      window.dispatchEvent(new CustomEvent('fontChanged', { detail: patch.fontFamily }));
    }
  }
  if ('reducedMotion' in patch) {
    root.classList.toggle('reduce-motion', !!next.reducedMotion);
  }
  if ('highContrast' in patch) {
    root.classList.toggle('high-contrast', !!next.highContrast);
  }
  if ('showStats' in patch && broadcast) {
    window.dispatchEvent(new CustomEvent('toggleStats', { detail: !!next.showStats }));
  }
  if ('performanceMode' in patch) {
    root.classList.toggle('perf-mode', !!next.performanceMode);
  }
  if ('caretStyle' in patch && next.caretStyle) {
    root.setAttribute('data-caret', next.caretStyle);
  }
}

/**
 * The one way to change settings. Merges the patch, persists, applies the
 * document side effects, notifies subscribers, and broadcasts the legacy
 * `settingsChanged` window event for islands that still listen to it.
 */
export function updateSettings(patch: Partial<Settings>, options?: { broadcast?: boolean }): Settings {
  const current = getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  _settingsCache = next;
  setJSON(STORAGE_KEYS.SETTINGS, next);
  applySettingsSideEffects(patch, next, options);
  for (const listener of settingsListeners) listener(next);
  if (options?.broadcast !== false && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
  }
  return next;
}

export function subscribeSettings(listener: (settings: Settings) => void): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Stats, history, streak
// ---------------------------------------------------------------------------

export function getStats(): Stats {
  const raw = getJSON<Partial<Stats>>(STORAGE_KEYS.STATS, DEFAULT_STATS);
  return { ...DEFAULT_STATS, ...raw };
}

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dayKeyFromIso = (iso: string): string | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
};

const shiftDay = (key: string, delta: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + delta);
  return dayKey(date);
};

export function getHistory(): SessionRecord[] {
  const list = getJSON<unknown>(STORAGE_KEYS.HISTORY, null);
  if (Array.isArray(list) && list.length > 0) {
    return list.filter((r): r is SessionRecord => !!r && typeof r === 'object' && typeof (r as SessionRecord).date === 'string');
  }
  // First read on an existing install: lift the old 10-entry telemetry log
  // into the history so nothing that was tracked is lost.
  const legacy = getJSON<TelemetryEntry[]>(STORAGE_KEYS.TELEMETRY, []);
  if (Array.isArray(legacy) && legacy.length > 0) {
    const migrated: SessionRecord[] = legacy
      .filter(e => e && typeof e.date === 'string')
      .map((e, i) => ({
        id: `legacy-${i}-${e.date}`,
        mode: e.mode === 'zen' ? 'zen' : 'quote',
        date: e.date,
        timeSec: Math.max(0, Number(e.timeSec) || 0),
        words: Math.max(0, Number(e.words) || 0),
        chars: Math.max(0, Math.round((Number(e.words) || 0) * 5)),
        ...(e.wpm !== undefined ? { wpm: Number(e.wpm) || 0 } : {}),
        ...(e.accuracy !== undefined ? { accuracy: Number(e.accuracy) || 0 } : {}),
      }));
    setJSON(STORAGE_KEYS.HISTORY, migrated);
    return migrated;
  }
  return [];
}

function saveHistory(list: SessionRecord[]): void {
  const trimmed = list.length > HISTORY_LIMIT ? list.slice(list.length - HISTORY_LIMIT) : list;
  setJSON(STORAGE_KEYS.HISTORY, trimmed);
}

/** Distinct calendar days with at least one recorded session, newest last. */
export function getPracticeDays(): string[] {
  const days = new Set<string>();
  for (const r of getHistory()) {
    const key = dayKeyFromIso(r.date);
    if (key) days.add(key);
  }
  return Array.from(days).sort();
}

/**
 * Consecutive practice days ending today or yesterday. A streak counts
 * calendar days, so 9am today and 8am tomorrow are two days, not one.
 */
export function computeStreak(days: string[], now: Date = new Date()): number {
  if (days.length === 0) return 0;
  const set = new Set(days);
  const today = dayKey(now);
  let cursor = set.has(today) ? today : shiftDay(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

export function getStreak(): number {
  const derived = computeStreak(getPracticeDays());
  if (derived > 0) return derived;
  // Installs that predate the history: honour the stored count while the
  // last session is still recent enough for the streak to be alive.
  const stored = getJSON<number>(STORAGE_KEYS.STREAK, 0);
  const last = getJSON<{ endedAt?: string } | null>(STORAGE_KEYS.LAST_SESSION, null);
  if (stored > 0 && last?.endedAt) {
    const lastDay = dayKeyFromIso(last.endedAt);
    const today = dayKey(new Date());
    if (lastDay === today || lastDay === shiftDay(today, -1)) return stored;
  }
  return 0;
}

/** True when a session has already been recorded today. */
export function practicedToday(): boolean {
  return getPracticeDays().includes(dayKey(new Date()));
}

/**
 * Record a finished session. Updates the lifetime stats, appends to the
 * history, and refreshes the streak. This is the only write path for stats.
 */
export function recordSession(summary: SessionSummary): SessionRecord {
  const startedMs = summary.startedAt.getTime();
  const endedMs = summary.endedAt.getTime();
  const timeSec = Math.max(1, Math.round((endedMs - startedMs) / 1000));
  const words = Math.max(0, Math.round(summary.wordsTyped || Math.round(summary.charactersTyped / 5)));
  const chars = Math.max(0, Math.round(summary.charactersTyped || 0));
  const minutes = timeSec / 60;
  const wpm = summary.wpm !== undefined ? Math.max(0, Math.round(summary.wpm)) : Math.round((chars / 5) / Math.max(0.01, minutes));

  const stats = getStats();
  stats.totalWords += words;
  stats.totalChars += chars;
  stats.totalTime += timeSec;
  stats.sessionsCompleted += 1;
  if (summary.mode === 'zen') stats.zenSessions += 1; else stats.quoteSessions += 1;
  if (summary.mode === 'quote' && wpm > 0) stats.bestWpm = Math.max(stats.bestWpm, wpm);
  if (summary.accuracy !== undefined) {
    const priorCount = Math.max(0, stats.quoteSessions - 1);
    const totalAccuracy = stats.averageAccuracy * priorCount;
    stats.averageAccuracy = (totalAccuracy + summary.accuracy) / Math.max(1, priorCount + 1);
  }
  setJSON(STORAGE_KEYS.STATS, stats);
  setJSON(STORAGE_KEYS.LAST_SESSION, summary);

  const record: SessionRecord = {
    id: `${endedMs.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    mode: summary.mode,
    date: summary.endedAt.toISOString(),
    timeSec,
    words,
    chars,
    ...(summary.mode === 'quote' ? { wpm } : {}),
    ...(summary.accuracy !== undefined ? { accuracy: Math.round(summary.accuracy) } : {}),
    ...(summary.quoteId ? { quoteId: summary.quoteId } : {}),
    ...(summary.errors ? { errors: summary.errors } : {}),
  };
  const history = getHistory();
  history.push(record);
  saveHistory(history);

  setJSON(STORAGE_KEYS.STREAK, computeStreak(getPracticeDays()));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sessionRecorded', { detail: record }));
  }
  return record;
}

/** @deprecated use recordSession */
export function updateStats(summary: SessionSummary): void {
  recordSession(summary);
}

/** @deprecated recordSession keeps the streak current */
export function updateStreak(): void {
  setJSON(STORAGE_KEYS.STREAK, computeStreak(getPracticeDays()));
}

/** @deprecated read getHistory() instead */
export function getTelemetry(): TelemetryEntry[] {
  return getHistory().slice(-10).map(r => ({
    date: r.date,
    mode: r.mode,
    timeSec: r.timeSec,
    words: r.words,
    ...(r.wpm !== undefined ? { wpm: r.wpm } : {}),
    ...(r.accuracy !== undefined ? { accuracy: r.accuracy } : {}),
  }));
}

export function resetAllData(): void {
  setJSON(STORAGE_KEYS.STATS, DEFAULT_STATS);
  setJSON(STORAGE_KEYS.TELEMETRY, []);
  setJSON(STORAGE_KEYS.HISTORY, []);
  setJSON(STORAGE_KEYS.STREAK, 0);
  if (isStorageAccessible()) {
    try { localStorage.removeItem(STORAGE_KEYS.LAST_SESSION); } catch { /* ignore */ }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sessionRecorded', { detail: null }));
  }
}

// ---------------------------------------------------------------------------
// Hints: one-time nudges that must never show twice
// ---------------------------------------------------------------------------

export function getHints(): Hints {
  const raw = getJSON<Hints>(STORAGE_KEYS.HINTS, {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function markHint(key: keyof Hints): void {
  const next = { ...getHints(), [key]: true };
  setJSON(STORAGE_KEYS.HINTS, next);
}
