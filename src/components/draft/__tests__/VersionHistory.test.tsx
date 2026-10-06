import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VersionHistory from '../VersionHistory';
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

const snapshots: DraftSnapshot[] = [
  { id: 'snap_1', body: 'Line 1\nLine 2', ts: 1700000000000 },
  { id: 'snap_2', body: 'Line 1\nLine 2\nLine 3', ts: 1700000100000 },
];

it('renders nothing when closed', () => {
  act(() => {
    root.render(
      <VersionHistory
        isOpen={false}
        onClose={() => {}}
        snapshots={snapshots}
        currentBody="Line 1\nLine 2\nLine 3"
        onRestore={() => {}}
      />
    );
  });
  expect(host.children.length).toBe(0);
});

it('renders empty message when no snapshots exist', () => {
  act(() => {
    root.render(
      <VersionHistory
        isOpen={true}
        onClose={() => {}}
        snapshots={[]}
        currentBody="Current body"
        onRestore={() => {}}
      />
    );
  });
  expect(host.textContent).toContain('No snapshots yet');
});

it('renders snapshot list and computes diff stats', () => {
  act(() => {
    root.render(
      <VersionHistory
        isOpen={true}
        onClose={() => {}}
        snapshots={snapshots}
        currentBody="Line 1\nLine 2\nLine 3"
        onRestore={() => {}}
      />
    );
  });

  expect(host.textContent).toContain('Version History');
  expect(host.textContent).toContain('+1 lines');
});

it('opens confirm dialog on restore button click and calls onRestore on confirmation', () => {
  const onRestore = vi.fn();
  const onClose = vi.fn();

  act(() => {
    root.render(
      <VersionHistory
        isOpen={true}
        onClose={onClose}
        snapshots={snapshots}
        currentBody="Line 1\nLine 2\nLine 3"
        onRestore={onRestore}
      />
    );
  });

  const restoreButtons = host.querySelectorAll('button');
  const restoreBtn = Array.from(restoreButtons).find(btn => btn.textContent === 'Restore');
  expect(restoreBtn).toBeDefined();

  act(() => {
    restoreBtn!.click();
  });

  expect(host.textContent).toContain('Restore Snapshot?');

  const confirmDialog = host.querySelector('[aria-label="Confirm restore snapshot"]');
  expect(confirmDialog).not.toBeNull();

  const confirmBtn = Array.from(confirmDialog!.querySelectorAll('button')).find(
    btn => btn.textContent === 'Restore'
  );
  expect(confirmBtn).toBeDefined();

  act(() => {
    confirmBtn!.click();
  });

  expect(onRestore).toHaveBeenCalledWith('snap_2');
  expect(onClose).toHaveBeenCalled();
});
