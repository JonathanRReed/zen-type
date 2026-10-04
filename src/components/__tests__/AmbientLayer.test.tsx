import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AmbientLayer from '../AmbientLayer';
import { installWebGLHarness } from '../../lib/ambient/__tests__/webglTestUtils';

const preferences = vi.hoisted(() => ({ theme: 'Ocean', reducedMotion: false, performanceMode: false }));
vi.mock('../../hooks/useSettings', () => ({ useSettings: () => preferences }));
vi.mock('../../hooks/useMotionPreference', () => ({ useMotionPreference: () => preferences }));

const originals = {
  width: Object.getOwnPropertyDescriptor(window, 'innerWidth')!,
  height: Object.getOwnPropertyDescriptor(window, 'innerHeight')!,
  dpr: Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')!,
  hidden: Object.getOwnPropertyDescriptor(document, 'hidden'),
};
let root: Root | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.assign(preferences, { theme: 'Ocean', reducedMotion: false, performanceMode: false });
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Object.defineProperty(window, 'innerWidth', originals.width);
  Object.defineProperty(window, 'innerHeight', originals.height);
  Object.defineProperty(window, 'devicePixelRatio', originals.dpr);
  if (originals.hidden) Object.defineProperty(document, 'hidden', originals.hidden);
  else Reflect.deleteProperty(document, 'hidden');
  document.body.innerHTML = '';
});

async function mountAmbient() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root?.render(createElement(AmbientLayer)));
  return container;
}

describe('AmbientLayer startup', () => {
  for (const preference of ['normal', 'reducedMotion', 'performanceMode'] as const) {
    it(`paints one configured first frame with ${preference}`, async () => {
      if (preference !== 'normal') preferences[preference] = true;
      const harness = installWebGLHarness();
      const container = await mountAmbient();
      expect(harness.draws).toHaveLength(1);
      expect(harness.draws[0]).toMatchObject({ width: 351, height: 760, theme: 3, base: [0.024, 0.086, 0.141] });
      expect(container.querySelector('canvas')?.classList.contains('is-ready')).toBe(true);
      expect(harness.requestFrame).toHaveBeenCalledTimes(preference === 'normal' ? 1 : 0);
      if (preference !== 'normal') expect(harness.draws[0]?.time).toBe(37);
      await act(async () => vi.advanceTimersByTime(120));
      expect(harness.draws).toHaveLength(1);
    });
  }

  for (const preference of ['reducedMotion', 'performanceMode'] as const) {
    it(`freezes and resumes after post-mount ${preference} changes`, async () => {
      const harness = installWebGLHarness();
      await mountAmbient();
      harness.draws.length = 0;
      preferences[preference] = true;
      await act(async () => root?.render(createElement(AmbientLayer)));
      expect(harness.draws).toHaveLength(1);
      expect(harness.draws[0]?.time).toBe(37);
      expect(harness.frames.size).toBe(0);
      preferences[preference] = false;
      await act(async () => root?.render(createElement(AmbientLayer)));
      expect(harness.frames.size).toBe(1);
      await act(async () => harness.runFrame(1000));
      expect(harness.draws).toHaveLength(2);
      expect(harness.draws[1]?.time).not.toBe(37);
      expect(harness.frames.size).toBe(1);
  });
  }

  it('repaints an actual theme change while reduced motion stays frozen', async () => {
    preferences.reducedMotion = true;
    const harness = installWebGLHarness();
    await mountAmbient();
    harness.draws.length = 0;
    preferences.theme = 'Forest';
    await act(async () => root?.render(createElement(AmbientLayer)));
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]).toMatchObject({ theme: 5, base: [0.024, 0.078, 0.063], time: 37 });
    await act(async () => vi.advanceTimersByTime(120));
    expect(harness.draws).toHaveLength(1);
    expect(harness.frames.size).toBe(0);
  });
});
