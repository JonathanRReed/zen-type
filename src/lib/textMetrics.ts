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

export function computeTextMetrics(text: string): TextMetrics {
  const trimmed = text.trim();
  
  if (!trimmed) {
    return {
      words: 0,
      chars: 0,
      sentences: 0,
      readTimeMinutes: 0,
    };
  }

  const words = trimmed.split(/\s+/).length;
  const chars = text.length;
  const sentences = (trimmed.match(/[.!?]+/g) || []).length || 1;
  
  // Average reading speed: 200 WPM
  const readTimeMinutes = Math.ceil(words / 200);

  return {
    words,
    chars,
    sentences,
    readTimeMinutes,
  };
}

export function getKeywordFrequencies(text: string, topN: number = 10): KeywordFrequency[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count }))
    .filter(item => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
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

export function findInText(text: string, query: string, caseSensitive: boolean = false): SearchMatch[] {
  if (!query) return [];

  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchQuery = caseSensitive ? query : query.toLowerCase();
  const matches: SearchMatch[] = [];

  let index = 0;
  while ((index = searchText.indexOf(searchQuery, index)) !== -1) {
    // Calculate line and column
    const before = text.substring(0, index);
    const lines = before.split('\n');
    const line = lines.length - 1;
    const column = (lines[lines.length - 1] || '').length;

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
