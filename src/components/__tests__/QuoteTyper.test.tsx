import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuoteTyper from '../QuoteTyper';
import type * as QuotesModule from '../../utils/quotes';
import { getLiveStats } from '../../utils/liveStats';
import { updateSettings } from '../../utils/storage';

vi.mock('../../utils/quotes', async (importOriginal) => ({
  ...await importOriginal<typeof QuotesModule>(),
  loadQuotes: vi.fn().mockResolvedValue([]),
}));

let host: HTMLDivElement;
let root: Root;

const passage = () => host.querySelector<HTMLParagraphElement>('.passage-text')!;
const progress = () => ({
  cursor: Number(passage().dataset.cursor),
  errors: Number(passage().dataset.errors),
});
const button = (label: string) =>
  [...host.querySelectorAll('button')].find(b => b.textContent?.startsWith(label))!;

function type(character: string) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="Type the quote shown here"]')!;
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true })));
}

describe('QuoteTyper', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    updateSettings({ reducedMotion: true, autoAdvanceQuotes: false, debounceMs: 0, soundEnabled: false, targetWpm: 0 });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<QuoteTyper quote="Code" />));
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function finishQuote() {
    type('C');
    for (const character of 'ode') {
      act(() => vi.advanceTimersByTime(1000));
      type(character);
    }
  }

  describe('sitting totals', () => {
    it('counts a completed quote exactly once', () => {
      finishQuote();
      expect(host.querySelector('.result')).not.toBeNull();
      expect(getLiveStats('quote')).toMatchObject({ chars: 4, time: 3, accuracy: 100 });
    });

    it('keeps prior completed totals while a second quote is typed and completed', () => {
      finishQuote();
      act(() => button('Type again').click());
      type('C');
      expect(getLiveStats('quote')).toMatchObject({ chars: 5, time: 3 });
      for (const character of 'ode') {
        act(() => vi.advanceTimersByTime(1000));
        type(character);
      }
      expect(getLiveStats('quote')).toMatchObject({ chars: 8, time: 6, accuracy: 100 });
    });

    it('freezes elapsed time after completion through later settings changes', () => {
      finishQuote();
      act(() => vi.advanceTimersByTime(60_000));
      act(() => updateSettings({ reducedMotion: false }));
      expect(getLiveStats('quote')).toMatchObject({ chars: 4, time: 3 });
    });
  });

  describe('typing', () => {
    it('shows the expected character in place of a wrong key, and takes it back', () => {
      type('x');
      expect(progress()).toEqual({ cursor: 1, errors: 1 });
      // The page keeps showing what should have been typed, so nothing reflows.
      expect(host.querySelector('.q-miss')?.textContent).toBe('C');
      expect(passage().textContent).toBe('Code');

      type('Backspace');
      expect(progress()).toEqual({ cursor: 0, errors: 0 });
      expect(host.querySelector('.q-miss')).toBeNull();
      expect(host.querySelector('.q-now')?.textContent).toBe('C');

      type('C');
      expect(progress()).toEqual({ cursor: 1, errors: 0 });
      expect(host.querySelector('.q-done')?.textContent).toBe('C');
      expect(host.querySelector('.q-now')?.textContent).toBe('o');
    });

    it('goes back to the start when Type again is pressed', () => {
      finishQuote();
      expect(progress().cursor).toBe(4);
      act(() => button('Type again').click());

      expect(progress()).toEqual({ cursor: 0, errors: 0 });
      expect(host.querySelector('.q-done')).toBeNull();
      expect(host.querySelector('.q-now')?.textContent).toBe('C');
      expect(host.querySelector('.result')).toBeNull();
    });

    it('moves the pace marker through the quote at the target speed', () => {
      act(() => updateSettings({ targetWpm: 60 })); // 60 wpm is five characters a second
      type('C');

      act(() => vi.advanceTimersByTime(400));
      expect(host.querySelector('.q-pace')?.textContent).toBe('d');

      act(() => vi.advanceTimersByTime(300));
      expect(host.querySelector('.q-pace')?.textContent).toBe('e');
      expect(passage().textContent).toBe('Code');
    });

    it('has no pace marker without a target speed', () => {
      type('C');
      act(() => vi.advanceTimersByTime(700));
      expect(host.querySelector('.q-pace')).toBeNull();
    });
  });

  describe('the passage text', () => {
    // The passage is set as running text and wrapped by the browser. Whatever
    // state the typist is in, the characters on the page are the quote's.
    const awkward = '😀alpha beta gamma delta epsilon zeta eta　theta﻿iota\tκόσμε last';

    it('renders astral characters and Unicode whitespace unchanged', async () => {
      await act(async () => window.dispatchEvent(new CustomEvent('loadCustomQuote', { detail: { text: awkward } })));
      expect(passage().textContent).toBe(awkward);
    });

    it('keeps the text intact at every cursor position, with and without mistakes', async () => {
      const quote = 'once upon a time';
      await act(async () => window.dispatchEvent(new CustomEvent('loadCustomQuote', { detail: { text: quote } })));
      for (const [i, character] of [...quote].entries()) {
        // Every third key is wrong.
        type(i % 3 === 2 ? '~' : character);
        expect(passage().textContent).toBe(quote);
      }
      expect(progress()).toEqual({ cursor: quote.length, errors: 5 });
    });

    it('replaces the passage with custom text and credits it', async () => {
      type('C');
      await act(async () => window.dispatchEvent(new CustomEvent('loadCustomQuote', { detail: { text: '  My own words.  ' } })));
      expect(passage().textContent).toBe('My own words.');
      expect(progress()).toEqual({ cursor: 0, errors: 0 });
      expect(passage().classList.contains('is-next')).toBe(true);
      expect(host.querySelector('.credit-author')?.textContent).toBe('Your own text');
    });

    it('ignores custom text that is only whitespace', async () => {
      await act(async () => window.dispatchEvent(new CustomEvent('loadCustomQuote', { detail: { text: ' \t\n ﻿' } })));
      expect(passage().textContent).toBe('Code');
    });
  });
});

describe('QuoteTyper with nothing to type', () => {
  it('shows no result and takes no keys for an empty quote', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    root = createRoot(host);
    try {
      await act(async () => root.render(<QuoteTyper quote="" />));
      type('a');
      expect(host.querySelector('.q-now')).toBeNull();
      expect(host.querySelector('.result')).toBeNull();
      expect(progress()).toEqual({ cursor: 0, errors: 0 });
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });
});
