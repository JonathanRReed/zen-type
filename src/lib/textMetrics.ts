export interface TextMetrics {
  words: number;
  chars: number;
  sentences: number;
  readTimeMinutes: number;
}

export interface KeywordFrequency {
  word: string;
  count: number;
}

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

// Single-pass computeTextMetrics to avoid string array allocations (.split(/\s+/))
// and RegExp match allocations (.match(/[.!?]+/g)) on every editor metric update.
// Complexity: O(N) time with O(1) auxiliary space.
export function computeTextMetrics(text: string): TextMetrics {
  const chars = text.length;
  let words = 0;
  let inWord = false;
  let sentences = 0;
  let inSentenceDelimiter = false;

  for (let i = 0; i < chars; i++) {
    const ch = text.charCodeAt(i);

    // Match ECMAScript WhiteSpace and LineTerminator, as trim() and /\s/ do.
    const isWhitespace =
      (ch >= 0x0009 && ch <= 0x000d) || ch === 0x0020 || ch === 0x00a0 ||
      ch === 0x1680 || (ch >= 0x2000 && ch <= 0x200a) ||
      ch === 0x2028 || ch === 0x2029 || ch === 0x202f ||
      ch === 0x205f || ch === 0x3000 || ch === 0xfeff;
    if (isWhitespace) {
      if (inWord) {
        words++;
        inWord = false;
      }
    } else {
      inWord = true;
    }

    // Sentence punctuation check: '.' (46), '!' (33), '?' (63)
    if (ch === 46 || ch === 33 || ch === 63) {
      if (!inSentenceDelimiter) {
        sentences++;
        inSentenceDelimiter = true;
      }
    } else {
      inSentenceDelimiter = false;
    }
  }

  if (inWord) {
    words++;
  }

  // Preserve the original all-zero metrics for empty or whitespace-only text.
  if (words === 0) {
    return {
      words: 0,
      chars: 0,
      sentences: 0,
      readTimeMinutes: 0,
    };
  }

  if (sentences === 0) {
    sentences = 1;
  }

  // Average reading speed: 200 WPM
  const readTimeMinutes = Math.ceil(words / 200);

  return {
    words,
    chars,
    sentences,
    readTimeMinutes,
  };
}

// Scan the lowercased document without regex replacement or intermediate word arrays.
// Fold before scanning: Unicode lowercasing can introduce ASCII word characters
// (e.g. K -> k) or expand a character (İ -> i + combining dot).
export function getKeywordFrequencies(text: string, topN: number = 10): KeywordFrequency[] {
  text = text.toLowerCase();
  const freq = new Map<string, number>();
  const len = text.length;
  let inWord = false;
  let wordStart = 0;

  for (let i = 0; i <= len; i++) {
    const ch = i < len ? text.charCodeAt(i) : 0;

    // Match \w characters: [a-zA-Z0-9_]
    const isWordChar =
      (ch >= 97 && ch <= 122) || // a-z
      (ch >= 65 && ch <= 90) ||  // A-Z
      (ch >= 48 && ch <= 57) ||  // 0-9
      ch === 95;                 // _

    if (isWordChar) {
      if (!inWord) {
        inWord = true;
        wordStart = i;
      }
    } else if (inWord) {
      inWord = false;
      const wordLen = i - wordStart;
      if (wordLen > 2) {
        const word = text.slice(wordStart, i);
        if (!STOP_WORDS.has(word)) {
          freq.set(word, (freq.get(word) || 0) + 1);
        }
      }
    }
  }

  const result: KeywordFrequency[] = [];
  for (const [word, count] of freq.entries()) {
    if (count > 1) {
      result.push({ word, count });
    }
  }
  return result.sort((a, b) => b.count - a.count).slice(0, topN);
}

export interface OutlineItem {
  text: string;
  level: number;
  startIndex: number;
}

export function extractOutline(text: string): OutlineItem[] {
  const lines = text.split('\n');
  const outline: OutlineItem[] = [];
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const trimmed = line.trim();

    // Markdown-style headings
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      outline.push({
        text: headingMatch[2] || '',
        level: headingMatch[1]?.length || 1,
        startIndex: currentIndex,
      });
    } else if (trimmed.endsWith('.') && trimmed.length > 10 && trimmed.length < 100) {
      // First sentence of paragraphs (if next line is blank)
      const nextLine = lines[i + 1];
      if (!nextLine || !nextLine.trim()) {
        outline.push({
          text: trimmed,
          level: 0,
          startIndex: currentIndex,
        });
      }
    }

    currentIndex += line.length + 1; // +1 for newline
  }

  return outline;
}

export interface SearchMatch {
  index: number;
  length: number;
  line: number;
  column: number;
}

// Backward-scanning line extraction helper to extract the last N lines matching line.trim().length > 10.
// Avoids splitting the entire document into line arrays from start to finish.
export function extractRecentLines(text: string, count: number = 50, minLength: number = 10): string[] {
  if (!text) return [];
  const lines: string[] = [];
  let end = text.length;

  while (end > 0 && lines.length < count) {
    const start = text.lastIndexOf('\n', end - 1);
    const line = start === -1 ? text.slice(0, end) : text.slice(start + 1, end);
    if (line.trim().length > minLength) {
      lines.push(line);
    }
    if (start === -1) break;
    end = start;
  }

  return lines.reverse();
}

/**
 * Extract a short preview string from the first non-empty line of text.
 * Scans line by line without splitting the entire document into line arrays.
 */
export function getDraftPreview(text: string, maxLength: number = 140): string {
  if (!text) return '';
  let lineStart = 0;
  const len = text.length;

  while (lineStart < len) {
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = len;

    // Fast check for non-whitespace in the current line segment
    let hasNonWhitespace = false;
    for (let i = lineStart; i < lineEnd; i++) {
      const ch = text.charCodeAt(i);
      if (ch !== 32 && ch !== 9 && ch !== 13) {
        hasNonWhitespace = true;
        break;
      }
    }

    if (hasNonWhitespace) {
      const line = text.slice(lineStart, lineEnd).trim();
      if (line.length > maxLength) {
        return `${line.slice(0, maxLength).trim()}…`;
      }
      return line;
    }

    lineStart = lineEnd + 1;
  }

  return '';
}

export function findInText(text: string, query: string, caseSensitive: boolean = false): SearchMatch[] {
  if (!query) return [];

  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchQuery = caseSensitive ? query : query.toLowerCase();
  const matches: SearchMatch[] = [];

  let index = 0;
  let line = 0;
  let lastNewlineIndex = -1;
  let scanIndex = 0;

  while ((index = searchText.indexOf(searchQuery, index)) !== -1) {
    // Single-pass incremental line & column tracking instead of O(N) substring + split
    while (scanIndex < index) {
      if (text[scanIndex] === '\n') {
        line++;
        lastNewlineIndex = scanIndex;
      }
      scanIndex++;
    }

    // substring(0, index) previously clamped offsets to the source length.
    const column = Math.min(index, text.length) - (lastNewlineIndex + 1);

    matches.push({
      index,
      length: query.length,
      line,
      column,
    });

    index += query.length;
  }

  return matches;
}

