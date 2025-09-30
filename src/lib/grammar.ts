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

  // Check for duplicate consecutive words
  const words = text.split(/\b/);
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i] || '';
    const nextWord = words[i + 1] || '';
    
    if (word.toLowerCase() === nextWord.toLowerCase() && /\w/.test(word)) {
      const startIdx = words.slice(0, i).join('').length;
      const endIdx = startIdx + word.length + nextWord.length;
      
      issues.push({
        type: 'duplicate-word',
        message: `Duplicate word: "${word}"`,
        startIndex: startIdx,
        endIndex: endIdx,
        suggestion: word,
      });
    }
  }

  // Check for passive voice patterns
  const lowerText = text.toLowerCase();
  const passivePattern = new RegExp(
    `\\b(${PASSIVE_INDICATORS.join('|')})\\s+(\\w+ed|\\w+en|${COMMON_PAST_PARTICIPLES.join('|')})\\b`,
    'gi'
  );

  let match;
  while ((match = passivePattern.exec(lowerText)) !== null) {
    const startIndex = match.index;
    const endIndex = startIndex + (match[0]?.length || 0);

    issues.push({
      type: 'passive-voice',
      message: 'Possible passive voice. Consider active voice.',
      startIndex,
      endIndex,
    });
  }

  // Check for multiple consecutive spaces
  const spacePattern = /  +/g;
  while ((match = spacePattern.exec(text)) !== null) {
    issues.push({
      type: 'extra-space',
      message: 'Extra spaces detected.',
      startIndex: match.index,
      endIndex: match.index + (match[0]?.length || 0),
    });
  }

  return issues;
}

export function getIssuesInRange(
  issues: GrammarIssue[],
  startIndex: number,
  endIndex: number
): GrammarIssue[] {
  return issues.filter(
    issue =>
      (issue.startIndex >= startIndex && issue.startIndex < endIndex) ||
      (issue.endIndex > startIndex && issue.endIndex <= endIndex) ||
      (issue.startIndex <= startIndex && issue.endIndex >= endIndex)
  );
}
