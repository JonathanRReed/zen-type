import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSettings, saveSettings, type Settings, createArchiveEntry, updateArchiveEntry } from '../utils/storage';

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
interface Bubble { x: number; y: number; vy: number; r: number; a: number; wobble: number; }
interface DriftSpeck { x: number; y: number; baseX: number; vy: number; amp: number; phase: number; alpha: number; radius: number; }
interface Firefly { baseX: number; baseY: number; ampX: number; ampY: number; phase: number; speed: number; radius: number; alpha: number; color: string; }

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
  const [rm, setRm] = useState<boolean>(reducedMotion);
  const starsRef = useRef<Star[]>([]);
  const leavesRef = useRef<Leaf[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const driftRef = useRef<DriftSpeck[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const lastLeafSpawnRef = useRef<number>(0);
  const lastBubbleSpawnRef = useRef<number>(0);
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
  // Markers
  const markersRef = useRef<number[]>([]);
  const lastCharRef = useRef<string>('');
  const lastTypeTsRef = useRef<number>(0);

  // Initialize reduced-motion from settings and media query
  useEffect(() => {
    try {
      const settings = getSettings();
      settingsRef.current = settings;
      const media = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setRm(reducedMotion || settings.reducedMotion || media);
    } catch {
      setRm(reducedMotion);
    }
  }, [reducedMotion]);

  // Archive persistence: create entry on first user input after mount, autosave periodically, finalize on unmount or event
  useEffect(() => {
    const persist = () => {
      if (!archiveIdRef.current || !archiveDirtyRef.current) return;
      const text = transcriptRef.current;
      const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      try {
        updateArchiveEntry(archiveIdRef.current, { text, wordCount: words, charCount: chars });
        archiveDirtyRef.current = false;
      } catch {}
    };
    archiveTimerRef.current = window.setInterval(persist, 3000);

    const finalize = () => {
      const id = archiveIdRef.current;
      if (!id) return;
      const text = transcriptRef.current;
      const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      try {
        updateArchiveEntry(id, { text, wordCount: words, charCount: chars, endedAt: new Date().toISOString() });
      } catch {}
    };
    const onFinalize = () => finalize();
    window.addEventListener('finalizeArchive', onFinalize as EventListener);

    return () => {
      if (archiveTimerRef.current) {
        clearInterval(archiveTimerRef.current);
        archiveTimerRef.current = null;
      }
      window.removeEventListener('finalizeArchive', onFinalize as EventListener);
      finalize();
    };
  }, []);

  // Respond to settings changes and hotkey toggles
  useEffect(() => {
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent).detail as Settings;
      settingsRef.current = s;
    };
    const onToggleBreath = () => {
      const s = settingsRef.current ?? getSettings();
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
  }, []);

  // Commit a word using spawn density controls and update transcript/ghost
  const commitWord = (word: string, delimiter: string) => {
    const s = settingsRef.current ?? getSettings();
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
    archiveDirtyRef.current = true;
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
      }
    }

    // Append to transcript and ghost log for typed characters
    if (value.length > currentWord.length) {
      const ch = value[value.length - 1] ?? '';
      // Debounce duplicate keystrokes
      const s = settingsRef.current ?? getSettings();
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
    if (lastChar === ' ' || /[.,!?;:]/.test(lastChar)) {
      if (currentWord.length > 0) {
        commitWord(currentWord, lastChar || ' ');
        setStats(prev => ({
          words: prev.words + 1,
          chars: prev.chars + currentWord.length,
          startTime: prev.startTime
        }));
      }
      setCurrentWord('');
      e.target.value = '';
      archiveDirtyRef.current = true;
    } else {
      setCurrentWord(value);
      archiveDirtyRef.current = true;
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
      archiveDirtyRef.current = true;
    }
    if (e.key === 'Backspace') {
      // Record deletion in transcript by removing last char, but do not push deletion char into ghost log
      transcriptRef.current = transcriptRef.current.slice(0, -1);
      archiveDirtyRef.current = true;
    }
  };

  // Spawn a new token
  const spawnToken = (text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wordLength = text.length;
    const s = settingsRef.current ?? getSettings();
    const baseFade = rm ? Math.max(1.8, (s.fadeSec ?? 4) * 0.6) : (s.fadeSec ?? 4);
    const lifetime = baseFade + (wordLength * 0.3);
    const amp = rm ? 0 : (s.driftAmp ?? 6);

    // Focus lanes
    let x = Math.random() * canvas.width;
    const laneStyle = s.laneStyle ?? 'soft';
    if (laneStyle !== 'none') {
      const lanes = [canvas.width * 0.25, canvas.width * 0.5, canvas.width * 0.75];
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      const jitter = laneStyle === 'tight' ? 18 : 40;
      x = lane + (Math.random() * 2 - 1) * jitter;
    }
    
    const newToken: Token = {
      id: tokenIdRef.current++,
      text,
      x,
      y: canvas.height - 100,
      vy: 20 + Math.random() * 25, // 20-45 px/s
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
    const canvas = canvasRef.current;
    const frontCtx = canvas?.getContext('2d');
    if (!canvas || !frontCtx) return;
    const ctx = (backCtxRef.current as any) || frontCtx;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Resolve Rosé Pine text color and typing font from CSS variables each frame (cheap)
    const css = getComputedStyle(document.documentElement);
    const rpText = (css.getPropertyValue('--rp-text') || '#e0def4').trim();
    const moss = (css.getPropertyValue('--moss') || '#7fbf9e').trim();
    const leafCol = (css.getPropertyValue('--leaf') || '#a3d9b1').trim();
    const typingFont = (css.getPropertyValue('--typing-font') || fontFamily).trim() || fontFamily;
    const isCosmic = document.documentElement.classList.contains('theme-cosmic');
    const sNow = settingsRef.current ?? getSettings();
    const perfMode = !!sNow.performanceMode;

    const isForest = document.documentElement.classList.contains('theme-forest');
    const isOcean = document.documentElement.classList.contains('theme-ocean');
    
    // Forest theme: Subtle leaf drift (<5 leaves)
    if (isForest && !perfMode && !rm) {
      const now = Date.now();
      // Spawn new leaf every 12-18 seconds, keep ≤5
      if (now - lastLeafSpawnRef.current > (12000 + Math.random() * 6000) && leavesRef.current.length < 5) {
        const size = 10 + Math.random() * 8; // 10–18 px
        leavesRef.current.push({
          x: Math.random() * canvas.width,
          y: -size,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (6 + Math.random() * 6) / 60, // 6–12 px/s
          size,
          a: 0.12 + Math.random() * 0.06,
          age: 0,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() * 0.1 - 0.05) / 60 // slow rotation rad/frame
        });
        lastLeafSpawnRef.current = now;
      }
      
      // Update and draw leaves
      ctx.save();
      const updatedLeaves: Leaf[] = [];
      for (const leaf of leavesRef.current) {
        leaf.age += 1/60;
        leaf.rot += leaf.rotSpeed;
        leaf.x += leaf.vx + Math.sin(leaf.age * 2) * 0.3;
        leaf.y += leaf.vy;
        
        if (leaf.y < canvas.height + leaf.size && leaf.age < 30) {
          // Draw leaf shape
          ctx.globalAlpha = leaf.a * Math.max(0, 1 - leaf.age / 30);
          ctx.fillStyle = leaf.age < 15 ? moss : leafCol;
          ctx.beginPath();
          ctx.ellipse(leaf.x, leaf.y, leaf.size * 0.5, leaf.size * 0.36, leaf.rot, 0, Math.PI * 2);
          ctx.fill();
          updatedLeaves.push(leaf);
        }
      }
      leavesRef.current = updatedLeaves;
      ctx.restore();

      // Fireflies – soft golden pulses
      const rpGold = (css.getPropertyValue('--rp-gold') || '#f6c177').trim();
      const rpLove = (css.getPropertyValue('--rp-love') || '#eb6f92').trim();
      const rpFoam = (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim();
      const fireflyPalette = [rpGold, rpLove, rpFoam];
      const canopyTop = canvas.height * 0.2;
      const canopyBottom = canvas.height * 0.85;
      const targetFireflies = 14;
      while (firefliesRef.current.length < targetFireflies) {
        const color = fireflyPalette[Math.floor(Math.random() * fireflyPalette.length)];
        firefliesRef.current.push({
          baseX: Math.random() * canvas.width,
          baseY: canopyBottom - Math.random() * (canopyBottom - canopyTop),
          ampX: 18 + Math.random() * 26,
          ampY: 10 + Math.random() * 16,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0009 + Math.random() * 0.0005,
          radius: 1.1 + Math.random() * 1.4,
          alpha: 0.18 + Math.random() * 0.1,
          color,
        });
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const updatedFireflies: Firefly[] = [];
      for (const firefly of firefliesRef.current) {
        firefly.phase += firefly.speed;
        firefly.baseY -= 0.03;
        if (firefly.baseY < canopyTop) {
          firefly.baseY = canopyBottom + Math.random() * 40;
          firefly.baseX = Math.random() * canvas.width;
        }
        firefly.baseX += (Math.random() - 0.5) * 0.2;
        if (firefly.baseX < -20) firefly.baseX = canvas.width + 20;
        if (firefly.baseX > canvas.width + 20) firefly.baseX = -20;

        const x = firefly.baseX + Math.sin(firefly.phase * 3) * firefly.ampX;
        const y = firefly.baseY + Math.cos(firefly.phase * 2) * firefly.ampY;
        const pulse = 0.6 + 0.4 * Math.sin(firefly.phase * 4);
        ctx.globalAlpha = firefly.alpha * pulse;
        ctx.fillStyle = firefly.color;
        ctx.beginPath();
        ctx.arc(x, y, firefly.radius, 0, Math.PI * 2);
        ctx.fill();

        updatedFireflies.push(firefly);
      }
      firefliesRef.current = updatedFireflies;
      ctx.restore();
    }
    
    // Ocean theme: Occasional bubble drift
    if (isOcean && !perfMode && !rm) {
      const now = Date.now();
      // Spawn new bubble every 2-4 seconds, keep ≤12
      if (now - lastBubbleSpawnRef.current > (2000 + Math.random() * 2000) && bubblesRef.current.length < 12) {
        bubblesRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + 10,
          vy: -(6 + Math.random() * 8) / 60, // 6–14 px/s upward
          r: 2 + Math.random() * 3,
          a: 0.05 + Math.random() * 0.05,
          wobble: Math.random() * Math.PI * 2
        });
        lastBubbleSpawnRef.current = now;
      }
      
      // Update and draw bubbles
      ctx.save();
      const updatedBubbles: Bubble[] = [];
      for (const bubble of bubblesRef.current) {
        bubble.wobble += 0.05;
        bubble.x += Math.sin(bubble.wobble) * 0.4;
        bubble.y += bubble.vy;
        
        if (bubble.y > -10) {
          ctx.globalAlpha = bubble.a;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
          ctx.stroke();
          updatedBubbles.push(bubble);
        }
      }
      bubblesRef.current = updatedBubbles;
      ctx.restore();

      // Gentle volumetric light gradient
      ctx.save();
      const foam = (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim();
      const pine = (css.getPropertyValue('--rp-pine') || '#31748f').trim();
      const surface = (css.getPropertyValue('--rp-surface') || '#1f1d2e').trim();
      const t = performance.now() * 0.000015;
      const highlightShift = 0.08 + 0.04 * Math.sin(t * 0.9);
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, hexToRgba(foam, 0.22 + highlightShift * 0.3));
      grad.addColorStop(0.45, hexToRgba(pine, 0.18 + highlightShift * 0.25));
      grad.addColorStop(1, hexToRgba(surface, 0.06));
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Drifting plankton specks
      const targetSpecks = rm ? 10 : 18;
      while (driftRef.current.length < targetSpecks) {
        driftRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseX: Math.random() * canvas.width,
          vy: -((2 + Math.random() * 5) / 900),
          amp: 6 + Math.random() * 10,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.035 + Math.random() * 0.06,
          radius: 0.7 + Math.random() * 1.1,
        });
      }

      ctx.save();
      const updatedSpecks: DriftSpeck[] = [];
      const driftTime = performance.now() * 0.0001;
      for (const speck of driftRef.current) {
        speck.phase += 0.0009;
        const sway = Math.sin(driftTime + speck.phase) * speck.amp;
        const nextX = speck.baseX + sway;
        const nextY = speck.y + speck.vy * canvas.height;
        if (nextY < -20) {
          speck.y = canvas.height + 10;
          speck.baseX = Math.random() * canvas.width;
          speck.phase = Math.random() * Math.PI * 2;
          speck.alpha = 0.035 + Math.random() * 0.06;
          speck.radius = 0.7 + Math.random() * 1.1;
        } else {
          speck.y = nextY;
        }

        ctx.globalAlpha = speck.alpha;
        ctx.fillStyle = foam;
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
      
      // Update position
      token.y -= (token.vy / 60); // Assuming 60fps
      
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
      
      // Calculate opacity (fade out over effective lifetime)
      const opacity = Math.max(0, 1 - (age / threshold));
      
      // Draw token
      ctx.save();
      ctx.globalAlpha = opacity;
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
      const s = settingsRef.current ?? getSettings();
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
    const _prevMs = frames.length ? frames[frames.length - 1] : nowMs;
    frames.push(nowMs);
    // Keep last ~2s (120 frames)
    if (frames.length > 120) frames.shift();
    if (frames.length > 30) {
      // Approx average FPS
      const totalDt = frames[frames.length - 1] - frames[0];
      const avgFps = (frames.length - 1) * 1000 / Math.max(1, totalDt);
      if (avgFps < 55 && !perfGuardRef.current) {
        perfGuardRef.current = true;
        dynCapRef.current = 80; // guardrail cap
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
  }, [stats, fontFamily, rm, onStats, maxTokens]);

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
      const perfMode = !!(settingsRef.current ?? getSettings()).performanceMode;
      
      // Reset all theme particles
      starsRef.current = [];
      leavesRef.current = [];
      bubblesRef.current = [];
      firefliesRef.current = [];
      
      if (isCosmic && !perfMode) {
        const css = getComputedStyle(document.documentElement);
        const palette = [
          (css.getPropertyValue('--rp-text') || '#e0def4').trim(),
          (css.getPropertyValue('--rp-foam') || '#9ccfd8').trim(),
          (css.getPropertyValue('--rp-gold') || '#f6c177').trim(),
          (css.getPropertyValue('--rp-iris') || '#c4a7e7').trim(),
        ];
        const area = window.innerWidth * window.innerHeight;
        const count = Math.min(220, Math.max(60, Math.floor(area / 14000)));
        const stars: Star[] = [];
        for (let i = 0; i < count; i++) {
          const color = palette[Math.floor(Math.random() * palette.length)];
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
      const css = getComputedStyle(document.documentElement);
      const typingFontVar = css.getPropertyValue('--typing-font');
      if (typingFontVar) {
        document.documentElement.style.setProperty('--typing-font', typingFontVar);
      }
      const uiFontVar = css.getPropertyValue('--ui-font');
      if (uiFontVar) {
        document.documentElement.style.setProperty('--ui-font', uiFontVar);
      }
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
  }, []);

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
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
};

export default ZenCanvas;
