import { describe, it, expect, beforeEach } from 'vitest';
import { buildBackup, parseBackup, restoreBackup, clearAllLocalData } from '../backup';
import { updateSettings, recordSession, getHistory, getSettings, getStats, __resetStoragePersistenceStateForTests, STORAGE_KEYS } from '../storage';
import { createDraft, updateDraftBody, getAllDrafts, clearDrafts, getDraft } from '../../lib/draftStore';

beforeEach(async () => {
  __resetStoragePersistenceStateForTests();
  await clearDrafts();
});

describe('backup', () => {
  it('round-trips settings, sessions, and drafts', async () => {
    updateSettings({ theme: 'Glacier', soundEnabled: true, switchSound: 'typewriter' });
    recordSession({ mode: 'quote', startedAt: new Date(Date.now() - 30_000), endedAt: new Date(), wordsTyped: 10, charactersTyped: 50, wpm: 55, accuracy: 98 });
    const draft = await createDraft('Morning pages');
    await updateDraftBody(draft.id, 'Three pages of nothing much.');

    const backup = await buildBackup();
    const text = JSON.stringify(backup);

    // Wipe everything, then restore from the text.
    await clearAllLocalData();
    __resetStoragePersistenceStateForTests();
    expect(getHistory()).toHaveLength(0);
    expect(await getAllDrafts()).toHaveLength(0);
    expect(getSettings().theme).toBe('Void');

    const summary = await restoreBackup(parseBackup(text));
    expect(summary.sessions).toBe(1);
    expect(summary.drafts).toBe(1);
    expect(getSettings().theme).toBe('Glacier');
    expect(getSettings().switchSound).toBe('typewriter');
    expect(getHistory()).toHaveLength(1);
    expect(getStats().bestWpm).toBe(55);
    const restored = await getDraft(draft.id);
    expect(restored?.body).toBe('Three pages of nothing much.');
  });

  it('merges rather than duplicates on a second restore', async () => {
    recordSession({ mode: 'zen', startedAt: new Date(Date.now() - 60_000), endedAt: new Date(), wordsTyped: 40, charactersTyped: 200 });
    const draft = await createDraft('Notes');
    const backup = await buildBackup();
    await restoreBackup(backup);
    await restoreBackup(backup);
    expect(getHistory()).toHaveLength(1);
    expect(await getAllDrafts()).toHaveLength(1);
    expect((await getDraft(draft.id))?.title).toBe('Notes');
  });

  it('keeps the newer draft when both sides changed', async () => {
    const draft = await createDraft('Essay');
    await updateDraftBody(draft.id, 'old');
    const backup = await buildBackup();
    await new Promise(r => setTimeout(r, 5));
    await updateDraftBody(draft.id, 'newer, kept');
    await restoreBackup(backup);
    expect((await getDraft(draft.id))?.body).toBe('newer, kept');
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/);
    expect(() => parseBackup(JSON.stringify({ app: 'other' }))).toThrow(/not a Zen Typer backup/);
    expect(() => parseBackup(JSON.stringify({ app: 'zen-typer', version: 99 }))).toThrow(/newer version/);
  });

  it('tolerates a sparse file', async () => {
    const parsed = parseBackup(JSON.stringify({ app: 'zen-typer', version: 1 }));
    expect(parsed.history).toEqual([]);
    expect(parsed.drafts).toEqual([]);
    expect(parsed.settings.theme).toBe('Void');
    await expect(restoreBackup(parsed)).resolves.toEqual({ sessions: 0, drafts: 0, settings: true });
  });

  it('clearAllLocalData removes every zt.* key and the drafts', async () => {
    updateSettings({ theme: 'Ember' });
    await createDraft('gone');
    window.localStorage.setItem('unrelated', '1');
    await clearAllLocalData();
    expect(window.localStorage.getItem(STORAGE_KEYS.SETTINGS)).toBeNull();
    expect(window.localStorage.getItem('unrelated')).toBe('1');
    expect(await getAllDrafts()).toHaveLength(0);
  });
});
