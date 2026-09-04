// Procedural audio for Zen Typer. Everything is synthesized with Web Audio:
// no samples, no network. Six keyboard switch profiles with separate down and
// up strokes, per-key pitch and stereo position, velocity from typing rhythm,
// a synthesized room, and a limiter so fast typing never clips. Four ambient
// beds (rain, wind, drone, fire) that move instead of looping a filter.
//
// State comes from settings via applySettings(); nothing here reads storage.

import type { AmbientSoundscape, Settings, SwitchSoundProfile } from './storage';

export type { AmbientSoundscape, SwitchSoundProfile };

// ---------------------------------------------------------------------------
// Key acoustics: where a key sits on the board decides its pan and pitch
// ---------------------------------------------------------------------------

const ROW_TOP = 'qwertyuiop[]';
const ROW_HOME = "asdfghjkl;'";
const ROW_BOTTOM = 'zxcvbnm,./';
const ROW_NUM = '1234567890-=`';

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000; // 0..1, stable per key
}

interface KeyAcoustics {
  pitch: number;   // multiplier on the profile's base frequencies
  pan: number;     // -1..1
  weight: number;  // gain multiplier (bigger keys hit harder)
  kind: 'letter' | 'space' | 'enter' | 'backspace' | 'modifier' | 'other';
}

function keyAcoustics(rawKey: string | undefined): KeyAcoustics {
  const key = rawKey ?? '';
  const k = key.length === 1 ? key.toLowerCase() : key;
  const jitter = (Math.random() - 0.5) * 0.04;

  if (k === ' ' || k === 'Spacebar') {
    return { pitch: 0.72 + jitter, pan: 0.02, weight: 1.12, kind: 'space' };
  }
  if (k === 'Enter') {
    return { pitch: 0.84 + jitter, pan: 0.3, weight: 1.06, kind: 'enter' };
  }
  if (k === 'Backspace' || k === 'Delete') {
    return { pitch: 1.1 + jitter, pan: 0.34, weight: 0.94, kind: 'backspace' };
  }
  if (k === 'Shift' || k === 'CapsLock' || k === 'Tab' || k === 'Control' || k === 'Meta' || k === 'Alt' || k === 'Escape') {
    const pan = k === 'Tab' || k === 'CapsLock' || k === 'Escape' ? -0.4 : (Math.random() < 0.5 ? -0.42 : 0.42);
    return { pitch: 0.9 + jitter, pan, weight: 0.85, kind: 'modifier' };
  }

  let pan = 0;
  let row = 0.5;
  let idx = -1;
  if ((idx = ROW_TOP.indexOf(k)) >= 0) { pan = (idx / (ROW_TOP.length - 1)) * 2 - 1; row = 0.7; }
  else if ((idx = ROW_HOME.indexOf(k)) >= 0) { pan = (idx / (ROW_HOME.length - 1)) * 2 - 1; row = 0.5; }
  else if ((idx = ROW_BOTTOM.indexOf(k)) >= 0) { pan = (idx / (ROW_BOTTOM.length - 1)) * 2 - 1; row = 0.3; }
  else if ((idx = ROW_NUM.indexOf(k)) >= 0) { pan = (idx / (ROW_NUM.length - 1)) * 2 - 1; row = 0.85; }
  else { pan = (hashKey(k) - 0.5) * 1.2; }

  // Higher rows sit further from the plate's centre of mass and ring a touch
  // brighter; every key also gets a stable offset so the same key sounds the
  // same, plus a hair of randomness so no two presses are identical.
  const pitch = 0.94 + row * 0.08 + (hashKey(k) - 0.5) * 0.06 + jitter;
  return { pitch, pan: pan * 0.36, weight: 1, kind: k.length === 1 ? 'letter' : 'other' };
}

// ---------------------------------------------------------------------------
// Noise and impulse buffers
// ---------------------------------------------------------------------------

function makeNoise(ctx: AudioContext, seconds: number, colour: 'white' | 'pink' | 'brown'): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (colour === 'white') {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  if (colour === 'brown') {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }
  // Pink: Paul Kellet's refinement, then normalised.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = pink;
    if (Math.abs(pink) > peak) peak = Math.abs(pink);
  }
  const norm = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < length; i++) data[i] = (data[i] ?? 0) * norm;
  return buffer;
}

/** A small room: decaying, slightly darkened noise. Stereo, ~0.7s. */
function makeRoomImpulse(ctx: AudioContext): AudioBuffer {
  const seconds = 0.7;
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const env = Math.pow(1 - t, 2.6);
      const white = Math.random() * 2 - 1;
      lp += (white - lp) * 0.32; // one-pole darkening so the tail is warm
      // A few early reflections keep it from sounding like a smear.
      const early = (i === 380 || i === 910 || i === 1460) ? 0.6 : 0;
      data[i] = (lp * env * 0.6 + early) * (ch === 0 ? 1 : 0.94);
    }
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Voice primitives
// ---------------------------------------------------------------------------

interface BurstSpec {
  colour?: 'white' | 'pink' | 'brown';
  at?: number;          // seconds offset from now
  duration: number;     // seconds
  attack?: number;      // seconds
  gain: number;
  filter?: { type: BiquadFilterType; frequency: number; Q?: number };
  filter2?: { type: BiquadFilterType; frequency: number; Q?: number };
}

interface PartialSpec {
  at?: number;
  type?: OscillatorType;
  frequency: number;
  endFrequency?: number; // pitch glide target
  glide?: number;        // seconds for the glide
  gain: number;
  attack?: number;
  decay: number;         // seconds to -60dB-ish
}

interface VoiceSpec {
  bursts: BurstSpec[];
  partials: PartialSpec[];
  reverb: number; // send level 0..1
}

class Voices {
  constructor(
    private readonly ctx: AudioContext,
    private readonly noise: Record<'white' | 'pink' | 'brown', AudioBuffer>,
  ) {}

  burst(spec: BurstSpec, when: number, level: number, dest: AudioNode, pitch = 1): void {
    const { ctx } = this;
    const buffer = this.noise[spec.colour ?? 'white'];
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const start = when + (spec.at ?? 0);
    const attack = Math.max(0.0008, spec.attack ?? 0.0012);
    const offset = Math.random() * Math.max(0.1, buffer.duration - spec.duration - 0.05);

    let node: AudioNode = src;
    if (spec.filter) {
      const f = ctx.createBiquadFilter();
      f.type = spec.filter.type;
      f.frequency.setValueAtTime(Math.min(20000, spec.filter.frequency * pitch), start);
      f.Q.setValueAtTime(spec.filter.Q ?? 1, start);
      node.connect(f);
      node = f;
    }
    if (spec.filter2) {
      const f = ctx.createBiquadFilter();
      f.type = spec.filter2.type;
      f.frequency.setValueAtTime(Math.min(20000, spec.filter2.frequency * pitch), start);
      f.Q.setValueAtTime(spec.filter2.Q ?? 1, start);
      node.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(spec.gain * level, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + spec.duration);
    node.connect(g);
    g.connect(dest);
    src.start(start, offset, spec.duration + attack + 0.02);
    src.stop(start + attack + spec.duration + 0.03);
  }

  partial(spec: PartialSpec, when: number, level: number, dest: AudioNode, pitch = 1): void {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const start = when + (spec.at ?? 0);
    const attack = Math.max(0.0008, spec.attack ?? 0.0015);
    osc.type = spec.type ?? 'sine';
    const f0 = Math.min(18000, spec.frequency * pitch);
    osc.frequency.setValueAtTime(f0, start);
    if (spec.endFrequency) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, spec.endFrequency * pitch),
        start + (spec.glide ?? spec.decay * 0.6),
      );
    }
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(spec.gain * level, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + spec.decay);
    osc.connect(g);
    g.connect(dest);
    osc.start(start);
    osc.stop(start + attack + spec.decay + 0.02);
  }
}

// ---------------------------------------------------------------------------
// Switch profiles
// ---------------------------------------------------------------------------

interface SwitchProfile {
  down: VoiceSpec;
  up: VoiceSpec;
  /** Extra layers for the big keys. */
  space?: Partial<VoiceSpec>;
  enter?: Partial<VoiceSpec>;
  /** Case resonance: a peaking filter the whole voice runs through. */
  body: { frequency: number; Q: number; gain: number; lowpass: number };
}

const PROFILES: Record<Exclude<SwitchSoundProfile, 'none'>, SwitchProfile> = {
  // Deep, lubed, thick plate. The body is mostly the case, not the stem.
  thock: {
    body: { frequency: 165, Q: 3.2, gain: 7, lowpass: 3400 },
    down: {
      bursts: [
        { colour: 'pink', duration: 0.022, gain: 0.55, filter: { type: 'bandpass', frequency: 1150, Q: 1.1 } },
        { colour: 'white', duration: 0.006, gain: 0.16, filter: { type: 'highpass', frequency: 2600 } },
      ],
      partials: [
        { type: 'triangle', frequency: 108, endFrequency: 62, glide: 0.05, gain: 0.85, decay: 0.075 },
        { type: 'sine', frequency: 214, gain: 0.32, decay: 0.045 },
      ],
      reverb: 0.07,
    },
    up: {
      bursts: [{ colour: 'pink', duration: 0.014, gain: 0.2, filter: { type: 'bandpass', frequency: 1700, Q: 1.3 } }],
      partials: [{ type: 'sine', frequency: 170, endFrequency: 120, glide: 0.03, gain: 0.22, decay: 0.038 }],
      reverb: 0.05,
    },
    space: {
      bursts: [
        { colour: 'pink', duration: 0.03, gain: 0.5, filter: { type: 'lowpass', frequency: 900 } },
        { colour: 'white', at: 0.007, duration: 0.004, gain: 0.08, filter: { type: 'highpass', frequency: 3200 } },
        { colour: 'white', at: 0.013, duration: 0.004, gain: 0.06, filter: { type: 'highpass', frequency: 3600 } },
      ],
      partials: [{ type: 'triangle', frequency: 82, endFrequency: 50, glide: 0.06, gain: 0.7, decay: 0.09 }],
    },
  },
  // POM linear: rounded, muted, almost no click. Softest of the set.
  cream: {
    body: { frequency: 210, Q: 2.4, gain: 5, lowpass: 2400 },
    down: {
      bursts: [{ colour: 'pink', duration: 0.016, gain: 0.34, filter: { type: 'lowpass', frequency: 1100 } }],
      partials: [
        { type: 'sine', frequency: 152, endFrequency: 96, glide: 0.04, gain: 0.62, decay: 0.055 },
        { type: 'sine', frequency: 304, gain: 0.16, decay: 0.03 },
      ],
      reverb: 0.05,
    },
    up: {
      bursts: [{ colour: 'pink', duration: 0.01, gain: 0.11, filter: { type: 'lowpass', frequency: 1400 } }],
      partials: [{ type: 'sine', frequency: 190, gain: 0.12, decay: 0.03 }],
      reverb: 0.04,
    },
    space: {
      bursts: [{ colour: 'pink', duration: 0.026, gain: 0.34, filter: { type: 'lowpass', frequency: 700 } }],
      partials: [{ type: 'sine', frequency: 96, endFrequency: 60, glide: 0.05, gain: 0.55, decay: 0.08 }],
    },
  },
  // Tactile: a sharp bump first, then the bottom-out a few ms later.
  'holy-panda': {
    body: { frequency: 190, Q: 3, gain: 6, lowpass: 4200 },
    down: {
      bursts: [
        { colour: 'white', duration: 0.007, gain: 0.34, filter: { type: 'bandpass', frequency: 2500, Q: 2 } },
        { colour: 'pink', at: 0.013, duration: 0.02, gain: 0.5, filter: { type: 'bandpass', frequency: 1000, Q: 1 } },
      ],
      partials: [
        { type: 'sine', frequency: 390, gain: 0.22, decay: 0.022 },
        { at: 0.013, type: 'triangle', frequency: 128, endFrequency: 70, glide: 0.045, gain: 0.8, decay: 0.065 },
      ],
      reverb: 0.07,
    },
    up: {
      bursts: [{ colour: 'white', duration: 0.009, gain: 0.2, filter: { type: 'bandpass', frequency: 2100, Q: 1.6 } }],
      partials: [{ type: 'sine', frequency: 205, endFrequency: 150, glide: 0.03, gain: 0.2, decay: 0.032 }],
      reverb: 0.05,
    },
    space: {
      partials: [{ at: 0.013, type: 'triangle', frequency: 88, endFrequency: 52, glide: 0.06, gain: 0.72, decay: 0.09 }],
    },
  },
  // Click bar: a bright snap on the way down and a second snap on release.
  clicky: {
    body: { frequency: 240, Q: 2.5, gain: 4, lowpass: 9000 },
    down: {
      bursts: [
        { colour: 'white', duration: 0.005, gain: 0.62, filter: { type: 'highpass', frequency: 3000 } },
        { colour: 'pink', at: 0.01, duration: 0.014, gain: 0.34, filter: { type: 'bandpass', frequency: 1400, Q: 1.2 } },
      ],
      partials: [
        { type: 'sine', frequency: 3400, gain: 0.28, decay: 0.012 },
        { type: 'sine', frequency: 5100, gain: 0.1, decay: 0.008 },
        { at: 0.01, type: 'triangle', frequency: 175, endFrequency: 110, glide: 0.035, gain: 0.5, decay: 0.05 },
      ],
      reverb: 0.06,
    },
    up: {
      bursts: [{ colour: 'white', duration: 0.005, gain: 0.46, filter: { type: 'highpass', frequency: 3200 } }],
      partials: [{ type: 'sine', frequency: 3000, gain: 0.2, decay: 0.01 }],
      reverb: 0.05,
    },
  },
  // Manual typewriter: type slug on platen, mechanism thunk, a little ring.
  typewriter: {
    body: { frequency: 300, Q: 2, gain: 4, lowpass: 12000 },
    down: {
      bursts: [
        { colour: 'white', duration: 0.009, gain: 0.7, filter: { type: 'highpass', frequency: 2400 } },
        { colour: 'pink', duration: 0.04, gain: 0.3, filter: { type: 'lowpass', frequency: 800 } },
      ],
      partials: [
        { type: 'sine', frequency: 2200, gain: 0.24, decay: 0.06 },
        { type: 'sine', frequency: 3300, gain: 0.14, decay: 0.045 },
        { type: 'sine', frequency: 4700, gain: 0.07, decay: 0.03 },
        { type: 'triangle', frequency: 96, endFrequency: 60, glide: 0.04, gain: 0.55, decay: 0.05 },
      ],
      reverb: 0.14,
    },
    up: {
      bursts: [{ colour: 'pink', duration: 0.016, gain: 0.26, filter: { type: 'bandpass', frequency: 1500, Q: 1.2 } }],
      partials: [{ type: 'sine', frequency: 520, endFrequency: 380, glide: 0.02, gain: 0.14, decay: 0.028 }],
      reverb: 0.1,
    },
    space: {
      bursts: [{ colour: 'pink', duration: 0.05, gain: 0.4, filter: { type: 'lowpass', frequency: 600 } }],
      partials: [{ type: 'triangle', frequency: 70, endFrequency: 45, glide: 0.06, gain: 0.6, decay: 0.09 }],
    },
    enter: {
      // Bell and carriage return.
      bursts: [{ colour: 'pink', at: 0.06, duration: 0.24, gain: 0.22, attack: 0.03, filter: { type: 'bandpass', frequency: 700, Q: 1 } }],
      partials: [
        { type: 'sine', frequency: 2640, gain: 0.34, decay: 0.7 },
        { type: 'sine', frequency: 3960, gain: 0.14, decay: 0.45 },
        { type: 'sine', frequency: 6600, gain: 0.05, decay: 0.25 },
      ],
      reverb: 0.4,
    },
  },
  // Not a switch at all: a drop of water on glass. Meditative option.
  raindrop: {
    body: { frequency: 900, Q: 1.5, gain: 2, lowpass: 14000 },
    down: {
      bursts: [{ colour: 'white', duration: 0.018, gain: 0.07, attack: 0.002, filter: { type: 'lowpass', frequency: 3200 } }],
      partials: [
        { type: 'sine', frequency: 1500, endFrequency: 760, glide: 0.045, gain: 0.42, attack: 0.002, decay: 0.13 },
        { type: 'sine', frequency: 3150, endFrequency: 1900, glide: 0.03, gain: 0.1, decay: 0.06 },
      ],
      reverb: 0.4,
    },
    up: {
      bursts: [],
      partials: [{ type: 'sine', frequency: 2600, endFrequency: 2000, glide: 0.02, gain: 0.03, decay: 0.03 }],
      reverb: 0.3,
    },
    space: {
      partials: [
        { type: 'sine', frequency: 900, endFrequency: 480, glide: 0.06, gain: 0.4, attack: 0.002, decay: 0.18 },
        { type: 'sine', frequency: 1900, endFrequency: 1200, glide: 0.04, gain: 0.08, decay: 0.08 },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Ambient beds
// ---------------------------------------------------------------------------

interface Bed {
  fadeOut: (seconds: number) => void;
}

interface BedContext {
  ctx: AudioContext;
  voices: Voices;
  noise: Record<'white' | 'pink' | 'brown', AudioBuffer>;
  out: GainNode;        // already connected to the ambient bus
  reverb: GainNode;     // send into the room
}

function loopNoise(b: BedContext, colour: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const src = b.ctx.createBufferSource();
  src.buffer = b.noise[colour];
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = b.noise[colour].duration;
  src.start(b.ctx.currentTime, Math.random() * b.noise[colour].duration);
  return src;
}

function lfo(ctx: AudioContext, frequency: number, amount: number, target: AudioParam, type: OscillatorType = 'sine'): OscillatorNode {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  g.gain.setValueAtTime(amount, ctx.currentTime);
  osc.connect(g);
  g.connect(target);
  osc.start();
  return osc;
}

/** Schedules sparse one-shot events (drops, crackles) a little ahead of time. */
class Sparse {
  private timer: number | null = null;
  private next = 0;
  constructor(
    private readonly ctx: AudioContext,
    private readonly gap: () => number, // seconds to next event
    private readonly fire: (when: number) => void,
  ) {
    this.next = ctx.currentTime + 0.1;
    this.tick();
  }
  private tick = () => {
    const lookahead = 0.25;
    while (this.next < this.ctx.currentTime + lookahead) {
      this.fire(this.next);
      this.next += this.gap();
    }
    this.timer = window.setTimeout(this.tick, 90);
  };
  stop(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }
}

function stopAll(nodes: AudioScheduledSourceNode[], at: number): void {
  for (const n of nodes) {
    try { n.stop(at); } catch { /* already stopped */ }
  }
}

function bedRain(b: BedContext): Bed {
  const { ctx } = b;
  const now = ctx.currentTime;
  const sources: AudioScheduledSourceNode[] = [];

  // Steady wash: pink noise, lowpassed, cutoff breathing so it never sits still.
  const wash = loopNoise(b, 'pink');
  const washLp = ctx.createBiquadFilter();
  washLp.type = 'lowpass';
  washLp.frequency.setValueAtTime(1300, now);
  washLp.Q.setValueAtTime(0.6, now);
  const washGain = ctx.createGain();
  washGain.gain.setValueAtTime(0.42, now);
  wash.connect(washLp); washLp.connect(washGain); washGain.connect(b.out);
  sources.push(wash, lfo(ctx, 0.07, 350, washLp.frequency), lfo(ctx, 0.19, 0.06, washGain.gain));

  // Hiss on the surface: bright and quiet.
  const hiss = loopNoise(b, 'white');
  const hissHp = ctx.createBiquadFilter();
  hissHp.type = 'highpass';
  hissHp.frequency.setValueAtTime(4200, now);
  const hissLp = ctx.createBiquadFilter();
  hissLp.type = 'lowpass';
  hissLp.frequency.setValueAtTime(9500, now);
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.045, now);
  hiss.connect(hissHp); hissHp.connect(hissLp); hissLp.connect(hissGain); hissGain.connect(b.out);
  sources.push(hiss, lfo(ctx, 0.11, 0.02, hissGain.gain));

  // Distant rumble underneath.
  const rumble = loopNoise(b, 'brown');
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = 'lowpass';
  rumbleLp.frequency.setValueAtTime(110, now);
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.16, now);
  rumble.connect(rumbleLp); rumbleLp.connect(rumbleGain); rumbleGain.connect(b.out);
  sources.push(rumble, lfo(ctx, 0.05, 0.05, rumbleGain.gain));

  // Close drops: sparse plinks, each panned somewhere different.
  const dropDest = ctx.createGain();
  dropDest.gain.setValueAtTime(1, now);
  dropDest.connect(b.out);
  dropDest.connect(b.reverb);
  const drops = new Sparse(
    ctx,
    () => 0.06 + Math.random() * 0.2,
    (when) => {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime((Math.random() - 0.5) * 1.4, when);
      pan.connect(dropDest);
      const base = 700 + Math.random() * 2200;
      b.voices.partial(
        { type: 'sine', frequency: base, endFrequency: base * 0.55, glide: 0.03, gain: 0.02 + Math.random() * 0.06, decay: 0.03 + Math.random() * 0.06 },
        when, 1, pan,
      );
    },
  );

  return {
    fadeOut: (seconds) => {
      const t = ctx.currentTime;
      drops.stop();
      for (const g of [washGain, hissGain, rumbleGain, dropDest]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0.0001, t + seconds);
      }
      stopAll(sources, t + seconds + 0.05);
    },
  };
}

function bedWind(b: BedContext): Bed {
  const { ctx } = b;
  const now = ctx.currentTime;
  const sources: AudioScheduledSourceNode[] = [];

  const body = loopNoise(b, 'pink');
  const bodyBp = ctx.createBiquadFilter();
  bodyBp.type = 'bandpass';
  bodyBp.frequency.setValueAtTime(380, now);
  bodyBp.Q.setValueAtTime(0.8, now);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.4, now);
  body.connect(bodyBp); bodyBp.connect(bodyGain); bodyGain.connect(b.out);
  sources.push(body, lfo(ctx, 0.05, 190, bodyBp.frequency), lfo(ctx, 0.13, 0.14, bodyGain.gain), lfo(ctx, 0.031, 0.08, bodyGain.gain, 'triangle'));

  const low = loopNoise(b, 'brown');
  const lowLp = ctx.createBiquadFilter();
  lowLp.type = 'lowpass';
  lowLp.frequency.setValueAtTime(95, now);
  const lowGain = ctx.createGain();
  lowGain.gain.setValueAtTime(0.22, now);
  low.connect(lowLp); lowLp.connect(lowGain); lowGain.connect(b.out);
  sources.push(low, lfo(ctx, 0.041, 0.07, lowGain.gain));

  // Gusts: a brighter band that swells now and then.
  const gust = loopNoise(b, 'white');
  const gustBp = ctx.createBiquadFilter();
  gustBp.type = 'bandpass';
  gustBp.frequency.setValueAtTime(950, now);
  gustBp.Q.setValueAtTime(1.4, now);
  const gustGain = ctx.createGain();
  gustGain.gain.setValueAtTime(0.0001, now);
  gust.connect(gustBp); gustBp.connect(gustGain); gustGain.connect(b.out);
  sources.push(gust);
  const gusts = new Sparse(
    ctx,
    () => 6 + Math.random() * 9,
    (when) => {
      const peak = 0.08 + Math.random() * 0.14;
      gustGain.gain.cancelScheduledValues(when);
      gustGain.gain.setValueAtTime(0.0001, when);
      gustGain.gain.exponentialRampToValueAtTime(peak, when + 1.8 + Math.random());
      gustGain.gain.exponentialRampToValueAtTime(0.0001, when + 5 + Math.random() * 2);
      gustBp.frequency.setValueAtTime(700 + Math.random() * 500, when);
      gustBp.frequency.linearRampToValueAtTime(1100 + Math.random() * 600, when + 2.5);
    },
  );

  return {
    fadeOut: (seconds) => {
      const t = ctx.currentTime;
      gusts.stop();
      for (const g of [bodyGain, lowGain, gustGain]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.linearRampToValueAtTime(0.0001, t + seconds);
      }
      stopAll(sources, t + seconds + 0.05);
    },
  };
}

function bedDrone(b: BedContext): Bed {
  const { ctx } = b;
  const now = ctx.currentTime;
  const sources: AudioScheduledSourceNode[] = [];
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(620, now);
  lp.Q.setValueAtTime(0.7, now);
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.16, now);
  lp.connect(master);
  master.connect(b.out);
  master.connect(b.reverb);
  sources.push(lfo(ctx, 0.017, 260, lp.frequency));

  const voices: Array<[number, OscillatorType, number]> = [
    [55, 'sine', 0.55], [110, 'triangle', 0.3], [165, 'sine', 0.22], [220, 'triangle', 0.14], [330, 'sine', 0.08],
  ];
  voices.forEach(([freq, type, gain], i) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    osc.connect(g);
    g.connect(lp);
    osc.start();
    sources.push(osc);
    sources.push(lfo(ctx, 0.03 + i * 0.011, 5 + i * 1.5, osc.detune));
    sources.push(lfo(ctx, 0.05 + i * 0.017, gain * 0.35, g.gain, i % 2 ? 'triangle' : 'sine'));
  });

  // A faint high shimmer that comes and goes.
  const shimmer = ctx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(880, now);
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0.012, now);
  shimmer.connect(shimmerGain);
  shimmerGain.connect(b.reverb);
  shimmer.start();
  sources.push(shimmer, lfo(ctx, 0.09, 0.011, shimmerGain.gain), lfo(ctx, 0.023, 9, shimmer.detune));

  return {
    fadeOut: (seconds) => {
      const t = ctx.currentTime;
      for (const g of [master, shimmerGain]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.linearRampToValueAtTime(0.0001, t + seconds);
      }
      stopAll(sources, t + seconds + 0.05);
    },
  };
}

function bedFire(b: BedContext): Bed {
  const { ctx } = b;
  const now = ctx.currentTime;
  const sources: AudioScheduledSourceNode[] = [];

  const roar = loopNoise(b, 'brown');
  const roarLp = ctx.createBiquadFilter();
  roarLp.type = 'lowpass';
  roarLp.frequency.setValueAtTime(240, now);
  const roarGain = ctx.createGain();
  roarGain.gain.setValueAtTime(0.32, now);
  roar.connect(roarLp); roarLp.connect(roarGain); roarGain.connect(b.out);
  sources.push(roar, lfo(ctx, 0.09, 80, roarLp.frequency), lfo(ctx, 0.17, 0.09, roarGain.gain), lfo(ctx, 0.43, 0.04, roarGain.gain, 'triangle'));

  const hiss = loopNoise(b, 'pink');
  const hissBp = ctx.createBiquadFilter();
  hissBp.type = 'bandpass';
  hissBp.frequency.setValueAtTime(2300, now);
  hissBp.Q.setValueAtTime(0.7, now);
  const hissGain = ctx.createGain();
  hissGain.gain.setValueAtTime(0.03, now);
  hiss.connect(hissBp); hissBp.connect(hissGain); hissGain.connect(b.out);
  sources.push(hiss, lfo(ctx, 0.27, 0.015, hissGain.gain));

  const crackleDest = ctx.createGain();
  crackleDest.gain.setValueAtTime(1, now);
  crackleDest.connect(b.out);
  const crackles = new Sparse(
    ctx,
    () => 0.02 + Math.random() * Math.random() * 0.3,
    (when) => {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime((Math.random() - 0.5) * 0.9, when);
      pan.connect(crackleDest);
      if (Math.random() < 0.07) {
        // A pop: a pocket of sap letting go.
        b.voices.burst({ colour: 'pink', duration: 0.02, gain: 0.25, filter: { type: 'lowpass', frequency: 500 } }, when, 1, pan);
        b.voices.partial({ type: 'sine', frequency: 140, endFrequency: 70, glide: 0.02, gain: 0.2, decay: 0.04 }, when, 1, pan);
        return;
      }
      b.voices.burst(
        { colour: 'white', duration: 0.003 + Math.random() * 0.009, gain: 0.04 + Math.random() * 0.16, attack: 0.0006, filter: { type: 'highpass', frequency: 1800 + Math.random() * 2000 } },
        when, 1, pan,
      );
    },
  );

  return {
    fadeOut: (seconds) => {
      const t = ctx.currentTime;
      crackles.stop();
      for (const g of [roarGain, hissGain, crackleDest]) {
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.linearRampToValueAtTime(0.0001, t + seconds);
      }
      stopAll(sources, t + seconds + 0.05);
    },
  };
}

const BEDS: Record<Exclude<AmbientSoundscape, 'none'>, (b: BedContext) => Bed> = {
  rain: bedRain,
  wind: bedWind,
  drone: bedDrone,
  fire: bedFire,
};

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

type AudioContextCtor = typeof AudioContext;

class ZenAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private switchBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private voices: Voices | null = null;
  private noise: Record<'white' | 'pink' | 'brown', AudioBuffer> | null = null;

  private enabled = false;
  private profile: SwitchSoundProfile = 'thock';
  private switchVolume = 0.6;
  private ambientVolume = 0.4;
  private ambientName: AmbientSoundscape = 'none';
  private ambient: { name: AmbientSoundscape; bed: Bed; gain: GainNode } | null = null;

  private lastDownAt = 0;
  private heldKeys = new Set<string>();
  private unlocking: Promise<boolean> | null = null;

  /** True once a user gesture has created a running context. */
  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  currentProfile(): SwitchSoundProfile {
    return this.profile;
  }

  // -- lifecycle ------------------------------------------------------------

  private init(): boolean {
    if (this.ctx) return true;
    if (typeof window === 'undefined') return false;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      this.ctx = ctx;
      const now = ctx.currentTime;

      this.master = ctx.createGain();
      this.master.gain.setValueAtTime(this.enabled ? 1 : 0, now);
      this.master.connect(ctx.destination);

      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-14, now);
      this.limiter.knee.setValueAtTime(6, now);
      this.limiter.ratio.setValueAtTime(6, now);
      this.limiter.attack.setValueAtTime(0.002, now);
      this.limiter.release.setValueAtTime(0.12, now);
      this.limiter.connect(this.master);

      this.switchBus = ctx.createGain();
      this.switchBus.gain.setValueAtTime(this.switchVolume, now);
      this.switchBus.connect(this.limiter);

      this.ambientBus = ctx.createGain();
      this.ambientBus.gain.setValueAtTime(this.ambientVolume, now);
      this.ambientBus.connect(this.limiter);

      this.noise = {
        white: makeNoise(ctx, 3, 'white'),
        pink: makeNoise(ctx, 4, 'pink'),
        brown: makeNoise(ctx, 4, 'brown'),
      };
      this.voices = new Voices(ctx, this.noise);

      this.convolver = ctx.createConvolver();
      this.convolver.buffer = makeRoomImpulse(ctx);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.setValueAtTime(1, now);
      this.reverbSend.connect(this.convolver);
      this.convolver.connect(this.limiter);

      if (this.ambientName !== 'none' && this.enabled) {
        this.startAmbient(this.ambientName);
      }
      return true;
    } catch (error) {
      console.warn('[audio] Web Audio unavailable', error);
      this.ctx = null;
      return false;
    }
  }

  /**
   * Create and resume the context. Call from a real user gesture; browsers
   * refuse to start audio otherwise. Safe to call repeatedly.
   */
  unlock(): Promise<boolean> {
    if (!this.init() || !this.ctx) return Promise.resolve(false);
    if (this.ctx.state === 'running') return Promise.resolve(true);
    if (this.unlocking) return this.unlocking;
    const ctx = this.ctx;
    this.unlocking = ctx.resume()
      .then(() => {
        if (this.ambientName !== 'none' && this.enabled && !this.ambient) {
          this.startAmbient(this.ambientName);
        }
        return ctx.state === 'running';
      })
      .catch(() => false)
      .finally(() => {
        this.unlocking = null;
      });
    return this.unlocking;
  }

  /** Mirror the persisted settings into the engine. Idempotent. */
  applySettings(settings: Settings): void {
    const enabled = !!settings.soundEnabled;
    const profile = settings.switchSound ?? 'thock';
    const switchVolume = settings.audioVolume ?? 0.6;
    const ambientVolume = settings.ambientVolume ?? 0.4;
    const ambientName = settings.ambientSound ?? 'none';

    this.profile = profile;
    this.switchVolume = switchVolume;
    this.ambientVolume = ambientVolume;

    const now = this.ctx?.currentTime ?? 0;
    if (this.switchBus) this.switchBus.gain.setTargetAtTime(switchVolume, now, 0.03);
    if (this.ambientBus) this.ambientBus.gain.setTargetAtTime(ambientVolume, now, 0.05);

    if (enabled !== this.enabled) {
      this.enabled = enabled;
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(enabled ? 1 : 0, now, enabled ? 0.02 : 0.06);
      }
    }

    this.ambientName = ambientName;
    if (!enabled || ambientName === 'none') {
      this.stopAmbient();
    } else if (this.ctx && this.ctx.state === 'running') {
      if (!this.ambient || this.ambient.name !== ambientName) this.startAmbient(ambientName);
    }
  }

  // -- keys -----------------------------------------------------------------

  /**
   * A key went down. `repeat` presses (holding a key) are silent, the same
   * as a real switch that is already bottomed out.
   */
  keyDown(key: string | undefined, options?: { repeat?: boolean; force?: boolean; profile?: SwitchSoundProfile }): void {
    if (options?.repeat) return;
    const profile = options?.profile ?? this.profile;
    if ((!this.enabled && !options?.force) || profile === 'none') return;
    if (!this.ctx) {
      // No gesture has unlocked audio yet. The first keystroke is one.
      void this.unlock().then((ok) => { if (ok) this.keyDown(key, options); });
      return;
    }
    if (this.ctx.state !== 'running') {
      void this.unlock();
      return;
    }
    const id = key ?? '';
    if (id && this.heldKeys.has(id)) return;
    if (id) this.heldKeys.add(id);

    const now = performance.now();
    const gap = this.lastDownAt ? now - this.lastDownAt : 400;
    this.lastDownAt = now;
    // Long pauses tend to come back with a firmer first stroke; a fast burst
    // settles into a lighter, even rhythm.
    const velocity = 0.84 + 0.16 * Math.min(1, gap / 320) + (Math.random() - 0.5) * 0.1;

    this.play(profile, 'down', key, velocity);
  }

  keyUp(key: string | undefined, options?: { profile?: SwitchSoundProfile }): void {
    const id = key ?? '';
    const wasHeld = id ? this.heldKeys.delete(id) : true;
    const profile = options?.profile ?? this.profile;
    if (!this.enabled || profile === 'none' || !this.ctx || this.ctx.state !== 'running' || !wasHeld) return;
    this.play(profile, 'up', key, 0.9 + Math.random() * 0.15);
  }

  /** Forget held keys (window blur, page hide) so nothing sticks. */
  releaseAll(): void {
    this.heldKeys.clear();
  }

  private play(profileName: SwitchSoundProfile, stroke: 'down' | 'up', key: string | undefined, velocity: number): void {
    if (!this.ctx || !this.voices || !this.switchBus || !this.reverbSend || profileName === 'none') return;
    const profile = PROFILES[profileName];
    const ctx = this.ctx;
    const when = ctx.currentTime + 0.002;
    const acoustics = keyAcoustics(key);
    const level = velocity * acoustics.weight * (acoustics.kind === 'modifier' ? 0.75 : 1);

    // Case body: the voice runs through a resonant peak and a lowpass, so the
    // same transient sounds like it landed in a keyboard rather than in air.
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.setValueAtTime(profile.body.frequency * (0.9 + acoustics.pitch * 0.1), when);
    body.Q.setValueAtTime(profile.body.Q, when);
    body.gain.setValueAtTime(profile.body.gain, when);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(profile.body.lowpass, when);
    lowpass.Q.setValueAtTime(0.5, when);
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.9, Math.min(0.9, acoustics.pan)), when);
    body.connect(lowpass);
    lowpass.connect(panner);
    panner.connect(this.switchBus);

    let spec: VoiceSpec = stroke === 'down' ? profile.down : profile.up;
    if (stroke === 'down') {
      const extra = acoustics.kind === 'space' ? profile.space : acoustics.kind === 'enter' ? profile.enter : undefined;
      if (extra) {
        spec = {
          bursts: [...(extra.bursts ?? spec.bursts)],
          partials: [...(extra.partials ?? spec.partials)],
          reverb: extra.reverb ?? spec.reverb,
        };
        // Big keys keep the profile's transient underneath their own body.
        if (!extra.bursts) spec.bursts = profile.down.bursts;
      }
    }

    const send = ctx.createGain();
    send.gain.setValueAtTime(spec.reverb, when);
    panner.connect(send);
    send.connect(this.reverbSend);

    for (const b of spec.bursts) this.voices.burst(b, when, level, body, acoustics.pitch);
    for (const p of spec.partials) this.voices.partial(p, when, level, body, acoustics.pitch);
  }

  /** Audition a profile: a short run of strokes. Works even while sound is off. */
  preview(profileName: SwitchSoundProfile = this.profile): void {
    if (profileName === 'none') return;
    void this.unlock().then((ok) => {
      if (!ok || !this.ctx || !this.master) return;
      const wasEnabled = this.enabled;
      if (!wasEnabled) this.master.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
      const keys = ['t', 'h', 'e', ' ', 'w', 'a', 'y'];
      keys.forEach((k, i) => {
        window.setTimeout(() => {
          this.play(profileName, 'down', k, 0.95);
          window.setTimeout(() => this.play(profileName, 'up', k, 0.95), 55 + Math.random() * 30);
        }, i * (95 + Math.random() * 40));
      });
      if (!wasEnabled) {
        window.setTimeout(() => {
          if (!this.enabled && this.master && this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
        }, keys.length * 130 + 500);
      }
    });
  }

  /** A soft bell for the end of a timed flow. */
  chime(): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || !this.voices || !this.reverbSend || !this.switchBus) return;
    const ctx = this.ctx;
    const when = ctx.currentTime + 0.01;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.7, when);
    out.connect(this.switchBus);
    const send = ctx.createGain();
    send.gain.setValueAtTime(0.55, when);
    out.connect(send);
    send.connect(this.reverbSend);
    this.voices.partial({ type: 'sine', frequency: 880, gain: 0.26, attack: 0.004, decay: 1.4 }, when, 1, out);
    this.voices.partial({ type: 'sine', frequency: 1320, gain: 0.1, attack: 0.004, decay: 0.9 }, when, 1, out);
    this.voices.partial({ type: 'sine', frequency: 2640, gain: 0.03, attack: 0.004, decay: 0.5 }, when, 1, out);
    this.voices.partial({ at: 0.9, type: 'sine', frequency: 660, gain: 0.18, attack: 0.004, decay: 1.6 }, when, 1, out);
    this.voices.partial({ at: 0.9, type: 'sine', frequency: 990, gain: 0.06, attack: 0.004, decay: 1.0 }, when, 1, out);
  }

  // -- ambient --------------------------------------------------------------

  private startAmbient(name: AmbientSoundscape): void {
    if (name === 'none' || !this.ctx || !this.voices || !this.noise || !this.ambientBus || !this.reverbSend) return;
    if (this.ambient?.name === name) return;
    this.stopAmbient(1.4);
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.8);
    gain.connect(this.ambientBus);
    const reverb = ctx.createGain();
    reverb.gain.setValueAtTime(0.35, ctx.currentTime);
    reverb.connect(this.reverbSend);
    gain.connect(reverb);
    const bed = BEDS[name]({ ctx, voices: this.voices, noise: this.noise, out: gain, reverb });
    this.ambient = { name, bed, gain };
  }

  private stopAmbient(fadeSeconds = 0.8): void {
    const current = this.ambient;
    if (!current || !this.ctx) {
      this.ambient = null;
      return;
    }
    this.ambient = null;
    const t = this.ctx.currentTime;
    current.gain.gain.cancelScheduledValues(t);
    current.gain.gain.setValueAtTime(Math.max(0.0001, current.gain.gain.value), t);
    current.gain.gain.exponentialRampToValueAtTime(0.0001, t + fadeSeconds);
    current.bed.fadeOut(fadeSeconds);
    const gainNode = current.gain;
    window.setTimeout(() => {
      try { gainNode.disconnect(); } catch { /* already gone */ }
    }, (fadeSeconds + 0.3) * 1000);
  }
}

export const audioEngine = new ZenAudioEngine();

if (typeof window !== 'undefined') {
  window.addEventListener('blur', () => audioEngine.releaseAll());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audioEngine.releaseAll();
  });
}
