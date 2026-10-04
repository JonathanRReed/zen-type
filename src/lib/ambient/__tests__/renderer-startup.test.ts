import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmbientRenderer, type AmbientPalette } from '../renderer';
import { installWebGLHarness } from './webglTestUtils';

const palette: AmbientPalette = {
  base: [0.02, 0.04, 0.09], accent: [0.7, 0.6, 0.9], accent2: [0.6, 0.8, 0.9], text: [0.9, 0.9, 1],
};
let renderer: AmbientRenderer | null = null;
afterEach(() => { renderer?.dispose(); renderer = null; vi.restoreAllMocks(); });

function createRenderer() {
  const harness = installWebGLHarness();
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 800, configurable: true });
  renderer = new AmbientRenderer(canvas);
  return { harness, canvas, instance: renderer };
}

describe('AmbientRenderer configuration', () => {
  it('defers the first paint until start after static configuration', () => {
    const { harness, instance } = createRenderer();
    instance.setTheme(3, palette);
    instance.setOptions({ motion: false, scale: 0.45, fps: 24 });
    instance.resize();
    expect(harness.draws).toHaveLength(0);
    instance.start();
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]).toMatchObject({ theme: 3, base: palette.base, time: 37 });
    expect(harness.requestFrame).not.toHaveBeenCalled();
  });

  for (const motion of [true, false]) {
    it(`does not repaint equal settings, palette values or buffer dimensions (motion=${motion})`, () => {
      const { harness, instance } = createRenderer();
      instance.setTheme(3, palette);
      instance.setOptions({ motion, scale: 0.45, fps: 24 });
      instance.resize();
      instance.start();
      harness.draws.length = 0;
      instance.setOptions({ motion, scale: 0.45, fps: 24 });
      instance.setTheme(3, { ...palette, base: [...palette.base], accent: [...palette.accent], accent2: [...palette.accent2], text: [...palette.text] });
      instance.resize();
      expect(harness.draws).toHaveLength(0);
    });
  }

  it('repaints once when scale and motion change together', () => {
    const { harness, instance } = createRenderer();
    instance.setTheme(3, palette);
    instance.resize();
    instance.start();
    harness.draws.length = 0;
    instance.setOptions({ motion: false, scale: 0.45 });
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]?.time).toBe(37);
    expect(harness.frames.size).toBe(0);
  });

  it('repaints an actual buffer resize while motion is off', () => {
    const { harness, canvas, instance } = createRenderer();
    instance.setOptions({ motion: false, scale: 0.5 });
    instance.resize();
    instance.start();
    harness.draws.length = 0;
    Object.defineProperty(canvas, 'clientWidth', { value: 600, configurable: true });
    instance.resize();
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]?.width).toBe(300);
    expect(harness.draws[0]?.time).toBe(37);
  });

  it('repaints changed palette values even when the theme index is unchanged', () => {
    const { harness, instance } = createRenderer();
    instance.setTheme(3, palette);
    instance.setOptions({ motion: false });
    instance.resize();
    instance.start();
    harness.draws.length = 0;
    instance.setTheme(3, { ...palette, base: [0.1, 0.2, 0.3] });
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]?.base).toEqual([0.1, 0.2, 0.3]);
  });
});
