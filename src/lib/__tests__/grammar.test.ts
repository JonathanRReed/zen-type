import { describe, it, expect } from 'vitest';
import { checkGrammar } from '../grammar';

describe('checkGrammar', () => {
  it('detects passive voice', () => {
    const text = 'The code was written by developers.';
    const issues = checkGrammar(text);
    expect(issues.some(i => i.type === 'passive-voice')).toBe(true);
  });

  it('detects long sentences', () => {
    const text = new Array(35).fill('word').join(' ') + '.';
    const issues = checkGrammar(text);
    expect(issues.some(i => i.type === 'long-sentence')).toBe(true);
  });

  it('detects extra spaces', () => {
    const text = 'This  has extra spaces.';
    const issues = checkGrammar(text);
    expect(issues.some(i => i.type === 'extra-space')).toBe(true);
  });

  it('returns no issues for standard text', () => {
    const text = 'This is a clean sentence.';
    const issues = checkGrammar(text);
    expect(issues.filter(i => i.type === 'passive-voice' || i.type === 'long-sentence')).toHaveLength(0);
  });
});
