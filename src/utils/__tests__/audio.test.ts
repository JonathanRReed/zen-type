import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../storage';

const state = vi.hoisted(() => ({
  enabled: false,
  ready: false,
  active: false,
  listener: undefined as ((settings: Settings) => void) | undefined,
  unlock: vi.fn<() => Promise<boolean>>(),
  loads: 0,
}));
vi.mock('../audioEngine', () => { state.loads++; return { audioEngine: {
  applySettings: (settings: Settings) => { state.enabled = !!settings.soundEnabled; },
  isEnabled: () => state.enabled,
  get ready() { return state.ready; },
  unlock: state.unlock,
  keyDown: vi.fn(),
  keyUp: vi.fn(),
} }; });
vi.mock('../storage', () => ({
  getSettings: () => ({ soundEnabled: state.enabled }),
  subscribeSettings: (listener: (settings: Settings) => void) => { state.listener = listener; },
}));

let listeners: Array<[string, EventListenerOrEventListenerObject, boolean]>;
beforeEach(() => {
  vi.resetModules();
  state.enabled = false;
  state.ready = false;
  state.active = false;
  state.listener = undefined;
  state.loads = 0;
  state.unlock.mockReset().mockResolvedValue(true);
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { get isActive() { return state.active; } } });
  listeners = [];
  const original = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    listeners.push([type, listener, typeof options === 'boolean' ? options : !!options?.capture]);
    original(type, listener, options);
  });
});
afterEach(() => {
  for (const [type, listener, capture] of listeners) window.removeEventListener(type, listener, capture);
  vi.restoreAllMocks();
});
const settings = (enabled: boolean) => ({ soundEnabled: enabled } as Settings);
// The engine is a lazy import now: it only arrives once sound is switched on.
// Let that import settle before looking at what it did.
const engineLoaded = () => vi.dynamicImportSettled();

describe('audio gesture initialization', () => {
  it('does not download the engine at all while sound is off', async () => {
    const { armAudio, audio } = await import('../audio');
    armAudio();
    audio.keyDown('a');
    audio.keyUp('a');
    await engineLoaded();
    expect(state.unlock).not.toHaveBeenCalled();
    expect(state.loads).toBe(0);
  });

  it('keeps muted typing, pointer and touch gestures free of audio initialization', async () => {
    const { armAudio } = await import('../audio');
    armAudio();
    for (const type of ['keydown', 'pointerdown', 'touchstart']) window.dispatchEvent(new Event(type));
    expect(state.unlock).not.toHaveBeenCalled();
  });

  it('initializes synchronously when sound is enabled inside a user gesture, including repeated toggles', async () => {
    const { armAudio } = await import('../audio');
    armAudio();
    state.active = true;
    state.listener!(settings(true));
    await engineLoaded();
    expect(state.unlock).toHaveBeenCalledTimes(1);
    state.listener!(settings(false));
    window.dispatchEvent(new Event('keydown'));
    expect(state.unlock).toHaveBeenCalledTimes(1);
    state.listener!(settings(true));
    expect(state.unlock).toHaveBeenCalledTimes(2);
  });

  it('waits for a gesture for saved or background-enabled sound and retries a suspended context', async () => {
    state.enabled = true;
    const { armAudio } = await import('../audio');
    armAudio();
    armAudio();
    await engineLoaded();
    expect(state.unlock).not.toHaveBeenCalled();
    state.listener!(settings(true));
    expect(state.unlock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('keydown'));
    window.dispatchEvent(new Event('pointerdown'));
    expect(state.unlock).toHaveBeenCalledTimes(2);
    state.ready = true;
    window.dispatchEvent(new Event('touchstart'));
    window.dispatchEvent(new Event('keydown'));
    expect(state.unlock).toHaveBeenCalledTimes(3);
  });

  it('does not treat activation inherited across a reload as a gesture for saved sound', async () => {
    state.enabled = true;
    state.active = true;
    const { armAudio } = await import('../audio');
    armAudio();
    await engineLoaded();
    expect(state.unlock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('keydown'));
    expect(state.unlock).toHaveBeenCalledTimes(1);
  });

  it('starts on arrival when a key lands while the engine is still downloading', async () => {
    state.enabled = true;
    const { armAudio } = await import('../audio');
    armAudio();
    state.active = true;
    window.dispatchEvent(new Event('keydown'));
    expect(state.unlock).not.toHaveBeenCalled();
    await engineLoaded();
    expect(state.unlock).toHaveBeenCalledTimes(1);
  });

  it('also handles legacy settings events without initializing muted or background audio', async () => {
    const { armAudio } = await import('../audio');
    armAudio();
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings(true) }));
    await engineLoaded();
    expect(state.unlock).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings(false) }));
    state.active = true;
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings(true) }));
    expect(state.unlock).toHaveBeenCalledTimes(1);
  });
});
