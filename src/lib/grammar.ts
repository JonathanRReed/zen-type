export interface GrammarIssue {
  type: 'long-sentence' | 'duplicate-word' | 'passive-voice' | 'extra-space';
  message: string;
  startIndex: number;
  endIndex: number;
  suggestion?: string;
}

const PASSIVE_INDICATORS = [
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
];

const COMMON_PAST_PARTICIPLES = [
  'used', 'made', 'done', 'seen', 'given', 'taken', 'found', 'known',
  'written', 'shown', 'told', 'asked', 'called', 'left', 'felt', 'kept',
  'held', 'brought', 'thought', 'heard', 'put', 'meant', 'said', 'led',
  'read', 'met', 'paid', 'sent', 'built', 'spent', 'lost', 'sold', 'worn',
  'taught', 'caught', 'bought', 'fought', 'sought', 'broken', 'chosen',
  'spoken', 'stolen', 'frozen', 'driven', 'risen', 'beaten', 'eaten',
  'fallen', 'forgotten', 'hidden', 'ridden', 'shaken', 'taken', 'thrown',
  'created', 'established', 'developed', 'produced', 'considered', 'completed',
  'provided', 'required', 'allowed', 'helped', 'caused', 'followed', 'included',
  'changed', 'moved', 'placed', 'reached', 'passed', 'raised', 'served',
  'increased', 'reduced', 'opened', 'closed', 'added', 'removed', 'improved',
  'designed', 'implemented', 'tested', 'approved', 'rejected', 'accepted',
];

// Pre-compiled global regular expressions for performance.
// Reusing compiled RegExp instances avoids repeated string parsing & allocation on every checkGrammar call.
const PASSIVE_PATTERN = new RegExp(
  `\\b(${PASSIVE_INDICATORS.join('|')})\\s+(\\w+ed|\\w+en|${COMMON_PAST_PARTICIPLES.join('|')})\\b`,
  'gi'
);

const DUPLICATE_WORD_PATTERN = /\b(\w+)\s+\1\b/gi;
const EXTRA_SPACE_PATTERN = /  +/g;
const SENTENCE_DELIMITER_PATTERN = /[.!?]+/g;

/**
 * Counts the number of words in `text` between `start` (inclusive) and `end` (exclusive)
 * without allocating intermediate substrings or word arrays.
 */
function countWordsInRange(text: string, start: number, end: number): number {
  let count = 0;
  let inWord = false;
  for (let i = start; i < end; i++) {
    const ch = text.charCodeAt(i);
    // ECMAScript WhiteSpace / LineTerminator set
    const isWhitespace =
      (ch >= 0x0009 && ch <= 0x000d) || ch === 0x0020 || ch === 0x00a0 ||
      ch === 0x1680 || (ch >= 0x2000 && ch <= 0x200a) ||
      ch === 0x2028 || ch === 0x2029 || ch === 0x202f ||
      ch === 0x205f || ch === 0x3000 || ch === 0xfeff;

    if (isWhitespace) {
      inWord = false;
    } else if (!inWord) {
      count++;
      inWord = true;
    }
  }
  return count;
}

export function checkGrammar(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];

  // Check for long sentences (> 30 words) using index scanning.
  // Avoids text.split(/[.!?]+/) sentence arrays and sentence.split(/\s+/) word arrays.
  SENTENCE_DELIMITER_PATTERN.lastIndex = 0;
  let currentIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SENTENCE_DELIMITER_PATTERN.exec(text)) !== null) {
    const sentenceEnd = match.index;
    const sentenceLength = sentenceEnd - currentIndex;
    const wordCount = countWordsInRange(text, currentIndex, sentenceEnd);

    if (wordCount > 30) {
      issues.push({
        type: 'long-sentence',
        message: `Long sentence (${wordCount} words). Consider breaking it up.`,
        startIndex: currentIndex,
        endIndex: currentIndex + sentenceLength,
      });
    }

    currentIndex = match.index + match[0].length;
  }

  // Handle trailing sentence after last punctuation (if any)
  if (currentIndex < text.length) {
    const sentenceLength = text.length - currentIndex;
    const wordCount = countWordsInRange(text, currentIndex, text.length);

    if (wordCount > 30) {
      issues.push({
        type: 'long-sentence',
        message: `Long sentence (${wordCount} words). Consider breaking it up.`,
        startIndex: currentIndex,
        endIndex: currentIndex + sentenceLength,
      });
    }
  }

  // Check for duplicate consecutive words using pre-compiled regex (O(N) search)
  DUPLICATE_WORD_PATTERN.lastIndex = 0;
  while ((match = DUPLICATE_WORD_PATTERN.exec(text)) !== null) {
    const word = match[1] || '';
    issues.push({
      type: 'duplicate-word',
      message: `Duplicate word: "${word}"`,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      suggestion: word,
    });
  }

  // Check for passive voice patterns directly on `text` (PASSIVE_PATTERN uses 'gi' case-insensitive matching).
  // Avoids allocating a full-document lowercased string copy (`text.toLowerCase()`).
  PASSIVE_PATTERN.lastIndex = 0;
  while ((match = PASSIVE_PATTERN.exec(text)) !== null) {
    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;

    issues.push({
      type: 'passive-voice',
      message: 'Possible passive voice. Consider active voice.',
      startIndex,
      endIndex,
    });
  }

  // Check for multiple consecutive spaces
  EXTRA_SPACE_PATTERN.lastIndex = 0;
  while ((match = EXTRA_SPACE_PATTERN.exec(text)) !== null) {
    issues.push({
      type: 'extra-space',
      message: 'Extra spaces detected.',
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return issues;
}
