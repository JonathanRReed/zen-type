import React, { Component, type ReactNode } from 'react';
import PauseMenu from './PauseMenu';
import HelpSheet from './HelpSheet';
import ArchiveOverlay from './ArchiveOverlay';
import ProgressOverlay from './ProgressOverlay';
import GlobalShortcuts from './GlobalShortcuts';
import FirstRunHint from './FirstRunHint';

/**
 * These used to be separate islands, so one of them throwing could not take
 * the others down. Sharing a root must not change that: each sits behind its
 * own boundary, and a failed one simply renders nothing.
 */
class Isolate extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error('[overlay] failed to render', error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

// Everything that is closed when the page arrives: the menu, the shortcut
// list, drafts, progress, the global keys and the one-time hint. They talk to
// the rest of the app through window events, so they can share one island
// (one React root and one request) instead of six.
const AppOverlays: React.FC<{ mode: 'zen' | 'quote' }> = ({ mode }) => (
  <>
    <GlobalShortcuts />
    <Isolate><PauseMenu mode={mode} /></Isolate>
    <Isolate><HelpSheet /></Isolate>
    <Isolate><ArchiveOverlay /></Isolate>
    <Isolate><ProgressOverlay /></Isolate>
    <Isolate><FirstRunHint mode={mode} /></Isolate>
  </>
);

export default AppOverlays;
