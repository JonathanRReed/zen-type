import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { diffLines } from 'diff';
import VersionHistory from '../VersionHistory';
import type { DraftSnapshot } from '../../../lib/draftStore';

// Spy on the real implementation so call counts also verify the rendered diffs.
vi.mock('diff', { spy: true });

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
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

const snapshots: [DraftSnapshot, DraftSnapshot] = [
  { id: 'snap_1', body: 'Line 1\nLine 2', ts: 1700000000000 },
  { id: 'snap_2', body: 'Line 1\nLine 2\nLine 3', ts: 1700000100000 },
];

const updatedSnapshots: [DraftSnapshot, DraftSnapshot, DraftSnapshot] = [
  ...snapshots,
  { id: 'snap_3', body: 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5', ts: 1700000200000 },
];

const renderHistory = (isOpen: boolean, items: DraftSnapshot[] = snapshots, currentBody = 'Current body') => {
  act(() => {
    root.render(
      <VersionHistory
        isOpen={isOpen}
        onClose={() => {}}
        snapshots={items}
        currentBody={currentBody}
        onRestore={() => {}}
      />
    );
  });
};

it('does not compute diffs on closed mount or closed snapshot updates', () => {
  renderHistory(false);
  expect(diffLines).not.toHaveBeenCalled();

  renderHistory(false, updatedSnapshots);
  expect(diffLines).not.toHaveBeenCalled();
  expect(host.children.length).toBe(0);
});

it('reuses diffs when the open panel rerenders with an edited current body', () => {
  renderHistory(true, updatedSnapshots);
  expect(diffLines).toHaveBeenCalledTimes(2);

  renderHistory(true, updatedSnapshots, 'New unsaved text');
  expect(diffLines).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain('Line 5');
});

it('reuses diffs while opening and cancelling the restore confirmation', () => {
  renderHistory(true, updatedSnapshots);
  expect(diffLines).toHaveBeenCalledTimes(2);
  const restore = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Restore');
  expect(restore).toBeDefined();

  act(() => restore!.click());
  expect(host.textContent).toContain('Restore Snapshot?');
  expect(diffLines).toHaveBeenCalledTimes(2);

  const cancel = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Cancel');
  expect(cancel).toBeDefined();
  act(() => cancel!.click());
  expect(host.textContent).not.toContain('Restore Snapshot?');
  expect(diffLines).toHaveBeenCalledTimes(2);
});

it('recomputes adjacent diffs and displays new snapshots while open', () => {
  renderHistory(true);
  expect(diffLines).toHaveBeenCalledTimes(1);

  renderHistory(true, updatedSnapshots);
  expect(diffLines).toHaveBeenCalledTimes(3);
  expect(diffLines).toHaveBeenNthCalledWith(2, snapshots[1].body, updatedSnapshots[2].body);
  expect(diffLines).toHaveBeenNthCalledWith(3, snapshots[0].body, snapshots[1].body);
  expect(host.textContent).toContain('Line 5');
  expect(Array.from(host.querySelectorAll('button')).filter(button => button.textContent === 'Restore')).toHaveLength(3);
  expect(updatedSnapshots.map(snapshot => snapshot.id)).toEqual(['snap_1', 'snap_2', 'snap_3']);
});

it('defers closed updates until reopening and computes the latest snapshot list', () => {
  renderHistory(true);
  expect(diffLines).toHaveBeenCalledTimes(1);

  renderHistory(false);
  renderHistory(false, updatedSnapshots);
  expect(diffLines).toHaveBeenCalledTimes(1);

  renderHistory(true, updatedSnapshots);
  expect(diffLines).toHaveBeenCalledTimes(3);
  expect(diffLines).toHaveBeenNthCalledWith(2, snapshots[1].body, updatedSnapshots[2].body);
  expect(diffLines).toHaveBeenNthCalledWith(3, snapshots[0].body, snapshots[1].body);
  expect(host.textContent).toContain('Line 5');

  renderHistory(false, updatedSnapshots);
  expect(diffLines).toHaveBeenCalledTimes(3);
  renderHistory(true, updatedSnapshots);
  expect(diffLines).toHaveBeenCalledTimes(5);
});

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
