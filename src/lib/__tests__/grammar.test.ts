import { describe, it, expect } from 'vitest';
import { checkGrammar } from '../grammar';

describe('checkGrammar', () => {
  it('detects long sentences (>30 words)', () => {
    const shortSentence = 'This is a short sentence.';
    expect(checkGrammar(shortSentence)).toHaveLength(0);

    const longSentence = 'This is a very long sentence that contains way more than thirty words in total because the writer kept adding clause after clause without putting a single period or ending punctuation mark anywhere in sight.';
    const issues = checkGrammar(longSentence);
    expect(issues.some(i => i.type === 'long-sentence')).toBe(true);
  });

  it('detects duplicate consecutive words', () => {
    const text = 'The the quick brown fox.';
    const issues = checkGrammar(text);
    const dupIssue = issues.find(i => i.type === 'duplicate-word');
    expect(dupIssue).toBeDefined();
    expect(dupIssue?.suggestion).toBe('The');
    expect(dupIssue?.startIndex).toBe(0);
    expect(dupIssue?.endIndex).toBe(7); // "The the" length
  });

  it('detects passive voice patterns', () => {
    const text = 'The code was written by a developer and was tested properly.';
    const issues = checkGrammar(text);
    const passiveIssues = issues.filter(i => i.type === 'passive-voice');
    expect(passiveIssues.length).toBeGreaterThanOrEqual(2);
  });

  it('detects extra spaces', () => {
    const text = 'Hello  world';
    const issues = checkGrammar(text);
    const spaceIssue = issues.find(i => i.type === 'extra-space');
    expect(spaceIssue).toBeDefined();
    expect(spaceIssue?.startIndex).toBe(5);
  });

  it('returns no issues for clean text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    expect(checkGrammar(text)).toEqual([]);
  });
});
