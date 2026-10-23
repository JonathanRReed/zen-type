import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Fuse from 'fuse.js';
import CommandPalette from '../CommandPalette';
import type { OutlineItem } from '../../../lib/textMetrics';

// Keep real Fuse indexing and search, observing only its construction cost.
vi.mock('fuse.js', { spy: true });
let host: HTMLDivElement;
let root: Root;
const onJumpTo = vi.fn();
const onClose = vi.fn();
const first: OutlineItem[] = [{ text: 'First heading', level: 1, startIndex: 12 }];
const latest: OutlineItem[] = [{ text: 'Latest heading', level: 1, startIndex: 42 }];
const lines = ['A recent line'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const render = (isOpen: boolean, outlineItems = first, recentLines = lines) => {
  act(() => root.render(<CommandPalette {...{ isOpen, outlineItems, recentLines, onJumpTo, onClose }} />));
  act(() => vi.runOnlyPendingTimers());
};
function search(value: string) {
  const input = host.querySelector('input')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return input;
}

it('does not index closed data and searches the latest headings after reopening', () => {
  render(false);
  render(false, latest);
  expect(Fuse).not.toHaveBeenCalled();
  expect(host.children).toHaveLength(0);
  render(true, latest);
  expect(Fuse).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('Latest heading');
  expect(host.textContent).not.toContain('First heading');
  const input = search('Latest');
  expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(onJumpTo).toHaveBeenCalledWith(42);
  expect(onClose).toHaveBeenCalledOnce();
  render(false, latest);
  render(true, first);
  expect(host.querySelector('input')!.value).toBe('');
  expect(host.textContent).toContain('First heading');
  expect(host.textContent).not.toContain('Latest heading');
});

it('refreshes open search data and handles empty results without stale jumps', () => {
  render(true);
  search('First');
  render(true, latest, []);
  expect(host.textContent).toContain('No results found');
  const input = search('Latest');
  expect(host.querySelectorAll('[role="option"]')).toHaveLength(1);
  render(true, [], []);
  expect(host.textContent).toContain('No results found');
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(onJumpTo).not.toHaveBeenCalled();
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(onClose).toHaveBeenCalledOnce();
});
