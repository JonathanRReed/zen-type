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

export function checkGrammar(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];

  // Check for long sentences (> 30 words)
  const sentences = text.split(/[.!?]+/);
  let currentIndex = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) {
      currentIndex += sentence.length + 1;
      continue;
    }

    const words = trimmed.split(/\s+/);
    if (words.length > 30) {
      issues.push({
        type: 'long-sentence',
        message: `Long sentence (${words.length} words). Consider breaking it up.`,
        startIndex: currentIndex,
        endIndex: currentIndex + sentence.length,
      });
    }

    currentIndex += sentence.length + 1;
  }

  // Check for duplicate consecutive words using pre-compiled regex (O(N) search)
  DUPLICATE_WORD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
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

  // Check for passive voice patterns
  const lowerText = text.toLowerCase();
  PASSIVE_PATTERN.lastIndex = 0;

  while ((match = PASSIVE_PATTERN.exec(lowerText)) !== null) {
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
