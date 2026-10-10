import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../storage';

const state = vi.hoisted(() => ({
  enabled: false,
  ready: false,
  active: false,
  listener: undefined as ((settings: Settings) => void) | undefined,
  unlock: vi.fn<() => Promise<boolean>>(),
}));
vi.mock('../audioEngine', () => ({ audioEngine: {
  applySettings: (settings: Settings) => { state.enabled = !!settings.soundEnabled; },
  isEnabled: () => state.enabled,
  get ready() { return state.ready; },
  unlock: state.unlock,
} }));
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

describe('audio gesture initialization', () => {
  it('keeps muted typing, pointer and touch gestures free of audio initialization', async () => {
    const { armAudio } = await import('../audioBridge');
    armAudio();
    for (const type of ['keydown', 'pointerdown', 'touchstart']) window.dispatchEvent(new Event(type));
    expect(state.unlock).not.toHaveBeenCalled();
  });

  it('initializes synchronously when sound is enabled inside a user gesture, including repeated toggles', async () => {
    const { armAudio } = await import('../audioBridge');
    armAudio();
    state.active = true;
    state.listener!(settings(true));
    expect(state.unlock).toHaveBeenCalledTimes(1);
    state.listener!(settings(false));
    window.dispatchEvent(new Event('keydown'));
    expect(state.unlock).toHaveBeenCalledTimes(1);
    state.listener!(settings(true));
    expect(state.unlock).toHaveBeenCalledTimes(2);
  });

  it('waits for a gesture for saved or background-enabled sound and retries a suspended context', async () => {
    state.enabled = true;
    const { armAudio } = await import('../audioBridge');
    armAudio();
    armAudio();
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

  it('also handles legacy settings events without initializing muted or background audio', async () => {
    const { armAudio } = await import('../audioBridge');
    armAudio();
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings(true) }));
    expect(state.unlock).not.toHaveBeenCalled();
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings(false) }));
    state.active = true;
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings(true) }));
    expect(state.unlock).toHaveBeenCalledTimes(1);
  });
});
