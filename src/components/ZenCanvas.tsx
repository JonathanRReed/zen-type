import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  type Settings,
  getStoragePersistenceErrorEvent,
  type StorageFailureDetail,
} from '../utils/storage';
import { useMotionPreference } from '../hooks/useMotionPreference';
import {
  setActiveDraftId,
  createDraft,
  updateDraftBody,
  getDraft,
} from '../lib/draftStore';
import { audioEngine } from '../utils/audioEngine';
import {
  type Star,
  type Leaf,
  type DriftSpeck,
  type Firefly,
  type SakuraPetal,
  type EmberSpark,
  type Snowflake,
  type KeystrokeBurstParticle,
} from '../hooks/useZenParticles';

interface Token {
  id: number;
  text: string;
  x: number;
  y: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  lifetime: number;
  maxLifetime: number;
  birth: number;
}

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

const hexCache = new Map<string, string>();
const hexToRgba = (hex: string, alpha: number) => {
  const key = `${hex.trim()}|${alpha}`;
  const cached = hexCache.get(key);
  if (cached !== undefined) return cached;
  const normalized = hex.trim().replace(/^#/, '');
  const isShort = normalized.length === 3;
  const value = isShort
    ? normalized.split('').map(ch => ch + ch).join('')
    : normalized.padEnd(6, '0');
  const num = parseInt(value.slice(0, 6), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const result = `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
  hexCache.set(key, result);
  if (hexCache.size > 256) {
    const firstKey = hexCache.keys().next().value;
    if (firstKey !== undefined) hexCache.delete(firstKey);
  }
  return result;
};

interface ZenCanvasProps {
  fontFamily?: string;
  maxTokens?: number;
  onStats?: (stats: { words: number; chars: number; time: number; wpm: number }) => void;
}

const ZenCanvas: React.FC<ZenCanvasProps> = ({
  fontFamily = 'monospace',
  maxTokens = 160,
  onStats,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokensRef = useRef<Token[]>([]);
  const [inputValue, setInputValue] = useState('');
  // Brief "active typing" flag that drives the input's commit-ripple animation.
  const [isCommitting, setIsCommitting] = useState(false);
  const commitPulseTimerRef = useRef<number | null>(null);
  const [stats, setStats] = useState(() => ({ words: 0, chars: 0, startTime: Date.now() }));
  const animationFrameRef = useRef<number | null>(null);
  const tokenIdRef = useRef(0);
  const lastStatsEmitRef = useRef<number>(0);
  // Live motion preference: settings toggle OR OS prefers-reduced-motion.
  // (A previous revision forced this to the `reducedMotion` prop, which no
  // page ever passed, so every `rm` branch below was dead and Reduced Motion
  // users still got full particle motion.)
  const { reducedMotion: rm } = useMotionPreference();
  const starsRef = useRef<Star[]>([]);
  const leavesRef = useRef<Leaf[]>([]);
  const driftRef = useRef<DriftSpeck[]>([]);
  const firefliesRef = useRef<Firefly[]>([]);
  const sakuraRef = useRef<SakuraPetal[]>([]);
  const embersRef = useRef<EmberSpark[]>([]);
  const snowflakesRef = useRef<Snowflake[]>([]);
  const auroraPhaseRef = useRef<number>(0);
  const burstsRef = useRef<KeystrokeBurstParticle[]>([]);
  const lastLeafSpawnRef = useRef<number>(0);
  const [flowSecondsLeft, setFlowSecondsLeft] = useState<number | null>(null);
  const [flowCompleted, setFlowCompleted] = useState<boolean>(false);
  const [flowMinutes, setFlowMinutes] = useState<number>(() => {
    try {
      return getSettings().timedFlowMinutes ?? 0;
    } catch {
      return 0;
    }
  });
  // Backing store is 1x CSS pixels by explicit trade-off, not oversight:
  // the layer is soft ambient glow (never crisp text), and 1x keeps the
  // per-frame fill cost flat on weak GPUs. dprRef exists so spawn math can
  // stay resolution-agnostic if that ever changes.
  const dprRef = useRef<number>(1);
  // Settings live snapshot
  const settingsRef = useRef<Settings | null>(null);
  // Dynamic token cap under performance guard
  const dynCapRef = useRef<number>(maxTokens);
  // FPS buffer for performance guard
  const frameTimesRef = useRef<number[]>([]);
  const perfGuardRef = useRef<boolean>(false);
  // Session timing
  const sessionStartRef = useRef<number>(0);
  useEffect(() => {
    lastStatsEmitRef.current = Date.now();
    sessionStartRef.current = Date.now();
  }, []);
  // Ghost buffer (event log of appended chars within rolling window)
  const ghostLogRef = useRef<{ t: number; ch: string }[]>([]);
  const transcriptRef = useRef<string>('');
  const activeDraftIdRef = useRef<string | null>(null);
  const draftInitPromiseRef = useRef<Promise<void> | null>(null);
  const draftDirtyRef = useRef<boolean>(false);
  // Animation loop ref to break circular dependency
  const animateRef = useRef<(() => void) | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const styleCacheRef = useRef<StyleCache | null>(null);
  // Markers
  const markersRef = useRef<number[]>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const statsRef = useRef(stats);
  const themeRef = useRef({
    isCosmic: false,
    isForest: false,
    isOcean: false,
    isSakura: false,
    isEmber: false,
    isAurora: false,
    isGlacier: false,
    isVoid: true,
    name: 'void',
  });

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

  const emitBurst = useCallback((x: number, y: number, color?: string) => {
    const perfMode = !!getSettingsSnapshot().performanceMode;
    if (perfMode || perfGuardRef.current) return;
    const burstColor = color || styleCacheRef.current?.rpIris || '#c4a7e7';
    const count = rm ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.5;
      burstsRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.7,
        r: 1.2 + Math.random() * 1.6,
        color: burstColor,
        alpha: 0.85 + Math.random() * 0.15,
        decay: 0.025 + Math.random() * 0.02,
      });
    }
  }, [rm]);

  // Timed Flow meditation countdown timer
  useEffect(() => {
    const s = getSettingsSnapshot();
    if (!s.timedFlowMinutes || s.timedFlowMinutes <= 0) {
      setFlowSecondsLeft(null);
      return;
    }
    const totalSec = s.timedFlowMinutes * 60;
    setFlowSecondsLeft(totalSec);
    setFlowCompleted(false);

    let remaining = totalSec;
    const interval = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(interval);
        setFlowSecondsLeft(0);
        setFlowCompleted(true);
        audioEngine.playSwitch('raindrop');
      } else {
        setFlowSecondsLeft(remaining);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Escape dismisses the completion modal to Free Flow. A window listener
  // rather than a div handler, so no non-interactive element owns key events;
  // capture phase so the page-level Escape→pause binding never fires behind it.
  useEffect(() => {
    if (!flowCompleted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setFlowCompleted(false);
        setFlowSecondsLeft(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [flowCompleted]);

  const saveDraft = useCallback(() => {
    const id = activeDraftIdRef.current;
    if (!id || !draftDirtyRef.current) return;
    const text = transcriptRef.current;
    updateDraftBody(id, text)
      .then(() => {
        draftDirtyRef.current = false;
      })
      .catch((err) => {
        console.error('[ZenCanvas] Failed to update draft', err);
      });
  }, []);

  const finalizeDraft = useCallback(() => {
    saveDraft();
  }, [saveDraft]);

  const ensureDraftInitialized = useCallback(() => {
    if (activeDraftIdRef.current || draftInitPromiseRef.current) {
      return;
    }

    const now = new Date();
    const title = `Zen Session: ${now.toLocaleString()}`;
    draftInitPromiseRef.current = createDraft(title)
      .then((draft) => {
        activeDraftIdRef.current = draft.id;
        setActiveDraftId(draft.id);
      })
      .catch((err) => {
        console.error('[ZenCanvas] Failed to initialize draft', err);
        activeDraftIdRef.current = null;
      })
      .finally(() => {
        draftInitPromiseRef.current = null;
        if (activeDraftIdRef.current && draftDirtyRef.current) {
          saveDraft();
        }
      });
  }, [saveDraft]);

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
    if (sakuraRef.current.length > 12) {
      sakuraRef.current = sakuraRef.current.slice(-12);
    }
    if (embersRef.current.length > 16) {
      embersRef.current = embersRef.current.slice(-16);
    }
    if (snowflakesRef.current.length > 16) {
      snowflakesRef.current = snowflakesRef.current.slice(-16);
    }
    if (burstsRef.current.length > 40) {
      burstsRef.current = burstsRef.current.slice(-40);
    }
  }, []);

  const scheduleDraftSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (draftSaveTimerRef.current !== null) {
      window.clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = window.setTimeout(() => {
      draftSaveTimerRef.current = null;
      saveDraft();
    }, 1000);
  }, [saveDraft]);

  const markDraftDirty = useCallback(() => {
    draftDirtyRef.current = true;
    scheduleDraftSave();
  }, [scheduleDraftSave]);

  // Pulse the input on each word commit so it feels like a living instrument
  // (drives the .zen-input ripple/breathe animations in globals.css).
  const pulseInput = useCallback(() => {
    if (typeof window === 'undefined') return;
    setIsCommitting(true);
    if (commitPulseTimerRef.current !== null) window.clearTimeout(commitPulseTimerRef.current);
    commitPulseTimerRef.current = window.setTimeout(() => {
      setIsCommitting(false);
      commitPulseTimerRef.current = null;
    }, 700);
  }, []);

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

  useEffect(() => { statsRef.current = stats; }, [stats]);

  useEffect(() => {
    // Prefer the theme NAME carried on the themeChanged event. applyTheme()
    // flips the <html> class inside a View Transition (async), so reading
    // classList synchronously when the event fires returns the PREVIOUS theme —
    // which made the canvas ambience (leaves/bubbles) lag one selection behind.
    const updateTheme = (e?: Event) => {
      const root = document.documentElement;
      const detail = e && (e as CustomEvent).detail;
      const named = typeof detail === 'string' ? detail.toLowerCase() : null;
      const themeName = named
        || ['cosmic', 'forest', 'ocean', 'ember', 'sakura', 'aurora', 'glacier', 'void'].find((n) => root.classList.contains('theme-' + n))
        || 'void';
      themeRef.current = {
        isCosmic: themeName === 'cosmic',
        isForest: themeName === 'forest',
        isOcean: themeName === 'ocean',
        isSakura: themeName === 'sakura',
        isEmber: themeName === 'ember',
        isAurora: themeName === 'aurora',
        isGlacier: themeName === 'glacier',
        isVoid: themeName === 'void',
        name: themeName,
      };
    };
    updateTheme();
    window.addEventListener('themeChanged', updateTheme as EventListener);
    return () => window.removeEventListener('themeChanged', updateTheme as EventListener);
  }, []);

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

  // Initialize or switch active draft
  useEffect(() => {
    const handleDraftChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string | null };
      activeDraftIdRef.current = detail.id;
      if (detail.id) {
        getDraft(detail.id).then(draft => {
          if (draft) {
            transcriptRef.current = draft.body;
          }
        });
      } else {
        transcriptRef.current = '';
      }
    };

    window.addEventListener('activeDraftChanged', handleDraftChange as EventListener);
    
    return () => {
      window.removeEventListener('activeDraftChanged', handleDraftChange as EventListener);
      if (draftSaveTimerRef.current !== null) {
        window.clearTimeout(draftSaveTimerRef.current);
      }
      finalizeDraft();
    };
  }, [finalizeDraft]);

  // Respond to settings changes and hotkey toggles
  useEffect(() => {
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent).detail as Settings;
      settingsRef.current = s;
      const root = document.documentElement;
      // Use the theme from the settings payload (set before the class flips via
      // the View Transition) so the ambience switches immediately, not a step late.
      const named = s && typeof s.theme === 'string' ? s.theme.toLowerCase() : null;
      const themeName = named
        || ['cosmic', 'forest', 'ocean', 'ember', 'sakura', 'aurora', 'glacier', 'void'].find((n) => root.classList.contains('theme-' + n))
        || 'void';
      themeRef.current = {
        isCosmic: themeName === 'cosmic',
        isForest: themeName === 'forest',
        isOcean: themeName === 'ocean',
        isSakura: themeName === 'sakura',
        isEmber: themeName === 'ember',
        isAurora: themeName === 'aurora',
        isGlacier: themeName === 'glacier',
        isVoid: themeName === 'void',
        name: themeName,
      };
      if (typeof s.timedFlowMinutes === 'number') {
        setFlowMinutes(s.timedFlowMinutes);
      }
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
      let text = '';
      for (const ev of ghostLogRef.current) {
        const tms = sessionStartRef.current + ev.t * 1000;
        if (tms >= startMs && tms <= endMs && ev.ch.length > 0) {
          text += ev.ch;
        }
      }
      window.dispatchEvent(new CustomEvent('ghostText', { detail: { text } }));
    };
    const onRestoreGhost = (e: Event) => {
      const { text } = (e as CustomEvent).detail as { text: string };
      setInputValue(text);
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

  // Spawn a new token
  const spawnToken = useCallback((text: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = dprRef.current || 1;
    const width = Math.max(1, canvas.width / dpr || 0);
    const height = Math.max(1, canvas.height / dpr || 0);
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
    
    const tokenId = tokenIdRef.current++;
    const birthTime = Date.now();

    const newToken: Token = {
      id: tokenId,
      text,
      x,
      y: Math.max(0, height - 200),
      vy: Math.min(80, Math.max(30, 45 + Math.random() * 35)),
      swayAmp: amp,
      swayFreq: 0.6 + Math.random() * 0.6,
      swayPhase: Math.random() * Math.PI * 2,
      lifetime,
      maxLifetime: lifetime,
      birth: birthTime
    };

    tokensRef.current.push(newToken);
    
    // Apply cap if needed
    const cap = dynCapRef.current;
    if (tokensRef.current.length > cap) {
      tokensRef.current = tokensRef.current.slice(-cap);
    }
  }, [rm]);

  // Commit a word using spawn density controls and update transcript/ghost
  const commitWord = useCallback((word: string, delimiter: string) => {
    if (!word) return;

    ensureDraftInitialized();

    const s = getSettingsSnapshot();
    const density = Math.max(0.5, Math.min(1.5, s.spawnDensity ?? 1.0));
    
    // Spawn tokens based on density
    if (density < 1) {
      if (Math.random() < density) spawnToken(word);
    } else {
      spawnToken(word);
      const extraBase = Math.floor(density - 1);
      for (let i = 0; i < extraBase; i++) spawnToken(word);
      const frac = density - 1 - extraBase;
      if (Math.random() < frac) spawnToken(word);
    }
    
    pulseInput();

    // Update transcript
    transcriptRef.current += word + delimiter;

    // Record in ghost log
    const now = (Date.now() - sessionStartRef.current) / 1000;
    for (const ch of word) {
      ghostLogRef.current.push({ t: now, ch });
    }
    ghostLogRef.current.push({ t: now, ch: delimiter });
    
    // Keep ghost log within window
    const maxWin = (settingsRef.current?.ghostWindowMin ?? 5) * 60;
    const cutoff = now - maxWin;
    ghostLogRef.current = ghostLogRef.current.filter(ev => ev.t >= cutoff);
    
    markDraftDirty();
  }, [spawnToken, markDraftDirty, ensureDraftInitialized, pulseInput]);

  // Handle input changes with proper controlled input pattern
  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const s = getSettingsSnapshot();
    // Pass the actual character so the engine can pan/pitch per keycap.
    const lastTyped = newValue.length > 0 ? (newValue[newValue.length - 1] ?? '') : '';
    audioEngine.playSwitch(s.switchSound || 'none', lastTyped || undefined);
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = dprRef.current || 1;
      emitBurst(canvas.width / dpr / 2 + (Math.random() - 0.5) * 80, canvas.height / dpr - 110);
    }
    
    // Check if word is complete (ends with space or punctuation)
    const lastChar = newValue[newValue.length - 1];
    const isDelimiter = lastChar === ' ' || /[.,!?;:]/.test(lastChar ?? '');
    
    if (isDelimiter && newValue.length > 1) {
      // Extract the word (everything except the delimiter)
      const word = newValue.slice(0, -1);
      const delimiter = lastChar ?? ' ';

      // Commit the word
      commitWord(word, delimiter);
      
      // Update stats
      setStats(prev => ({
        words: prev.words + 1,
        chars: prev.chars + word.length,
        startTime: prev.startTime
      }));
      
      // Clear input for next word
      setInputValue('');
      markDraftDirty();
    } else {
      // Just update the input value
      setInputValue(newValue);
    }
  }, [commitWord, markDraftDirty, emitBurst]);

  // Handle key down for special keys
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const s = getSettingsSnapshot();
    if (e.key === 'Backspace') {
      audioEngine.playSwitch(s.switchSound || 'none', 'Backspace');
    }
    if (e.key === 'Enter' && inputValue.length > 0) {
      e.preventDefault();
      audioEngine.playSwitch(s.switchSound || 'none', 'Enter');
      commitWord(inputValue, '\n');
      setStats(prev => ({
        words: prev.words + 1,
        chars: prev.chars + inputValue.length,
        startTime: prev.startTime
      }));
      setInputValue('');
      markDraftDirty();
    }
    
    if (e.key === 'Backspace' && inputValue.length === 0 && transcriptRef.current.length > 0) {
      // If input is empty and backspace is pressed, remove from transcript
      transcriptRef.current = transcriptRef.current.slice(0, -1);
      markDraftDirty();
    }
  }, [inputValue, commitWord, markDraftDirty]);

  // Animation loop
  const animate = useCallback(() => {
    if (typeof document !== 'undefined' && document.hidden) {
      frameTimesRef.current = [];
      animationFrameRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Render straight into the visible canvas. (An earlier revision drew
    // into an offscreen back buffer and blitted it every frame — a full-screen
    // copy that doubled GPU cost for no visual gain.)
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';

    const styleCache = styleCacheRef.current ?? { ...FALLBACK_STYLE_CACHE, typingFont: fontFamily };
    const { rpText, moss, leaf: leafColor, typingFont, rpFoam, rpGold, rpLove, rpIris } = styleCache;
    const { isCosmic, isForest, isOcean, isSakura, isEmber, isAurora, isGlacier, name: themeName } = themeRef.current;
    const sNow = getSettingsSnapshot();
    const perfMode = !!sNow.performanceMode;
    // Token typeface is frame-global (it only changes with settings), so set
    // it once instead of per token.
    ctx.font = `18px ${typingFont}`;
    
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
      
      /* eslint-disable react-hooks/immutability */
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
      /* eslint-enable react-hooks/immutability */

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

      /* eslint-disable react-hooks/immutability */
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
      /* eslint-enable react-hooks/immutability */
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

      /* eslint-disable react-hooks/immutability */
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
      /* eslint-enable react-hooks/immutability */
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

    // Sakura theme: Falling fluttering cherry blossom petals
    if (isSakura && !perfMode) {
      const reduced = rm;
      const targetPetals = perfGuardRef.current ? 12 : (reduced ? 14 : 26);
      const palette = [hexToRgba(rpLove, 0.75), hexToRgba('#f2a9c3', 0.8), hexToRgba(rpGold, 0.6)];
      while (sakuraRef.current.length < targetPetals) {
        sakuraRef.current.push({
          x: Math.random() * (canvas.width + 100) - 50,
          y: Math.random() * -canvas.height * 0.4,
          vx: -(0.4 + Math.random() * 0.6),
          vy: 0.6 + Math.random() * 0.7,
          size: 4 + Math.random() * 4,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: 0.01 + Math.random() * 0.02,
          flip: Math.random() * Math.PI * 2,
          flipSpeed: 0.02 + Math.random() * 0.03,
          color: palette[Math.floor(Math.random() * palette.length)]!,
          alpha: 0.4 + Math.random() * 0.4,
          age: 0,
        });
      }
      ctx.save();
      const updatedPetals: SakuraPetal[] = [];
      /* eslint-disable react-hooks/immutability */
      for (const p of sakuraRef.current) {
        p.age += 1 / 60;
        p.rot += p.rotSpeed;
        p.flip += p.flipSpeed;
        p.x += p.vx + Math.sin(p.age * 1.5) * 0.8;
        p.y += p.vy;
        if (p.y < canvas.height + 20 && p.x > -50) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(Math.cos(p.flip), 1);
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.5, p.size, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          updatedPetals.push(p);
        }
      }
      /* eslint-enable react-hooks/immutability */
      sakuraRef.current = updatedPetals;
      ctx.restore();
    }

    // Ember theme: Rising glowing heat embers with turbulence
    if (isEmber && !perfMode) {
      const reduced = rm;
      const targetEmbers = perfGuardRef.current ? 16 : (reduced ? 18 : 34);
      const emberPalette = [hexToRgba(rpGold, 0.9), hexToRgba(rpLove, 0.85), hexToRgba('#ff8844', 0.8)];
      while (embersRef.current.length < targetEmbers) {
        embersRef.current.push({
          x: Math.random() * canvas.width,
          y: canvas.height + Math.random() * 25,
          vx: (Math.random() - 0.5) * 0.6,
          vy: 0.8 + Math.random() * 1.3,
          size: 1.2 + Math.random() * 2.2,
          heat: 1.0,
          decay: 0.003 + Math.random() * 0.005,
          color: emberPalette[Math.floor(Math.random() * emberPalette.length)]!,
          phase: Math.random() * Math.PI * 2,
        });
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const updatedEmbers: EmberSpark[] = [];
      /* eslint-disable react-hooks/immutability */
      for (const e of embersRef.current) {
        e.phase += 0.03;
        e.x += e.vx + Math.sin(e.phase) * 0.7;
        e.y -= e.vy;
        e.heat -= e.decay;
        if (e.heat > 0 && e.y > -20) {
          ctx.globalAlpha = e.heat * 0.8;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * (0.6 + e.heat * 0.4), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = e.heat * 0.25;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
          updatedEmbers.push(e);
        }
      }
      /* eslint-enable react-hooks/immutability */
      embersRef.current = updatedEmbers;
      ctx.restore();
    }

    // Aurora theme: Ethereal undulating northern light ribbon curtains
    if (isAurora && !perfMode) {
      auroraPhaseRef.current += rm ? 0.004 : 0.009;
      const phase = auroraPhaseRef.current;
      const auroraColors = [
        hexToRgba(rpFoam, 0.12),
        hexToRgba(rpIris, 0.14),
        hexToRgba(moss, 0.12),
      ];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Wave sampler shared by all bands (kept outside the loop: a closure
      // over the loop counter breaks React Compiler memoization).
      const waveY = (x: number, base: number, ph: number, band: number) =>
        base + Math.sin(x * 0.003 + ph + band * 1.2) * 28 + Math.cos(x * 0.006 + ph * 0.8) * 16;
      for (let b = 0; b < auroraColors.length; b++) {
        const bandColor = auroraColors[b]!;
        const baseHeight = canvas.height * (0.12 + b * 0.08);
        const waveHeight = canvas.height * 0.25;
        const grad = ctx.createLinearGradient(0, baseHeight - 40, 0, baseHeight + waveHeight);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, bandColor);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        // Smooth ribbon top edge: sample the wave, then trace it with
        // midpoint quadratics so the silhouette is a continuous curve.
        // (Straight lineTo segments every 30px left a visibly jagged,
        // hard edge along what should read as soft light.)
        ctx.beginPath();
        const step = 36;
        let prevX = -step;
        let prevY = waveY(prevX, baseHeight, phase, b);
        ctx.moveTo(prevX, prevY);
        for (let x = 0; x <= canvas.width + step; x += step) {
          const y = waveY(x, baseHeight, phase, b);
          ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2);
          prevX = x;
          prevY = y;
        }
        ctx.lineTo(canvas.width, baseHeight + waveHeight);
        ctx.lineTo(0, baseHeight + waveHeight);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Glacier theme: Crystallized drifting snowflakes and ice needles
    if (isGlacier && !perfMode) {
      const reduced = rm;
      const targetSnow = perfGuardRef.current ? 16 : (reduced ? 18 : 32);
      while (snowflakesRef.current.length < targetSnow) {
        snowflakesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * -canvas.height * 0.3,
          vy: 0.4 + Math.random() * 0.8,
          size: 1.5 + Math.random() * 2.5,
          driftAmp: 0.6 + Math.random() * 1.2,
          phase: Math.random() * Math.PI * 2,
          alpha: 0.3 + Math.random() * 0.45,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
      ctx.save();
      const updatedSnow: Snowflake[] = [];
      /* eslint-disable react-hooks/immutability */
      for (const s of snowflakesRef.current) {
        s.phase += 0.02;
        s.twinkle += 0.04;
        s.x += Math.sin(s.phase) * s.driftAmp;
        s.y += s.vy;
        if (s.y < canvas.height + 15) {
          const shimmer = 0.7 + 0.3 * Math.sin(s.twinkle);
          ctx.globalAlpha = s.alpha * shimmer;
          ctx.fillStyle = hexToRgba(rpText, 0.85);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
          if (s.size > 2.8) {
            ctx.strokeStyle = hexToRgba(rpFoam, 0.6);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(s.x - s.size * 1.5, s.y);
            ctx.lineTo(s.x + s.size * 1.5, s.y);
            ctx.moveTo(s.x, s.y - s.size * 1.5);
            ctx.lineTo(s.x, s.y + s.size * 1.5);
            ctx.stroke();
          }
          updatedSnow.push(s);
        }
      }
      snowflakesRef.current = updatedSnow;
      /* eslint-enable react-hooks/immutability */
      ctx.restore();
    }

    // Keystroke burst particles (tactile reactive typing feedback)
    if (burstsRef.current.length > 0) {
      /* eslint-disable react-hooks/immutability */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const updatedBursts: KeystrokeBurstParticle[] = [];
      for (const b of burstsRef.current) {
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.04; // subtle gravity
        b.alpha -= b.decay;
        if (b.alpha > 0.01) {
          ctx.globalAlpha = Math.max(0, b.alpha);
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          updatedBursts.push(b);
        }
      }
      burstsRef.current = updatedBursts;
      ctx.restore();
      /* eslint-enable react-hooks/immutability */
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
      
      // Add horizontal sway if not reduced motion. Two layered sines with a
      // per-token phase keep tokens from oscillating in mechanical unison.
      const effectiveAmp = (perfGuardRef.current || perfMode) ? 0 : token.swayAmp;
      if (!rm && effectiveAmp > 0) {
        const primary = Math.sin(age * token.swayFreq * 2 * Math.PI + token.swayPhase) * effectiveAmp;
        const secondary = Math.sin(age * token.swayFreq * 0.55 * Math.PI + token.swayPhase * 1.7) * effectiveAmp * 0.4;
        token.x += (primary + secondary) / 60;
      }

      // Check if still on screen
      if (token.y < -50 || token.x < -50 || token.x > canvas.width + 50) {
        return; // Remove off-screen tokens
      }

      // Smooth opacity fade in (quick ease-out so the word "arrives") and a
      // long, gentle ease-out fade as it rises and evaporates.
      let opacity = 1;
      const fadeInDuration = 0.32;
      const fadeOutStart = 0.6;

      if (age < fadeInDuration) {
        const t = age / fadeInDuration;
        opacity = 1 - Math.pow(1 - t, 2); // ease-out: appears promptly
      } else if (ageProgress > fadeOutStart) {
        const fadeProgress = (ageProgress - fadeOutStart) / (1 - fadeOutStart);
        opacity = Math.pow(1 - fadeProgress, 3); // cubic ease-out
      }

      // Draw token with glow, scale, and theme tint
      ctx.save();
      const rawOpacity = Math.max(0, Math.min(1, opacity));
      ctx.globalAlpha = rawOpacity;

      // Theme-aware color tint
      let tokenColor = rpText;
      if (themeName === 'cosmic') tokenColor = rpIris;
      else if (themeName === 'ocean' || themeName === 'aurora' || themeName === 'glacier') tokenColor = rpFoam;
      else if (themeName === 'forest') tokenColor = leafColor;
      else if (themeName === 'ember') tokenColor = rpGold;
      else if (themeName === 'sakura') tokenColor = rpLove;

      // Entrance "pop": spring up from 0.84 → ~1.0 with a soft overshoot
      // (easeOutBack), so each word feels like it lands rather than shrinks in.
      const entranceT = Math.min(1, age / 0.45);
      let scale = 1;
      if (!rm) {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const back = 1 + c3 * Math.pow(entranceT - 1, 3) + c1 * Math.pow(entranceT - 1, 2);
        scale = 0.84 + 0.16 * back;
      }

      // Slight rotation sway for organic feel
      const rotation = rm ? 0 : Math.sin(age * 1.5 + token.swayPhase) * 0.02;

      ctx.translate(token.x, token.y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      // Luminous halo only while the word is young. shadowBlur is the single
      // most expensive canvas op here, so settled words render as one cheap,
      // shadow-free fill — visually identical once the glow has faded anyway.
      const isYoung = age < 0.6 && !perfMode && !perfGuardRef.current;
      if (isYoung) {
        const glowStrength = rawOpacity * (1 - Math.min(1, age / 0.45) * 0.55);
        ctx.shadowColor = tokenColor;
        ctx.shadowBlur = 10 + glowStrength * 22;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = tokenColor;
        ctx.fillText(token.text, 0, 0);
        // Second pass: crisp core text for readability
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = rawOpacity * 0.92;
      ctx.fillStyle = rpText;
      ctx.fillText(token.text, 0, 0);

      ctx.restore();
      
      updatedTokens.push(token);
    });

    tokensRef.current = updatedTokens;

    // Emit stats every second
    if (now - lastStatsEmitRef.current >= 1000) {
      const s = statsRef.current;
      const elapsedTime = (now - s.startTime) / 1000;
      const minutes = elapsedTime > 0 ? (elapsedTime / 60) : 0;
      const wpm = minutes > 0 ? Math.round(((s.chars / 5) || 0) / minutes) : 0;
      const payload = { words: s.words, chars: s.chars, time: Math.floor(elapsedTime), wpm };
      // Optional callback
      if (onStats) onStats(payload);
      // Dispatch global event for StatsBar and others
      window.dispatchEvent(new CustomEvent('zenStats', { detail: payload }));
      // Session markers
      const settingsNow = getSettingsSnapshot();
      const every = Math.max(1, settingsNow.markersEveryMin || 2) * 60;
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
      animationFrameRef.current = requestAnimationFrame(() => animateRef.current?.());
    }
  }, [fontFamily, rm, onStats, maxTokens, trimAmbientParticles]);

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  // Start/stop animation based on document visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(() => animateRef.current?.());
      } else if (document.hidden && animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Start animation
    animationFrameRef.current = requestAnimationFrame(() => animateRef.current?.());

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle canvas resize
  useEffect(() => {
    const regenerateThemeParticles = (e?: Event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      computeStyleCache();

      const ctx = canvas.getContext('2d');

      // Regenerate particles for theme changes. On a themeChanged event the
      // <html> class hasn't flipped yet (View Transition), so trust the event's
      // theme name; otherwise (resize/font) read the already-stable class.
      const detail = e && (e as CustomEvent).detail;
      const named = typeof detail === 'string' ? detail.toLowerCase() : null;
      const root = document.documentElement;
      const themeName = named
        || ['sakura', 'ember', 'aurora', 'glacier', 'forest', 'ocean', 'cosmic', 'void'].find((n) => root.classList.contains('theme-' + n))
        || 'void';

      themeRef.current = {
        isCosmic: themeName === 'cosmic',
        isForest: themeName === 'forest',
        isOcean: themeName === 'ocean',
        isSakura: themeName === 'sakura',
        isEmber: themeName === 'ember',
        isAurora: themeName === 'aurora',
        isGlacier: themeName === 'glacier',
        isVoid: themeName === 'void',
        name: themeName,
      };
      const isCosmic = themeRef.current.isCosmic;
      const perfMode = !!getSettingsSnapshot().performanceMode;
      
      // Reset all theme particles
      starsRef.current = [];
      leavesRef.current = [];
      firefliesRef.current = [];
      sakuraRef.current = [];
      embersRef.current = [];
      snowflakesRef.current = [];
      driftRef.current = [];
      burstsRef.current = [];
      
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

    // Regenerating wipes and rebuilds every particle set — far too heavy to
    // run per resize event while the user drags the window edge.
    let resizeTimer: number | null = null;
    const debouncedResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        handleResize();
      }, 150);
    };

    handleResize();
    window.addEventListener('resize', debouncedResize);
    window.addEventListener('themeChanged', regenerateThemeParticles as EventListener);
    window.addEventListener('fontChanged', updateFont);

    return () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('themeChanged', regenerateThemeParticles as EventListener);
      window.removeEventListener('fontChanged', updateFont);
    };
  }, [computeStyleCache]);

  // Focus input on mount, and warm up the audio engine on the first real
  // gesture so keystroke sounds play with zero async-resume lag.
  useEffect(() => {
    inputRef.current?.focus();
    const unlock = () => audioEngine.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Clear the commit-pulse timer on unmount
  useEffect(() => () => {
    if (commitPulseTimerRef.current !== null) {
      window.clearTimeout(commitPulseTimerRef.current);
    }
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
            <svg aria-hidden="true" className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="font-medium">{storageWarning}</p>
            </div>
            <Button
              onClick={() => setStorageWarning(null)}
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-love/70 hover:text-love transition-colors"
              aria-label="Dismiss warning"
            >
              <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
      )}

      {flowSecondsLeft !== null && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full glass border border-tint/20 text-xs font-mono text-tint/90 flex items-center gap-2 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-tint animate-pulse" />
          <span>Flow: {Math.floor(flowSecondsLeft / 60)}:{(flowSecondsLeft % 60).toString().padStart(2, '0')}</span>
        </div>
      )}

      {flowCompleted && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-md p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flow-complete-title"
        >
          <div className="glass max-w-md w-full rounded-2xl p-8 text-center border border-tint/30 completion-pulse">
            <h2 id="flow-complete-title" className="text-2xl font-sans text-tint mb-2">Meditation Flow Complete</h2>
            <p className="text-sm text-muted mb-6">Rest your hands. Savor the stillness.</p>
            <div className="flex justify-around items-center mb-6 py-4 rounded-xl bg-surface/40 border border-tint/15">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted/80 mb-1">Words</div>
                <div className="text-3xl font-mono text-tint">{stats.words}</div>
              </div>
              <div className="w-px h-8 bg-tint/20" />
              <div>
                <div className="text-xs uppercase tracking-widest text-muted/80 mb-1">Duration</div>
                <div className="text-3xl font-mono text-tint2">{flowMinutes}m</div>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <Button
                // Initial focus into a modal dialog is required practice
                // (APG dialog pattern), which is what this disable records.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onClick={() => {
                  setFlowCompleted(false);
                  const totalSec = (getSettingsSnapshot().timedFlowMinutes ?? 5) * 60;
                  setFlowSecondsLeft(totalSec);
                }}
                className="bg-tint/90 hover:bg-tint text-base font-semibold text-[color-mix(in_oklab,var(--rp-base)_88%,black_12%)]"
              >
                Begin Again
              </Button>
              <Button
                onClick={() => {
                  setFlowCompleted(false);
                  setFlowSecondsLeft(null);
                }}
                variant="outline"
                className="border-tint/30 text-tint hover:bg-tint/15"
              >
                Free Flow
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <input
        ref={inputRef}
        type="text"
        aria-label="Free-flow typing input"
        value={inputValue}
        data-typing-surface="zen"
        data-typing={isCommitting ? 'true' : undefined}
        style={{ position: 'absolute' }}
         className="zen-input bottom-[18vh] left-1/2 -translate-x-1/2
                    w-[90vw] max-w-xl px-6 py-4 text-lg font-mono caret-accent
                    backdrop-blur-soft
                    border border-tint/30 rounded-2xl
                    text-text placeholder-muted tracking-wide
                    focus:outline-none focus:border-tint/50"
        placeholder="Type freely…"
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
