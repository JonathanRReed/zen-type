import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DraftManager from '../DraftManager';
import { createDraft, clearDrafts, getDraft, saveDraftPrefs, updateDraft } from '../../../lib/draftStore';
import * as textMetrics from '../../../lib/textMetrics';
import * as grammar from '../../../lib/grammar';

let host: HTMLDivElement;
let root: Root;

const initialBody = 'This is line one.\n# Heading 1\nThis is line two with some repetitive words words.';

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

function requiredInput(label: string): HTMLInputElement {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input).not.toBeNull();
  return input!;
}

// Bypass React's instrumented instance setter so the bubbling input event
// represents a real value change and reaches the component's onChange.
async function enterText(input: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function renderStoredDraft() {
  const draft = await createDraft('Initial Title');
  await updateDraft(draft.id, { body: initialBody });
  expect(await getDraft(draft.id)).toMatchObject({ body: initialBody });

  const computeSpy = vi.spyOn(textMetrics, 'computeTextMetrics');
  const grammarSpy = vi.spyOn(grammar, 'checkGrammar');

  await act(async () => {
    root.render(<DraftManager isOpen={true} onClose={() => {}} />);
  });

  await vi.waitFor(async () => {
    // Await an IndexedDB read inside act to flush the asynchronous draft load.
    await act(async () => { await getDraft(draft.id); });
    expect(host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Draft editor"]')?.value)
      .toBe(initialBody);
    expect(requiredInput('Draft title').value).toBe('Initial Title');
    expect(computeSpy).toHaveBeenCalledWith(initialBody);
    expect(grammarSpy).toHaveBeenCalledWith(initialBody);
  });

  return { draft, computeSpy, grammarSpy };
}

async function expectStoredDraft(id: string, updates: { title?: string; tags?: string[]; body?: string }) {
  await vi.waitFor(async () => {
    let saved: Awaited<ReturnType<typeof getDraft>>;
    await act(async () => { saved = await getDraft(id); });
    expect(saved).toMatchObject({ body: initialBody, ...updates });
  }, { timeout: 2000 });
}

describe('DraftManager memoization', () => {
  it('does not recompute text metrics or grammar after a persisted title edit', async () => {
    const { draft, computeSpy, grammarSpy } = await renderStoredDraft();
    const initialComputeCalls = computeSpy.mock.calls.length;
    const initialGrammarCalls = grammarSpy.mock.calls.length;

    await enterText(requiredInput('Draft title'), 'Updated Title');
    await expectStoredDraft(draft.id, { title: 'Updated Title' });
    expect(requiredInput('Draft title').value).toBe('Updated Title');
    expect(computeSpy).toHaveBeenCalledTimes(initialComputeCalls);
    expect(grammarSpy).toHaveBeenCalledTimes(initialGrammarCalls);
  });

  it('does not recompute text metrics or grammar after a persisted tag edit', async () => {
    const { draft, computeSpy, grammarSpy } = await renderStoredDraft();
    const initialComputeCalls = computeSpy.mock.calls.length;
    const initialGrammarCalls = grammarSpy.mock.calls.length;
    const tagInput = requiredInput('Add tag');

    await enterText(tagInput, 'work');
    expect(tagInput.value).toBe('work');
    // Flush onChange before Enter so handleAddTag sees the new input state.
    await act(async () => {
      tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await expectStoredDraft(draft.id, { tags: ['work'] });
    expect(host.querySelector('button[aria-label="Remove tag work"]')).not.toBeNull();
    expect(tagInput.value).toBe('');
    expect(computeSpy).toHaveBeenCalledTimes(initialComputeCalls);
    expect(grammarSpy).toHaveBeenCalledTimes(initialGrammarCalls);
  });

  it('recomputes text metrics and grammar when the body changes', async () => {
    const { draft, computeSpy, grammarSpy } = await renderStoredDraft();
    const initialComputeCalls = computeSpy.mock.calls.length;
    const initialGrammarCalls = grammarSpy.mock.calls.length;
    const editor = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Draft editor"]');
    expect(editor).not.toBeNull();
    const updatedBody = 'A changed body with duplicate duplicate words.';

    await enterText(editor!, updatedBody);
    await expectStoredDraft(draft.id, { body: updatedBody });
    expect(editor!.value).toBe(updatedBody);
    expect(computeSpy).toHaveBeenCalledTimes(initialComputeCalls + 1);
    expect(computeSpy).toHaveBeenLastCalledWith(updatedBody);
    expect(grammarSpy).toHaveBeenCalledTimes(initialGrammarCalls + 1);
    expect(grammarSpy).toHaveBeenLastCalledWith(updatedBody);
    expect(host.textContent).toContain('Duplicate word: "duplicate"');
  });
});
