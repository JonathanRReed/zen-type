import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VersionHistory from '../VersionHistory';
import { computeTextMetrics } from '../../../lib/textMetrics';
import type { DraftSnapshot } from '../../../lib/draftStore';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const makeSnapshots = (bodies: string[], prefix = 'snap'): DraftSnapshot[] =>
  bodies.map((body, i) => ({ id: `${prefix}_${i}`, body, ts: 1700000000000 + i * 1000 }));

const renderHistory = (isOpen: boolean, items: DraftSnapshot[]) => {
  act(() => {
    root.render(
      <VersionHistory
        isOpen={isOpen}
        onClose={() => {}}
        snapshots={items}
        currentBody=""
        onRestore={() => {}}
      />
    );
  });
};

const renderedWordCounts = () =>
  Array.from(host.querySelectorAll('p'))
    .map((p) => p.textContent ?? '')
    .filter((text) => text.includes('words •'))
    .map((text) => Number(text.split(' ')[0]));

// The list shows snapshots newest first.
const editorWordCounts = (items: DraftSnapshot[]) =>
  [...items].reverse().map((snapshot) => computeTextMetrics(snapshot.body).words);

const clickButton = (label: string, index = 0) => {
  const buttons = Array.from(host.querySelectorAll('button')).filter((b) => b.textContent === label);
  act(() => buttons[index]!.click());
};

it('shows zero words for an empty snapshot', () => {
  const items = makeSnapshots(['']);
  renderHistory(true, items);
  expect(renderedWordCounts()).toEqual([0]);
});

it('matches the editor word count for whitespace-only and edge-whitespace snapshots', () => {
  const items = makeSnapshots(['   ', '\n\t \n', '  hello world  ', '\nfoo\u00a0bar\n']);
  renderHistory(true, items);
  expect(renderedWordCounts()).toEqual(editorWordCounts(items));
  expect(renderedWordCounts()).toEqual([2, 2, 0, 0]);
});

it('updates word counts when snapshots change while open', () => {
  const items = makeSnapshots(['one', 'one two', 'one two three']);
  renderHistory(true, items);
  expect(renderedWordCounts()).toEqual([3, 2, 1]);

  const updated = [...items, ...makeSnapshots(['', ' one two three four five '], 'next')];
  renderHistory(true, updated);
  expect(renderedWordCounts()).toEqual(editorWordCounts(updated));
});

it('shows current word counts after reopening with changed snapshots', () => {
  const items = makeSnapshots(['alpha beta']);
  renderHistory(true, items);
  expect(renderedWordCounts()).toEqual([2]);

  renderHistory(false, items);
  const updated = makeSnapshots(['alpha beta', '', 'alpha beta gamma']);
  renderHistory(false, updated);
  renderHistory(true, updated);
  expect(renderedWordCounts()).toEqual(editorWordCounts(updated));
  expect(renderedWordCounts()).toEqual([3, 0, 2]);
});

it('keeps word counts correct across selection changes and snapshot set switches', () => {
  const items = makeSnapshots(['x y', ' x y z ']);
  renderHistory(true, items);

  clickButton('Restore', 1);
  expect(renderedWordCounts()).toEqual([3, 2]);

  clickButton('Cancel');
  clickButton('Restore', 0);
  expect(renderedWordCounts()).toEqual([3, 2]);

  clickButton('Cancel');
  const otherDraft = makeSnapshots(['  ', 'lorem ipsum dolor sit'], 'other');
  renderHistory(true, otherDraft);
  expect(renderedWordCounts()).toEqual(editorWordCounts(otherDraft));
  expect(renderedWordCounts()).toEqual([4, 0]);
});
