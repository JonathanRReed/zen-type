import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmbientRenderer } from '../renderer';
import { installWebGLHarness } from './webglTestUtils';

let renderer: AmbientRenderer | null = null;
afterEach(() => { renderer?.dispose(); renderer = null; vi.restoreAllMocks(); });

type Harness = ReturnType<typeof installWebGLHarness>;

function setup(configure?: (harness: Harness) => void) {
  const harness = installWebGLHarness();
  configure?.(harness);
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 1000, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true });
  renderer = new AmbientRenderer(canvas);
  renderer.setOptions({ motion: true, fps: 60, scale: 0.5 });
  renderer.resize();
  renderer.start();
  return { harness, canvas, instance: renderer };
}

/** Run display frames at a steady refresh rate and return the gaps between draws. */
function drawGaps(harness: Harness, hz: number, frames: number, from = 1000): number[] {
  const step = 1000 / hz;
  const times: number[] = [];
  for (let i = 0; i < frames; i++) {
    const before = harness.draws.length;
    harness.runFrame(from + i * step);
    if (harness.draws.length > before) times.push(i);
  }
  return times.slice(1).map((t, i) => t - times[i]!);
}

describe('AmbientRenderer frame pacing', () => {
  it('draws on every frame of a 60 Hz display', () => {
    const { harness } = setup();
    const gaps = drawGaps(harness, 60, 60).slice(10);
    expect(new Set(gaps)).toEqual(new Set([1]));
  });

  it('draws on every second frame of a 120 Hz display', () => {
    const { harness } = setup();
    const gaps = drawGaps(harness, 120, 120).slice(10);
    expect(new Set(gaps)).toEqual(new Set([2]));
  });

  // A fixed timer against these rates alternates short and long gaps.
  it.each([75, 100, 144, 165, 240])('keeps an even cadence on a %i Hz display', hz => {
    const { harness } = setup();
    const gaps = drawGaps(harness, hz, hz * 2).slice(10);
    expect(new Set(gaps).size).toBe(1);
    const fps = hz / gaps[0]!;
    expect(fps).toBeGreaterThanOrEqual(50);
    expect(fps).toBeLessThanOrEqual(75);
  });

  it('does not let a dropped display frame change the cadence', () => {
    const { harness } = setup();
    drawGaps(harness, 120, 60);
    // One long gap, as when the page janks, then the display carries on.
    const gaps = drawGaps(harness, 120, 120, 1000 + 60 * (1000 / 120) + 40).slice(4);
    expect(new Set(gaps)).toEqual(new Set([2]));
  });
});

describe('AmbientRenderer typing energy', () => {
  it('eases toward a keystroke instead of stepping, and settles back', () => {
    const { harness, instance } = setup();
    drawGaps(harness, 60, 30);
    const before = harness.draws.at(-1)!.energy;
    expect(before).toBe(0);
    instance.bumpEnergy(0.25);
    harness.runFrame(1000 + 30 * (1000 / 60));
    const first = harness.draws.at(-1)!.energy;
    // The frame after the key is only part of the way there.
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(0.1);
    drawGaps(harness, 60, 12, 1000 + 31 * (1000 / 60));
    const risen = harness.draws.at(-1)!.energy;
    expect(risen).toBeGreaterThan(first);
    drawGaps(harness, 60, 240, 1000 + 43 * (1000 / 60));
    expect(harness.draws.at(-1)!.energy).toBeLessThan(0.01);
  });
});

describe('AmbientRenderer quality governor', () => {
  it('leaves the buffer alone while the GPU keeps up', () => {
    const { harness, canvas } = setup();
    const width = canvas.width;
    drawGaps(harness, 60, 600);
    expect(canvas.width).toBe(width);
  });

  it('shrinks the buffer when frames keep finding the GPU busy, then halves the rate', () => {
    const { harness, canvas } = setup();
    const width = canvas.width;
    // Busy on every other frame: the scene costs more than a frame to draw.
    const strain = (frames: number, from: number) => {
      for (let i = 0; i < frames; i++) {
        harness.setGpuBusy(i % 2 === 1);
        harness.runFrame(from + i * (1000 / 60));
      }
      harness.setGpuBusy(false);
    };
    strain(200, 1000);
    expect(canvas.width).toBeLessThan(width);
    const afterOneStep = canvas.width;
    strain(1200, 1000 + 200 * (1000 / 60));
    expect(canvas.width).toBeLessThan(afterOneStep);
    expect(canvas.width).toBeGreaterThanOrEqual(Math.floor(width * 0.4) - 1);
    // At the smallest buffer it draws every other frame instead.
    const gaps = drawGaps(harness, 60, 120, 1000 + 1400 * (1000 / 60) + 5).slice(10);
    expect(new Set(gaps)).toEqual(new Set([2]));
  });
});

describe('AmbientRenderer shader compilation', () => {
  const COMPLETION = 99;
  function parallel(harness: Harness) {
    const state = { done: false, linkAsked: 0 };
    harness.gl.getExtension = ((name: string) =>
      name === 'KHR_parallel_shader_compile' ? { COMPLETION_STATUS_KHR: COMPLETION } : null) as never;
    harness.gl.getProgramParameter = ((_program: unknown, name: number) => {
      if (name === COMPLETION) return state.done;
      state.linkAsked++;
      return true;
    }) as never;
    return state;
  }

  it('never asks whether the program linked until the compiler says it is done', () => {
    let state!: ReturnType<typeof parallel>;
    const { harness, instance } = setup(h => { state = parallel(h); });
    expect(instance.supported).toBe(true);
    for (let i = 0; i < 20; i++) harness.runFrame(1000 + i * 16);
    // Asking for LINK_STATUS is what blocks the page on the compiler.
    expect(state.linkAsked).toBe(0);
    expect(harness.draws).toHaveLength(0);

    state.done = true;
    harness.runFrame(2000);
    expect(state.linkAsked).toBe(1);
    expect(harness.draws.length).toBeGreaterThan(0);
    const drawn = harness.draws.length;
    harness.runFrame(2016);
    harness.runFrame(2033);
    expect(harness.draws.length).toBeGreaterThan(drawn);
  });

  it('draws the frozen frame once compiled when motion is off', () => {
    let state!: ReturnType<typeof parallel>;
    const { harness, instance } = setup(h => { state = parallel(h); });
    instance.setOptions({ motion: false });
    instance.start();
    harness.runFrame(1000);
    expect(harness.draws).toHaveLength(0);
    state.done = true;
    harness.runFrame(1016);
    expect(harness.draws).toHaveLength(1);
    expect(harness.draws[0]?.time).toBe(37);
    harness.runFrame(1033);
    expect(harness.draws).toHaveLength(1);
  });

  it('stops polling the compiler when disposed', () => {
    const { harness, instance } = setup(h => { parallel(h); });
    harness.runFrame(1000);
    instance.dispose();
    expect(harness.frames.size).toBe(0);
  });
});
