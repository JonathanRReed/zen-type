// Hook for managing theme-specific particle systems
import { useRef, useCallback } from 'react';

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
}

interface ThemeConfig {
  particleCap: number;
  spawnWindow: number;
  colors: string[];
  reducedParticleCap: number;
}

const THEME_CONFIGS: Record<string, ThemeConfig> = {
  forest: {
    particleCap: 6,
    spawnWindow: 8000,
    colors: ['#7fbf9e', '#a3d9b1'],
    reducedParticleCap: 4,
  },
  ocean: {
    particleCap: 25,
    spawnWindow: 6000,
    colors: ['#9ccfd8', '#31748f'],
    reducedParticleCap: 15,
  },
  cosmic: {
    particleCap: 120,
    spawnWindow: 4000,
    colors: ['#c4a7e7', '#f6c177', '#eb6f92'],
    reducedParticleCap: 80,
  },
  void: {
    particleCap: 0,
    spawnWindow: 0,
    colors: [],
    reducedParticleCap: 0,
  },
};

export function useZenParticles() {
  const starsRef = useRef<Star[]>([]);
  const leavesRef = useRef<Leaf[]>([]);
  const driftRef = useRef<DriftSpeck[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const lastLeafSpawnRef = useRef<number>(0);

  const getThemeConfig = useCallback((theme: string): ThemeConfig => {
    const normalizedTheme = theme.toLowerCase();
    const config = THEME_CONFIGS[normalizedTheme as keyof typeof THEME_CONFIGS];
    return (config || THEME_CONFIGS.void) as ThemeConfig;
  }, []);

  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const normalized = hex.trim().replace(/^#/, '');
    const isShort = normalized.length === 3;
    const value = isShort
      ? normalized.split('').map(ch => ch + ch).join('')
      : normalized.padEnd(6, '0');
    const num = parseInt(value.slice(0, 6), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
  }, []);

  const spawnForestParticles = useCallback((canvas: HTMLCanvasElement, _styleCache: StyleCache, reducedMotion: boolean, perfGuard: boolean) => {
    const config = getThemeConfig('forest');
    const now = Date.now();
    const leafCap = perfGuard ? 3 : reducedMotion ? config.reducedParticleCap : config.particleCap;
    const spawnWindow = reducedMotion ? 12000 : config.spawnWindow;
    const elapsedSinceSpawn = now - lastLeafSpawnRef.current;

    if (leavesRef.current.length < leafCap && elapsedSinceSpawn > spawnWindow) {
      lastLeafSpawnRef.current = now;
      leavesRef.current.push({
        x: Math.random() * canvas.width,
        y: -20,
        vx: -0.5 + Math.random(),
        vy: 0.8 + Math.random() * 0.4,
        size: 3 + Math.random() * 2,
        a: 0.4 + Math.random() * 0.3,
        age: 0,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (-0.01 + Math.random() * 0.02) * 0.5,
      });
    }
  }, [getThemeConfig]);

  const spawnOceanParticles = useCallback((canvas: HTMLCanvasElement, _styleCache: StyleCache, reducedMotion: boolean) => {
    const config = getThemeConfig('ocean');
    const targetDrift = reducedMotion ? config.reducedParticleCap : config.particleCap;
    
    while (driftRef.current.length < targetDrift) {
      driftRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        baseX: Math.random() * canvas.width,
        vy: 0.1 + Math.random() * 0.2,
        amp: 2 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.15 + Math.random() * 0.1,
        radius: 0.8 + Math.random() * 1.2,
      });
    }
  }, [getThemeConfig]);

  const spawnCosmicParticles = useCallback((canvas: HTMLCanvasElement, _styleCache: StyleCache, reducedMotion: boolean) => {
    const config = getThemeConfig('cosmic');
    const targetStars = reducedMotion ? config.reducedParticleCap : config.particleCap;
    
    while (starsRef.current.length < targetStars) {
      const configColors = config.colors;
      const color = configColors[Math.floor(Math.random() * configColors.length)];
      if (color) {
        starsRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: 0.8 + Math.random() * 1.5,
          a: 0.3 + Math.random() * 0.4,
          color: hexToRgba(color, 0.8),
          twinkle: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.03,
          amp: 0.2 + Math.random() * 0.3,
        });
      }
    }
  }, [getThemeConfig, hexToRgba]);

  const resetParticles = useCallback(() => {
    starsRef.current = [];
    leavesRef.current = [];
    driftRef.current = [];
    firefliesRef.current = [];
    lastLeafSpawnRef.current = 0;
  }, []);

  return {
    starsRef,
    leavesRef,
    driftRef,
    firefliesRef,
    lastLeafSpawnRef,
    getThemeConfig,
    hexToRgba,
    spawnForestParticles,
    spawnOceanParticles,
    spawnCosmicParticles,
    resetParticles,
  };
}