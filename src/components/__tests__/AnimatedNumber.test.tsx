import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnimatedNumber from '../AnimatedNumber';
import { updateSettings } from '../../utils/storage';

describe('AnimatedNumber reduced motion', () => {
  let host: HTMLDivElement;
  let root: Root;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
    updateSettings({ reducedMotion: false });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops the active animation and clears its glow when reduced motion is enabled', () => {
    act(() => root.render(<AnimatedNumber value={0} />));
    act(() => root.render(<AnimatedNumber value={100} />));
    expect(host.querySelector('.updating')).not.toBeNull();
    expect(frames.size).toBe(1);
    act(() => updateSettings({ reducedMotion: true }));
    expect(host.textContent).toBe('100');
    expect(frames.size).toBe(0);
    expect(host.querySelector('.updating')).toBeNull();
    expect(host.querySelector('.improving')).toBeNull();
  });
});
