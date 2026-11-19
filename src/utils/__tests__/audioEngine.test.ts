import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../audioEngine';
import { DEFAULT_SETTINGS } from '../storage';

afterEach(() => vi.restoreAllMocks());

describe('explicit audio preview', () => {
  it('still requests unlock for an explicit preview while sound is disabled', () => {
    audioEngine.applySettings({ ...DEFAULT_SETTINGS, soundEnabled: false });
    const unlock = vi.spyOn(audioEngine, 'unlock').mockResolvedValue(false);
    audioEngine.preview('thock');
    expect(unlock).toHaveBeenCalledOnce();
    expect(audioEngine.isEnabled()).toBe(false);
  });

  it('keeps the silent profile free of initialization', () => {
    const unlock = vi.spyOn(audioEngine, 'unlock').mockResolvedValue(false);
    audioEngine.preview('none');
    expect(unlock).not.toHaveBeenCalled();
  });
});
