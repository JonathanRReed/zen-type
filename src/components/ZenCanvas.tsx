import React, { useEffect, useRef, useState, useCallback } from 'react';
import { markInteractiveReady } from '../utils/interactiveReady';
import {
  getSettings,
  recordSession,
  updateSettings,
  type Settings,
  getStoragePersistenceErrorEvent,
  type StorageFailureDetail,
} from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import { useMotionPreference } from '../hooks/useMotionPreference';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
// The draft store brings the IndexedDB library with it. Nothing needs it
// until the first word is written, so it loads then instead of with the page.
const draftStore = () => import('../lib/draftStore');
import { audio } from '../utils/audio';
import { publishLiveStats, resetLiveStats } from '../utils/liveStats';
import { markTyping, clearTyping } from '../utils/focusMode';
import { IconClose } from './icons';

// Zen mode: every committed word becomes a token that rises and fades on a
// 2D canvas. The ambient scene behind it is the AmbientLayer's job; this file
// only draws what the typist made.

interface Token {
  id: number;
  text: string;
  /** Half the rendered width, for keeping new words off the ones still low. */
  half: number;
  x: number;
  y: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  maxLifetime: number;
  birth: number;
}

interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  decay: number;
}

interface Palette {
  text: string;
  accent: string;
  accent2: string;
  font: string;
}

const FALLBACK_PALETTE: Palette = {
  text: '#f1ece2',
  accent: '#c4a7e7',
  accent2: '#9ccfd8',
  font: "'Newsreader', Georgia, serif",
};

/** Token type size in CSS pixels: a little smaller on a phone. */
const tokenSize = (width: number): number => (width < 640 ? 19 : 23);

interface ZenCanvasProps {
  maxTokens?: number;
}

const ZenCanvas: React.FC<ZenCanvasProps> = ({ maxTokens = 160 }) => {
  const settings = useSettings();
  const { reducedMotion: rm } = useMotionPreference();
  const keyboardInset = useKeyboardInset();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tokensRef = useRef<Token[]>([]);
  const burstsRef = useRef<Burst[]>([]);
  const tokenIdRef = useRef(0);
  const lastLaneRef = useRef(-1);
  const lastFrameMsRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const animateRef = useRef<((nowMs: number) => void) | null>(null);
  const paletteRef = useRef<Palette>(FALLBACK_PALETTE);
  const sizeRef = useRef({ width: 1, height: 1, dpr: 1 });
  const settingsRef = useRef<Settings>(settings);
  const rmRef = useRef(rm);
  const [inputValue, setInputValue] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const commitPulseTimerRef = useRef<number | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Session counters. The clock starts on the first keystroke, not on mount.
  const statsRef = useRef({ words: 0, chars: 0, startedAt: 0, recordedWords: 0, recordedChars: 0, recordedAt: 0 });
  const lastStatsEmitRef = useRef(0);
  const perfGuardRef = useRef(false);
  const frameTimesRef = useRef<number[]>([]);

  // Drafts
  const transcriptRef = useRef('');
  const activeDraftIdRef = useRef<string | null>(null);
  const draftInitPromiseRef = useRef<Promise<void> | null>(null);
  const draftDirtyRef = useRef(false);
  const draftSaveTimerRef = useRef<number | null>(null);

  // Timed flow
  const [flowSecondsLeft, setFlowSecondsLeft] = useState<number | null>(null);
  const [flowCompleted, setFlowCompleted] = useState(false);
  const [flowSummary, setFlowSummary] = useState<{ words: number; minutes: number; wpm: number } | null>(null);
  const flowMinutes = settings.timedFlowMinutes ?? 0;

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { rmRef.current = rm; }, [rm]);

  // -- palette ----------------------------------------------------------------

  const readPalette = useCallback(() => {
    if (typeof document === 'undefined') return;
    const css = getComputedStyle(document.documentElement);
    const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    paletteRef.current = {
      text: get('--rp-text', FALLBACK_PALETTE.text),
      accent: get('--theme-accent', FALLBACK_PALETTE.accent),
      accent2: get('--theme-accent-2', FALLBACK_PALETTE.accent2),
      font: get('--typing-font', FALLBACK_PALETTE.font),
    };
  }, []);

  useEffect(() => {
    readPalette();
    // The theme class lands a moment after the event; read once it has.
    let timer: number | null = null;
    const onTheme = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(readPalette, 60);
    };
    window.addEventListener('themeChanged', onTheme);
    window.addEventListener('fontChanged', readPalette);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('themeChanged', onTheme);
      window.removeEventListener('fontChanged', readPalette);
    };
  }, [readPalette]);

  // -- drafts -----------------------------------------------------------------

  const flagDraftFailure = useCallback((err: unknown) => {
    console.error('[zen] draft write failed', err);
    setStorageWarning('This browser refused to save your draft. Copy anything you want to keep.');
  }, []);

  const saveDraft = useCallback(() => {
    const id = activeDraftIdRef.current;
    if (!id || !draftDirtyRef.current) return;
    draftStore()
      .then(store => store.updateDraftBody(id, transcriptRef.current))
      .then(() => { draftDirtyRef.current = false; })
      .catch(flagDraftFailure);
  }, [flagDraftFailure]);

  const ensureDraftInitialized = useCallback(() => {
    if (activeDraftIdRef.current || draftInitPromiseRef.current) return;
    const title = `Zen session, ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    draftInitPromiseRef.current = draftStore()
      .then(async (store) => {
        const draft = await store.createDraft(title);
        activeDraftIdRef.current = draft.id;
        store.setActiveDraftId(draft.id);
      })
      .catch((err) => {
        flagDraftFailure(err);
        activeDraftIdRef.current = null;
      })
      .finally(() => {
        draftInitPromiseRef.current = null;
        if (activeDraftIdRef.current && draftDirtyRef.current) saveDraft();
      });
  }, [saveDraft, flagDraftFailure]);

  const scheduleDraftSave = useCallback(() => {
    if (draftSaveTimerRef.current !== null) window.clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = window.setTimeout(() => {
      draftSaveTimerRef.current = null;
      saveDraft();
    }, 1000);
  }, [saveDraft]);

  const markDraftDirty = useCallback(() => {
    draftDirtyRef.current = true;
    scheduleDraftSave();
  }, [scheduleDraftSave]);

  useEffect(() => {
    const handleDraftChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string | null };
      // Our own freshly created draft announces itself too. Its body is
      // empty, and loading it here would wipe the first word just typed.
      if (detail.id && detail.id === activeDraftIdRef.current) return;
      activeDraftIdRef.current = detail.id;
      if (detail.id) {
        const id = detail.id;
        draftStore().then(store => store.getDraft(id)).then(draft => { if (draft) transcriptRef.current = draft.body; }).catch(() => {});
      } else {
        transcriptRef.current = '';
      }
    };
    window.addEventListener('activeDraftChanged', handleDraftChange as EventListener);
    return () => {
      window.removeEventListener('activeDraftChanged', handleDraftChange as EventListener);
      if (draftSaveTimerRef.current !== null) window.clearTimeout(draftSaveTimerRef.current);
      saveDraft();
    };
  }, [saveDraft]);

  // -- session recording -------------------------------------------------------

  /** Persist whatever has been typed since the last flush. Safe to call often. */
  const flushSession = useCallback(() => {
    const s = statsRef.current;
    const words = s.words - s.recordedWords;
    const chars = s.chars - s.recordedChars;
    if (words <= 0 || !s.startedAt) return;
    const startedAt = new Date(s.recordedAt || s.startedAt);
    const endedAt = new Date();
    try {
      recordSession({ mode: 'zen', startedAt, endedAt, wordsTyped: words, charactersTyped: chars });
    } catch (e) {
      console.error('[zen] record failed', e);
    }
    s.recordedWords = s.words;
    s.recordedChars = s.chars;
    s.recordedAt = endedAt.getTime();
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushSession();
    };
    const onPageHide = () => flushSession();
    // Reset Session in the pause menu: bank what was typed, then start over
    // with a clean page.
    const onReset = () => {
      flushSession();
      window.location.reload();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('resetSession', onReset);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('resetSession', onReset);
      flushSession();
      resetLiveStats('zen');
      clearTyping();
    };
  }, [flushSession]);

  // -- storage warnings ---------------------------------------------------------

  useEffect(() => {
    const handleStorageError = (e: Event) => {
      const detail = (e as CustomEvent<StorageFailureDetail>).detail;
      if (detail.action === 'write') {
        setStorageWarning('Local storage is disabled or full. Your session will not be saved.');
      }
    };
    const eventName = getStoragePersistenceErrorEvent();
    window.addEventListener(eventName, handleStorageError as EventListener);
    return () => window.removeEventListener(eventName, handleStorageError as EventListener);
  }, []);

  // -- timed flow ---------------------------------------------------------------

  // The countdown restarts whenever the setting changes, so the reset has to
  // happen in the effect that owns the interval.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!flowMinutes || flowMinutes <= 0) {
      setFlowSecondsLeft(null);
      setFlowCompleted(false);
      return;
    }
    const totalSec = Math.round(flowMinutes * 60);
    setFlowSecondsLeft(totalSec);
    setFlowCompleted(false);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const remaining = totalSec - Math.floor((Date.now() - startedAt) / 1000);
      if (remaining <= 0) {
        window.clearInterval(interval);
        setFlowSecondsLeft(0);
        const s = statsRef.current;
        const minutesTyped = s.startedAt ? Math.max(1 / 60, (Date.now() - s.startedAt) / 60000) : 1;
        setFlowSummary({ words: s.words, minutes: flowMinutes, wpm: Math.round((s.chars / 5) / minutesTyped) });
        setFlowCompleted(true);
        flushSession();
        audio.chime();
      } else {
        setFlowSecondsLeft(remaining);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [flowMinutes, flushSession]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!flowCompleted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setFlowCompleted(false);
        updateSettings({ timedFlowMinutes: 0 });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [flowCompleted]);

  // -- settings-driven events ---------------------------------------------------

  useEffect(() => {
    const onFocusTyping = () => inputRef.current?.focus();
    window.addEventListener('focusTyping', onFocusTyping);
    return () => window.removeEventListener('focusTyping', onFocusTyping);
  }, []);

  // -- tokens -------------------------------------------------------------------

  const pulseInput = useCallback(() => {
    setIsCommitting(true);
    if (commitPulseTimerRef.current !== null) window.clearTimeout(commitPulseTimerRef.current);
    commitPulseTimerRef.current = window.setTimeout(() => {
      setIsCommitting(false);
      commitPulseTimerRef.current = null;
    }, 700);
  }, []);

  const emitBurst = useCallback((x: number, y: number) => {
    const s = settingsRef.current;
    if (s.performanceMode || perfGuardRef.current) return;
    const count = rmRef.current ? 2 : 6;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.5;
      burstsRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.7,
        r: 1.2 + Math.random() * 1.6,
        alpha: 0.85 + Math.random() * 0.15,
        decay: 0.025 + Math.random() * 0.02,
      });
    }
    if (burstsRef.current.length > 48) burstsRef.current = burstsRef.current.slice(-48);
  }, []);

  /** Where words lift off: just above the writing line. */
  const launchY = useCallback((): number => {
    const rect = inputRef.current?.getBoundingClientRect();
    return rect ? rect.top - 14 : sizeRef.current.height - 200;
  }, []);

  const spawnToken = useCallback((text: string) => {
    const { width } = sizeRef.current;
    const s = settingsRef.current;
    const reduced = rmRef.current;
    const baseFade = reduced ? Math.max(1.8, (s.fadeSec ?? 4) * 0.6) : (s.fadeSec ?? 4);
    const lifetime = baseFade + text.length * 0.3;
    const amp = reduced ? 0 : (s.driftAmp ?? 6);
    const y = launchY();

    const ctx = canvasRef.current?.getContext('2d');
    let half = text.length * 6;
    if (ctx) {
      ctx.font = `${tokenSize(width)}px ${paletteRef.current.font}`;
      half = ctx.measureText(text).width / 2;
    }
    const pad = Math.min(48, width / 6) + half;
    const clampX = (value: number) => Math.min(Math.max(pad, width - pad), Math.max(pad, value));
    // A word is in the way if it is still near the line and overlaps sideways.
    const blocked = (x: number) => tokensRef.current.some(tk => Math.abs(tk.y - y) < 34 && Math.abs(tk.x - x) < tk.half + half + 14);

    const laneStyle = s.laneStyle ?? 'soft';
    let x = clampX(Math.random() * width);
    if (laneStyle === 'none') {
      for (let tries = 0; tries < 6 && blocked(x); tries++) x = clampX(Math.random() * width);
    } else {
      // Three columns gathered around the writing line rather than spread to
      // the edges of a wide screen, where words used to land out of sight.
      const spread = Math.min(width * 0.27, 300);
      const lanes = [width / 2 - spread, width / 2, width / 2 + spread];
      const jitter = laneStyle === 'tight' ? 16 : 44;
      // Never the lane the previous word took, and prefer one that is clear.
      const order = [0, 1, 2].filter(i => i !== lastLaneRef.current).sort(() => Math.random() - 0.5);
      if (lastLaneRef.current >= 0) order.push(lastLaneRef.current);
      let laneIndex = order[0] ?? 1;
      x = clampX((lanes[laneIndex] ?? width / 2) + (Math.random() * 2 - 1) * jitter);
      for (const candidate of order) {
        const cx = clampX((lanes[candidate] ?? width / 2) + (Math.random() * 2 - 1) * jitter);
        if (!blocked(cx)) {
          laneIndex = candidate;
          x = cx;
          break;
        }
      }
      lastLaneRef.current = laneIndex;
    }

    tokensRef.current.push({
      id: tokenIdRef.current++,
      text,
      half,
      x,
      y,
      vy: Math.min(80, Math.max(30, 45 + Math.random() * 35)),
      swayAmp: amp,
      swayFreq: 0.6 + Math.random() * 0.6,
      swayPhase: Math.random() * Math.PI * 2,
      maxLifetime: lifetime,
      birth: performance.now(),
    });
    const cap = s.performanceMode || perfGuardRef.current ? 80 : maxTokens;
    if (tokensRef.current.length > cap) tokensRef.current = tokensRef.current.slice(-cap);
  }, [maxTokens, launchY]);

  const commitWord = useCallback((word: string, delimiter: string) => {
    if (!word) return;
    ensureDraftInitialized();
    const s = settingsRef.current;
    const density = Math.max(0.5, Math.min(1.5, s.spawnDensity ?? 1.0));
    if (density < 1) {
      if (Math.random() < density) spawnToken(word);
    } else {
      spawnToken(word);
      if (Math.random() < density - 1) spawnToken(word);
    }
    pulseInput();

    transcriptRef.current += word + delimiter;
    const st = statsRef.current;
    if (!st.startedAt) st.startedAt = Date.now();
    st.words += 1;
    st.chars += word.length;

    markDraftDirty();
  }, [spawnToken, markDraftDirty, ensureDraftInitialized, pulseInput]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const { width } = sizeRef.current;
    markTyping();
    if (newValue.length > inputValue.length) {
      emitBurst(width / 2 + (Math.random() - 0.5) * 120, launchY() + 30);
      if (!statsRef.current.startedAt) statsRef.current.startedAt = Date.now();
    }
    const lastChar = newValue[newValue.length - 1];
    const isDelimiter = lastChar === ' ' || /[.,!?;:]/.test(lastChar ?? '');
    if (isDelimiter && newValue.length > 1) {
      commitWord(newValue.slice(0, -1), lastChar ?? ' ');
      setInputValue('');
    } else {
      setInputValue(newValue);
    }
  }, [commitWord, emitBurst, inputValue.length, launchY]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key !== 'Tab' && e.key !== 'Escape') {
      audio.keyDown(e.key, { repeat: e.repeat });
    }
    if (e.key === 'Enter' && inputValue.length > 0) {
      e.preventDefault();
      commitWord(inputValue, '\n');
      setInputValue('');
    }
    if (e.key === 'Backspace' && inputValue.length === 0 && transcriptRef.current.length > 0) {
      transcriptRef.current = transcriptRef.current.slice(0, -1);
      markDraftDirty();
    }
  }, [inputValue, commitWord, markDraftDirty]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    audio.keyUp(e.key);
  }, []);

  // -- animation loop -----------------------------------------------------------

  const animate = useCallback((nowMs: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Motion is scaled by real elapsed time, so a 30 Hz laptop on battery and
    // a 120 Hz display drift the same words the same distance. Long gaps
    // (a hidden tab, a stalled frame) are clamped rather than replayed.
    const dt = lastFrameMsRef.current > 0 ? Math.min(0.1, (nowMs - lastFrameMsRef.current) / 1000) : 1 / 60;
    lastFrameMsRef.current = nowMs;
    const f = dt * 60; // 1 at 60 fps; per-frame constants below were tuned there
    const { width, height, dpr } = sizeRef.current;
    const palette = paletteRef.current;
    const s = settingsRef.current;
    const reduced = rmRef.current;
    const perf = !!s.performanceMode || perfGuardRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${tokenSize(width)}px ${palette.font}`;

    // The particle and token records are plain mutable structs owned by
    // refs; updating them in place is the whole point of the loop.
    /* eslint-disable react-hooks/immutability */
    // Bursts
    if (burstsRef.current.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const kept: Burst[] = [];
      for (const b of burstsRef.current) {
        b.x += b.vx * f;
        b.y += b.vy * f;
        b.vy += 0.04 * f;
        b.alpha -= b.decay * f;
        if (b.alpha > 0.01) {
          ctx.globalAlpha = b.alpha;
          ctx.fillStyle = palette.accent;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          kept.push(b);
        }
      }
      burstsRef.current = kept;
      ctx.restore();
    }

    // Tokens
    const kept: Token[] = [];
    for (const token of tokensRef.current) {
      const age = (nowMs - token.birth) / 1000;
      const threshold = perf ? token.maxLifetime * 0.7 : token.maxLifetime;
      if (age >= threshold) continue;
      const progress = Math.min(1, age / threshold);
      const easeOut = 1 - Math.pow(1 - progress, 2);
      token.y -= token.vy * dt * (1 - easeOut * 0.3);
      if (!reduced && token.swayAmp > 0 && !perf) {
        const primary = Math.sin(age * token.swayFreq * 2 * Math.PI + token.swayPhase) * token.swayAmp;
        const secondary = Math.sin(age * token.swayFreq * 0.55 * Math.PI + token.swayPhase * 1.7) * token.swayAmp * 0.4;
        token.x += (primary + secondary) * dt;
      }
      if (token.y < -50 || token.x < -50 || token.x > width + 50) continue;

      let opacity = 1;
      if (age < 0.32) opacity = 1 - Math.pow(1 - age / 0.32, 2);
      else if (progress > 0.6) opacity = Math.pow(1 - (progress - 0.6) / 0.4, 3);
      opacity = Math.max(0, Math.min(1, opacity));

      const entranceT = Math.min(1, age / 0.45);
      let scale = 1;
      if (!reduced) {
        const c1 = 1.70158, c3 = c1 + 1;
        const back = 1 + c3 * Math.pow(entranceT - 1, 3) + c1 * Math.pow(entranceT - 1, 2);
        scale = 0.84 + 0.16 * back;
      }
      const rotation = reduced ? 0 : Math.sin(age * 1.5 + token.swayPhase) * 0.02;

      ctx.save();
      ctx.translate(token.x, token.y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      const young = age < 0.6 && !perf;
      if (young) {
        const glow = opacity * (1 - Math.min(1, age / 0.45) * 0.55);
        ctx.globalAlpha = opacity;
        ctx.shadowColor = palette.accent;
        ctx.shadowBlur = 10 + glow * 22;
        ctx.fillStyle = palette.accent;
        ctx.fillText(token.text, 0, 0);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = opacity * 0.92;
      ctx.fillStyle = palette.text;
      ctx.fillText(token.text, 0, 0);
      ctx.restore();
      kept.push(token);
    }
    tokensRef.current = kept;
    /* eslint-enable react-hooks/immutability */

    // Breathing ring: a slow 4s in, 4s out.
    if (s.breath && !reduced && !perf) {
      const period = 8000;
      const t = (nowMs % period) / period;
      const phase = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 - Math.PI / 2);
      const radius = Math.min(width, height) * (0.14 + 0.1 * phase);
      ctx.save();
      ctx.globalAlpha = 0.14 + 0.1 * phase;
      ctx.strokeStyle = palette.accent2;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = palette.accent2;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.42, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Stats once a second
    if (nowMs - lastStatsEmitRef.current >= 1000) {
      const st = statsRef.current;
      const elapsed = st.startedAt ? (Date.now() - st.startedAt) / 1000 : 0;
      const minutes = elapsed / 60;
      const wpm = minutes > 0.05 ? Math.round((st.chars / 5) / minutes) : 0;
      publishLiveStats('zen', { words: st.words, chars: st.chars, time: Math.floor(elapsed), wpm, startedAt: st.startedAt });
      lastStatsEmitRef.current = nowMs;
    }

    // Frame-rate guard
    const frames = frameTimesRef.current;
    frames.push(nowMs);
    if (frames.length > 120) frames.shift();
    if (frames.length > 30) {
      const first = frames[0] ?? nowMs;
      const avgFps = (frames.length - 1) * 1000 / Math.max(1, nowMs - first);
      if (avgFps < 50 && !perfGuardRef.current) perfGuardRef.current = true;
      else if (avgFps > 57 && perfGuardRef.current) perfGuardRef.current = false;
    }

    // Idle: nothing to draw and nothing pending, so stop asking for frames.
    const idle = tokensRef.current.length === 0 && burstsRef.current.length === 0 && !s.breath;
    if (!document.hidden && !idle) {
      frameRef.current = requestAnimationFrame((t) => animateRef.current?.(t));
    } else {
      frameRef.current = null;
    }
  }, []);

  useEffect(() => { animateRef.current = animate; }, [animate]);

  const ensureAnimating = useCallback(() => {
    if (frameRef.current === null && !document.hidden) {
      frameRef.current = requestAnimationFrame((t) => animateRef.current?.(t));
    }
  }, []);

  useEffect(() => {
    // Wake the loop whenever there is something new to draw.
    const id = window.setInterval(() => {
      const s = settingsRef.current;
      if (tokensRef.current.length || burstsRef.current.length || s.breath) ensureAnimating();
      // Keep the stats bar ticking while the clock runs, even when nothing moves.
      const st = statsRef.current;
      if (st.startedAt && frameRef.current === null) {
        const elapsed = (Date.now() - st.startedAt) / 1000;
        const minutes = elapsed / 60;
        publishLiveStats('zen', { words: st.words, chars: st.chars, time: Math.floor(elapsed), wpm: minutes > 0.05 ? Math.round((st.chars / 5) / minutes) : 0, startedAt: st.startedAt });
      }
    }, 1000);
    const onVisibility = () => {
      if (document.hidden && frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      } else {
        ensureAnimating();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [ensureAnimating]);

  useEffect(() => {
    if (inputValue.length) ensureAnimating();
  }, [inputValue, ensureAnimating]);

  // -- sizing -----------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { width, height, dpr };
      ensureAnimating();
    };
    resize();
    let timer: number | null = null;
    const debounced = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(resize, 120);
    };
    window.addEventListener('resize', debounced);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('resize', debounced);
    };
  }, [ensureAnimating]);

  useEffect(() => {
    inputRef.current?.focus();
    const releaseReady = markInteractiveReady('typing');
    return () => {
      releaseReady();
      if (commitPulseTimerRef.current !== null) window.clearTimeout(commitPulseTimerRef.current);
    };
  }, []);

  // -- render -------------------------------------------------------------------

  const inputStyle = keyboardInset > 0 ? { bottom: `${keyboardInset + 56}px` } : undefined;

  return (
    <div className="zen-stage">
      <canvas ref={canvasRef} className="zen-canvas" aria-hidden="true" />

      {storageWarning && (
        <div className="notice notice-warn" role="alert">
          <p>{storageWarning}</p>
          <button type="button" className="notice-close" onClick={() => setStorageWarning(null)} aria-label="Dismiss warning">
            <IconClose />
          </button>
        </div>
      )}

      {flowSecondsLeft !== null && !flowCompleted && (
        <div className="flow-timer" data-flow-countdown role="timer" aria-label="Time remaining">
          {Math.floor(flowSecondsLeft / 60)}:{(flowSecondsLeft % 60).toString().padStart(2, '0')}
        </div>
      )}

      {flowCompleted && flowSummary && (
        <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="flow-complete-title">
          <div className="overlay-card sheet">
            <h2 id="flow-complete-title" className="sheet-title">Time is up</h2>
            <p className="sheet-lede">Rest your hands. What you wrote is saved in your drafts.</p>
            <dl className="result-figures result-figures-sm">
              <div>
                <dt>Words</dt>
                <dd>{flowSummary.words}</dd>
              </div>
              <div>
                <dt>{flowSummary.minutes === 1 ? 'Minute' : 'Minutes'}</dt>
                <dd>{flowSummary.minutes}</dd>
              </div>
              {settings.showStats && (
                <div>
                  <dt>Words a minute</dt>
                  <dd>{flowSummary.wpm}</dd>
                </div>
              )}
            </dl>
            <div className="sheet-foot">
              <div className="sheet-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setFlowCompleted(false);
                    updateSettings({ timedFlowMinutes: 0 });
                    inputRef.current?.focus();
                  }}
                >
                  Keep writing
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  // Initial focus into a modal dialog is required practice.
                  // eslint-disable-next-line jsx-a11y-x/no-autofocus
                  autoFocus
                  onClick={() => {
                    setFlowCompleted(false);
                    // Same length again: nudge the setting so the effect restarts.
                    const minutes = getSettings().timedFlowMinutes ?? 0;
                    updateSettings({ timedFlowMinutes: 0 });
                    window.setTimeout(() => updateSettings({ timedFlowMinutes: minutes || 5 }), 0);
                    inputRef.current?.focus();
                  }}
                >
                  Go again
                </button>
              </div>
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
        style={inputStyle}
        className="zen-line"
        placeholder="Start writing…"
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="enter"
      />
    </div>
  );
};

export default ZenCanvas;
