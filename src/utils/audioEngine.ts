// Procedural Web Audio Engine for Zen Typer
// Synthesizes tactile mechanical switch profiles and ambient meditation soundscapes in real-time.
// Zero network requests, zero audio assets, 100% procedurally synthesized.

import { getSettings } from './storage';

export type SwitchSoundProfile = 'none' | 'thock' | 'cream' | 'raindrop' | 'typewriter' | 'holy-panda' | 'clicky';
export type AmbientSoundscape = 'none' | 'rain' | 'wind' | 'drone';

// Helper to determine spatial pan (-0.28 to +0.28) and pitch multiplier based on keycap geometry
function getKeyAcoustics(key?: string): { pitchMult: number; pan: number } {
  if (!key) {
    return { pitchMult: 0.96 + Math.random() * 0.08, pan: (Math.random() - 0.5) * 0.2 };
  }
  if (key === ' ' || key === 'Spacebar') {
    return { pitchMult: 0.68, pan: 0 };
  }
  if (key === 'Backspace' || key === 'Delete') {
    return { pitchMult: 1.22, pan: 0.22 };
  }
  if (key === 'Enter') {
    return { pitchMult: 0.84, pan: 0.25 };
  }

  const k = key.toLowerCase();
  let pan = 0;
  if ('qaz1!~`'.includes(k)) pan = -0.26;
  else if ('wsx2@'.includes(k)) pan = -0.18;
  else if ('edc3#'.includes(k)) pan = -0.10;
  else if ('rfv4$tgb5%6^'.includes(k)) pan = -0.02;
  else if ('yhn7&ujm8*'.includes(k)) pan = 0.08;
  else if ('ik,9('.includes(k)) pan = 0.16;
  else if ('ol.0)'.includes(k)) pan = 0.22;
  else if ("p;/'\"[{]}=+-".includes(k)) pan = 0.28;

  // Natural Gaussian-like micro-pitch variance between keys (+/- 6%)
  const pitchMult = 0.94 + Math.random() * 0.12;
  return { pitchMult, pan };
}

class ZenAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentAmbient: AmbientSoundscape = 'none';
  private ambientNodes: { stop: () => void } | null = null;
  private isMuted: boolean = false;
  private masterVol: number = 0.6;
  private ambientVol: number = 0.4;
  private noiseBuffer: AudioBuffer | null = null;

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVol, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.ambientVol, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);

      // Generate 2 seconds of pink/brown noise for procedural synthesis
      this.generateNoiseBuffer();
    } catch (e) {
      console.warn('[AudioEngine] Web Audio not available', e);
    }
  }

  private generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink/Brownian filter approximation
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i]!;
      data[i]! *= 3.5; // Gain boost
    }
    this.noiseBuffer = buffer;
  }

  private async resumeContext(): Promise<boolean> {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }
    return true;
  }

  // Warm up the AudioContext on a real user gesture so the very first
  // keystroke plays synchronously instead of paying the async-resume cost.
  public unlock(): void {
    void this.resumeContext();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const target = muted ? 0 : this.masterVol;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
    }
  }

  public setMasterVolume(vol: number): void {
    this.masterVol = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVol, this.ctx.currentTime, 0.03);
    }
  }

  public setAmbientVolume(vol: number): void {
    this.ambientVol = Math.max(0, Math.min(1, vol));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(this.ambientVol, this.ctx.currentTime, 0.05);
    }
  }

  // Play mechanical switch click with spatial stereo panning and per-key pitch acoustics
  public playSwitch(profile?: SwitchSoundProfile, key?: string): void {
    const activeProfile = profile ?? (typeof window !== 'undefined' ? (getSettings().switchSound || 'thock') : 'thock');
    if (activeProfile === 'none' || this.isMuted) return;

    const { pitchMult, pan } = getKeyAcoustics(key);

    // If context is already running, play SYNCHRONOUSLY without promise microtask lag
    if (this.ctx && this.ctx.state === 'running') {
      this.dispatchSwitchSound(this.ctx, activeProfile, pitchMult, pan);
      return;
    }

    void this.resumeContext().then((ready) => {
      if (!ready || !this.ctx || !this.masterGain) return;
      this.dispatchSwitchSound(this.ctx, activeProfile, pitchMult, pan);
    });
  }

  private createDestination(ctx: AudioContext, pan: number): AudioNode {
    if (ctx.createStereoPanner && pan !== 0) {
      try {
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-0.8, Math.min(0.8, pan)), ctx.currentTime);
        panner.connect(this.masterGain!);
        return panner;
      } catch {
        // Fallback if stereo panner fails
      }
    }
    return this.masterGain!;
  }

  private dispatchSwitchSound(ctx: AudioContext, profile: SwitchSoundProfile, pitchMult: number, pan: number) {
    const now = ctx.currentTime;
    const dest = this.createDestination(ctx, pan);

    switch (profile) {
      case 'thock':
        this.synthesizeThock(ctx, now, pitchMult, dest);
        break;
      case 'holy-panda':
        this.synthesizeHolyPanda(ctx, now, pitchMult, dest);
        break;
      case 'clicky':
        this.synthesizeClicky(ctx, now, pitchMult, dest);
        break;
      case 'cream':
        this.synthesizeCream(ctx, now, pitchMult, dest);
        break;
      case 'raindrop':
        this.synthesizeRaindrop(ctx, now, pitchMult, dest);
        break;
      case 'typewriter':
        this.synthesizeTypewriter(ctx, now, pitchMult, dest);
        break;
    }
  }

  // Deep resonant mechanical switch (lubed U4T / Cherry MX Black)
  private synthesizeThock(ctx: AudioContext, now: number, pitchMult: number, dest: AudioNode) {
    // 1. Deep low-frequency body thump
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 110 * pitchMult;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(45 * pitchMult, now + 0.045);

    oscGain.gain.setValueAtTime(0.75, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.058);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.06);

    // 2. Crisp tactile stem contact snap
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400 * pitchMult, now);
      filter.Q.setValueAtTime(3.5, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.38, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.03);
    }
  }

  // Tactile Holy Panda: pronounced round bump snap + deep wooden housing bottom-out
  private synthesizeHolyPanda(ctx: AudioContext, now: number, pitchMult: number, dest: AudioNode) {
    // 1. Tactile bump snap
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    const bumpFreq = 220 * pitchMult;
    osc.frequency.setValueAtTime(bumpFreq, now);
    osc.frequency.exponentialRampToValueAtTime(65 * pitchMult, now + 0.042);

    oscGain.gain.setValueAtTime(0.65, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.055);

    // 2. High snap click
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2800 * pitchMult, now);
      filter.Q.setValueAtTime(4.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.42, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.025);
    }
  }

  // Clicky: Kailh Box White / Buckling Spring with sharp crisp clickbar
  private synthesizeClicky(ctx: AudioContext, now: number, pitchMult: number, dest: AudioNode) {
    // 1. Sharp clickbar crack
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3800 * pitchMult, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.55, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.02);
    }

    // 2. Buckled spring chime ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1850 * pitchMult, now);
    osc.frequency.exponentialRampToValueAtTime(920 * pitchMult, now + 0.04);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Soft POM linear switch
  private synthesizeCream(ctx: AudioContext, now: number, pitchMult: number, dest: AudioNode) {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 * pitchMult, now);
    osc.frequency.exponentialRampToValueAtTime(80 * pitchMult, now + 0.035);

    oscGain.gain.setValueAtTime(0.42, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.045);

    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400 * pitchMult, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.22, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.025);
    }
  }

  // Water droplet glass clack
  private synthesizeRaindrop(ctx: AudioContext, now: number, pitchMult: number, dest: AudioNode) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const pitch = (950 + Math.random() * 300) * pitchMult;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.35, now + 0.015);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.8, now + 0.06);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  // Crisp mechanical typewriter click with carriage spring
  private synthesizeTypewriter(ctx: AudioContext, now: number, pitchMult: number, dest: AudioNode) {
    // Metal impact
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3200 * pitchMult, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.025);
    }

    // Spring bell chime overtone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480 * pitchMult, now);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // Ambient soundscapes
  public setAmbient(soundscape: AmbientSoundscape): void {
    if (this.currentAmbient === soundscape) return;
    this.currentAmbient = soundscape;

    // Stop current ambient nodes
    if (this.ambientNodes) {
      this.ambientNodes.stop();
      this.ambientNodes = null;
    }

    if (soundscape === 'none' || this.isMuted) return;

    void this.resumeContext().then((ready) => {
      if (!ready || !this.ctx || !this.ambientGain) return;
      const ctx = this.ctx;

      switch (soundscape) {
        case 'rain':
          this.startRain(ctx);
          break;
        case 'wind':
          this.startWind(ctx);
          break;
        case 'drone':
          this.startDrone(ctx);
          break;
      }
    });
  }

  private startRain(ctx: AudioContext) {
    if (!this.noiseBuffer || !this.ambientGain) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 1.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    noise.start();

    this.ambientNodes = {
      stop: () => {
        try {
          gain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.4);
          setTimeout(() => noise.stop(), 500);
        } catch {}
      },
    };
  }

  private startWind(ctx: AudioContext) {
    if (!this.noiseBuffer || !this.ambientGain) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.Q.setValueAtTime(2.2, ctx.currentTime);

    // LFO to modulate wind howling
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.18, ctx.currentTime); // Gentle gust period
    lfoGain.gain.setValueAtTime(250, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 1.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);

    lfo.start();
    noise.start();

    this.ambientNodes = {
      stop: () => {
        try {
          gain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.4);
          setTimeout(() => {
            noise.stop();
            lfo.stop();
          }, 500);
        } catch {}
      },
    };
  }

  private startDrone(ctx: AudioContext) {
    if (!this.ambientGain) return;
    const freqs = [54, 108, 162]; // Harmonic tri-drone
    const oscs: OscillatorNode[] = [];
    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.001, ctx.currentTime);
    mainGain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 2.0);
    mainGain.connect(this.ambientGain);

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      // Subtle detune for shimmer
      osc.detune.setValueAtTime((idx - 1) * 3, ctx.currentTime);

      oscGain.gain.setValueAtTime(0.3 / (idx + 1), ctx.currentTime);
      osc.connect(oscGain);
      oscGain.connect(mainGain);
      osc.start();
      oscs.push(osc);
    });

    this.ambientNodes = {
      stop: () => {
        try {
          mainGain.gain.setTargetAtTime(0.001, ctx.currentTime, 0.4);
          setTimeout(() => oscs.forEach(o => o.stop()), 500);
        } catch {}
      },
    };
  }
}

export const audioEngine = new ZenAudioEngine();

