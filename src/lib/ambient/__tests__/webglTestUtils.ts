import { vi } from 'vitest';

export interface DrawRecord {
  width: number;
  height: number;
  time: number;
  theme: number;
  base: number[];
}

/** JSDOM has no WebGL implementation; exercise the real renderer at its API boundary. */
export function installWebGLHarness() {
  const draws: DrawRecord[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  let canvas: HTMLCanvasElement;
  let time = 0;
  let theme = 0;
  let base: number[] = [];
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, TRIANGLES: 5,
    createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
    getShaderParameter: () => true, createProgram: () => ({}), attachShader: () => {},
    linkProgram: () => {}, deleteShader: () => {}, getProgramParameter: () => true,
    useProgram: () => {}, getUniformLocation: (_program: unknown, name: string) => name,
    createVertexArray: () => ({}), bindVertexArray: () => {}, viewport: () => {},
    uniform2f: () => {},
    uniform1i: (name: string, value: number) => { if (name === 'uTheme') theme = value; },
    uniform1f: (name: string, value: number) => { if (name === 'uTime') time = value; },
    uniform3fv: (name: string, value: number[]) => { if (name === 'uBase') base = [...value]; },
    drawArrays: () => draws.push({ width: canvas.width, height: canvas.height, time, theme, base: [...base] }),
    deleteProgram: () => {}, deleteVertexArray: () => {}, getExtension: () => null,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    canvas = this;
    return gl as never;
  });
  const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  return {
    draws,
    frames,
    requestFrame,
    runFrame(now: number) {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(now);
    },
  };
}
