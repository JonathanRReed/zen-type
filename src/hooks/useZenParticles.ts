// Hook and models for managing all 8 theme-specific generative particle systems
// and reactive keystroke burst simulations.
import { useRef } from 'react';

export interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  color: string;
  twinkle: number;
  speed: number;
  amp: number;
}

export interface Leaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  a: number;
  age: number;
  rot: number;
  rotSpeed: number;
}

export interface DriftSpeck {
  x: number;
  y: number;
  baseX: number;
  vy: number;
  amp: number;
  phase: number;
  alpha: number;
  radius: number;
}

export interface Firefly {
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  phase: number;
  speed: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface SakuraPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  rotSpeed: number;
  flip: number;
  flipSpeed: number;
  color: string;
  alpha: number;
  age: number;
}

export interface EmberSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  heat: number;
  decay: number;
  color: string;
  phase: number;
}

export interface Snowflake {
  x: number;
  y: number;
  vy: number;
  size: number;
  driftAmp: number;
  phase: number;
  alpha: number;
  twinkle: number;
}

export interface AuroraWave {
  yRatio: number;
  heightRatio: number;
  speed: number;
  color: string;
  phase: number;
  alpha: number;
}

export interface KeystrokeBurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  alpha: number;
  decay: number;
}

export interface StyleCache {
  rpText: string;
  moss: string;
  leaf: string;
  typingFont: string;
  rpFoam: string;
  rpPine: string;
  rpSurface: string;
  rpGold: string;
  rpLove: string;
  rpIris: string;
  rpRose?: string;
}

export interface ThemeParticleConfig {
  particleCap: number;
  reducedCap: number;
  spawnRateMs: number;
  colors: string[];
}

export const THEME_PARTICLE_CONFIGS: Record<string, ThemeParticleConfig> = {
  forest: {
    particleCap: 16,
    reducedCap: 8,
    spawnRateMs: 4000,
    colors: ['#7fbf9e', '#a3d9b1', '#f6c177'],
  },
  ocean: {
    particleCap: 32,
    reducedCap: 16,
    spawnRateMs: 2000,
    colors: ['#9ccfd8', '#31748f', '#c4a7e7'],
  },
  cosmic: {
    particleCap: 160,
    reducedCap: 70,
    spawnRateMs: 0,
    colors: ['#c4a7e7', '#f6c177', '#eb6f92', '#e0def4'],
  },
  sakura: {
    particleCap: 30,
    reducedCap: 12,
    spawnRateMs: 800,
    colors: ['#f2a9c3', '#ea9a97', '#eb6f92'],
  },
  ember: {
    particleCap: 45,
    reducedCap: 18,
    spawnRateMs: 300,
    colors: ['#eb6f92', '#f6c177', '#ea9a97'],
  },
  aurora: {
    particleCap: 5,
    reducedCap: 3,
    spawnRateMs: 0,
    colors: ['#7fbf9e', '#9ccfd8', '#c4a7e7'],
  },
  glacier: {
    particleCap: 40,
    reducedCap: 16,
    spawnRateMs: 600,
    colors: ['#e0def4', '#9ccfd8', '#c4a7e7'],
  },
  void: {
    particleCap: 8,
    reducedCap: 4,
    spawnRateMs: 3000,
    colors: ['#524f67', '#403d52'],
  },
};

export function useZenParticles() {
  const starsRef = useRef<Star[]>([]);
  const leavesRef = useRef<Leaf[]>([]);
  const driftRef = useRef<DriftSpeck[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const sakuraRef = useRef<SakuraPetal[]>([]);
  const embersRef = useRef<EmberSpark[]>([]);
  const snowflakesRef = useRef<Snowflake[]>([]);
  const burstsRef = useRef<KeystrokeBurstParticle[]>([]);
  const lastSpawnRef = useRef<Record<string, number>>({});

  const emitKeystrokeBurst = (x: number, y: number, color: string, count: number = 6) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.8;
      burstsRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8, // slight upward bias
        r: 1.2 + Math.random() * 1.8,
        color,
        alpha: 0.85 + Math.random() * 0.15,
        decay: 0.02 + Math.random() * 0.025,
      });
    }
  };

  const resetAllParticles = () => {
    starsRef.current = [];
    leavesRef.current = [];
    driftRef.current = [];
    firefliesRef.current = [];
    sakuraRef.current = [];
    embersRef.current = [];
    snowflakesRef.current = [];
    burstsRef.current = [];
    lastSpawnRef.current = {};
  };

  return {
    starsRef,
    leavesRef,
    driftRef,
    firefliesRef,
    sakuraRef,
    embersRef,
    snowflakesRef,
    burstsRef,
    emitKeystrokeBurst,
    resetAllParticles,
  };
}

