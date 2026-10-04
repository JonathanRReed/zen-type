import { describe, it, expect } from 'vitest';
import { findInText, computeTextMetrics, getKeywordFrequencies, extractOutline } from '../textMetrics';

describe('findInText', () => {
  it('returns empty array when query is empty or text is empty', () => {
    expect(findInText('', 'test')).toEqual([]);
    expect(findInText('hello world', '')).toEqual([]);
  });

  it('finds single match on single line', () => {
    const text = 'Hello world';
    const matches = findInText(text, 'world');
    expect(matches).toEqual([
      { index: 6, length: 5, line: 0, column: 6 },
    ]);
  });

  it('calculates lines and columns correctly across multi-line text', () => {
    const text = 'Line 0\nLine 1 is here\nLine 2 is also here';
    const matches = findInText(text, 'is');
    expect(matches).toEqual([
      { index: 14, length: 2, line: 1, column: 7 },
      { index: 29, length: 2, line: 2, column: 7 },
    ]);
  });

  it('handles multiple matches on the same line', () => {
    const text = 'abc abc abc';
    const matches = findInText(text, 'abc');
    expect(matches).toEqual([
      { index: 0, length: 3, line: 0, column: 0 },
      { index: 4, length: 3, line: 0, column: 4 },
      { index: 8, length: 3, line: 0, column: 8 },
    ]);
  });

  it('handles query matching newline character itself', () => {
    const text = 'hello\nworld\nfoo';
    const matches = findInText(text, '\n');
    expect(matches).toEqual([
      { index: 5, length: 1, line: 0, column: 5 },
      { index: 11, length: 1, line: 1, column: 5 },
    ]);
  });

  it('respects caseSensitivity flag', () => {
    const text = 'Hello HELLO hello';
    expect(findInText(text, 'hello', false)).toHaveLength(3);
    const caseSensitiveMatches = findInText(text, 'hello', true);
    expect(caseSensitiveMatches).toEqual([
      { index: 12, length: 5, line: 0, column: 12 },
    ]);
  });

  it('handles matches in large multi-line text efficiently', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: item in list`);
    const text = lines.join('\n');
    const matches = findInText(text, 'item');
    expect(matches).toHaveLength(100);
    expect(matches[0]).toMatchObject({ line: 0, column: 8 });
    expect(matches[99]).toMatchObject({ line: 99, column: 9 });
  });
});

describe('computeTextMetrics', () => {
  it('handles empty text', () => {
    expect(computeTextMetrics('')).toEqual({
      words: 0,
      chars: 0,
      sentences: 0,
      readTimeMinutes: 0,
    });
  });

  it('computes metrics for normal text', () => {
    const text = 'Hello world! This is a test. How are you doing?';
    const metrics = computeTextMetrics(text);
    expect(metrics.words).toBe(10);
    expect(metrics.chars).toBe(text.length);
    expect(metrics.sentences).toBe(3);
    expect(metrics.readTimeMinutes).toBe(1);
  });
});

describe('getKeywordFrequencies', () => {
  it('extracts top non-stop-word frequencies', () => {
    const text = 'TypeScript is great. Programmers write TypeScript code because TypeScript is flexible.';
    const freqs = getKeywordFrequencies(text, 5);
    expect(freqs[0]).toEqual({ word: 'typescript', count: 3 });
  });
});

describe('extractOutline', () => {
  it('extracts headings from markdown text', () => {
    const text = '# Heading 1\nSome paragraph without dot\n## Heading 2\nMore text';
    const outline = extractOutline(text);
    expect(outline).toEqual([
      { text: 'Heading 1', level: 1, startIndex: 0 },
      { text: 'Heading 2', level: 2, startIndex: 39 },
    ]);
  });
});
