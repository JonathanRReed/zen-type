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
  /**
   * The most frames per second to draw while animating. The loop draws on
   * every display frame, or every second, third... one, whichever lands
   * nearest this without going over it by much, so the cadence is always
   * even: a 60 cap is 60 on a 60 Hz or 120 Hz screen and 72 on a 144 Hz one.
   */
  fps: number;
  /** Render scale relative to CSS pixels (0.35..1). */
  scale: number;
}

const UNIFORMS = ['uRes', 'uTime', 'uCursor', 'uEnergy', 'uTheme', 'uBase', 'uAccent', 'uAccent2', 'uText'] as const;
const PALETTE_KEYS = ['base', 'accent', 'accent2', 'text'] as const;
type UniformName = typeof UNIFORMS[number];

/** Buffer scale and frame skipping for each step the governor can take down. */
const QUALITY_SCALE = [1, 0.75, 0.55, 0.4, 0.4] as const;
const FRAME_SKIP = [1, 1, 1, 1, 2] as const;
/** Draws between the governor's looks at how the GPU is keeping up. */
const GOVERNOR_WINDOW = 90;

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
  private animating = false;
  private completion: WebGLSync | null = null;
  private pendingDraw: { time: number; dt: number } | null = null;
  private completionPoll: number | null = null;
  private resizePending = false;
  private lastFrameAt = 0;
  private lastTickAt = 0;
  /** Recent gaps between display frames; the smallest is the refresh interval. */
  private tickGaps: number[] = [];
  private refreshMs = 1000 / 60;
  /** Frames the GPU was still busy for, out of the draws tried, this window. */
  private busyFrames = 0;
  private triedFrames = 0;
  /** Steps down when the GPU cannot keep up: smaller buffer first, then fewer frames. */
  private quality = 0;
  private compiling: { program: WebGLProgram; vs: WebGLShader; fs: WebGLShader; status: number } | null = null;
  private compilePoll: number | null = null;
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
  private energyTarget = 0;
  private lost = false;
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
      // Context loss already invalidates all of its GPU resources.
      this.completion = null;
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
    return this.gl !== null && (this.program !== null || this.compiling !== null);
  }

  private compile(): boolean {
    const gl = this.gl;
    if (!gl) return false;
    const make = (type: number, src: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    };
    const vs = make(gl.VERTEX_SHADER, VERT);
    const fs = make(gl.FRAGMENT_SHADER, FRAG);
    const program = vs && fs ? gl.createProgram() : null;
    if (!vs || !fs || !program) return false;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    // Asking whether the program linked makes the browser wait for the
    // compiler, and translating these scenes can take hundreds of
    // milliseconds: a freeze right when the page is becoming usable. Where
    // the driver can compile on another thread, ask it when it is done
    // instead, and keep showing the CSS scene until then.
    const parallel = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: number } | null;
    if (parallel && typeof requestAnimationFrame === 'function') {
      this.compiling = { program, vs, fs, status: parallel.COMPLETION_STATUS_KHR };
      this.pollCompile();
      return true;
    }
    return this.finishCompile(program, vs, fs);
  }

  private pollCompile(): void {
    const gl = this.gl;
    const job = this.compiling;
    if (!gl || !job) return;
    if (!gl.getProgramParameter(job.program, job.status)) {
      this.compilePoll = requestAnimationFrame(() => {
        this.compilePoll = null;
        this.pollCompile();
      });
      return;
    }
    this.compiling = null;
    if (!this.finishCompile(job.program, job.vs, job.fs)) {
      this.gl = null;
      return;
    }
    // Whatever was asked for while the compiler ran is waiting to be drawn.
    if (this.wantsLoop) this.start();
    else this.flushDraw();
  }

  private finishCompile(program: WebGLProgram, vs: WebGLShader, fs: WebGLShader): boolean {
    const gl = this.gl;
    if (!gl) return false;
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) {
      for (const shader of [vs, fs]) {
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.warn('[ambient] shader failed', gl.getShaderInfoLog(shader));
        }
      }
      console.warn('[ambient] program failed', gl.getProgramInfoLog(program));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!linked) {
      gl.deleteProgram(program);
      return false;
    }
    this.program = program;
    gl.useProgram(program);
    for (const name of UNIFORMS) this.uniforms.set(name, gl.getUniformLocation(program, name));
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    return true;
  }

  setOptions(options: Partial<AmbientOptions>): void {
    const previous = this.options;
    this.options = { ...this.options, ...options };
    const resized = previous.scale !== this.options.scale && this.bufferNeedsResize();
    // Initial configuration must not paint with incomplete theme/size settings.
    if (!this.drawn) {
      if (resized) this.resizeBuffer();
      return;
    }
    if (resized) this.resizePending = true;
    if (this.options.motion) {
      if (resized) this.draw((performance.now() - this.startAt) / 1000, 0);
      if (!previous.motion) this.start();
    } else if (previous.motion || resized) {
      this.renderOnce();
    }
  }

  setTheme(theme: number, palette: AmbientPalette): void {
    const unchanged = theme === this.theme && PALETTE_KEYS.every(key =>
      palette[key].every((value, index) => value === this.palette[key][index]),
    );
    if (unchanged) return;
    this.theme = theme;
    this.palette = palette;
    if (!this.drawn) return;
    if (!this.options.motion) this.renderOnce();
    else this.draw((performance.now() - this.startAt) / 1000, 0);
  }

  setCursor(x: number, y: number): void {
    this.cursorTarget = [x, y];
  }

  bumpEnergy(amount = 0.35): void {
    // Raise what the scene eases toward, not the scene itself: a keystroke
    // that stepped the brightness would flicker at typing speed.
    this.energyTarget = Math.min(1, this.energyTarget + amount);
  }

  resize(): void {
    if (!this.bufferNeedsResize()) return;
    if (!this.drawn) {
      this.resizeBuffer();
      return;
    }
    this.resizePending = true;
    // Queue the replacement promptly, but keep the old buffer until the GPU
    // can draw its replacement rather than clearing it to black while busy.
    if (!this.options.motion) this.renderOnce();
    else this.draw((performance.now() - this.startAt) / 1000, 0);
  }

  private bufferSize(): [number, number] {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const scale = this.options.scale * dpr * (QUALITY_SCALE[this.quality] ?? 1);
    const width = Math.max(64, Math.min(1400, Math.round(cssW * scale)));
    const height = Math.max(64, Math.round(cssH * scale));
    return [width, height];
  }

  private bufferNeedsResize(): boolean {
    const [width, height] = this.bufferSize();
    return this.canvas.width !== width || this.canvas.height !== height;
  }

  private resizeBuffer(): boolean {
    const gl = this.gl;
    if (!gl) return false;
    const [width, height] = this.bufferSize();
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
    return true;
  }

  /** True between start() and stop() while motion is on. */
  private wantsLoop = false;

  start(): void {
    if (!this.supported || this.lost) return;
    if (!this.options.motion) {
      this.renderOnce();
      return;
    }
    this.wantsLoop = true;
    // The loop starts once the compiler has finished; see pollCompile.
    if (this.compiling) return;
    if (this.frame !== null) return;
    this.animating = true;
    if (this.completionPoll !== null) cancelAnimationFrame(this.completionPoll);
    this.completionPoll = null;
    // A backgrounded tab gets no animation frames. Paint one frame anyway so
    // the canvas is never a black rectangle when the tab comes forward.
    if (document.hidden || !this.drawn) this.draw((performance.now() - this.startAt) / 1000, 0);
    this.lastTickAt = 0;
    const loop = (now: number) => {
      this.frame = null;
      if (document.hidden) {
        this.animating = false;
        return;
      }
      this.measureRefresh(now);
      // Draw on a whole number of display frames. A fixed 33 ms timer drifts
      // against any screen that is not 60 or 120 Hz and lands on alternating
      // short and long gaps, which the eye reads as a stutter.
      const interval = this.frameInterval();
      if (now - this.lastFrameAt >= interval - this.refreshMs / 2) {
        const dt = this.lastFrameAt > 0 ? Math.min(0.1, (now - this.lastFrameAt) / 1000) : interval / 1000;
        this.lastFrameAt = now;
        this.triedFrames++;
        this.draw((now - this.startAt) / 1000, dt);
        this.govern();
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  /** Track the display's refresh interval from the gaps between its frames. */
  private measureRefresh(now: number): void {
    const gap = now - this.lastTickAt;
    this.lastTickAt = now;
    // Ignore the first tick and anything that is clearly a pause.
    if (gap < 2 || gap > 50) return;
    this.tickGaps.push(gap);
    if (this.tickGaps.length > 12) this.tickGaps.shift();
    // Dropped frames only ever lengthen a gap, so the shortest recent one is
    // the screen's own interval.
    if (this.tickGaps.length >= 6) this.refreshMs = Math.min(...this.tickGaps);
  }

  /** The gap between draws: a whole number of display frames near the cap. */
  private frameInterval(): number {
    const wanted = 1000 / this.options.fps;
    const every = Math.max(1, Math.round(wanted / this.refreshMs)) * (FRAME_SKIP[this.quality] ?? 1);
    return every * this.refreshMs;
  }

  /**
   * If the GPU keeps being busy when the next frame is due, the scene is too
   * heavy for this device right now. Shrink the buffer, and after that draw
   * half as often. A soft, slow backdrop loses little at a lower resolution;
   * a late frame takes the typing with it.
   */
  private govern(): void {
    if (this.triedFrames < GOVERNOR_WINDOW) return;
    const struggling = this.busyFrames > this.triedFrames * 0.2;
    this.busyFrames = 0;
    this.triedFrames = 0;
    if (!struggling || this.quality >= QUALITY_SCALE.length - 1) return;
    this.quality++;
    if (this.bufferNeedsResize()) this.resizePending = true;
  }

  stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.animating = false;
    this.wantsLoop = false;
    if (this.completionPoll !== null) cancelAnimationFrame(this.completionPoll);
    this.completionPoll = null;
    this.pendingDraw = null;
  }

  /** One frame with the clock frozen: reduced motion and low-power mode. */
  renderOnce(): void {
    if (!this.supported || this.lost) return;
    this.stop();
    this.cursor = [0.5, 0.5];
    this.draw(this.frozenTime, 0);
  }

  private draw(time: number, dt: number): void {
    this.pendingDraw = { time, dt };
    this.flushDraw();
  }

  private flushDraw(): void {
    const gl = this.gl;
    if (!gl || !this.program || this.lost || !this.pendingDraw) return;
    if (this.completion) {
      // A timestamp cap alone can still queue expensive software-GPU work.
      // Poll without blocking; keep only the newest requested frame while busy.
      const status = gl.clientWaitSync(this.completion, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) {
        if (this.animating) this.busyFrames++;
        if (!this.animating && this.completionPoll === null) {
          this.completionPoll = requestAnimationFrame(() => {
            this.completionPoll = null;
            this.flushDraw();
          });
        }
        return;
      }
      // WAIT_FAILED must not leave the canvas permanently stuck either.
      gl.deleteSync(this.completion);
      this.completion = null;
    }
    if (this.completionPoll !== null) cancelAnimationFrame(this.completionPoll);
    this.completionPoll = null;
    const { time, dt } = this.pendingDraw;
    this.pendingDraw = null;
    // Resizing clears the canvas, so defer it together with the replacement draw.
    if (this.resizePending) {
      this.resizeBuffer();
      this.resizePending = false;
    }
    // Ease the cursor and decay the energy in frame-rate independent steps.
    const k = dt > 0 ? 1 - Math.pow(0.02, dt) : 1;
    this.cursor = [
      this.cursor[0] + (this.cursorTarget[0] - this.cursor[0]) * k,
      this.cursor[1] + (this.cursorTarget[1] - this.cursor[1]) * k,
    ];
    if (dt > 0) {
      this.energyTarget = Math.max(0, this.energyTarget - dt * 0.45);
      this.energy += (this.energyTarget - this.energy) * (1 - Math.pow(0.001, dt));
    }

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
    this.completion = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Submit the fence even when a static frame has no next animation tick.
    // A null fence falls back to the previous best-effort rendering behavior.
    if (this.completion) gl.flush();
    if (!this.drawn) {
      this.drawn = true;
      this.onFirstFrame?.();
    }
  }

  dispose(): void {
    this.stop();
    if (this.compilePoll !== null) cancelAnimationFrame(this.compilePoll);
    this.compilePoll = null;
    const gl = this.gl;
    if (gl) {
      if (this.compiling) gl.deleteProgram(this.compiling.program);
      this.compiling = null;
      if (this.completion) gl.deleteSync(this.completion);
      if (this.program) gl.deleteProgram(this.program);
      if (this.vao) gl.deleteVertexArray(this.vao);
      const ext = gl.getExtension('WEBGL_lose_context');
      ext?.loseContext();
    }
    this.gl = null;
    this.program = null;
    this.completion = null;
  }
}

let sharedProbe: HTMLSpanElement | null = null;

function getSharedProbe(): HTMLSpanElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  if (!sharedProbe || sharedProbe.ownerDocument !== document) {
    sharedProbe = document.createElement('span');
    sharedProbe.style.position = 'absolute';
    sharedProbe.style.opacity = '0';
    sharedProbe.style.pointerEvents = 'none';
    sharedProbe.style.visibility = 'hidden';
  }
  if (!sharedProbe.isConnected) document.body.appendChild(sharedProbe);
  return sharedProbe;
}

/**
 * Resolve a CSS colour (any syntax) to 0..1 rgb via a single reused probe element.
 * Reusing the probe element avoids DOM node allocation and insertion/removal layout thrashing.
 */
export function resolveColor(cssValue: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof document === 'undefined') return fallback;
  const probe = getSharedProbe();
  if (!probe) return fallback;
  // Invalid assignments otherwise leave the previous successful color intact.
  probe.style.color = '';
  probe.style.color = cssValue;
  if (!probe.style.color) return fallback;
  const rgb = getComputedStyle(probe).color;
  const m = rgb.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return fallback;
  return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255];
}
