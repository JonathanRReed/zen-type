import { describe, it, expect } from 'vitest';
import { checkGrammar } from '../grammar';

function words(count: number, prefix = 'word'): string {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`).join(' ');
}

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

  it('maps long-sentence offsets past multi-character delimiters', () => {
    // 'Short... ' then 31 words then '.'. Head starts the long span after '...', not mid-ellipsis.
    const text = `Short... ${words(31)}.`;
    const issues = checkGrammar(text).filter(i => i.type === 'long-sentence');
    expect(issues).toHaveLength(1);
    const issue = issues[0]!;
    expect(issue).toMatchObject({
      type: 'long-sentence',
      message: 'Long sentence (31 words). Consider breaking it up.',
      startIndex: 8,
      endIndex: 215,
    });
    expect(text.slice(issue.startIndex, issue.endIndex)).toBe(` ${words(31)}`);
    // Wrong baseline-style offsets (6..213) must not match the source span.
    expect(text.slice(6, 213)).not.toBe(` ${words(31)}`);
  });

  it('keeps passive-voice offsets on the original source when lowercasing expands characters', () => {
    // Turkish İ lowercases to two code units; matching on toLowerCase() shifts indexes.
    const text = 'İ The code WAS WRITTEN.';
    const issues = checkGrammar(text).filter(i => i.type === 'passive-voice');
    expect(issues).toHaveLength(1);
    const issue = issues[0]!;
    expect(issue).toMatchObject({ startIndex: 11, endIndex: 22 });
    expect(text.slice(issue.startIndex, issue.endIndex)).toBe('WAS WRITTEN');
    // Baseline lowercased match sat at 12..23 and sliced the wrong source bytes.
    expect(text.slice(12, 23)).toBe('AS WRITTEN.');
  });

  it('flags sentences only above the 30-word boundary', () => {
    const exactly30 = `${words(30, 'w')}.`;
    const exactly31 = `${words(31, 'w')}.`;
    expect(checkGrammar(exactly30).filter(i => i.type === 'long-sentence')).toEqual([]);
    const longIssues = checkGrammar(exactly31).filter(i => i.type === 'long-sentence');
    expect(longIssues).toHaveLength(1);
    expect(longIssues[0]).toMatchObject({
      type: 'long-sentence',
      message: 'Long sentence (31 words). Consider breaking it up.',
      startIndex: 0,
      endIndex: exactly31.length - 1,
    });
    expect(exactly31.slice(longIssues[0]!.startIndex, longIssues[0]!.endIndex)).toBe(words(31, 'w'));
  });

  it('detects a trailing long sentence without ending punctuation', () => {
    const text = words(31, 'trail');
    const issues = checkGrammar(text).filter(i => i.type === 'long-sentence');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      startIndex: 0,
      endIndex: text.length,
      message: 'Long sentence (31 words). Consider breaking it up.',
    });
    expect(text.slice(issues[0]!.startIndex, issues[0]!.endIndex)).toBe(text);
  });

  it('treats consecutive punctuation as one delimiter and advances past the whole run', () => {
    const text = 'First clause with words... Second clause with words!! Third clause with words.';
    expect(checkGrammar(text)).toEqual([]);

    const longAfterEllipsis = `Ok... ${words(31)}.`;
    const issue = checkGrammar(longAfterEllipsis).find(i => i.type === 'long-sentence');
    expect(issue).toBeDefined();
    expect(issue!.startIndex).toBe(5); // after 'Ok...'
    expect(longAfterEllipsis.slice(issue!.startIndex, issue!.endIndex)).toBe(` ${words(31)}`);
  });

  it('counts words across representative ECMAScript whitespace', () => {
    // Tab, LF, CR, space, NBSP, em-space (U+2003), line separator (U+2028).
    const sep = '\t\n\r \u00a0\u2003\u2028';
    const text = `${Array.from({ length: 31 }, (_, i) => `w${i}`).join(sep)}.`;
    const issues = checkGrammar(text).filter(i => i.type === 'long-sentence');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      message: 'Long sentence (31 words). Consider breaking it up.',
      startIndex: 0,
      endIndex: text.length - 1,
    });

    const shortWithExoticSpace = `one${sep}two${sep}three.`;
    expect(checkGrammar(shortWithExoticSpace)).toEqual([]);
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

  it('returns identical long-sentence and passive offsets across repeated calls', () => {
    const multiDelim = `Short... ${words(31)}.`;
    const expanding = 'İ The code WAS WRITTEN.';
    const firstLong = checkGrammar(multiDelim).find(i => i.type === 'long-sentence');
    const firstPassive = checkGrammar(expanding).find(i => i.type === 'passive-voice');
    expect(firstLong).toMatchObject({ startIndex: 8, endIndex: 215 });
    expect(firstPassive).toMatchObject({ startIndex: 11, endIndex: 22 });
    for (let i = 0; i < 15; i++) {
      expect(checkGrammar(multiDelim).find(x => x.type === 'long-sentence')).toEqual(firstLong);
      expect(checkGrammar(expanding).find(x => x.type === 'passive-voice')).toEqual(firstPassive);
      expect(checkGrammar('Clean text here.')).toEqual([]);
    }
  });
});
