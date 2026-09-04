import { FRAG, VERT } from './shader';

export interface AmbientPalette {
  base: [number, number, number];
  accent: [number, number, number];
  accent2: [number, number, number];
  text: [number, number, number];
}

export interface AmbientOptions {
  /** 0 = static frame, 1 = full motion. */
  motion: boolean;
  /** Frames per second to aim for while animating. */
  fps: number;
  /** Render scale relative to CSS pixels (0.35..1). */
  scale: number;
}

const UNIFORMS = ['uRes', 'uTime', 'uCursor', 'uEnergy', 'uTheme', 'uBase', 'uAccent', 'uAccent2', 'uText'] as const;
type UniformName = typeof UNIFORMS[number];

/**
 * Owns the WebGL2 context for the ambient canvas: compiles the scene shader,
 * keeps the uniforms current, and runs a frame-rate-capped loop that stops
 * entirely when motion is off or the tab is hidden.
 */
export class AmbientRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uniforms = new Map<UniformName, WebGLUniformLocation | null>();
  private vao: WebGLVertexArrayObject | null = null;
  private frame: number | null = null;
  private lastFrameAt = 0;
  private startAt = performance.now();
  private frozenTime = 37.0;
  private theme = 0;
  private palette: AmbientPalette = {
    base: [0.06, 0.05, 0.12],
    accent: [0.77, 0.65, 0.9],
    accent2: [0.61, 0.81, 0.85],
    text: [0.88, 0.87, 0.96],
  };
  private cursor: [number, number] = [0.5, 0.5];
  private cursorTarget: [number, number] = [0.5, 0.5];
  private energy = 0;
  private lost = false;
  private dirty = true;
  private drawn = false;
  private options: AmbientOptions = { motion: true, fps: 30, scale: 0.5 };
  /** Called after the first frame lands, so the canvas can fade in over the CSS. */
  onFirstFrame: (() => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, onReady?: () => void) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
      // Keep the last frame: a backgrounded tab gets no animation frames, and
      // the frozen frame is the whole reduced-motion experience.
      preserveDrawingBuffer: true,
    });
    if (!gl) return;
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      this.stop();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      if (this.compile()) this.start();
    });
    if (this.compile()) {
      onReady?.();
    } else {
      this.gl = null;
    }
  }

  get supported(): boolean {
    return this.gl !== null && this.program !== null;
  }

  private compile(): boolean {
    const gl = this.gl;
    if (!gl) return false;
    const make = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('[ambient] shader failed', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };
    const vs = make(gl.VERTEX_SHADER, VERT);
    const fs = make(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const program = gl.createProgram();
    if (!program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[ambient] program failed', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return false;
    }
    this.program = program;
    gl.useProgram(program);
    for (const name of UNIFORMS) this.uniforms.set(name, gl.getUniformLocation(program, name));
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.dirty = true;
    return true;
  }

  setOptions(options: Partial<AmbientOptions>): void {
    const wasMotion = this.options.motion;
    this.options = { ...this.options, ...options };
    if (options.scale !== undefined) this.resize();
    if (wasMotion !== this.options.motion) {
      this.dirty = true;
      if (this.options.motion) this.start(); else this.renderOnce();
    }
  }

  setTheme(theme: number, palette: AmbientPalette): void {
    this.theme = theme;
    this.palette = palette;
    this.dirty = true;
    if (!this.options.motion) this.renderOnce();
    else if (this.drawn) this.draw((performance.now() - this.startAt) / 1000, 0);
  }

  setCursor(x: number, y: number): void {
    this.cursorTarget = [x, y];
  }

  bumpEnergy(amount = 0.35): void {
    this.energy = Math.min(1, this.energy + amount);
  }

  resize(): void {
    const gl = this.gl;
    if (!gl) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const scale = this.options.scale * dpr;
    const width = Math.max(64, Math.min(1400, Math.round(cssW * scale)));
    const height = Math.max(64, Math.round(cssH * scale));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    this.dirty = true;
    // Changing the buffer size clears it to black. Repaint straight away
    // rather than waiting on an animation frame that a hidden tab never gets.
    if (!this.options.motion) this.renderOnce();
    else if (this.drawn) this.draw((performance.now() - this.startAt) / 1000, 0);
  }

  start(): void {
    if (!this.supported || this.lost) return;
    if (!this.options.motion) {
      this.renderOnce();
      return;
    }
    if (this.frame !== null) return;
    // A backgrounded tab gets no animation frames. Paint one frame anyway so
    // the canvas is never a black rectangle when the tab comes forward.
    if (document.hidden || !this.drawn) this.draw((performance.now() - this.startAt) / 1000, 0);
    const loop = (now: number) => {
      this.frame = null;
      if (document.hidden) return;
      const interval = 1000 / this.options.fps;
      if (now - this.lastFrameAt >= interval - 1) {
        this.lastFrameAt = now;
        this.draw((now - this.startAt) / 1000, (interval) / 1000);
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /** One frame with the clock frozen: reduced motion and low-power mode. */
  renderOnce(): void {
    if (!this.supported || this.lost) return;
    this.stop();
    this.cursor = [0.5, 0.5];
    this.draw(this.frozenTime, 0);
  }

  private draw(time: number, dt: number): void {
    const gl = this.gl;
    if (!gl || !this.program) return;
    // Ease the cursor and decay the energy in frame-rate independent steps.
    const k = dt > 0 ? 1 - Math.pow(0.02, dt) : 1;
    this.cursor = [
      this.cursor[0] + (this.cursorTarget[0] - this.cursor[0]) * k,
      this.cursor[1] + (this.cursorTarget[1] - this.cursor[1]) * k,
    ];
    if (dt > 0) this.energy = Math.max(0, this.energy - dt * 0.45);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.uniforms.get('uRes') ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.get('uTime') ?? null, time % 3600);
    gl.uniform2f(this.uniforms.get('uCursor') ?? null, this.cursor[0], this.cursor[1]);
    gl.uniform1f(this.uniforms.get('uEnergy') ?? null, this.energy);
    gl.uniform1i(this.uniforms.get('uTheme') ?? null, this.theme);
    gl.uniform3fv(this.uniforms.get('uBase') ?? null, this.palette.base);
    gl.uniform3fv(this.uniforms.get('uAccent') ?? null, this.palette.accent);
    gl.uniform3fv(this.uniforms.get('uAccent2') ?? null, this.palette.accent2);
    gl.uniform3fv(this.uniforms.get('uText') ?? null, this.palette.text);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.dirty = false;
    if (!this.drawn) {
      this.drawn = true;
      this.onFirstFrame?.();
    }
  }

  dispose(): void {
    this.stop();
    const gl = this.gl;
    if (gl) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.vao) gl.deleteVertexArray(this.vao);
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }
    this.gl = null;
    this.program = null;
  }
}

/** Resolve a CSS colour (any syntax) to 0..1 rgb via a probe element. */
export function resolveColor(cssValue: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof document === 'undefined') return fallback;
  const probe = document.createElement('span');
  probe.style.color = cssValue;
  probe.style.position = 'absolute';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = rgb.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return fallback;
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
}
