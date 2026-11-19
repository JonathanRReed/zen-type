import { describe, it, expect } from 'vitest';
import { INITIAL_TYPING, typingReducer, typedRuns, describeMistakes, type TypingState } from '../typingEngine';

const type = (state: TypingState, text: string, quote: string, debounceMs = 0, startTs = 0): TypingState =>
  Array.from(text).reduce((acc, ch, i) => typingReducer(acc, { type: 'type', ch, ts: startTs + i * 100, quote, debounceMs }), state);

describe('typingReducer', () => {
  const quote = 'Be still.';

  it('finishes a clean run with every character correct', () => {
    const done = type(INITIAL_TYPING, quote, quote);
    expect(done.complete).toBe(true);
    expect(done.cursor).toBe(quote.length);
    expect(done.correct).toBe(quote.length);
    expect(done.total).toBe(quote.length);
    expect(done.errors.size).toBe(0);
    expect(done.startedAt).not.toBeNull();
    expect(done.endedAt).not.toBeNull();
  });

  it('does not finish on a wrong last character', () => {
    const state = type(INITIAL_TYPING, 'Be still!', quote);
    expect(state.complete).toBe(false);
    expect(state.errors.has(quote.length - 1)).toBe(true);
  });

  it('sorts mistakes into wrong keys, early spaces, and missed spaces', () => {
    // "Bx" wrong key, then a space where "s" belongs, then a letter where the space belongs.
    let state = type(INITIAL_TYPING, 'Bx', quote);
    expect(state.counts).toEqual({ slip: 1, skip: 0, extra: 0 });
    state = type(INITIAL_TYPING, 'Be ', quote);
    state = type(state, ' ', quote);
    expect(state.counts.skip).toBe(1);
    state = type(INITIAL_TYPING, 'Bex', quote);
    expect(state.counts.extra).toBe(1);
  });

  it('rewinds to the earliest uncorrected mistake and keeps the tally', () => {
    let state = type(INITIAL_TYPING, 'Bx st', quote);
    expect(state.cursor).toBe(5);
    state = typingReducer(state, { type: 'backspace' });
    expect(state.cursor).toBe(1);
    expect(state.errors.size).toBe(0);
    // The mistake happened; fixing it does not erase the count.
    expect(state.counts.slip).toBe(1);
    const done = type(state, 'e still.', quote);
    expect(done.complete).toBe(true);
    expect(done.total).toBe(5 + 8);
  });

  it('ignores a bounced key inside the debounce window', () => {
    let state = typingReducer(INITIAL_TYPING, { type: 'type', ch: 'B', ts: 0, quote, debounceMs: 30 });
    state = typingReducer(state, { type: 'type', ch: 'B', ts: 10, quote, debounceMs: 30 });
    expect(state.cursor).toBe(1);
    state = typingReducer(state, { type: 'type', ch: 'e', ts: 20, quote, debounceMs: 30 });
    expect(state.cursor).toBe(2);
  });

  it('ignores input once the quote is complete, and reset starts clean', () => {
    const done = type(INITIAL_TYPING, quote, quote);
    expect(typingReducer(done, { type: 'type', ch: 'x', ts: 9999, quote, debounceMs: 0 })).toBe(done);
    expect(typingReducer(done, { type: 'backspace' })).toBe(done);
    const fresh = typingReducer(done, { type: 'reset' });
    expect(fresh.cursor).toBe(0);
    expect(fresh.complete).toBe(false);
    expect(fresh.errors.size).toBe(0);
  });
});

describe('typedRuns', () => {
  const text = 'Still water';

  it('is empty before anything is typed', () => {
    expect(typedRuns(text, 0, new Set())).toEqual([]);
  });

  it('keeps the newest character as its own run', () => {
    const runs = typedRuns(text, 5, new Set());
    expect(runs.map(r => r.text)).toEqual(['Stil', 'l']);
    expect(runs.map(r => r.fresh)).toEqual([false, true]);
    expect(runs.every(r => r.kind === 'done')).toBe(true);
  });

  it('splits at every change between right and wrong, and loses no text', () => {
    const runs = typedRuns(text, 8, new Set([1, 2, 5]));
    expect(runs.map(r => [r.kind, r.text])).toEqual([
      ['done', 'S'],
      ['miss', 'ti'],
      ['done', 'll'],
      ['miss', ' '],
      ['done', 'w'],
      ['done', 'a'],
    ]);
    expect(runs.map(r => r.text).join('')).toBe(text.slice(0, 8));
  });

  it('marks a wrong newest character as a miss', () => {
    const runs = typedRuns(text, 3, new Set([2]));
    expect(runs.at(-1)).toMatchObject({ kind: 'miss', text: 'i', fresh: true });
  });
});

describe('describeMistakes', () => {
  it('is empty for a clean quote', () => {
    expect(describeMistakes({ slip: 0, skip: 0, extra: 0 })).toBe('');
  });

  it('names each kind with the right plural', () => {
    expect(describeMistakes({ slip: 1, skip: 2, extra: 1 })).toBe('1 wrong key, 2 early spaces, 1 missed space');
  });
});
