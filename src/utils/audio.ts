// Sound is off by default, and the synthesizer is the largest module in the
// app, so it is not downloaded until sound is switched on. The typing
// surfaces call this facade on every keystroke; while the engine is absent
// those calls cost nothing.

import { getSettings, subscribeSettings, type Settings, type SwitchSoundProfile } from './storage';
// Type only: erased at build time, so this does not pull the engine in.
import type { audioEngine } from './audioEngine';

type Engine = typeof audioEngine;

let engine: Engine | null = null;
let pending: Promise<Engine> | null = null;
let armed = false;

function load(): Promise<Engine> {
  pending ??= import('./audioEngine').then(({ audioEngine }) => {
    engine = audioEngine;
    engine.applySettings(getSettings());
    // Usually still inside the activation of the click or key that turned
    // sound on. If the browser disagrees, the gesture listeners below try
    // again on the next key.
    void engine.unlock();
    return engine;
  });
  return pending;
}

function sync(settings: Settings): void {
  if (engine) engine.applySettings(settings);
  else if (settings.soundEnabled) void load();
}

/**
 * Keep the engine in step with settings and arm the first-gesture unlock.
 * Call once per page (any island will do); it is idempotent.
 */
export function armAudio(): void {
  if (armed || typeof window === 'undefined') return;
  armed = true;

  sync(getSettings());
  subscribeSettings(sync);

  // Browsers only start audio inside a gesture. Keep listening: the first
  // gesture may land before the engine has loaded, or while the tab is
  // still in the background.
  const onGesture = () => {
    if (!engine) return;
    void engine.unlock();
    if (engine.ready) {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      window.removeEventListener('touchstart', onGesture, true);
    }
  };
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
}

export const audio = {
  keyDown(key: string | undefined, options?: { repeat?: boolean }): void {
    engine?.keyDown(key, options);
  },
  keyUp(key: string | undefined): void {
    engine?.keyUp(key);
  },
  /** The bell at the end of a timed session. Silent while sound is off. */
  chime(): void {
    engine?.chime();
  },
  /** Audition a key sound. Loads the engine if it is not there yet. */
  preview(profile?: SwitchSoundProfile): void {
    void load().then(e => e.preview(profile));
  },
};
