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

describe('QuoteTyper sitting totals', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    updateSettings({ reducedMotion: true, autoAdvanceQuotes: false, debounceMs: 0, soundEnabled: false });
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

  function type(character: string) {
    const input = host.querySelector<HTMLInputElement>('[aria-label="Type the quote shown here"]')!;
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true })));
  }

  function finishQuote() {
    type('C');
    for (const character of 'ode') {
      act(() => vi.advanceTimersByTime(1000));
      type(character);
    }
  }

  it('counts a completed quote exactly once in the card and live counters', () => {
    finishQuote();
    expect(host.textContent).toContain('Characters: 4');
    expect(host.textContent).toContain('Correct: 4');
    expect(getLiveStats('quote')).toMatchObject({ chars: 4, time: 3, accuracy: 100 });
  });

  it('keeps prior completed totals while a second quote is typed and completed', () => {
    finishQuote();
    const retry = [...host.querySelectorAll('button')].find(button => button.textContent === 'Type again')!;
    act(() => retry.click());
    type('C');
    expect(getLiveStats('quote')).toMatchObject({ chars: 5, time: 3 });
    for (const character of 'ode') {
      act(() => vi.advanceTimersByTime(1000));
      type(character);
    }
    expect(host.textContent).toContain('Characters: 8');
    expect(host.textContent).toContain('Correct: 8');
    expect(getLiveStats('quote')).toMatchObject({ chars: 8, time: 6, accuracy: 100 });
  });

  it('freezes elapsed time after completion through later settings changes', () => {
    finishQuote();
    act(() => vi.advanceTimersByTime(60_000));
    act(() => updateSettings({ reducedMotion: false }));
    expect(getLiveStats('quote')).toMatchObject({ chars: 4, time: 3 });
  });

  it('handles backspace and error correction', () => {
    // Type incorrect character
    type('x');
    const firstChar = host.querySelector<HTMLSpanElement>('.quote-char');
    expect(firstChar?.getAttribute('data-state')).toBe('error');

    // Press Backspace
    const input = host.querySelector<HTMLInputElement>('[aria-label="Type the quote shown here"]')!;
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })));

    // First char should now be 'current'
    expect(firstChar?.getAttribute('data-state')).toBe('current');

    // Type correct character
    type('C');
    expect(firstChar?.getAttribute('data-state')).toBe('correct');
  });

  it('resets quote progress when Type again is clicked', () => {
    finishQuote();
    const retry = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Type again'))!;
    expect(retry).toBeDefined();
    act(() => retry.click());

    expect(host.querySelectorAll('.quote-char[data-state="correct"]').length).toBe(0);
    const firstChar = host.querySelector<HTMLSpanElement>('.quote-char');
    expect(firstChar?.getAttribute('data-state')).toBe('current');
  });

  it('advances ghost-pacer element as targetWpm pace progresses', () => {
    act(() => updateSettings({ targetWpm: 60 })); // 60 WPM = 5 CPS
    type('C'); // start typing (cursor = 1)

    // Advance time by 400ms -> 0.4s * 5 CPS = ghost cursor at index 2 ('d')
    act(() => vi.advanceTimersByTime(400));
    const pacer1 = host.querySelector('.quote-char.ghost-pacer');
    expect(pacer1).not.toBeNull();
    expect(pacer1?.textContent).toBe('d');

    // Advance time by another 300ms (700ms total) -> interval at 640ms calculates 0.64s * 5 CPS = ghost cursor at index 3 ('e')
    act(() => vi.advanceTimersByTime(300));
    const pacer2 = host.querySelector('.quote-char.ghost-pacer');
    expect(pacer2).not.toBeNull();
    expect(pacer2?.textContent).toBe('e');

    // Verify marker position changed between timer advances
    expect(pacer1).not.toBe(pacer2);
  });
});

describe('QuoteTyper chunk boundaries', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    updateSettings({ reducedMotion: true, autoAdvanceQuotes: false, soundEnabled: false });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  async function render(quote: string) {
    await act(async () => root.render(<QuoteTyper quote={quote} />));
    return Array.from(host.querySelectorAll('.quote-line'), line => line.textContent);
  }

  it('scans without splitting quote words into temporary strings', async () => {
    const quote = 'once upon a time once upon a time once upon a time';
    const split = vi.spyOn(String.prototype, 'split');
    const chunks = await render(quote);
    expect(chunks.join('')).toBe(quote.replaceAll(' ', '\u00a0'));
    const quoteSplits = split.mock.contexts.filter(context => String(context) === quote);
    expect(quoteSplits).toHaveLength(0);
  });

  it('preserves UTF-16 offsets around astral characters and Unicode whitespace', async () => {
    const quote = '😀alpha\u00a0beta\u1680gamma\u2000delta\u2028epsilon\u202fzeta\u205feta\u3000theta\ufeffiota\tκόσμε\nlast';
    const chunks = await render(quote);
    expect(chunks).toEqual([
      '😀alpha\u00a0beta\u1680gamma\u2000delta\u2028epsilon\u202fzeta\u205feta\u3000theta\ufeff',
      'iota\tκόσμε\nlast',
    ]);
  });

  it.each([0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0,
    0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
    0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f,
    0x3000, 0xfeff])('uses ECMAScript whitespace U+%s as a chunk boundary', async code => {
    const separator = String.fromCharCode(code);
    const quote = ['😀a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'].join(separator);
    const displayedSeparator = separator === ' ' ? '\u00a0' : separator;
    expect(await render(quote)).toEqual([
      ['😀a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', ''].join(displayedSeparator),
      ['i', 'j', 'k'].join(displayedSeparator),
    ]);
  });

  it('keeps substring words and non-whitespace Unicode unchanged', async () => {
    const quote = '  catcat cat a aa aaa aaaa aaaaa aaaaaa aaaaaaa aaaaaaaa aaaaaaaaa aaaaaaaaaa  ';
    expect(await render(quote)).toEqual([
      'catcat\u00a0cat\u00a0a\u00a0aa\u00a0aaa\u00a0aaaa\u00a0aaaaa\u00a0aaaaaa\u00a0',
      'aaaaaaa\u00a0aaaaaaaa\u00a0aaaaaaaaa\u00a0aaaaaaaaaa\u00a0\u00a0',
    ]);
    // New quotes are delivered through the same custom event as the app.
    await act(async () => window.dispatchEvent(new CustomEvent('newQuote', { detail: { quote: 'x\u0085y\u180ez\u200bw' } })));
    expect(Array.from(host.querySelectorAll('.quote-line'), line => line.textContent)).toEqual(['x\u0085y\u180ez\u200bw']);
  });
});

describe('QuoteTyper empty chunk inputs', () => {
  it.each(['', ' \t\n\u00a0\ufeff'])('does not create a line for %j', async quote => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(<QuoteTyper quote={quote} />));
      expect(host.querySelectorAll('.quote-line')).toHaveLength(0);
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
    }
  });
});
