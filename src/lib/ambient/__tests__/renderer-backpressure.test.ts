import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmbientRenderer } from '../renderer';
import { installWebGLHarness } from './webglTestUtils';

let renderer: AmbientRenderer | null = null;
afterEach(() => { renderer?.dispose(); renderer = null; vi.restoreAllMocks(); });

function setup() {
  const harness = installWebGLHarness();
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 800, configurable: true });
  renderer = new AmbientRenderer(canvas);
  renderer.resize();
  renderer.start();
  return { harness, canvas, instance: renderer };
}

describe('AmbientRenderer GPU backpressure', () => {
  it('skips busy submissions and resumes with one nonblocking fence', () => {
    const { harness } = setup();
    expect(harness.draws).toHaveLength(1);
    expect(harness.fences.size).toBe(1);
    harness.setGpuBusy(true);
    for (let now = 100; now <= 1000; now += 100) harness.runFrame(now);
    expect(harness.draws).toHaveLength(1);
    expect(harness.fences.size).toBe(1);
    expect(harness.frames.size).toBe(1);
    expect(harness.requestFrame).toHaveBeenCalledTimes(11);
    expect(harness.gl.clientWaitSync).toHaveBeenCalled();
    for (const call of harness.gl.clientWaitSync.mock.calls) expect(call.slice(1)).toEqual([0, 0]);
    harness.setGpuBusy(false);
    harness.runFrame(1100);
    expect(harness.draws).toHaveLength(2);
    expect(harness.fences.size).toBe(1);
    expect(harness.gl.deleteSync).toHaveBeenCalledTimes(1);
    expect(harness.gl.flush).toHaveBeenCalledTimes(2);
    expect(harness.gl.fenceSync).toHaveBeenLastCalledWith(harness.gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  });

  it('coalesces static theme and resize work without clearing a busy frame', () => {
    const { harness, canvas, instance } = setup();
    harness.setGpuBusy(true);
    instance.setOptions({ motion: false });
    instance.setTheme(3, { base: [0.1, 0.2, 0.3], accent: [1, 0, 0], accent2: [0, 1, 0], text: [1, 1, 1] });
    Object.defineProperty(canvas, 'clientWidth', { value: 600, configurable: true });
    instance.resize();
    expect(canvas.width).toBe(200);
    expect(harness.draws).toHaveLength(1);
    expect(harness.frames.size).toBe(1);
    harness.runFrame(1000);
    expect(harness.draws).toHaveLength(1);
    harness.setGpuBusy(false);
    harness.runFrame(1100);
    expect(harness.draws).toHaveLength(2);
    expect(harness.draws[1]).toMatchObject({ width: 300, theme: 3, base: [0.1, 0.2, 0.3], time: 37 });
    expect(harness.frames.size).toBe(0);
  });

  it('stops polling when stopped and releases the fence on disposal', () => {
    const { harness, instance } = setup();
    harness.setGpuBusy(true);
    instance.setOptions({ motion: false });
    expect(harness.frames.size).toBe(1);
    instance.stop();
    expect(harness.frames.size).toBe(0);
    instance.dispose();
    expect(harness.fences.size).toBe(0);
    expect(harness.gl.deleteSync).toHaveBeenCalledTimes(1);
    harness.runFrame(1000);
    expect(harness.draws).toHaveLength(1);
    instance.dispose();
    expect(harness.gl.deleteSync).toHaveBeenCalledTimes(1);
  });

  it('forgets invalid context fences and resumes after restoration', () => {
    const { harness, canvas } = setup();
    const oldFence = [...harness.fences][0];
    harness.setGpuBusy(true);
    harness.runFrame(1000);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(harness.frames.size).toBe(0);
    // The browser destroys sync objects with the lost context.
    harness.fences.clear();
    harness.gl.clientWaitSync.mockClear();
    harness.setGpuBusy(false);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    harness.runFrame(1100);
    expect(harness.draws).toHaveLength(2);
    expect(harness.fences.size).toBe(1);
    expect(harness.gl.clientWaitSync).not.toHaveBeenCalledWith(oldFence, 0, 0);
  });

  it('retains backpressure across a stop and resume', () => {
    const { harness, instance } = setup();
    harness.setGpuBusy(true);
    instance.stop();
    instance.start();
    harness.runFrame(1000);
    expect(harness.draws).toHaveLength(1);
    expect(harness.fences.size).toBe(1);
    harness.setGpuBusy(false);
    harness.runFrame(1100);
    expect(harness.draws).toHaveLength(2);
  });

  it('restores a reduced-motion frame without starting an animation loop', () => {
    const { harness, canvas, instance } = setup();
    instance.setOptions({ motion: false });
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    harness.fences.clear();
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(harness.draws).toHaveLength(3);
    expect(harness.draws[2]?.time).toBe(37);
    expect(harness.frames.size).toBe(0);
  });

  it('continues best-effort rendering if a fence cannot be allocated', () => {
    const { harness, instance } = setup();
    harness.gl.fenceSync.mockReturnValue(null);
    harness.runFrame(1000);
    harness.runFrame(1100);
    expect(harness.draws).toHaveLength(3);
    expect(harness.fences.size).toBe(0);
    instance.dispose();
    expect(harness.gl.deleteSync).toHaveBeenCalledTimes(1);
  });

  it('does not deadlock on a failed wait', () => {
    const { harness } = setup();
    harness.gl.clientWaitSync.mockReturnValue(harness.gl.WAIT_FAILED);
    harness.runFrame(1000);
    expect(harness.draws).toHaveLength(2);
    expect(harness.fences.size).toBe(1);
    expect(harness.gl.deleteSync).toHaveBeenCalledTimes(1);
  });

  it('preserves the CSS fallback when WebGL2 is unavailable', () => {
    const harness = installWebGLHarness();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const instance = new AmbientRenderer(document.createElement('canvas'));
    renderer = instance;
    instance.resize();
    instance.start();
    instance.setOptions({ motion: false });
    expect(instance.supported).toBe(false);
    expect(harness.draws).toHaveLength(0);
    expect(harness.gl.fenceSync).not.toHaveBeenCalled();
    expect(harness.frames.size).toBe(0);
  });
});
