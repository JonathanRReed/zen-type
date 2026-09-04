// Quote loading, filtering, and selection.

import type { QuoteLength } from './storage';

export interface Quote {
  id: string;
  text: string;
  author: string;
  source?: string;
  tags?: string[];
}

export interface QuoteFilter {
  lengths?: QuoteLength[]; // empty = any
  tags?: string[];         // empty = any; a quote matches if it carries any of them
  excludeId?: string;
}

/** Tag vocabulary, in display order. Quotes may carry several. */
export const QUOTE_TAGS: ReadonlyArray<{ id: string; label: string; blurb: string }> = [
  { id: 'stillness', label: 'Stillness', blurb: 'Quiet, rest, and letting things settle' },
  { id: 'mind', label: 'Mind', blurb: 'Attention, thought, and judgment' },
  { id: 'stoic', label: 'Stoic', blurb: 'Marcus Aurelius, Epictetus, Seneca' },
  { id: 'tao', label: 'Tao', blurb: 'Lao Tzu and Chuang Tzu' },
  { id: 'zen', label: 'Zen', blurb: 'Practice, tea, and the ordinary' },
  { id: 'buddhist', label: 'Buddhist', blurb: 'The Dhammapada and after' },
  { id: 'nature', label: 'Nature', blurb: 'Woods, water, weather, seasons' },
  { id: 'craft', label: 'Craft', blurb: 'Work, skill, and doing things well' },
  { id: 'life', label: 'Life', blurb: 'Time, change, and how to spend a day' },
  { id: 'simplicity', label: 'Simplicity', blurb: 'Less, plainly' },
];

// Bounds chosen so the corpus splits roughly 45 / 50 / 5.
export const LENGTH_BOUNDS: Readonly<Record<QuoteLength, [number, number]>> = {
  short: [0, 70],
  medium: [71, 110],
  long: [111, Infinity],
};

export function quoteLength(text: string): QuoteLength {
  const n = text.length;
  if (n <= 70) return 'short';
  if (n <= 110) return 'medium';
  return 'long';
}

let quotesCache: Quote[] | null = null;

const loadClientQuotes = async (): Promise<Quote[]> => {
  const response = await fetch('/quotes.json');
  if (!response.ok) {
    throw new Error(`Failed to load quotes: ${response.status}`);
  }
  return await response.json() as Quote[];
};

export async function loadQuotes(): Promise<Quote[]> {
  if (quotesCache) return quotesCache;
  try {
    let arr: Quote[];
    if (import.meta.env.SSR) {
      const { loadServerQuotes } = await import('./quotes.server.js');
      arr = await loadServerQuotes();
    } else {
      arr = await loadClientQuotes();
    }
    quotesCache = arr.filter(q => q && typeof q.text === 'string' && q.text.trim().length > 0);
    return quotesCache;
  } catch (error) {
    console.error('Error loading quotes:', error);
    return getFallbackQuotes();
  }
}

export function filterQuotes(quotes: Quote[], filter?: QuoteFilter): Quote[] {
  if (!filter) return quotes;
  const lengths = filter.lengths ?? [];
  const tags = filter.tags ?? [];
  return quotes.filter(q => {
    if (filter.excludeId && q.id === filter.excludeId) return false;
    if (lengths.length > 0 && !lengths.includes(quoteLength(q.text))) return false;
    if (tags.length > 0) {
      const own = q.tags ?? [];
      if (!tags.some(t => own.includes(t))) return false;
    }
    return true;
  });
}

/**
 * Pick a quote that fits the filter. Falls back to the whole pool when the
 * filter leaves nothing, and to the built-in quotes when the pool is empty.
 */
export function pickQuote(quotes: Quote[], filter?: QuoteFilter): Quote {
  let pool = filterQuotes(quotes, filter);
  if (pool.length === 0 && filter?.excludeId) {
    pool = filterQuotes(quotes, { ...filter, excludeId: undefined as unknown as string });
  }
  if (pool.length === 0) pool = quotes.length > 0 ? quotes : getFallbackQuotes();
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? pool[0] ?? getFallbackQuotes()[0]!;
}

/** @deprecated use pickQuote */
export function getRandomQuote(quotes: Quote[]): Quote {
  return pickQuote(quotes);
}

export function getFallbackQuotes(): Quote[] {
  return [
    {
      id: 'fallback-01',
      text: 'Let it be still, and it will gradually become clear.',
      author: 'Lao Tzu',
      source: 'Tao Te Ching, trans. James Legge (1891)',
      tags: ['tao', 'stillness'],
    },
    {
      id: 'fallback-02',
      text: 'Confine thyself to the present.',
      author: 'Marcus Aurelius',
      source: 'Meditations, trans. George Long (1862)',
      tags: ['stoic', 'mind'],
    },
    {
      id: 'fallback-03',
      text: 'All that we are is the result of what we have thought: it is founded on our thoughts, it is made up of our thoughts.',
      author: 'The Buddha',
      source: 'Dhammapada, trans. F. Max Muller (1881)',
      tags: ['buddhist', 'mind'],
    },
    {
      id: 'fallback-04',
      text: 'Above all, we cannot afford not to live in the present.',
      author: 'Henry David Thoreau',
      source: 'Walking (1862)',
      tags: ['nature', 'life'],
    },
  ];
}

export function formatQuote(quote: Quote): string {
  return `${quote.text} — ${quote.author}`;
}
