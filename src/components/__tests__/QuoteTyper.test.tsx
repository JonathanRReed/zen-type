import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QuoteTyper from '../QuoteTyper';
import { getLiveStats } from '../../utils/liveStats';
import { updateSettings } from '../../utils/storage';

vi.mock('../../utils/quotes', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/quotes')>(),
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
});
