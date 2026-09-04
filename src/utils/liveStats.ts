// The live counters the typing surfaces publish while a session is running.
// Islands that need the latest numbers (stats bar, pause menu, share card)
// read them here instead of off ad-hoc window globals.

export interface LiveStats {
  time: number;   // seconds elapsed
  words: number;
  chars: number;
  wpm?: number;
  accuracy?: number;
  startedAt?: number; // ms epoch
}

export type LiveMode = 'zen' | 'quote';

const EMPTY: LiveStats = { time: 0, words: 0, chars: 0 };
const current: Record<LiveMode, LiveStats> = { zen: { ...EMPTY }, quote: { ...EMPTY } };

export function publishLiveStats(mode: LiveMode, stats: LiveStats): void {
  current[mode] = stats;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(mode === 'zen' ? 'zenStats' : 'quoteStats', { detail: stats }));
  }
}

export function getLiveStats(mode: LiveMode): LiveStats {
  return current[mode];
}

export function resetLiveStats(mode: LiveMode): void {
  current[mode] = { ...EMPTY };
}
