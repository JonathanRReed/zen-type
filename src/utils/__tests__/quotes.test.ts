import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { quoteLength, filterQuotes, pickQuote, getFallbackQuotes, splitSource, normalizeCustomText, CUSTOM_TEXT_MAX, QUOTE_TAGS, type Quote } from '../quotes';

const corpus = JSON.parse(readFileSync(join(process.cwd(), 'public', 'quotes.json'), 'utf-8')) as Quote[];

const sample: Quote[] = [
  { id: 'a', text: 'Short one.', author: 'A', tags: ['stoic'] },
  { id: 'b', text: 'A medium length sentence that goes on a little longer than the short one does.', author: 'B', tags: ['nature'] },
  { id: 'c', text: 'x'.repeat(140), author: 'C', tags: ['stoic', 'nature'] },
];

describe('quoteLength', () => {
  it('buckets by character count', () => {
    expect(quoteLength('x'.repeat(60))).toBe('short');
    expect(quoteLength('x'.repeat(61))).toBe('medium');
    expect(quoteLength('x'.repeat(90))).toBe('medium');
    expect(quoteLength('x'.repeat(91))).toBe('long');
  });
});

describe('filterQuotes', () => {
  it('matches any of the chosen tags', () => {
    expect(filterQuotes(sample, { tags: ['stoic'] }).map(q => q.id)).toEqual(['a', 'c']);
    expect(filterQuotes(sample, { tags: ['stoic', 'nature'] })).toHaveLength(3);
  });

  it('filters by length and excludes the current quote', () => {
    expect(filterQuotes(sample, { lengths: ['short'] }).map(q => q.id)).toEqual(['a']);
    expect(filterQuotes(sample, { lengths: ['long'], excludeId: 'c' })).toHaveLength(0);
  });

  it('treats empty arrays as no filter', () => {
    expect(filterQuotes(sample, { tags: [], lengths: [] })).toHaveLength(3);
  });
});

describe('pickQuote', () => {
  it('never returns the excluded quote when there is a choice', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickQuote(sample, { excludeId: 'a' }).id).not.toBe('a');
    }
  });

  it('falls back to the full pool when the filter leaves nothing', () => {
    const q = pickQuote(sample, { tags: ['zen'] });
    expect(['a', 'b', 'c']).toContain(q.id);
  });

  it('falls back to the built-in quotes when the pool is empty', () => {
    expect(pickQuote([], {}).id).toMatch(/^fallback-/);
  });
});

describe('quotes.json', () => {
  it('is a few hundred quotes with complete records', () => {
    expect(corpus.length).toBeGreaterThan(300);
    for (const q of corpus) {
      expect(q.id).toMatch(/^[a-z0-9-]+$/);
      expect(q.text.length).toBeGreaterThan(10);
      expect(q.text.length).toBeLessThan(200);
      expect(q.author.length).toBeGreaterThan(0);
      expect(q.source && q.source.length).toBeGreaterThan(0);
      expect(q.tags && q.tags.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids and texts', () => {
    expect(new Set(corpus.map(q => q.id)).size).toBe(corpus.length);
    expect(new Set(corpus.map(q => q.text.toLowerCase())).size).toBe(corpus.length);
  });

  it('only uses characters a keyboard can type', () => {
    for (const q of corpus) {
      expect(q.text).toMatch(/^[A-Za-z0-9 .,;:!?'"()-]+$/);
      expect(q.text).not.toMatch(/\s{2}/);
    }
  });

  it('carries no made-up or unsourced entries', () => {
    for (const q of corpus) {
      expect(q.source).not.toMatch(/ZenQuotes|Original|Attributed/);
      expect(q.author).not.toBe('Zen Typer');
    }
  });

  it('only uses known tags', () => {
    const known = new Set(QUOTE_TAGS.map(t => t.id));
    for (const q of corpus) for (const t of q.tags ?? []) expect(known.has(t)).toBe(true);
  });

  it('has every tag represented at least ten times', () => {
    for (const tag of QUOTE_TAGS) {
      expect(corpus.filter(q => q.tags?.includes(tag.id)).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('fallbacks match the same shape', () => {
    for (const q of getFallbackQuotes()) {
      expect(q.tags?.length).toBeGreaterThan(0);
      expect(q.source).toBeTruthy();
    }
  });
});

describe('splitSource', () => {
  it('separates the work from its translator and year', () => {
    expect(splitSource('Meditations, trans. Meric Casaubon (1634)')).toEqual({ title: 'Meditations', detail: 'tr. Meric Casaubon, 1634' });
    expect(splitSource('Walden (1854)')).toEqual({ title: 'Walden', detail: '1854' });
    expect(splitSource('Essays, trans. Charles Cotton')).toEqual({ title: 'Essays', detail: 'tr. Charles Cotton' });
    expect(splitSource('The Enchiridion')).toEqual({ title: 'The Enchiridion', detail: '' });
    expect(splitSource('Bushido: The Soul of Japan (1900)')).toEqual({ title: 'Bushido: The Soul of Japan', detail: '1900' });
  });

  it('copes with a missing source', () => {
    expect(splitSource(undefined)).toEqual({ title: '', detail: '' });
    expect(splitSource('  ')).toEqual({ title: '', detail: '' });
  });

  it('gives every quote in the shipped pool a title', () => {
    for (const q of corpus) {
      const { title } = splitSource(q.source);
      expect(title.length, q.id).toBeGreaterThan(0);
    }
  });
});

describe('normalizeCustomText', () => {
  it('turns line breaks and runs of whitespace into single spaces', () => {
    expect(normalizeCustomText('  one\n\ntwo\t three  ')).toBe('one two three');
  });

  it('swaps typographic characters for the ones on a keyboard', () => {
    expect(normalizeCustomText('“Wait” — it’s here…')).toBe('"Wait" - it\'s here...');
  });

  it('caps the length and never ends on a space', () => {
    const long = 'word '.repeat(400);
    const out = normalizeCustomText(long);
    expect(out.length).toBeLessThanOrEqual(CUSTOM_TEXT_MAX);
    expect(out.endsWith(' ')).toBe(false);
  });

  it('leaves the shipped quotes untouched, so they stay typeable as written', () => {
    for (const q of corpus) expect(normalizeCustomText(q.text), q.id).toBe(q.text);
  });
});
