import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  type Settings,
  createArchiveEntry,
  updateArchiveEntry,
  getStoragePersistenceErrorEvent,
  type StorageFailureDetail,
} from '../utils/storage';
import { useMotionPreference } from '../hooks/useMotionPreference';

interface Token {
  id: number;
  text: string;
  x: number;
  y: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  lifetime: number;
  maxLifetime: number;
  birth: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  color: string;
  twinkle: number;
  speed: number;
  amp: number;
}
interface Leaf { x: number; y: number; vx: number; vy: number; size: number; a: number; age: number; rot: number; rotSpeed: number; }
interface DriftSpeck { x: number; y: number; baseX: number; vy: number; amp: number; phase: number; alpha: number; radius: number; }
interface Firefly { baseX: number; baseY: number; ampX: number; ampY: number; phase: number; speed: number; radius: number; alpha: number; color: string; }

type StyleCache = {
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
};

const FALLBACK_STYLE_CACHE: StyleCache = {
  rpText: '#e0def4',
  moss: '#6ec98b',
  leaf: '#a3d9b1',
  typingFont: 'monospace',
  rpFoam: '#9ccfd8',
  rpPine: '#31748f',
  rpSurface: '#1f1d2e',
  rpGold: '#f6c177',
  rpLove: '#eb6f92',
  rpIris: '#c4a7e7',
};

const hexToRgba = (hex: string, alpha: number) => {
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
};

interface ZenCanvasProps {
  fontFamily?: string;
  reducedMotion?: boolean;
  maxTokens?: number;
  onStats?: (stats: { words: number; chars: number; time: number; wpm: number }) => void;
}

const ZenCanvas: React.FC<ZenCanvasProps> = ({
  fontFamily = 'monospace',
  reducedMotion = false,
  maxTokens = 160,
  onStats,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokensRef = useRef<Token[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [stats, setStats] = useState({ words: 0, chars: 0, startTime: Date.now() });
  const animationFrameRef = useRef<number | null>(null);
  const tokenIdRef = useRef(0);
  const lastStatsEmitRef = useRef(Date.now());
  const { reducedMotion: rm } = useMotionPreference({ forced: reducedMotion });
  const starsRef = useRef<Star[]>([]);
  const leavesRef = useRef<Leaf[]>([]);
  const driftRef = useRef<DriftSpeck[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const lastLeafSpawnRef = useRef<number>(0);
  // Back buffer for rendering (OffscreenCanvas if available)
  const backCanvasRef = useRef<OffscreenCanvas | HTMLCanvasElement | null>(null);
  const backCtxRef = useRef<OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null>(null);
  // Settings live snapshot
  const settingsRef = useRef<Settings | null>(null);
  // Dynamic token cap under performance guard
  const dynCapRef = useRef<number>(maxTokens);
  // FPS buffer for performance guard
  const frameTimesRef = useRef<number[]>([]);
  const perfGuardRef = useRef<boolean>(false);
  // Session timing
  const sessionStartRef = useRef<number>(Date.now());
  // Ghost buffer (event log of appended chars within rolling window)
  const ghostLogRef = useRef<{ t: number; ch: string }[]>([]);
  const transcriptRef = useRef<string>('');
  const archiveIdRef = useRef<string | null>(null);
  const archiveDirtyRef = useRef<boolean>(false);
  const archiveTimerRef = useRef<number | null>(null);
  const archiveIdleRef = useRef<number | null>(null);
  const archiveSuspendedRef = useRef<boolean>(false);
  const styleCacheRef = useRef<StyleCache | null>(null);
  // Markers
  const markersRef = useRef<number[]>([]);
  const lastCharRef = useRef<string>('');
  const lastTypeTsRef = useRef<number>(0);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const getSettingsSnapshot = (): Settings => {
    if (!settingsRef.current) {
      try {
        settingsRef.current = getSettings();
      } catch {
        settingsRef.current = { ...DEFAULT_SETTINGS };
      }
    }
    return settingsRef.current;
  };

  const flushArchive = useCallback(() => {
    if (archiveSuspendedRef.current) return;
    const id = archiveIdRef.current;
    if (!id || !archiveDirtyRef.current) return;
    const text = transcriptRef.current;
    const trimmed = text.trim();
    const words = trimmed.length ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    try {
      updateArchiveEntry(id, { text, wordCount: words, charCount: chars });
      archiveDirtyRef.current = false;
    } catch (err) {
      console.error('[ZenCanvas] Failed to update archive entry', err);
      archiveSuspendedRef.current = true;
    }
  }, []);

  const finalizeArchive = useCallback(() => {
    if (archiveSuspendedRef.current) return;
    const id = archiveIdRef.current;
    if (!id) return;
    const text = transcriptRef.current;
    const trimmed = text.trim();
    const words = trimmed.length ? trimmed.split(/\s+/).length : 0;
    const chars = text.length;
    try {
      updateArchiveEntry(id, { text, wordCount: words, charCount: chars, endedAt: new Date().toISOString() });
      archiveDirtyRef.current = false;
    } catch (err) {
      console.error('[ZenCanvas] Failed to finalize archive entry', err);
      archiveSuspendedRef.current = true;
    }
  }, []);

  const trimAmbientParticles = useCallback(() => {
    if (leavesRef.current.length > 4) {
      leavesRef.current = leavesRef.current.slice(-4);
    }
    if (firefliesRef.current.length > 10) {
      firefliesRef.current = firefliesRef.current.slice(0, 10);
    }
    if (driftRef.current.length > 24) {
      driftRef.current = driftRef.current.slice(0, 24);
    }
  }, []);

  const scheduleArchivePersist = useCallback(() => {
    if (archiveSuspendedRef.current) return;
    if (typeof window === 'undefined') return;
    if (archiveTimerRef.current !== null) {
      window.clearTimeout(archiveTimerRef.current);
    }
    if (archiveIdleRef.current !== null && 'cancelIdleCallback' in window) {
      (window as any).cancelIdleCallback(archiveIdleRef.current);
      archiveIdleRef.current = null;
    }
    archiveTimerRef.current = window.setTimeout(() => {
      archiveTimerRef.current = null;
      if ('requestIdleCallback' in window) {
        archiveIdleRef.current = (window as any).requestIdleCallback(() => {
          archiveIdleRef.current = null;
          flushArchive();
        }, { timeout: 2000 });
      } else {
        flushArchive();
      }
    }, 1500);
  }, [flushArchive]);

  const markArchiveDirty = useCallback(() => {
    if (archiveSuspendedRef.current) return;
    archiveDirtyRef.current = true;
    scheduleArchivePersist();
  }, [scheduleArchivePersist]);

  const computeStyleCache = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const getVar = (name: string, fallback: string) => {
      const value = css.getPropertyValue(name);
      return value ? value.trim() : fallback;
    };

    styleCacheRef.current = {
      rpText: getVar('--rp-text', '#e0def4'),
      moss: getVar('--moss', '#7fbf9e'),
      leaf: getVar('--leaf', '#a3d9b1'),
      typingFont: getVar('--typing-font', fontFamily) || fontFamily,
      rpFoam: getVar('--rp-foam', '#9ccfd8'),
      rpPine: getVar('--rp-pine', '#31748f'),
      rpSurface: getVar('--rp-surface', '#1f1d2e'),
      rpGold: getVar('--rp-gold', '#f6c177'),
      rpLove: getVar('--rp-love', '#eb6f92'),
      rpIris: getVar('--rp-iris', '#c4a7e7'),
    };
  }, [fontFamily]);

  useEffect(() => {
    computeStyleCache();
  }, [computeStyleCache]);

  // Listen for storage persistence errors and warn users
  useEffect(() => {
    const handleStorageError = (e: Event) => {
      const detail = (e as CustomEvent<StorageFailureDetail>).detail;
      if (detail.action === 'write') {
        setStorageWarning('Local storage is disabled or full. Your session will not be saved.');
        console.warn('[ZenCanvas] Storage persistence disabled:', detail);
      }
    };

    const eventName = getStoragePersistenceErrorEvent();
    window.addEventListener(eventName, handleStorageError as EventListener);

    return () => {
      window.removeEventListener(eventName, handleStorageError as EventListener);
    };
  }, []);

  // Archive persistence: schedule saves after idle and finalize on teardown
  useEffect(() => {
    const handleFinalize = () => {
      if (archiveTimerRef.current !== null) {
        window.clearTimeout(archiveTimerRef.current);
        archiveTimerRef.current = null;
      }
      if (archiveIdleRef.current !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(archiveIdleRef.current);
        archiveIdleRef.current = null;
      }
      finalizeArchive();
    };

    window.addEventListener('finalizeArchive', handleFinalize as EventListener);

    return () => {
      window.removeEventListener('finalizeArchive', handleFinalize as EventListener);
      handleFinalize();
    };
  }, [finalizeArchive]);

  // Respond to settings changes and hotkey toggles
  useEffect(() => {
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent).detail as Settings;
      settingsRef.current = s;
    };
    const onToggleBreath = () => {
      const s = getSettingsSnapshot();
      const next = { ...s, breath: !s.breath } as Settings;
      settingsRef.current = next;
      try { saveSettings(next); } catch {}
      window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
    };
    const onRequestGhost = (e: Event) => {
      const { startSec, endSec } = (e as CustomEvent).detail as { startSec: number; endSec: number };
      const startMs = sessionStartRef.current + startSec * 1000;
      const endMs = sessionStartRef.current + endSec * 1000;
      const text = ghostLogRef.current
        .filter(ev => {
          const tms = sessionStartRef.current + ev.t * 1000;
          return tms >= startMs && tms <= endMs && ev.ch.length > 0;
        })
        .map(ev => ev.ch)
        .join('');
      window.dispatchEvent(new CustomEvent('ghostText', { detail: { text } }));
    };
    const onRestoreGhost = (e: Event) => {
      const { text } = (e as CustomEvent).detail as { text: string };
      if (!inputRef.current) return;
      inputRef.current.value = text;
      setCurrentWord(text);
    };

    const onFocusTyping = () => {
      inputRef.current?.focus();
    };

    window.addEventListener('settingsChanged', onSettings as EventListener);
    window.addEventListener('toggleBreath', onToggleBreath as EventListener);
    window.addEventListener('requestGhost', onRequestGhost as EventListener);
    window.addEventListener('restoreGhost', onRestoreGhost as EventListener);
    window.addEventListener('focusTyping', onFocusTyping as EventListener);
    return () => {
      window.removeEventListener('settingsChanged', onSettings as EventListener);
      window.removeEventListener('toggleBreath', onToggleBreath as EventListener);
      window.removeEventListener('requestGhost', onRequestGhost as EventListener);
      window.removeEventListener('restoreGhost', onRestoreGhost as EventListener);
      window.removeEventListener('focusTyping', onFocusTyping as EventListener);
    };
  }, [computeStyleCache]);

  // Commit a word using spawn density controls and update transcript/ghost
  const commitWord = (word: string, delimiter: string) => {
    const s = getSettingsSnapshot();
    const density = Math.max(0.5, Math.min(1.5, s.spawnDensity ?? 1.0));
    if (density < 1) {
      if (Math.random() < density) spawnToken(word);
    } else {
      // Always spawn one
      spawnToken(word);
      const extraBase = Math.floor(density - 1);
      for (let i = 0; i < extraBase; i++) spawnToken(word);
      const frac = density - 1 - extraBase;
      if (Math.random() < frac) spawnToken(word);
    }
    // Record delimiter
    transcriptRef.current += delimiter;
    ghostLogRef.current.push({ t: (Date.now() - sessionStartRef.current) / 1000, ch: delimiter });
    markArchiveDirty();
  };

  // Handle input changes
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const lastChar = value[value.length - 1];
    
    // Ensure archive entry exists once typing starts
    if (!archiveIdRef.current) {
      try {
        const entry = createArchiveEntry({ text: '', wordCount: 0, charCount: 0, startedAt: new Date().toISOString() });
        archiveIdRef.current = entry.id;
      } catch (err) {
        console.error('[ZenCanvas] Failed to create archive entry', err);
        archiveSuspendedRef.current = true;
      }
    }

    // Append to transcript and ghost log for typed characters
    if (value.length > currentWord.length) {
      const ch = value[value.length - 1] ?? '';
      // Debounce duplicate keystrokes
      const s = getSettingsSnapshot();
      const thr = Math.max(0, s.debounceMs || 0);
      const now = performance.now();
      if (thr > 0 && ch && ch === lastCharRef.current && (now - lastTypeTsRef.current) < thr) {
        return; // ignore this duplicate
      }
      lastCharRef.current = ch;
      lastTypeTsRef.current = now;
      if (ch) {
        // Only append non-delimiter chars here; delimiters recorded in commitWord
        if (!/[\s.,!?;:]/.test(ch)) {
          transcriptRef.current += ch;
        }
        ghostLogRef.current.push({ t: (Date.now() - sessionStartRef.current) / 1000, ch });
        // Keep within largest window (max 5 min)
        const maxWin = (settingsRef.current?.ghostWindowMin ?? 5) * 60;
        const cutoff = (Date.now() - sessionStartRef.current) / 1000 - maxWin;
        ghostLogRef.current = ghostLogRef.current.filter(ev => ev.t >= cutoff);
      }
    }

    // Check if we should commit the word (space or punctuation)
    if (lastChar === ' ' || /[.,!?;:]/.test(lastChar ?? '')) {
      if (currentWord.length > 0) {
        const delimiter: string = lastChar ?? ' ';
        commitWord(currentWord, delimiter);
        setStats(prev => ({
          words: prev.words + 1,
          chars: prev.chars + currentWord.length,
          startTime: prev.startTime
        }));
      }
      setCurrentWord('');
      e.target.value = '';
      markArchiveDirty();
    } else {
      setCurrentWord(value);
      markArchiveDirty();
    }
  };

  // Handle key down for special keys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && currentWord.length > 0) {
      commitWord(currentWord, '\n');
      setStats(prev => ({
        words: prev.words + 1,
        chars: prev.chars + currentWord.length,
        startTime: prev.startTime
      }));
      setCurrentWord('');
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      markArchiveDirty();
    }
    if (e.key === 'Backspace') {
      // Record deletion in transcript by removing last char, but do not push deletion char into ghost log
      transcriptRef.current = transcriptRef.current.slice(0, -1);
      markArchiveDirty();
    }
  };

  // Spawn a new token
  const spawnToken = (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = Math.max(1, canvas.width || 0);
    const height = Math.max(1, canvas.height || 0);
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return;
    }

    const wordLength = text.length;
    const s = getSettingsSnapshot();
    const baseFade = rm ? Math.max(1.8, (s.fadeSec ?? 4) * 0.6) : (s.fadeSec ?? 4);
    const lifetime = baseFade + (wordLength * 0.3);
    const amp = rm ? 0 : (s.driftAmp ?? 6);

    // Focus lanes
    let x = Math.random() * width;
    const laneStyle = s.laneStyle ?? 'soft';
    if (laneStyle !== 'none') {
      const lanes = [width * 0.25, width * 0.5, width * 0.75];
      const lane = lanes[Math.floor(Math.random() * lanes.length)] ?? width * 0.5;
      const jitter = laneStyle === 'tight' ? 18 : 40;
      x = lane + (Math.random() * 2 - 1) * jitter;
    }
    if (!Number.isFinite(x)) {
      x = width / 2;
    }
    const horizontalPadding = Math.min(48, width / 6);
    const minX = horizontalPadding;
    const maxX = width - horizontalPadding;
    if (maxX > minX) {
      x = Math.min(maxX, Math.max(minX, x));
    } else {
      x = width / 2;
    }

    const newToken: Token = {
      id: tokenIdRef.current++,
      text,
      x,
      y: Math.max(0, height - 80),
      vy: Math.min(80, Math.max(30, 45 + Math.random() * 35)), // Faster upward movement
      swayAmp: amp,
      swayFreq: 0.6 + Math.random() * 0.6, // 0.6-1.2Hz frequency
      lifetime,
      maxLifetime: lifetime,
      birth: Date.now()
    };

    const arr = tokensRef.current.slice();
    arr.push(newToken);
    const cap = dynCapRef.current;
    if (arr.length > cap) {
      tokensRef.current = arr.slice(-cap);
    } else {
      tokensRef.current = arr;
    }
  };

  // Animation loop
  const animate = useCallback(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      frameTimesRef.current = [];
      animationFrameRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const frontCtx = canvas?.getContext('2d');
    if (!canvas || !frontCtx) return;
    const ctx = (backCtxRef.current as any) || frontCtx;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!styleCacheRef.current) {
      computeStyleCache();
    }
    const styleCache = styleCacheRef.current ?? { ...FALLBACK_STYLE_CACHE, typingFont: fontFamily };
    const { rpText, moss, leaf: leafColor, typingFont, rpFoam, rpGold, rpLove } = styleCache;
    const isCosmic = document.documentElement.classList.contains('theme-cosmic');
    const sNow = getSettingsSnapshot();
    const perfMode = !!sNow.performanceMode;

    const isForest = document.documentElement.classList.contains('theme-forest');
    const isOcean = document.documentElement.classList.contains('theme-ocean');
    
    // Forest theme: Enhanced leaf drift and firefly ambience
    if (isForest && !perfMode) {
      const now = Date.now();
      const reduced = rm;
      const leafCap = perfGuardRef.current ? 4 : reduced ? 5 : 8;
      const spawnWindow = reduced ? 10000 : 6500;
      const elapsedSinceSpawn = now - lastLeafSpawnRef.current;
      const spawnDelay = spawnWindow * (0.5 + Math.random() * 0.5);

      if (elapsedSinceSpawn > spawnDelay && leavesRef.current.length < leafCap) {
        const size = 14 + Math.random() * 10;
        leavesRef.current.push({
          x: Math.random() * canvas.width,
          y: -size,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (reduced ? 3 : 4 + Math.random() * 3) / 60,
          size,
          a: 0.18 + Math.random() * 0.08,
          age: 0,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() * 0.08 - 0.04) / 60
        });
        lastLeafSpawnRef.current = now;
      }
      
      ctx.save();
      const updatedLeaves: Leaf[] = [];
      for (const leaf of leavesRef.current) {
        leaf.age += 1 / 60;
        leaf.rot += leaf.rotSpeed;
        leaf.x += leaf.vx + Math.sin(leaf.age * 1.15) * 0.4;
        leaf.y += leaf.vy;
        const lifeSpan = reduced ? 28 : 45;
        if (leaf.y < canvas.height + leaf.size && leaf.age < lifeSpan) {
          const fade = Math.max(0, 1 - leaf.age / lifeSpan);
          ctx.globalAlpha = leaf.a * fade;
          ctx.fillStyle = hexToRgba(moss, leaf.age < 12 ? 0.96 : 0.68);
          ctx.beginPath();
          ctx.ellipse(leaf.x, leaf.y, leaf.size * 0.5, leaf.size * 0.36, leaf.rot, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = Math.min(0.4, leaf.a * 0.5 * fade);
          ctx.strokeStyle = hexToRgba(leafColor, 0.42);
          ctx.lineWidth = 0.6;
          ctx.stroke();
          updatedLeaves.push(leaf);
        }
      }
      leavesRef.current = updatedLeaves;
      ctx.restore();

      const fireflyPalette = [hexToRgba(rpGold, 0.92), hexToRgba(rpLove, 0.78), hexToRgba(rpFoam, 0.85), hexToRgba(moss, 0.88)];
      const canopyTop = canvas.height * 0.18;
      const canopyBottom = canvas.height * 0.8;
      const targetFireflies = reduced ? 10 : 16;
      let paletteSize = fireflyPalette.length;
      if (paletteSize === 0) {
        firefliesRef.current = [];
      } else {
        while (firefliesRef.current.length < targetFireflies) {
          paletteSize = fireflyPalette.length;
          if (paletteSize === 0) break;
          const paletteIndex = Math.min(paletteSize - 1, Math.floor(Math.random() * paletteSize));
          const candidate = fireflyPalette[paletteIndex];
          const color: string = typeof candidate === 'string' ? candidate : hexToRgba(rpGold, 0.92);
          firefliesRef.current.push({
            baseX: Math.random() * canvas.width,
            baseY: canopyBottom - Math.random() * (canopyBottom - canopyTop),
            ampX: 16 + Math.random() * 22,
            ampY: 10 + Math.random() * 14,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0006 + Math.random() * 0.00038,
            radius: 1.3 + Math.random() * 1.4,
            alpha: 0.22 + Math.random() * 0.12,
            color,
          });
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const updatedFireflies: Firefly[] = [];
      for (const firefly of firefliesRef.current) {
        firefly.phase += firefly.speed;
        firefly.baseY -= reduced ? 0.012 : 0.024;
        if (firefly.baseY < canopyTop) {
          firefly.baseY = canopyBottom + Math.random() * 20;
          firefly.baseX = Math.random() * canvas.width;
        }
        firefly.baseX += (Math.random() - 0.5) * 0.2;
        if (firefly.baseX < -20) firefly.baseX = canvas.width + 20;
        if (firefly.baseX > canvas.width + 20) firefly.baseX = -20;

        const x = firefly.baseX + Math.sin(firefly.phase * 2.3) * firefly.ampX;
        const y = firefly.baseY + Math.cos(firefly.phase * 2) * firefly.ampY;
        const pulse = 0.55 + 0.4 * Math.sin(firefly.phase * 3);
        ctx.globalAlpha = firefly.alpha * pulse;
        ctx.fillStyle = firefly.color;
        ctx.beginPath();
        ctx.arc(x, y, firefly.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = firefly.alpha * pulse * 0.35;
        ctx.beginPath();
        ctx.arc(x, y, firefly.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        updatedFireflies.push(firefly);
      }
      firefliesRef.current = updatedFireflies;
      ctx.restore();
    }
    
    // Ocean theme: bubbles and plankton ambience (kept subtle with reduced motion)
    if (isOcean && !perfMode) {
      const foam = rpFoam;
      const reduced = rm;

      const targetSpecks = perfGuardRef.current ? 18 : (reduced ? 22 : 34);
      while (driftRef.current.length < targetSpecks) {
        driftRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseX: Math.random() * canvas.width,
          vy: -(reduced ? (1 + Math.random() * 2) / 1200 : (2 + Math.random() * 6) / 900),
          amp: (reduced ? 4 : 7) + Math.random() * (reduced ? 6 : 12),
          phase: Math.random() * Math.PI * 2,
          alpha: (reduced ? 0.2 : 0.3) + Math.random() * 0.24,
          radius: (reduced ? 1.6 : 2.1) + Math.random() * (reduced ? 1.6 : 2.8),
        });
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const updatedSpecks: DriftSpeck[] = [];
      const driftTime = performance.now() * 0.00008;
      for (const speck of driftRef.current) {
        speck.phase += reduced ? 0.00045 : 0.0012;
        const sway = Math.sin(driftTime + speck.phase) * speck.amp;
        const nextX = speck.baseX + sway;
        const nextY = speck.y + speck.vy * canvas.height;
        if (nextY < -28) {
          speck.y = canvas.height + 14;
          speck.baseX = Math.random() * canvas.width;
          speck.phase = Math.random() * Math.PI * 2;
          speck.alpha = (reduced ? 0.2 : 0.3) + Math.random() * 0.24;
          speck.radius = (reduced ? 1.6 : 2.1) + Math.random() * (reduced ? 1.6 : 2.8);
        } else {
          speck.y = nextY;
        }

        ctx.globalAlpha = speck.alpha;
        ctx.fillStyle = hexToRgba(foam, reduced ? 0.7 : 0.96);
        ctx.beginPath();
        ctx.arc(nextX, speck.y, speck.radius, 0, Math.PI * 2);
        ctx.fill();

        updatedSpecks.push(speck);
      }
      driftRef.current = updatedSpecks;
      ctx.restore();
    }
    
    // Cosmic theme: Starfield with slow twinkle
    if (isCosmic && !perfMode && starsRef.current.length) {
      ctx.save();
      for (const s of starsRef.current) {
        s.twinkle += s.speed;
        const twinkleFactor = 1 - s.amp + s.amp * (1 + Math.sin(s.twinkle)) / 2;
        ctx.globalAlpha = Math.max(0.05, s.a * twinkleFactor);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Update and draw tokens
    const now = Date.now();
    const updatedTokens: Token[] = [];

    tokensRef.current.forEach(token => {
      const age = (now - token.birth) / 1000; // Age in seconds
      const threshold = perfGuardRef.current ? token.maxLifetime * 0.7 : token.maxLifetime;
      token.lifetime = threshold - age;
      if (age >= threshold) return; // Remove when past effective lifetime
      
      // Update position with ease-out for smoother deceleration
      const ageProgress = Math.min(1, age / threshold);
      const easeOut = 1 - Math.pow(1 - ageProgress, 2); // Quadratic ease-out
      token.y -= (token.vy / 60) * (1 - easeOut * 0.3); // Slow down as it rises
      
      // Add horizontal sway if not reduced motion
      const effectiveAmp = (perfGuardRef.current || perfMode) ? 0 : token.swayAmp;
      if (!rm && effectiveAmp > 0) {
        const swayOffset = Math.sin(age * token.swayFreq * 2 * Math.PI) * effectiveAmp;
        token.x += swayOffset / 60;
      }
      
      // Check if still on screen
      if (token.y < -50 || token.x < -50 || token.x > canvas.width + 50) {
        return; // Remove off-screen tokens
      }
      
      // Smooth opacity fade in and fade out
      let opacity = 1;
      const fadeInDuration = 0.3; // Gentle fade in
      const fadeOutStart = 0.65; // Start fading earlier for longer transition
      
      if (age < fadeInDuration) {
        // Cubic ease-in for smooth appearance
        const t = age / fadeInDuration;
        opacity = t * t * t;
      } else if (ageProgress > fadeOutStart) {
        // Long, gentle fade out
        const fadeProgress = (ageProgress - fadeOutStart) / (1 - fadeOutStart);
        opacity = Math.pow(1 - fadeProgress, 3); // Cubic ease-out
      }
      
      // Draw token with minimal effects
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
      ctx.fillStyle = rpText;
      ctx.font = `18px ${typingFont}`;
      ctx.fillText(token.text, token.x, token.y);
      ctx.restore();
      
      updatedTokens.push(token);
    });

    tokensRef.current = updatedTokens;

    // Emit stats every second
    if (now - lastStatsEmitRef.current >= 1000) {
      const elapsedTime = (now - stats.startTime) / 1000;
      const minutes = elapsedTime > 0 ? (elapsedTime / 60) : 0;
      const wpm = minutes > 0 ? Math.round(((stats.chars / 5) || 0) / minutes) : 0;
      const payload = { words: stats.words, chars: stats.chars, time: Math.floor(elapsedTime), wpm };
      // Optional callback
      if (onStats) onStats(payload);
      // Dispatch global event for StatsBar and others
      window.dispatchEvent(new CustomEvent('zenStats', { detail: payload }));
      // Session markers
      const s = getSettingsSnapshot();
      const every = Math.max(1, s.markersEveryMin || 2) * 60;
      const lastMarker = markersRef.current[markersRef.current.length - 1] ?? 0;
      if (Math.floor(elapsedTime) > 0 && Math.floor(elapsedTime) % every === 0 && lastMarker !== Math.floor(elapsedTime)) {
        markersRef.current.push(Math.floor(elapsedTime));
        window.dispatchEvent(new CustomEvent('markersUpdated', { detail: markersRef.current.slice() }));
      }
      lastStatsEmitRef.current = now;
    }

    // Breathing overlay (expanding ring)
    if (sNow.breath && !rm && !perfMode) {
      const period = 8000; // 8s full cycle
      const t = (now % period) / period; // 0..1
      // sin wave 0..1
      const scale = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
      const radius = Math.min(canvas.width, canvas.height) * (0.15 + 0.1 * scale);
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = rpText;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height * 0.6, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Clamp token cap under explicit performance mode, else dynamic guard
    if (perfMode) {
      if (dynCapRef.current > 80) dynCapRef.current = 80;
    } else if (!perfGuardRef.current) {
      dynCapRef.current = maxTokens;
    }

    // Performance guard: monitor FPS and react
    const frames = frameTimesRef.current;
    const nowMs = performance.now();
    frames.push(nowMs);
    // Keep last ~2s (120 frames)
    if (frames.length > 120) frames.shift();
    if (frames.length > 30) {
      // Approx average FPS
      const first = frames[0] ?? nowMs;
      const last = frames[frames.length - 1] ?? nowMs;
      const totalDt = last - first;
      const avgFps = (frames.length - 1) * 1000 / Math.max(1, totalDt);
      if (avgFps < 55 && !perfGuardRef.current) {
        perfGuardRef.current = true;
        dynCapRef.current = 80; // guardrail cap
        trimAmbientParticles();
      } else if (avgFps > 57 && perfGuardRef.current) {
        perfGuardRef.current = false;
        dynCapRef.current = maxTokens;
      }
    }

    // Continue animation if document is visible
    if (!document.hidden) {
      // Blit back buffer to front if using offscreen/double buffer
      if (backCtxRef.current && backCanvasRef.current) {
        frontCtx.clearRect(0, 0, canvas.width, canvas.height);
        // @ts-ignore drawImage supports OffscreenCanvas in modern browsers
        frontCtx.drawImage(backCanvasRef.current as any, 0, 0);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [stats, fontFamily, rm, onStats, maxTokens, computeStyleCache, trimAmbientParticles]);

  // Start/stop animation based on document visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else if (document.hidden && animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  // Handle canvas resize
  useEffect(() => {
    const regenerateThemeParticles = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      computeStyleCache();

      // Configure back buffer
      try {
        // Recreate if size changed
        if ('OffscreenCanvas' in window) {
          backCanvasRef.current = new (window as any).OffscreenCanvas(globalThis.innerWidth, globalThis.innerHeight);
          backCtxRef.current = (backCanvasRef.current as OffscreenCanvas).getContext('2d');
        } else {
          const buf = document.createElement('canvas');
          buf.width = globalThis.innerWidth; buf.height = globalThis.innerHeight;
          backCanvasRef.current = buf;
          backCtxRef.current = buf.getContext('2d');
        }
      } catch {
        backCanvasRef.current = null;
        backCtxRef.current = null;
      }

      const ctx = (backCtxRef.current as any) || canvas.getContext('2d');

      // Regenerate particles for theme changes
      const isCosmic = document.documentElement.classList.contains('theme-cosmic');
      const perfMode = !!getSettingsSnapshot().performanceMode;
      
      // Reset all theme particles
      starsRef.current = [];
      leavesRef.current = [];
      firefliesRef.current = [];
      
      if (isCosmic && !perfMode) {
        computeStyleCache();
        const paletteSource = styleCacheRef.current ?? FALLBACK_STYLE_CACHE;
        const palette: string[] = [
          paletteSource.rpText,
          paletteSource.rpFoam,
          paletteSource.rpGold,
          paletteSource.rpIris,
        ];
        const paletteSize = palette.length;
        const fallbackColor = paletteSource.rpText;
        const area = window.innerWidth * window.innerHeight;
        const count = Math.min(220, Math.max(60, Math.floor(area / 14000)));
        const stars: Star[] = [];
        for (let i = 0; i < count; i++) {
          const colorIndex = paletteSize > 0 ? Math.floor(Math.random() * paletteSize) : 0;
          const color = palette[colorIndex] ?? fallbackColor;
          const radius = 0.6 + Math.random() * 1.8;
          const baseAlpha = 0.25 + Math.random() * 0.55;
          const amp = 0.25 + Math.random() * 0.4;
          stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: radius,
            a: baseAlpha,
            color,
            twinkle: Math.random() * Math.PI * 2,
            speed: 0.008 + Math.random() * 0.02,
            amp,
          });
        }
        starsRef.current = stars;
      }

      driftRef.current = [];

      // Clear canvas to avoid ghosting old theme artifacts
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = globalThis.innerWidth;
      canvas.height = globalThis.innerHeight;

      regenerateThemeParticles();
    };

    handleResize();
    const updateFont = () => {
      computeStyleCache();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('themeChanged', regenerateThemeParticles as EventListener);
    window.addEventListener('fontChanged', updateFont);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('themeChanged', regenerateThemeParticles as EventListener);
      window.removeEventListener('fontChanged', updateFont);
    };
  }, [computeStyleCache]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      />
      
      {storageWarning && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 max-w-md px-4 py-3 
                     bg-love/20 border border-love/40 rounded-lg text-love text-sm
                     shadow-lg backdrop-blur-sm"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">{storageWarning}</p>
            </div>
            <button
              onClick={() => setStorageWarning(null)}
              className="flex-shrink-0 text-love/70 hover:text-love transition-colors"
              aria-label="Dismiss warning"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <input
        ref={inputRef}
        type="text"
        className="absolute bottom-[18vh] left-1/2 -translate-x-1/2 
                   w-[90vw] max-w-xl px-6 py-4 text-lg font-mono caret-accent
                   bg-surface/70 backdrop-blur-soft shadow-soft
                   border border-iris/25 rounded-2xl
                   text-text placeholder-muted tracking-wide
                   focus:outline-none focus:ring-2 focus:ring-iris/40 focus:border-iris/40
                   transition-all duration-200"
        placeholder="Type freely..."
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
      />
    </div>
  );
};

export default ZenCanvas;
