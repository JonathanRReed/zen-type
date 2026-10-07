import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DraftManager from '../DraftManager';
import { createDraft, clearDrafts, saveDraftPrefs } from '../../../lib/draftStore';
import * as textMetrics from '../../../lib/textMetrics';
import * as grammar from '../../../lib/grammar';

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await clearDrafts();
  saveDraftPrefs({
    counters: true,
    readTime: true,
    outline: true,
    grammar: true,
    keywordHighlighter: true,
    tags: true,
    scratchpad: true,
  });
});

afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await clearDrafts();
});

describe('DraftManager memoization', () => {
  it('does not re-compute text metrics or grammar when updating title or tags', async () => {
    const draft = await createDraft('Initial Title');
    draft.body = 'This is line one.\n# Heading 1\nThis is line two with some repetitive words words.';

    const computeSpy = vi.spyOn(textMetrics, 'computeTextMetrics');
    const grammarSpy = vi.spyOn(grammar, 'checkGrammar');

    await act(async () => {
      root.render(<DraftManager isOpen={true} onClose={() => {}} />);
    });

    // Wait for initial async draft load
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const initialComputeCalls = computeSpy.mock.calls.length;
    const initialGrammarCalls = grammarSpy.mock.calls.length;

    // Change title input
    const titleInput = host.querySelector<HTMLInputElement>('input[aria-label="Draft title"]');
    expect(titleInput).not.toBeNull();
    if (titleInput) {
      await act(async () => {
        titleInput.value = 'Updated Title';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    // Verify text metrics and grammar were NOT recomputed when only title changed
    expect(computeSpy.mock.calls.length).toBe(initialComputeCalls);
    expect(grammarSpy.mock.calls.length).toBe(initialGrammarCalls);

    // Add a tag
    const tagInput = host.querySelector<HTMLInputElement>('input[aria-label="Add tag"]');
    if (tagInput) {
      await act(async () => {
        tagInput.value = 'work';
        tagInput.dispatchEvent(new Event('change', { bubbles: true }));
        tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
    }

    // Verify text metrics and grammar were STILL NOT recomputed when adding a tag
    expect(computeSpy.mock.calls.length).toBe(initialComputeCalls);
    expect(grammarSpy.mock.calls.length).toBe(initialGrammarCalls);
  });
});
