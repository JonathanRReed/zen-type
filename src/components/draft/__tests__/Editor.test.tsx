import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Editor from '../Editor';
import type { Draft } from '../../../lib/draftStore';

afterEach(cleanup);
const draft: Draft = {
  id: 'search-test', title: 'Search test', body: 'First target\nSecond target',
  tags: [], createdAt: 0, updatedAt: 0, snapshots: [],
};
const matches = [
  { index: 6, length: 6, line: 0, column: 6 },
  { index: 20, length: 6, line: 1, column: 7 },
];
const onChange = vi.fn();
function surface(searchMatches = [] as typeof matches, currentMatchIndex = 0) {
  return <>
    <input aria-label="Search query" />
    <Editor draft={draft} onChange={onChange} grammarIssues={[]}
      searchMatches={searchMatches} currentMatchIndex={currentMatchIndex}
      highlightedWords={new Set()} />
  </>;
}

it('updates search selection without taking focus from the query', () => {
  const { rerender } = render(surface());
  const query = screen.getByRole('textbox', { name: 'Search query' });
  const editor = screen.getByRole('textbox', { name: 'Draft editor' }) as HTMLTextAreaElement;
  query.focus();
  rerender(surface(matches));
  expect(document.activeElement).toBe(query);
  expect(editor.selectionStart).toBe(6);
  expect(editor.selectionEnd).toBe(12);
  rerender(surface(matches, 1));
  expect(document.activeElement).toBe(query);
  expect(editor.selectionStart).toBe(20);
  expect(editor.selectionEnd).toBe(26);
  expect(editor.value).toBe(draft.body);
});

it('still focuses the editor for an explicit outline jump', () => {
  render(surface());
  const query = screen.getByRole('textbox', { name: 'Search query' });
  const editor = screen.getByRole('textbox', { name: 'Draft editor' }) as HTMLTextAreaElement;
  query.focus();
  act(() => window.dispatchEvent(new CustomEvent('draftJumpTo', { detail: { index: 13 } })));
  expect(document.activeElement).toBe(editor);
  expect(editor.selectionStart).toBe(13);
  expect(editor.selectionEnd).toBe(13);
});
