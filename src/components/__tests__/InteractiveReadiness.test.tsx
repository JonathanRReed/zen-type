import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GlobalShortcuts from '../GlobalShortcuts';
import HelpSheet from '../HelpSheet';
import { markInteractiveReady } from '../../utils/interactiveReady';

const panels = vi.hoisted(() => ({ loads: 0 }));
vi.mock('../../utils/audioBridge', () => ({ armAudio: vi.fn() }));
vi.mock('../HelpSheetBody', () => {
  panels.loads++;
  return { default: ({ open }: { open: boolean }) => open ? createElement('div', { role: 'dialog', 'aria-label': 'Keyboard Shortcuts' }) : null };
});

const roots: Root[] = [];
const releases: Array<() => void> = [];
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.dispatchEvent(new Event('astro:before-swap'));
});
afterEach(async () => {
  await act(async () => { for (const root of roots.splice(0)) root.unmount(); });
  for (const release of releases.splice(0)) release();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function mount(component: typeof GlobalShortcuts | typeof HelpSheet) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(createElement(component)));
  return root;
}
function ready(...parts: Parameters<typeof markInteractiveReady>[0][]) {
  for (const part of parts) releases.push(markInteractiveReady(part));
}
const isReady = () => document.documentElement.getAttribute('data-app-ready');
const helpDialog = () => document.querySelector('[role="dialog"][aria-label="Keyboard Shortcuts"]');
const pressHelp = () => act(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, bubbles: true, cancelable: true }));
});

describe('interactive island readiness', () => {
  it('does not declare ready before late help handlers, then handles the first Ctrl+H without preloading panels', async () => {
    ready('typing', 'pause', 'archive', 'progress');
    await mount(GlobalShortcuts);
    expect(isReady()).toBeNull();
    expect(panels.loads).toBe(0);
    const help = await mount(HelpSheet);
    expect(isReady()).toBe('1');
    expect(panels.loads).toBe(0);
    await pressHelp();
    expect(helpDialog()).not.toBeNull();
    expect(panels.loads).toBe(1);
    await pressHelp();
    expect(helpDialog()).toBeNull();
    await act(async () => help.unmount());
    roots.splice(roots.indexOf(help), 1);
    expect(isReady()).toBeNull();
    await mount(HelpSheet);
    expect(isReady()).toBe('1');
    await pressHelp();
    expect(helpDialog()).not.toBeNull();
  });

  it('also waits when the global shortcut island mounts last', async () => {
    ready('typing', 'pause', 'archive', 'progress');
    await mount(HelpSheet);
    expect(isReady()).toBeNull();
    await mount(GlobalShortcuts);
    expect(isReady()).toBe('1');
    await pressHelp();
    expect(helpDialog()).not.toBeNull();
  });

  for (const missing of ['typing', 'shortcuts', 'help', 'pause', 'archive', 'progress'] as const) {
    it(`waits for the ${missing} participant and revokes readiness on its teardown`, () => {
      for (const part of ['typing', 'shortcuts', 'help', 'pause', 'archive', 'progress'] as const) {
        if (part !== missing) ready(part);
      }
      expect(isReady()).toBeNull();
      const release = markInteractiveReady(missing);
      expect(isReady()).toBe('1');
      release();
      release();
      expect(isReady()).toBeNull();
    });
  }

  it('does not let an old owner cleanup revoke its replacement', () => {
    ready('typing', 'shortcuts', 'pause', 'archive', 'progress');
    const old = markInteractiveReady('help');
    const replacement = markInteractiveReady('help');
    expect(isReady()).toBe('1');
    old();
    expect(isReady()).toBe('1');
    replacement();
    expect(isReady()).toBeNull();
  });

  it('resets on navigation and ignores cleanup from the previous page', () => {
    const previous = (['typing', 'shortcuts', 'help', 'pause', 'archive', 'progress'] as const).map(markInteractiveReady);
    expect(isReady()).toBe('1');
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(isReady()).toBeNull();
    ready('typing', 'shortcuts', 'help', 'pause', 'archive', 'progress');
    for (const release of previous) release();
    expect(isReady()).toBe('1');
  });
});
