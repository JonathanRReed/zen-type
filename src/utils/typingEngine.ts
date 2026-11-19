// The quote typing engine: what a keystroke does to the state, and how the
// typed text is cut up for display. Pure functions, no React, no DOM.

type ErrorKind = 'slip' | 'skip' | 'extra';

// ---------------------------------------------------------------------------
// The typing engine is a reducer. Every keystroke dispatches an action that
// is applied against the latest state, so a burst of keydown events (key
// repeat, a composed word from a phone keyboard, a very fast typist) can never
// read a stale cursor and land on the same character.
// ---------------------------------------------------------------------------

export interface TypingState {
  cursor: number;
  errors: ReadonlySet<number>;
  correct: number;
  total: number;
  counts: { slip: number; skip: number; extra: number };
  startedAt: number | null;
  endedAt: number | null;
  complete: boolean;
  lastChar: string;
  lastTs: number;
}

export type TypingAction =
  | { type: 'type'; ch: string; ts: number; quote: string; debounceMs: number }
  | { type: 'backspace' }
  | { type: 'reset' };

export const INITIAL_TYPING: TypingState = {
  cursor: 0,
  errors: new Set<number>(),
  correct: 0,
  total: 0,
  counts: { slip: 0, skip: 0, extra: 0 },
  startedAt: null,
  endedAt: null,
  complete: false,
  lastChar: '',
  lastTs: 0,
};

export function typingReducer(state: TypingState, action: TypingAction): TypingState {
  switch (action.type) {
    case 'reset':
      return { ...INITIAL_TYPING, errors: new Set<number>() };
    case 'backspace': {
      if (state.complete || state.cursor === 0) return state;
      // Smart rewind: jump back to the earliest uncorrected mistake.
      let target = state.cursor - 1;
      for (let i = state.cursor - 1; i >= 0; i--) {
        if (state.errors.has(i)) { target = i; break; }
      }
      const errors = new Set(state.errors);
      errors.delete(target);
      return { ...state, cursor: target, errors };
    }
    case 'type': {
      const { ch, ts, quote, debounceMs } = action;
      if (state.complete || ch.length !== 1 || state.cursor >= quote.length) return state;
      if (debounceMs > 0 && ch === state.lastChar && ts - state.lastTs < debounceMs) return state;
      const index = state.cursor;
      const expected = quote[index];
      const isCorrect = ch === expected;
      const errors = new Set(state.errors);
      const counts = { ...state.counts };
      if (isCorrect) {
        errors.delete(index);
      } else {
        // Mistake counts are cumulative for the quote. Backspace rewinds to
        // the mistake so it can be fixed, but the fact that it happened stays
        // counted; otherwise every finished quote would report no mistakes.
        errors.add(index);
        const typedIsWs = /\s/.test(ch);
        const expectedIsWs = expected ? /\s/.test(expected) : false;
        const kind: ErrorKind = typedIsWs && !expectedIsWs ? 'skip' : !typedIsWs && expectedIsWs ? 'extra' : 'slip';
        counts[kind] += 1;
      }
      const cursor = index + 1;
      const complete = cursor === quote.length && isCorrect;
      return {
        ...state,
        cursor,
        errors,
        counts,
        correct: state.correct + (isCorrect ? 1 : 0),
        total: state.total + 1,
        startedAt: state.startedAt ?? Date.now(),
        endedAt: complete ? Date.now() : state.endedAt,
        complete,
        lastChar: ch,
        lastTs: ts,
      };
    }
    default:
      return state;
  }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "2 wrong keys, 1 early space." Empty when the quote was typed clean. */
export function describeMistakes(counts: { slip: number; skip: number; extra: number }): string {
  const parts: string[] = [];
  if (counts.slip) parts.push(plural(counts.slip, 'wrong key', 'wrong keys'));
  if (counts.skip) parts.push(plural(counts.skip, 'early space', 'early spaces'));
  if (counts.extra) parts.push(plural(counts.extra, 'missed space', 'missed spaces'));
  return parts.join(', ');
}

export interface Run {
  key: string;
  kind: 'done' | 'miss';
  text: string;
}

/**
 * The typed part of the quote as a handful of text runs instead of one
 * element per character, so the type keeps its kerning and a long pasted text
 * costs a few nodes, not twelve hundred. A run is keyed by where it starts,
 * so a keystroke only lengthens the text of the last one: no element is
 * added or removed for a correct key.
 */
export function typedRuns(text: string, cursor: number, errors: ReadonlySet<number>): Run[] {
  const runs: Run[] = [];
  let start = 0;
  for (let i = 1; i <= cursor; i++) {
    if (i === cursor || errors.has(i) !== errors.has(start)) {
      runs.push({ key: `r${start}`, kind: errors.has(start) ? 'miss' : 'done', text: text.slice(start, i) });
      start = i;
    }
  }
  return runs;
}
