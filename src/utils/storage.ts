// Local storage utilities for Zen Typer
// Handles settings, stats, streak, telemetry and exports
export function getJSON<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return fallback;
    }
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
    return fallback;
  }
}

export function setJSON(key: string, value: any): void {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing ${key} to localStorage:`, error);
  }
}

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

  const fonts = (document as any).fonts;
  if (fonts?.load) {
    const family = font.replace(/"/g, '\\"');
    const weights = ['400', '500', '600', '700'];
    for (const weight of weights) {
      void fonts.load(`${weight} 1rem "${family}"`).catch(() => {});
    }
  }
}

export type StatsBarMetricKey = 'time' | 'words' | 'wpm' | 'accuracy';

export const DEFAULT_STATS_BAR_METRICS: Readonly<Record<'zen' | 'quote', StatsBarMetricKey[]>> = {
  zen: ['time', 'words', 'wpm'],
  quote: ['time', 'words', 'wpm', 'accuracy'],
};

const ALLOWED_STATS_BAR_METRICS: readonly StatsBarMetricKey[] = ['time', 'words', 'wpm', 'accuracy'];

export function applySettingsSideEffects(patch: Partial<Settings>, next: Settings, options?: { broadcast?: boolean }): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const broadcast = options?.broadcast ?? true;

  if ('fontFamily' in patch && next.fontFamily) {
    syncTypingFont(next.fontFamily);
    if (broadcast && patch.fontFamily) {
      window.dispatchEvent(new CustomEvent('fontChanged', { detail: patch.fontFamily }));
    }
  }

  if ('reducedMotion' in patch) {
    document.documentElement.classList.toggle('reduce-motion', !!next.reducedMotion);
  }

  if ('highContrast' in patch) {
    document.documentElement.classList.toggle('high-contrast', !!next.highContrast);
  }

  if ('showStats' in patch) {
    if (broadcast) {
      window.dispatchEvent(new CustomEvent('toggleStats', { detail: !!next.showStats }));
    }
  }

  if ('performanceMode' in patch) {
    document.documentElement.classList.toggle('perf-mode', !!next.performanceMode);
  }
}

// Type definitions
export interface Settings {
  theme: 'Void' | 'Forest' | 'Ocean' | 'Cosmic';
  reducedMotion: boolean;
  showStats: boolean;
  highContrast: boolean;
  fontFamily?: FontOption;
  autoAdvanceQuotes?: boolean;
  autoAdvanceDelayMs?: number; // 0 for immediate; default 1500
  performanceMode?: boolean;
  // Global profiles
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
  // Theme
  themeShiftLocked?: boolean; // lock ambient theme shift
  statsBarMetrics?: Partial<Record<'zen' | 'quote', StatsBarMetricKey[]>>;
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
}

export interface SessionCardSummary {
  mode: 'zen' | 'quote';
  date: string; // ISO string
  time: number; // seconds
  words: number; // total words
  wpm?: number; // quote mode
  accuracy?: number; // quote mode
}

export interface TelemetryEntry {
  date: string; // ISO
  mode: 'zen' | 'quote';
  timeSec: number;
  words: number;
  wpm?: number;
  accuracy?: number;
}

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'zt.settings',
  STATS: 'zt.stats',
  STREAK: 'zt.streak',
  LAST_SESSION: 'zt.lastSession',
  TELEMETRY: 'zt.telemetry',
  ARCHIVE: 'zt.archive'
} as const;

// Defaults
export const DEFAULT_SETTINGS: Settings = {
  theme: 'Void',
  reducedMotion: false,
  showStats: true,
  highContrast: false,
  fontFamily: FONT_OPTIONS[0],
  autoAdvanceQuotes: false,
  autoAdvanceDelayMs: 1500,  // 1.5s affirmation delay
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
  themeShiftLocked: false,
  statsBarMetrics: {
    zen: [...DEFAULT_STATS_BAR_METRICS.zen],
    quote: [...DEFAULT_STATS_BAR_METRICS.quote],
  },
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

// Settings helpers
export function getSettings(): Settings {
  const raw = getJSON(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS as Settings);
  const normalized = { ...DEFAULT_SETTINGS, ...raw } as Settings;

  if ((raw as any).theme === 'Plain') {
    normalized.theme = 'Void';
  }

  const allowedThemes: Settings['theme'][] = ['Void', 'Forest', 'Ocean', 'Cosmic'];
  if (!allowedThemes.includes(normalized.theme)) {
    normalized.theme = 'Void';
  }

  if (!normalized.fontFamily || !FONT_OPTIONS.includes(normalized.fontFamily)) {
    normalized.fontFamily = DEFAULT_SETTINGS.fontFamily!;
  }

  const sanitizeMetrics = (mode: 'zen' | 'quote', metrics?: StatsBarMetricKey[]): StatsBarMetricKey[] => {
    const allowedForMode = DEFAULT_STATS_BAR_METRICS[mode];
    const list = (metrics && Array.isArray(metrics) ? metrics : []).filter((key): key is StatsBarMetricKey =>
      (ALLOWED_STATS_BAR_METRICS as readonly string[]).includes(key)
    );
    const unique = Array.from(new Set(list.filter(key => allowedForMode.includes(key))));
    return unique.length > 0 ? unique : [...DEFAULT_STATS_BAR_METRICS[mode]];
  };

  const rawMetrics = (raw as Settings | undefined)?.statsBarMetrics;
  normalized.statsBarMetrics = {
    zen: sanitizeMetrics('zen', rawMetrics?.zen),
    quote: sanitizeMetrics('quote', rawMetrics?.quote),
  };

  return normalized;
}

export function saveSettings(settings: Settings): void {
  setJSON(STORAGE_KEYS.SETTINGS, settings);
}

// Stats
export function getStats(): Stats {
  return getJSON(STORAGE_KEYS.STATS, DEFAULT_STATS);
}

export function updateStats(sessionSummary: SessionSummary): void {
  const stats = getStats();

  stats.totalWords += sessionSummary.wordsTyped;
  stats.totalChars += sessionSummary.charactersTyped;
  stats.totalTime += (sessionSummary.endedAt.getTime() - sessionSummary.startedAt.getTime()) / 1000;
  stats.sessionsCompleted += 1;

  if (sessionSummary.mode === 'zen') {
    stats.zenSessions += 1;
  } else {
    stats.quoteSessions += 1;
  }

  if (sessionSummary.wpm) {
    stats.bestWpm = Math.max(stats.bestWpm, sessionSummary.wpm);
  }

  if (sessionSummary.accuracy !== undefined) {
    const totalAccuracy = stats.averageAccuracy * (stats.sessionsCompleted - 1);
    stats.averageAccuracy = (totalAccuracy + sessionSummary.accuracy) / stats.sessionsCompleted;
  }

  setJSON(STORAGE_KEYS.STATS, stats);
  setJSON(STORAGE_KEYS.LAST_SESSION, sessionSummary);

  // Telemetry (rolling last 10 sessions)
  try {
    const tel: TelemetryEntry[] = getJSON(STORAGE_KEYS.TELEMETRY, [] as TelemetryEntry[]);
    const timeSec = Math.max(1, Math.round((sessionSummary.endedAt.getTime() - sessionSummary.startedAt.getTime()) / 1000));
    const minutes = timeSec / 60;
    const words = sessionSummary.wordsTyped || Math.round(sessionSummary.charactersTyped / 5);
    const wpm = sessionSummary.wpm ?? Math.round(words / Math.max(0.01, minutes));
    const accuracy = sessionSummary.accuracy;
    const entry = { date: new Date().toISOString(), mode: sessionSummary.mode, timeSec, words, wpm };
    if (accuracy !== undefined) {
      (entry as any).accuracy = accuracy;
    }
    tel.push(entry as TelemetryEntry);
    while (tel.length > 10) tel.shift();
    setJSON(STORAGE_KEYS.TELEMETRY, tel);
  } catch (e) {
    console.warn('Telemetry update failed', e);
  }
}

export function getStreak(): number {
  return getJSON(STORAGE_KEYS.STREAK, 0);
}

export function updateStreak(): void {
  const lastSession = getJSON<SessionSummary | null>(STORAGE_KEYS.LAST_SESSION, null);
  const currentStreak = getStreak();

  if (lastSession) {
    const lastDate = new Date(lastSession.endedAt);
    const today = new Date();
    const dayDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) {
      return;
    } else if (dayDiff === 1) {
      setJSON(STORAGE_KEYS.STREAK, currentStreak + 1);
    } else {
      setJSON(STORAGE_KEYS.STREAK, 1);
    }
  } else {
    setJSON(STORAGE_KEYS.STREAK, 1);
  }
}

// PNG export card
export async function exportSessionCard(summary: SessionCardSummary) {
  try {
    const width = 1200;
    const height = 628;
    const dpi = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpi, dpi);

    const css = getComputedStyle(document.documentElement);
    const base = (css.getPropertyValue('--rp-base') || '#191724').trim();
    const overlay = (css.getPropertyValue('--rp-overlay') || '#26233a').trim();
    const text = (css.getPropertyValue('--rp-text') || '#e0def4').trim();
    const foam = (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim();
    const gold = (css.getPropertyValue('--rp-gold') || '#f6c177').trim();
    const rose = (css.getPropertyValue('--rp-rose') || '#ea9a97').trim();
    const iris = (css.getPropertyValue('--rp-iris') || '#c4a7e7').trim();

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, base);
    grad.addColorStop(1, overlay);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.08;
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (Math.random() < 0.05) {
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = foam;
    ctx.font = '700 40px Inter, system-ui, sans-serif';
    ctx.fillText('Zen Typer Session', 60, 100);
    const d = new Date(summary.date);
    ctx.fillStyle = text;
    ctx.font = '400 20px Inter, system-ui, sans-serif';
    ctx.fillText(d.toLocaleString(), 60, 130);

    const toMMSS = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    let y = 210;
    const line = (label: string, value: string, color: string) => {
      ctx.fillStyle = color;
      ctx.font = '600 28px JetBrains Mono, ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(label, 60, y);
      ctx.fillStyle = text;
      ctx.font = '600 28px JetBrains Mono, ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(value, 260, y);
      y += 48;
    };

    line('Mode', summary.mode.toUpperCase(), iris);
    line('Time', toMMSS(summary.time), foam);
    line('Words', String(summary.words), gold);
    if (summary.wpm !== undefined) line('WPM', String(summary.wpm), rose);
    if (summary.accuracy !== undefined) line('Accuracy', `${Math.round(summary.accuracy)}%`, iris);

    ctx.fillStyle = text;
    ctx.font = '400 16px Inter, system-ui, sans-serif';
    ctx.fillText('Built with Rosé Pine', 60, height - 40);

    const png = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = png;
    a.download = `zen-typer-session-${ts}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('exportSessionCard failed', err);
  }
}

// SVG export
export async function exportSessionCardSVG(summary: SessionCardSummary) {
  try {
    const css = getComputedStyle(document.documentElement);
    const base = (css.getPropertyValue('--rp-base') || '#191724').trim();
    const overlay = (css.getPropertyValue('--rp-overlay') || '#26233a').trim();
    const text = (css.getPropertyValue('--rp-text') || '#e0def4').trim();
    const foam = (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim();
    const gold = (css.getPropertyValue('--rp-gold') || '#f6c177').trim();
    const rose = (css.getPropertyValue('--rp-rose') || '#ea9a97').trim();
    const iris = (css.getPropertyValue('--rp-iris') || '#c4a7e7').trim();

    const toMMSS = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };
    const dateStr = new Date(summary.date).toLocaleString();

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${base}"/>
      <stop offset="100%" stop-color="${overlay}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="628" fill="url(#g)"/>
  <g font-family="Inter, system-ui, sans-serif" fill="${text}">
    <text x="60" y="100" font-size="40" font-weight="700" fill="${foam}">Zen Typer Session</text>
    <text x="60" y="130" font-size="20">${dateStr}</text>
    <g font-family="'JetBrains Mono', ui-monospace, SFMono-Regular, monospace" font-size="28" font-weight="600">
      <text x="60" y="210" fill="${iris}">Mode</text><text x="260" y="210">${summary.mode.toUpperCase()}</text>
      <text x="60" y="258" fill="${foam}">Time</text><text x="260" y="258">${toMMSS(summary.time)}</text>
      <text x="60" y="306" fill="${gold}">Words</text><text x="260" y="306">${summary.words}</text>
      ${summary.wpm !== undefined ? `<text x="60" y="354" fill="${rose}">WPM</text><text x="260" y="354">${summary.wpm}</text>` : ''}
      ${summary.accuracy !== undefined ? `<text x="60" y="402" fill="${iris}">Accuracy</text><text x="260" y="402">${Math.round(summary.accuracy)}%</text>` : ''}
    </g>
    <text x="60" y="588" font-size="16">Built with Rosé Pine</text>
  </g>
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `zen-typer-session-${ts}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('exportSessionCardSVG failed', err);
  }
}

export function getTelemetry(): TelemetryEntry[] {
  return getJSON(STORAGE_KEYS.TELEMETRY, [] as TelemetryEntry[]);
}

export function resetAllData(): void {
  setJSON(STORAGE_KEYS.STATS, DEFAULT_STATS);
  setJSON(STORAGE_KEYS.TELEMETRY, []);
  setJSON(STORAGE_KEYS.STREAK, 0);
}

// ==========================
// Archive (Zen Mode) storage
// ==========================

export interface ArchiveEntry {
  id: string;
  startedAt: string; // ISO
  endedAt?: string; // ISO
  text: string;
  wordCount: number;
  charCount: number;
}

export function getArchive(): ArchiveEntry[] {
  return getJSON<ArchiveEntry[]>(STORAGE_KEYS.ARCHIVE, []);
}

export function saveArchive(entries: ArchiveEntry[]): void {
  setJSON(STORAGE_KEYS.ARCHIVE, entries);
}

export function createArchiveEntry(init?: Partial<ArchiveEntry>): ArchiveEntry {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: ArchiveEntry = {
    id,
    startedAt: init?.startedAt ?? new Date().toISOString(),
    text: init?.text ?? '',
    wordCount: init?.wordCount ?? 0,
    charCount: init?.charCount ?? 0,
  };
  if (init?.endedAt) {
    entry.endedAt = init.endedAt;
  }
  const list = getArchive();
  list.push(entry);
  saveArchive(list);
  return entry;
}

export function upsertArchiveEntry(entry: ArchiveEntry): void {
  const list = getArchive();
  const idx = list.findIndex(e => e.id === entry.id);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveArchive(list);
}

export function updateArchiveEntry(id: string, patch: Partial<ArchiveEntry>): ArchiveEntry | null {
  const list = getArchive();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const next = { ...list[idx], ...patch } as ArchiveEntry;
  list[idx] = next;
  saveArchive(list);
  return next;
}

export function getArchiveEntry(id: string): ArchiveEntry | null {
  const list = getArchive();
  return list.find(e => e.id === id) ?? null;
}

export function deleteArchiveEntry(id: string): void {
  const list = getArchive().filter(e => e.id !== id);
  saveArchive(list);
}
