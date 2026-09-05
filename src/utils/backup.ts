// Back up and restore everything the app keeps in this browser: settings,
// lifetime stats, session history, hint flags, and every draft with its
// snapshots. One JSON file, nothing uploaded anywhere. This is the local-only
// answer to sync: take the file with you.

import {
  STORAGE_KEYS,
  getSettings,
  getStats,
  getHistory,
  getHints,
  saveSettings,
  setJSON,
  normalizeSettings,
  HISTORY_LIMIT,
  type Settings,
  type Stats,
  type SessionRecord,
  type Hints,
} from './storage';
import {
  exportDrafts,
  importDrafts,
  clearDrafts,
  getDraftPrefs,
  saveDraftPrefs,
  type Draft,
  type DraftPrefs,
} from '../lib/draftStore';

const BACKUP_VERSION = 1;

export interface Backup {
  app: 'zen-typer';
  version: number;
  exportedAt: string;
  settings: Settings;
  stats: Stats;
  history: SessionRecord[];
  hints: Hints;
  drafts: Draft[];
  draftPrefs: DraftPrefs;
}

export interface RestoreSummary {
  sessions: number;
  drafts: number;
  settings: boolean;
}

export async function buildBackup(): Promise<Backup> {
  return {
    app: 'zen-typer',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    stats: getStats(),
    history: getHistory(),
    hints: getHints(),
    drafts: await exportDrafts(),
    draftPrefs: getDraftPrefs(),
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `zen-typer-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Throws with a plain-language message when the file is not a Zen Typer backup. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!isRecord(data) || data.app !== 'zen-typer') {
    throw new Error('That file is not a Zen Typer backup.');
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error('That backup was made by a newer version of Zen Typer.');
  }
  const history = Array.isArray(data.history)
    ? (data.history as unknown[]).filter((r): r is SessionRecord => isRecord(r) && typeof r.date === 'string' && typeof r.id === 'string')
    : [];
  const drafts = Array.isArray(data.drafts)
    ? (data.drafts as unknown[]).filter((d): d is Draft => isRecord(d) && typeof d.id === 'string' && typeof d.body === 'string')
    : [];
  return {
    app: 'zen-typer',
    version: data.version,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    settings: normalizeSettings(data.settings),
    stats: isRecord(data.stats) ? (data.stats as unknown as Stats) : getStats(),
    history,
    hints: isRecord(data.hints) ? (data.hints as Hints) : {},
    drafts,
    draftPrefs: isRecord(data.draftPrefs) ? ({ ...getDraftPrefs(), ...(data.draftPrefs as Partial<DraftPrefs>) }) : getDraftPrefs(),
  };
}

/**
 * Merge a backup into this browser. Sessions and drafts are unioned by id
 * (newer draft wins); settings, stats, and hints are taken from the file.
 */
export async function restoreBackup(backup: Backup): Promise<RestoreSummary> {
  const existing = getHistory();
  const byId = new Map(existing.map(r => [r.id, r]));
  for (const r of backup.history) byId.set(r.id, r);
  const merged = Array.from(byId.values()).sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = merged.length > HISTORY_LIMIT ? merged.slice(merged.length - HISTORY_LIMIT) : merged;
  setJSON(STORAGE_KEYS.HISTORY, trimmed);

  setJSON(STORAGE_KEYS.STATS, backup.stats);
  setJSON(STORAGE_KEYS.HINTS, { ...getHints(), ...backup.hints });
  saveSettings(backup.settings);
  saveDraftPrefs(backup.draftPrefs);
  const drafts = await importDrafts(backup.drafts);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: getSettings() }));
    window.dispatchEvent(new CustomEvent('sessionRecorded', { detail: null }));
  }
  return { sessions: backup.history.length, drafts, settings: true };
}

export async function restoreFromFile(file: File): Promise<RestoreSummary> {
  const text = await file.text();
  return restoreBackup(parseBackup(text));
}

/** Remove everything: settings, stats, history, hints, and all drafts. */
export async function clearAllLocalData(): Promise<void> {
  await clearDrafts();
  if (typeof localStorage !== 'undefined') {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('zt.')) keys.push(key);
    }
    for (const key of keys) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
  }
}
