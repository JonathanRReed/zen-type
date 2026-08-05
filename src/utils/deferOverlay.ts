import { useSyncExternalStore } from 'react';

// Helpers for overlays that are closed at first paint.
//
// Every overlay on the app pages ships as its own `client:only` island, so
// whatever the module imports lands in the initial download even though the
// overlay renders nothing until someone opens it. The pause menu was the worst
// case: ~85KB of Radix select, switch, checkbox, and label parsed and hydrated
// at first paint for a dialog that is closed on arrival.
//
// The fix is a small always-loaded shell that owns the open/close contract plus
// a dynamic import for the markup, primed on the first real user interaction so
// the chunk is already in memory by the time the shortcut that opens it is
// pressed.
//
// Deliberately not React.lazy + Suspense. A Suspense boundary that shows a
// fallback will not swap in the real content immediately even when the module
// is already resolved: React throttles fallback-to-content so the fallback
// cannot flicker, and that put ~300ms between Escape and the pause menu on an
// interaction that used to take 16ms. Holding the module in an external store
// and reading it with useSyncExternalStore means a primed overlay renders in
// the same commit as the keypress, with no fallback mounted and nothing to
// throttle.

export interface DeferredModule<T> {
  /** Start the fetch, or hand back the one already in flight. */
  load: () => Promise<T>;
  /** The module once it has arrived, otherwise null. */
  get: () => T | null;
  subscribe: (onChange: () => void) => () => void;
}

export function deferModule<T>(importer: () => Promise<T>): DeferredModule<T> {
  let pending: Promise<T> | null = null;
  let value: T | null = null;
  const listeners = new Set<() => void>();

  const load = () => {
    if (!pending) {
      pending = importer().then(mod => {
        value = mod;
        for (const listener of listeners) listener();
        return mod;
      });
    }
    return pending;
  };

  return {
    load,
    get: () => value,
    subscribe: (onChange: () => void) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

/** Re-render the caller when `mod` finishes loading. Null until then. */
export function useDeferredModule<T>(mod: DeferredModule<T>): T | null {
  return useSyncExternalStore(mod.subscribe, mod.get, mod.get);
}

// `pointermove` is the one that matters in practice: it fires the moment the
// cursor crosses the page, long before anyone decides to pause. The rest cover
// keyboard-only and touch arrivals. All capture-phase so a component that stops
// propagation cannot starve the primer.
//
// `focusin` looks like it belongs here and does not. The typing surface focuses
// itself on mount, so focusin fires on every load before anybody has touched
// anything, and including it put the overlay chunks straight back on the
// critical path. Every input method that can reach these overlays sends one of
// the four below first.
const PRIME_EVENTS = [
  'keydown',
  'pointerdown',
  'pointermove',
  'touchstart',
] as const;

/**
 * Start `load` on the first user interaction of any kind, then unsubscribe.
 * Returns the teardown so effects can hand it straight back.
 */
export function primeOnFirstInteraction(load: () => unknown): () => void {
  if (typeof window === 'undefined') return () => {};

  let fired = false;

  const stop = () => {
    for (const type of PRIME_EVENTS) {
      window.removeEventListener(type, run, true);
    }
  };

  function run() {
    if (fired) return;
    fired = true;
    stop();
    load();
  }

  for (const type of PRIME_EVENTS) {
    window.addEventListener(type, run, { capture: true, passive: true });
  }

  return stop;
}
