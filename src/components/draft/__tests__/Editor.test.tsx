import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Editor from '../Editor';
import type { Draft } from '../../../lib/draftStore';

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
const draft: Draft = {
  id: 'search-test', title: 'Search test', body: 'First target\nSecond target',
  tags: [], createdAt: 0, updatedAt: 0, snapshots: [],
};
const matches = [
  { index: 6, length: 6, line: 0, column: 6 },
  { index: 20, length: 6, line: 1, column: 7 },
];
function surface(searchMatches = [] as typeof matches, currentMatchIndex = 0) {
  return <>
    <input aria-label="Search query" />
    <Editor draft={draft} onChange={() => {}} grammarIssues={[]}
      searchMatches={searchMatches} currentMatchIndex={currentMatchIndex}
      highlightedWords={new Set()} />
  </>;
}

it('updates search selection without taking focus from the query', () => {
  act(() => root.render(surface()));
  const query = host.querySelector('input')!;
  const editor = host.querySelector('textarea')!;
  query.focus();
  act(() => root.render(surface(matches)));
  expect(document.activeElement).toBe(query);
  expect(editor.selectionStart).toBe(6);
  expect(editor.selectionEnd).toBe(12);
  act(() => root.render(surface(matches, 1)));
  expect(document.activeElement).toBe(query);
  expect(editor.selectionStart).toBe(20);
  expect(editor.selectionEnd).toBe(26);
  expect(editor.value).toBe(draft.body);
});

it('still focuses the editor for an explicit outline jump', () => {
  act(() => root.render(surface()));
  const query = host.querySelector('input')!;
  const editor = host.querySelector('textarea')!;
  query.focus();
  act(() => window.dispatchEvent(new CustomEvent('draftJumpTo', { detail: { index: 13 } })));
  expect(document.activeElement).toBe(editor);
  expect(editor.selectionStart).toBe(13);
  expect(editor.selectionEnd).toBe(13);
});
