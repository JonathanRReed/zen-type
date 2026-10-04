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

describe('repeated grammar checks', () => {
  it('resets every shared expression between alternating inputs', () => {
    const text = 'The the code was written. It  works.';
    const expected = checkGrammar(text);
    expect(expected.map(issue => issue.type)).toEqual(['duplicate-word', 'passive-voice', 'extra-space']);
    for (let index = 0; index < 20; index++) {
      expect(checkGrammar('')).toEqual([]);
      expect(checkGrammar('Developers write clean code.')).toEqual([]);
      expect(checkGrammar(text)).toEqual(expected);
    }
  });

  it('preserves offsets and the original spelling for repeated words', () => {
    const text = 'Hello, The the world.';
    const issue = checkGrammar(text).find(item => item.type === 'duplicate-word');
    expect(issue).toMatchObject({ startIndex: 7, endIndex: 14, suggestion: 'The' });
    expect(text.slice(issue!.startIndex, issue!.endIndex)).toBe('The the');
  });

  it('does not join distinct words or words separated by punctuation', () => {
    expect(checkGrammar('there then. The, the.')).toEqual([]);
  });
});
