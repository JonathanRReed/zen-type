import Dexie from 'dexie';

export interface Draft {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  snapshots: DraftSnapshot[];
  scratchpad?: string;
}

export interface DraftSnapshot {
  id: string;
  body: string;
  ts: number;
  isRestore?: boolean;
}

export interface DraftPrefs {
  counters: boolean;
  readTime: boolean;
  outline: boolean;
  quickJump: boolean;
  search: boolean;
  tags: boolean;
  scratchpad: boolean;
  keywordHighlighter: boolean;
  grammar: boolean;
  preset: 'minimal' | 'structural' | 'editor-pro';
}

export const DEFAULT_DRAFT_PREFS: DraftPrefs = {
  counters: true,
  readTime: true,
  outline: false,
  quickJump: true,
  search: true,
  tags: false,
  scratchpad: false,
  keywordHighlighter: false,
  grammar: false,
  preset: 'structural',
};

class DraftDatabase extends Dexie {
  drafts!: Dexie.Table<Draft, string>;

  constructor() {
    super('ZenTypeDrafts');
    this.version(1).stores({
      drafts: 'id, updatedAt, createdAt',
    });
  }
}

const db = new DraftDatabase();

// Older or corrupt records may predate an array field. Normalize on read so
// callers can trust the shape instead of throwing on `undefined.slice`.
function normalizeDraft(draft: Draft): Draft {
  return {
    ...draft,
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    snapshots: Array.isArray(draft.snapshots) ? draft.snapshots : [],
    scratchpad: typeof draft.scratchpad === 'string' ? draft.scratchpad : '',
  };
}

export async function getAllDrafts(): Promise<Draft[]> {
  const drafts = await db.drafts.orderBy('updatedAt').reverse().toArray();
  return drafts.map(normalizeDraft);
}

export async function getDraft(id: string): Promise<Draft | undefined> {
  const draft = await db.drafts.get(id);
  return draft ? normalizeDraft(draft) : undefined;
}

export async function createDraft(title: string = 'Untitled'): Promise<Draft> {
  const now = Date.now();
  const draft: Draft = {
    id: `draft_${now}_${Math.random().toString(36).slice(2, 9)}`,
    title,
    body: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    snapshots: [],
    scratchpad: '',
  };
  await db.drafts.add(draft);
  return draft;
}

export async function updateDraft(id: string, updates: Partial<Draft>): Promise<void> {
  await db.drafts.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function updateDraftBody(id: string, body: string): Promise<void> {
  await db.drafts.update(id, {
    body,
    updatedAt: Date.now(),
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await db.drafts.delete(id);
}

export async function addSnapshot(draftId: string, body: string, isRestore = false): Promise<void> {
  const draft = await getDraft(draftId);
  if (!draft) return;

  const snapshot: DraftSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    body,
    ts: Date.now(),
    isRestore,
  };

  const snapshots = [...draft.snapshots, snapshot];
  
  // Keep last 50 snapshots (FIFO)
  while (snapshots.length > 50) {
    snapshots.shift();
  }

  await updateDraft(draftId, { snapshots });
}

export async function restoreSnapshot(draftId: string, snapshotId: string): Promise<void> {
  const draft = await getDraft(draftId);
  if (!draft) return;

  const snapshot = draft.snapshots.find(s => s.id === snapshotId);
  if (!snapshot) return;

  // Create a restore snapshot before restoring
  await addSnapshot(draftId, draft.body, false);

  // Update body and create restore marker
  await updateDraft(draftId, { body: snapshot.body });
  await addSnapshot(draftId, snapshot.body, true);
}

// Preferences stored in localStorage for simplicity
const PREFS_KEY = 'zt.draft.prefs.v1';
const LEGACY_PREFS_KEY = 'zt.draft.prefs';

export function getDraftPrefs(): DraftPrefs {
  if (typeof window === 'undefined') return DEFAULT_DRAFT_PREFS;
  
  try {
    const stored = localStorage.getItem(PREFS_KEY) || localStorage.getItem(LEGACY_PREFS_KEY);
    if (!stored) return DEFAULT_DRAFT_PREFS;
    return { ...DEFAULT_DRAFT_PREFS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_DRAFT_PREFS;
  }
}

export function saveDraftPrefs(prefs: Partial<DraftPrefs>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getDraftPrefs();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save draft preferences:', e);
  }
}

// Active draft tracking for zen mode
const ACTIVE_DRAFT_KEY = 'zt.activeDraft';

export function getActiveDraftId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_DRAFT_KEY);
  } catch {
    return null;
  }
}

export function setActiveDraftId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      localStorage.setItem(ACTIVE_DRAFT_KEY, id);
      window.dispatchEvent(new CustomEvent('activeDraftChanged', { detail: { id } }));
    } else {
      localStorage.removeItem(ACTIVE_DRAFT_KEY);
      window.dispatchEvent(new CustomEvent('activeDraftChanged', { detail: { id: null } }));
    }
  } catch (e) {
    console.error('Failed to persist active draft id:', e);
  }
}

export function applyPreset(preset: DraftPrefs['preset']): Partial<DraftPrefs> {
  switch (preset) {
    case 'minimal':
      return {
        preset,
        counters: true,
        readTime: false,
        outline: false,
        quickJump: false,
        search: false,
        tags: false,
        scratchpad: false,
        keywordHighlighter: false,
        grammar: false,
      };
    case 'structural':
      return {
        preset,
        counters: true,
        readTime: true,
        outline: true,
        quickJump: true,
        search: true,
        tags: false,
        scratchpad: false,
        keywordHighlighter: false,
        grammar: false,
      };
    case 'editor-pro':
      return {
        preset,
        counters: true,
        readTime: true,
        outline: true,
        quickJump: true,
        search: true,
        tags: true,
        scratchpad: true,
        keywordHighlighter: true,
        grammar: true,
      };
  }
}

// Sync from localStorage archive entries (runs each time to catch new zen sessions)
export async function syncFromArchive(): Promise<void> {
  try {
    const archiveKey = 'zt.archive';
    const lastSyncKey = 'zt.archive.lastSync';

    if (typeof window === 'undefined') return;

    const archiveData = localStorage.getItem(archiveKey);
    if (!archiveData) return;

    const entries = JSON.parse(archiveData);
    if (!Array.isArray(entries)) return;

    // Get last sync timestamp
    const lastSync = parseInt(localStorage.getItem(lastSyncKey) || '0');
    let newEntriesCount = 0;

    const validEntries = entries.filter((e: any) => e.text && e.text.trim() && new Date(e.startedAt).getTime() > lastSync);
    const existingDrafts = await Promise.all(validEntries.map((e: any) => db.drafts.get(e.id)));
    const operations: Promise<unknown>[] = [];

    for (let i = 0; i < validEntries.length; i++) {
      const entry = validEntries[i];
      const existingDraft = existingDrafts[i];

      if (!existingDraft) {
        const draft: Draft = {
          id: entry.id || `zen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          title: `Zen Session: ${new Date(entry.startedAt).toLocaleString()}`,
          body: entry.text,
          tags: ['zen-mode'],
          createdAt: new Date(entry.startedAt).getTime(),
          updatedAt: entry.endedAt ? new Date(entry.endedAt).getTime() : new Date(entry.startedAt).getTime(),
          snapshots: [],
          scratchpad: '',
        };
        operations.push(db.drafts.add(draft));
        newEntriesCount++;
      } else if (entry.endedAt) {
        // Update existing draft if it has new content
        const updatedAt = new Date(entry.endedAt).getTime();
        if (updatedAt > existingDraft.updatedAt) {
          operations.push(db.drafts.update(entry.id, {
            body: entry.text,
            updatedAt,
          }));
        }
      }
    }
    await Promise.all(operations);

    // Update last sync timestamp
    localStorage.setItem(lastSyncKey, Date.now().toString());

    if (newEntriesCount > 0) {
      console.log(`Synced ${newEntriesCount} new Zen sessions to drafts`);
    }
  } catch (e) {
    console.error('Sync from archive failed:', e);
  }
}

// Legacy migration function (kept for backward compatibility)
export async function migrateFromArchive(): Promise<void> {
  await syncFromArchive();
}
