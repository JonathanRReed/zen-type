import { describe, it, expect } from 'vitest';
import { findInText, computeTextMetrics, getKeywordFrequencies, extractOutline, extractRecentLines, getDraftPreview } from '../textMetrics';

// Reference implementation from before the single-pass optimization.
function legacyTextMetrics(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: 0, chars: 0, sentences: 0, readTimeMinutes: 0 };
  }
  const words = trimmed.split(/\s+/).length;
  return {
    words,
    chars: text.length,
    sentences: (trimmed.match(/[.!?]+/g) || []).length || 1,
    readTimeMinutes: Math.ceil(words / 200),
  };
}

const ECMASCRIPT_WHITESPACE = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
  0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
  0xfeff,
].map(code => ({
  name: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
  whitespace: String.fromCharCode(code),
}));

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

  it('counts words separated by a non-breaking space', () => {
    expect(computeTextMetrics('one\u00a0two')).toEqual({
      words: 2,
      chars: 7,
      sentences: 1,
      readTimeMinutes: 1,
    });
  });

  it.each(ECMASCRIPT_WHITESPACE)('preserves metrics across $name whitespace', ({ whitespace }) => {
    const inputs = [
      whitespace,
      whitespace.repeat(3),
      `one${whitespace}two`,
      `${whitespace}one${whitespace}${whitespace}two${whitespace}`,
      `one!${whitespace}two?`,
    ];
    for (const text of inputs) {
      expect(computeTextMetrics(text)).toEqual(legacyTextMetrics(text));
    }
  });

  it.each([
    ['empty', ''],
    ['mixed whitespace only', '\t\r\n \u00a0\u2003\u2028\ufeff'],
    ['multiline', '\nFirst line.\r\nSecond\tline!\n\nThird line?\n'],
    ['punctuation only', '...!!!???'],
    ['separated punctuation', '. ! ?'],
    ['consecutive sentence delimiters', 'Wait... Really?! Yes!!'],
    ['Unicode sentence punctuation', 'One\u3002Two\uff01Three\uff1f'],
    ['no sentence delimiters', 'Hello world'],
    ['UTF-16 characters', '\ud83d\ude00 caf\u00e9\u2003\ud83d\ude80'],
    ['non-whitespace Unicode characters', 'one\u0085two\u180ethree\u200bfour'],
    ['control characters', '\u0000one\u0001two\u001fthree\u0000'],
  ])('preserves legacy metrics for %s text', (_name, text) => {
    expect(computeTextMetrics(text)).toEqual(legacyTextMetrics(text));
  });

  it.each([199, 200, 201, 400, 401])('preserves reading time for %i words', count => {
    const text = Array.from({ length: count }, () => 'word').join('\u202f');
    expect(computeTextMetrics(text)).toEqual(legacyTextMetrics(text));
    expect(computeTextMetrics(text).readTimeMinutes).toBe(Math.ceil(count / 200));
  });

  it('matches legacy word boundaries for every UTF-16 code unit', () => {
    for (let code = 0; code <= 0xffff; code++) {
      const text = `one${String.fromCharCode(code)}two`;
      expect(computeTextMetrics(text)).toEqual(legacyTextMetrics(text));
    }
  });
});

function legacyKeywordFrequencies(text: string, topN: number = 10) {
  const STOP_WORDS = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
    'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
    'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
    'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them',
    'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
    'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
    'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
    'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had',
    'were', 'said', 'did', 'having', 'may', 'should', 'could', 'would'
  ]);

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const result: { word: string; count: number }[] = [];
  for (const [word, count] of freq.entries()) {
    if (count > 1) {
      result.push({ word, count });
    }
  }
  return result.sort((a, b) => b.count - a.count).slice(0, topN);
}

describe('getKeywordFrequencies', () => {
  it('extracts top non-stop-word frequencies', () => {
    const text = 'TypeScript is great. Programmers write TypeScript code because TypeScript is flexible.';
    const freqs = getKeywordFrequencies(text, 5);
    expect(freqs[0]).toEqual({ word: 'typescript', count: 3 });
  });

  it('handles empty text and text with no repeated words', () => {
    expect(getKeywordFrequencies('')).toEqual([]);
    expect(getKeywordFrequencies('unique words only here')).toEqual([]);
  });

  it('filters out short words (length <= 2) and stop words', () => {
    const text = 'is to be in on at or an it if up my so no do go me no by my at am is or re re';
    expect(getKeywordFrequencies(text)).toEqual([]);
  });

  it('respects topN limit and sorts by count descending', () => {
    const text = 'apple apple apple banana banana cherry cherry cherry cherry date date';
    const freqs = getKeywordFrequencies(text, 2);
    expect(freqs).toEqual([
      { word: 'cherry', count: 4 },
      { word: 'apple', count: 3 },
    ]);
  });

  it.each([
    ['simple text', 'testing testing testing performance performance optimization'],
    ['mixed punctuation', 'hello, world! hello: world... hello? world!'],
    ['multiline document', 'drafting text\ndrafting text\ndrafting text\nagain again'],
    ['numbers and underscores', 'var_1 var_1 var_2 var_2 var_2 test_123 test_123'],
  ])('matches legacy keyword frequencies parity for %s', (_name, text) => {
    expect(getKeywordFrequencies(text)).toEqual(legacyKeywordFrequencies(text));
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

describe('getDraftPreview', () => {
  it.each(ECMASCRIPT_WHITESPACE)('skips $name-only lines before preview content', ({ whitespace }) => {
    expect(getDraftPreview(`${whitespace}\nActual content`)).toBe('Actual content');
    expect(getDraftPreview(` \t${whitespace}${whitespace}\r\n  Actual content  \r\nIgnored`)).toBe('Actual content');
    expect(getDraftPreview(`${whitespace}\n`)).toBe('');
  });

  it('skips consecutive Unicode-whitespace lines and preserves truncation', () => {
    const text = '\u00a0\n\u2003\r\n\ufeff\nHello World\nIgnored';
    expect(getDraftPreview(text, 5)).toBe('Hello…');
  });

  it('matches legacy preview selection for every UTF-16 code unit', () => {
    for (let code = 0; code <= 0xffff; code++) {
      const text = `${String.fromCharCode(code)}\nActual content`;
      const expected = text.split('\n').map(line => line.trim()).find(line => line.length > 0) || '';
      expect(getDraftPreview(text)).toBe(expected);
    }
  });

  it('returns empty string for empty or whitespace-only text', () => {
    expect(getDraftPreview('')).toBe('');
    expect(getDraftPreview('   \n\t  \n  ')).toBe('');
  });

  it('returns first non-empty line trimmed', () => {
    expect(getDraftPreview('  Hello World  ')).toBe('Hello World');
    expect(getDraftPreview('\n\n  First Line  \nSecond Line')).toBe('First Line');
  });

  it('truncates line if longer than maxLength (default 140)', () => {
    const longLine = 'a'.repeat(200);
    const preview = getDraftPreview(longLine);
    expect(preview).toBe('a'.repeat(140) + '…');
    expect(preview.length).toBe(141);
  });

  it('respects custom maxLength parameter', () => {
    expect(getDraftPreview('Hello World', 5)).toBe('Hello…');
  });

  it('matches legacy split/find behavior', () => {
    const testCases = [
      '',
      '   \n\n  \t ',
      'Simple line',
      '   Leading spaces line   ',
      '\n\n  Multi-line document\nSecond line\nThird line',
      'Line with trailing spaces   \nAnother line',
      'X'.repeat(150),
    ];

    for (const text of testCases) {
      const previewLine = text
        .split('\n')
        .map(line => line.trim())
        .find(line => line.length > 0);
      const expected = previewLine
        ? previewLine.length > 140
          ? `${previewLine.slice(0, 140).trim()}…`
          : previewLine
        : '';
      expect(getDraftPreview(text)).toBe(expected);
    }
  });
});

describe('extractRecentLines', () => {
  it('preserves whitespace, CRLF, Unicode, and original order', () => {
    const text = '\n  \r\n  padded long line  \r\n😀😀😀😀😀😀\r\n東京東京東京東京東京東京\nshort\n\n';
    expect(extractRecentLines(text)).toEqual(text.split('\n').filter(line => line.trim().length > 10).slice(-50));
  });

  it('scans past a long rejected suffix without losing qualifying lines', () => {
    const text = 'First qualifying long line\nSecond qualifying long line\n' + 'short\n'.repeat(20_000);
    expect(extractRecentLines(text)).toEqual(['First qualifying long line', 'Second qualifying long line']);
  });

  it('returns empty array when text is empty', () => {
    expect(extractRecentLines('')).toEqual([]);
  });

  it('filters lines with length <= minLength and keeps up to count matching lines', () => {
    const lines = [
      'Short line',
      'This line is long enough to be included 1',
      'Tiny',
      'This line is long enough to be included 2',
      'This line is long enough to be included 3',
    ];
    const text = lines.join('\n');
    expect(extractRecentLines(text, 2, 10)).toEqual([
      'This line is long enough to be included 2',
      'This line is long enough to be included 3',
    ]);
  });

  it('matches full split and filter behavior for multi-line documents', () => {
    const lines = Array.from({ length: 100 }, (_, i) =>
      i % 2 === 0 ? `Line number ${i} which has more than 10 chars` : `Short ${i}`
    );
    const text = lines.join('\n');
    const legacyResult = text
      .split('\n')
      .filter(line => line.trim().length > 10)
      .slice(-50);
    expect(extractRecentLines(text, 50, 10)).toEqual(legacyResult);
  });
});

// Preserve the legacy substring clamp when Unicode case folding expands a
// character. Mapping folded match indices back to source indices is separate.
it('keeps columns bounded by the source line after case-fold expansion', () => {
  const matches = findInText('İİİxxx', 'x');
  expect(matches.map(({ column }) => column)).toEqual([6, 6, 6]);
  const multiline = findInText('a\nİİİxxx', 'x');
  expect(multiline.map(({ line, column }) => ({ line, column }))).toEqual([
    { line: 1, column: 6 }, { line: 1, column: 6 }, { line: 1, column: 6 },
  ]);
});


it.each([
  ['Kelvin sign folding', 'Key Key key'],
  ['dotted I expansion', 'ABİ ABİ'],
  ['expansion inside a token', 'ABİCDE ABİCDE'],
  ['mixed scripts and punctuation', 'Café café 東京 hello! HELLO KERNEL kernel'],
])('preserves keyword boundaries after %s', (_name, text) => {
  expect(getKeywordFrequencies(text)).toEqual(legacyKeywordFrequencies(text));
});

it('preserves keyword folding and boundaries for every UTF-16 code unit', () => {
  for (let code = 0; code <= 0xffff; code++) {
    const token = `ab${String.fromCharCode(code)}cde`;
    const text = `${token} ${token}`;
    expect(getKeywordFrequencies(text)).toEqual(legacyKeywordFrequencies(text));
  }
});

