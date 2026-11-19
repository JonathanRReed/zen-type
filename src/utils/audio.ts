// Sound is off by default, and the synthesizer is the largest module in the
// app, so it is not downloaded until sound is switched on. The typing
// surfaces call this facade on every keystroke; while the engine is absent
// those calls cost nothing, and muted typing never creates an audio context.

import { getSettings, subscribeSettings, type Settings, type SwitchSoundProfile } from './storage';
// Type only: erased at build time, so this does not pull the engine in.
import type { audioEngine } from './audioEngine';

type Engine = typeof audioEngine;

let engine: Engine | null = null;
let pending: Promise<Engine> | null = null;
let armed = false;
/** The most recent settings seen, applied to the engine when it arrives. */
let latest: Settings | null = null;

/** True while the browser still counts a recent click or key as a gesture. */
const gestureActive = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.userActivation?.isActive;

/**
 * Set when a gesture asked for sound before the engine had arrived: the click
 * that switched sound on, or a key pressed while it was still downloading.
 * Never set by the page simply loading with sound already on. A reload can
 * inherit the previous page's activation, and that is not a gesture here.
 */
let unlockOnArrival = false;

function load(): Promise<Engine> {
  pending ??= import('./audioEngine').then(({ audioEngine: loaded }) => {
    engine = loaded;
    engine.applySettings(latest ?? getSettings());
    if (unlockOnArrival && engine.isEnabled() && gestureActive()) void engine.unlock();
    return engine;
  });
  return pending;
}

function applySettings(settings: Settings): void {
  const turnedOn = latest !== null && !latest.soundEnabled && !!settings.soundEnabled;
  latest = settings;
  if (!engine) {
    if (settings.soundEnabled) {
      unlockOnArrival ||= turnedOn;
      void load();
    }
    return;
  }
  const wasEnabled = engine.isEnabled();
  engine.applySettings(settings);
  // Enable clicks and shortcuts must unlock before their user activation
  // expires. Saved or background settings wait for the next gesture.
  if (!wasEnabled && engine.isEnabled() && gestureActive()) void engine.unlock();
}

/**
 * Keep the engine in step with settings and arm the first-gesture unlock.
 * Call once per page (any island will do); it is idempotent.
 */
export function armAudio(): void {
  if (armed || typeof window === 'undefined') return;
  armed = true;

  applySettings(getSettings());
  subscribeSettings(applySettings);
  // Anything that still broadcasts the window event without going through
  // updateSettings() is covered too.
  window.addEventListener('settingsChanged', (e) => {
    const detail = (e as CustomEvent).detail;
    if (detail && typeof detail === 'object') applySettings(detail as Settings);
  });

  // Browsers only start audio inside a gesture. Keep listening: the first
  // gesture may land before the engine has loaded, or while the tab is
  // still in the background and the context refuses to resume.
  const onGesture = () => {
    if (!engine) {
      // Still downloading: let it start as soon as it lands.
      if (pending && latest?.soundEnabled) unlockOnArrival = true;
      return;
    }
    if (!engine.isEnabled()) return;
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
