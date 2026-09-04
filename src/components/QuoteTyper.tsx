import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  recordSession,
  getSettings,
  updateSettings,
  getStats,
  getStreak,
  getHints,
  markHint,
  getStoragePersistenceErrorEvent,
  type StorageFailureDetail,
} from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import { loadQuotes, pickQuote, getFallbackQuotes, type Quote } from '../utils/quotes';
import { Button } from '@/components/ui/button';
import AnimatedNumber from './AnimatedNumber';
import { audioEngine } from '../utils/audioEngine';
import { publishLiveStats, resetLiveStats } from '../utils/liveStats';
import { downloadShareCard } from '../utils/shareCard';

const STATIC_FALLBACK_QUOTES = getFallbackQuotes();

type ErrorKind = 'slip' | 'skip' | 'extra';

interface QuoteTyperProps {
  quote: string;
  author?: string;
  quoteId?: string;
  onComplete?: (summary: {
    mode: 'quote';
    startedAt: Date;
    endedAt: Date;
    wordsTyped: number;
    charactersTyped: number;
    wpm: number;
    accuracy: number;
  }) => void;
}

interface ActiveQuote {
  id?: string;
  text: string;
  author?: string;
}

const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

const QuoteTyper: React.FC<QuoteTyperProps> = ({ quote, author, quoteId, onComplete }) => {
  const settings = useSettings();
  const [active, setActive] = useState<ActiveQuote>({ text: quote, ...(author ? { author } : {}), ...(quoteId ? { id: quoteId } : {}) });
  const activeQuote = active.text;
  const [cursor, setCursor] = useState(0);
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const errorTypeAtRef = useRef<Map<number, ErrorKind>>(new Map());
  const [errorCounts, setErrorCounts] = useState({ slip: 0, skip: 0, extra: 0 });
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [totalTyped, setTotalTyped] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [completion, setCompletion] = useState<{ streak: number; personalBest: boolean } | null>(null);
  const [showAudioHint, setShowAudioHint] = useState(false);
  const [touchIdle, setTouchIdle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastAnnouncedProgress = useRef(0);
  const lastTypedCharRef = useRef<string>('');
  const lastPressTsRef = useRef<number>(0);
  const composingRef = useRef(false);
  const handledKeydownAtRef = useRef(0);
  // Cumulative metrics across consecutive quotes in one sitting
  const [sittingTimeSec, setSittingTimeSec] = useState(0);
  const [sittingCorrect, setSittingCorrect] = useState(0);
  const [sittingTotal, setSittingTotal] = useState(0);
  const quotesRef = useRef<Quote[]>([]);
  const activeRef = useRef(active);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [progressAnnouncement, setProgressAnnouncement] = useState<string | null>(null);
  const [ghostCursor, setGhostCursor] = useState<number>(-1);
  const progressTimeoutRef = useRef<number | null>(null);
  const autoAdvance = !!settings.autoAdvanceQuotes;

  useEffect(() => { activeRef.current = active; }, [active]);

  // Target-WPM pacer: a marker that moves through the quote at the chosen pace.
  useEffect(() => {
    if (!startTime || isComplete) return;
    const targetWpm = settings.targetWpm || 0;
    if (targetWpm <= 0) return;
    const startMs = startTime.getTime();
    const interval = window.setInterval(() => {
      const elapsedSec = (Date.now() - startMs) / 1000;
      const targetCps = (targetWpm * 5) / 60;
      setGhostCursor(Math.min(activeQuote.length - 1, Math.floor(elapsedSec * targetCps)));
    }, 80);
    return () => {
      window.clearInterval(interval);
      setGhostCursor(-1);
    };
  }, [startTime, isComplete, activeQuote.length, settings.targetWpm]);

  const handleReset = useCallback(() => {
    setCursor(0);
    setTypedChars([]);
    setErrors(new Set());
    errorTypeAtRef.current.clear();
    setErrorCounts({ slip: 0, skip: 0, extra: 0 });
    setStartTime(null);
    setEndTime(null);
    setIsComplete(false);
    setCompletion(null);
    setTotalTyped(0);
    setCorrectChars(0);
    if (progressTimeoutRef.current !== null) {
      window.clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
    setProgressAnnouncement(null);
    lastAnnouncedProgress.current = 0;
    inputRef.current?.focus();
  }, []);

  const wpmValue = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const minutes = (endTime.getTime() - startTime.getTime()) / 1000 / 60;
    if (minutes === 0) return 0;
    return Math.round((correctChars / 5) / minutes);
  }, [startTime, endTime, correctChars]);

  const accuracyValue = useMemo(() => {
    if (totalTyped === 0) return 100;
    return Math.round((correctChars / totalTyped) * 100);
  }, [correctChars, totalTyped]);

  const progressPct = useMemo(
    () => Math.max(0, Math.min(100, Math.round((cursor / Math.max(1, activeQuote.length)) * 100))),
    [cursor, activeQuote.length],
  );

  const toggleAutoAdvance = useCallback((enabled: boolean) => {
    updateSettings({ autoAdvanceQuotes: enabled });
  }, []);

  const nextQuote = useCallback((pool: Quote[]): Quote => {
    const s = getSettings();
    return pickQuote(pool, {
      lengths: s.quoteLengths ?? [],
      tags: s.quoteTags ?? [],
      ...(activeRef.current.id ? { excludeId: activeRef.current.id } : {}),
    });
  }, []);

  const loadNext = useCallback((next: Quote) => {
    const value: ActiveQuote = { id: next.id, text: next.text, ...(next.author ? { author: next.author } : {}) };
    activeRef.current = value;
    setActive(value);
    handleReset();
  }, [handleReset]);

  // Group the quote into lines of roughly ten words so the surface wraps on
  // word boundaries rather than mid-word.
  type Chunk = { start: number; end: number };
  const chunks = useMemo<Chunk[]>(() => {
    const words = activeQuote.split(/\s+/).filter(Boolean);
    const starts: number[] = [];
    let idx = 0;
    for (const w of words) {
      const found = activeQuote.indexOf(w, idx);
      if (found === -1) break;
      starts.push(found);
      idx = found + w.length;
    }
    const out: Chunk[] = [];
    const targetChunks = Math.max(1, Math.ceil(words.length / 10));
    const size = Math.max(8, Math.min(12, Math.ceil(words.length / targetChunks)));
    for (let w = 0; w < words.length; w += size) {
      const last = Math.min(words.length - 1, w + size - 1);
      const start = starts[w] ?? 0;
      const end = last + 1 < starts.length ? (starts[last + 1] ?? activeQuote.length) : activeQuote.length;
      out.push({ start, end });
    }
    return out;
  }, [activeQuote]);

  useEffect(() => {
    let mounted = true;
    loadQuotes()
      .then(arr => { if (mounted) quotesRef.current = arr; })
      .catch(err => console.error('Failed to load quotes', err));

    const onNew = async (e: Event) => {
      const d = (e as CustomEvent).detail as { quote?: string; author?: string; id?: string } | undefined;
      if (d?.quote) {
        loadNext({ id: d.id ?? `custom-${Date.now()}`, text: d.quote, author: d.author ?? '' });
        return;
      }
      let pool = quotesRef.current;
      if (!pool.length) {
        try {
          pool = await loadQuotes();
          quotesRef.current = pool;
        } catch {
          pool = [];
        }
      }
      if (!pool.length) pool = STATIC_FALLBACK_QUOTES;
      loadNext(nextQuote(pool));
    };
    const onCustomQuote = (e: Event) => {
      const d = (e as CustomEvent).detail as { text: string; author?: string } | undefined;
      const text = d?.text?.trim();
      if (text) {
        loadNext({ id: `custom-${Date.now()}`, text, author: d?.author?.trim() || 'Custom text' });
      }
    };
    window.addEventListener('newQuote', onNew as EventListener);
    window.addEventListener('loadCustomQuote', onCustomQuote as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener('newQuote', onNew as EventListener);
      window.removeEventListener('loadCustomQuote', onCustomQuote as EventListener);
    };
  }, [loadNext, nextQuote]);

  useEffect(() => {
    const handleStorageError = (e: Event) => {
      const detail = (e as CustomEvent<StorageFailureDetail>).detail;
      if (detail.action === 'write') {
        setStorageWarning('Local storage is disabled or full. Your stats will not be saved.');
      }
    };
    const eventName = getStoragePersistenceErrorEvent();
    window.addEventListener(eventName, handleStorageError as EventListener);
    return () => window.removeEventListener(eventName, handleStorageError as EventListener);
  }, []);

  // Live numbers for the stats bar. Ticks once a second while the clock runs
  // and on every change while typing.
  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
      const totalSec = sittingTimeSec + elapsedSec;
      const minutes = Math.max(1 / 60, totalSec / 60);
      const aggCorrect = sittingCorrect + correctChars;
      const aggTyped = sittingTotal + totalTyped;
      publishLiveStats('quote', {
        time: totalSec,
        words: Math.floor(aggCorrect / 5),
        chars: aggCorrect,
        wpm: Math.round((aggCorrect / 5) / minutes),
        accuracy: aggTyped === 0 ? 100 : Math.round((aggCorrect / aggTyped) * 100),
        startedAt: startTime.getTime(),
      });
    };
    tick();
    if (isComplete) return;
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [startTime, isComplete, correctChars, totalTyped, sittingTimeSec, sittingCorrect, sittingTotal]);

  useEffect(() => () => resetLiveStats('quote'), []);

  const announceProgress = useCallback((percent: number) => {
    setProgressAnnouncement(`${percent}% complete`);
    if (progressTimeoutRef.current !== null) window.clearTimeout(progressTimeoutRef.current);
    progressTimeoutRef.current = window.setTimeout(() => {
      setProgressAnnouncement(null);
      progressTimeoutRef.current = null;
    }, 1000);
  }, []);

  const handleComplete = useCallback((finalCorrect: number, finalTyped: number, start: Date) => {
    const end = new Date();
    setEndTime(end);
    setIsComplete(true);

    const words = activeRef.current.text.split(/\s+/).filter(Boolean).length;
    const minutes = (end.getTime() - start.getTime()) / 1000 / 60;
    const wpm = minutes > 0 ? Math.round((finalCorrect / 5) / minutes) : 0;
    const accuracy = finalTyped === 0 ? 100 : Math.round((finalCorrect / finalTyped) * 100);
    const errorsNow = { ...errorCounts };
    const previousBest = (() => { try { return getStats().bestWpm; } catch { return 0; } })();

    const summary = {
      mode: 'quote' as const,
      startedAt: start,
      endedAt: end,
      wordsTyped: words,
      charactersTyped: activeRef.current.text.length,
      wpm,
      accuracy,
      ...(activeRef.current.id ? { quoteId: activeRef.current.id } : {}),
      errors: errorsNow,
    };
    try {
      recordSession(summary);
    } catch (e) {
      console.error('Failed to record session', e);
    }
    let streak = 0;
    try { streak = getStreak(); } catch { /* storage blocked */ }
    setCompletion({ streak, personalBest: wpm > previousBest && previousBest > 0 });

    window.dispatchEvent(new CustomEvent('quoteComplete', { detail: summary }));
    onComplete?.(summary);

    const elapsed = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    setSittingTimeSec(prev => prev + elapsed);
    setSittingCorrect(prev => prev + finalCorrect);
    setSittingTotal(prev => prev + finalTyped);

    // The one-time nudge toward sound, after the first finished quote.
    try {
      const hints = getHints();
      const s = getSettings();
      if (!hints.audio && !s.soundEnabled) {
        setShowAudioHint(true);
        markHint('audio');
      }
    } catch { /* storage blocked */ }

    if (getSettings().autoAdvanceQuotes) {
      const delay = Math.max(0, getSettings().autoAdvanceDelayMs ?? 1500);
      window.setTimeout(() => {
        const pool = quotesRef.current.length ? quotesRef.current : STATIC_FALLBACK_QUOTES;
        loadNext(nextQuote(pool));
      }, delay);
    }
    announceProgress(100);
  }, [errorCounts, onComplete, announceProgress, loadNext, nextQuote]);

  // -- character processing --------------------------------------------------

  const typeCharacter = useCallback((ch: string, ts: number) => {
    if (isComplete) return;
    if (ch.length !== 1) return;
    let start = startTime;
    if (!start) {
      start = new Date();
      setStartTime(start);
    }
    if (cursor >= activeQuote.length) return;

    const thr = Math.max(0, getSettings().debounceMs || 0);
    if (thr > 0 && ch === lastTypedCharRef.current && (ts - lastPressTsRef.current) < thr) return;
    lastTypedCharRef.current = ch;
    lastPressTsRef.current = ts;

    const buf = [...typedChars];
    buf[cursor] = ch;
    setTypedChars(buf);
    setTotalTyped(prev => prev + 1);

    const expected = activeQuote[cursor];
    const isCorrect = ch === expected || (ch === ' ' && expected === ' ');

    let errType: ErrorKind | null = null;
    if (!isCorrect) {
      const typedIsWs = /\s/.test(ch);
      const expectedIsWs = expected ? /\s/.test(expected) : false;
      if (typedIsWs && !expectedIsWs) errType = 'skip';
      else if (!typedIsWs && expectedIsWs) errType = 'extra';
      else errType = 'slip';
    }

    if (isCorrect) {
      setCorrectChars(prev => prev + 1);
      if (errors.has(cursor)) {
        const es = new Set(errors); es.delete(cursor); setErrors(es);
      }
      const prior = errorTypeAtRef.current.get(cursor);
      if (prior) {
        errorTypeAtRef.current.delete(cursor);
        setErrorCounts(prev => ({ ...prev, [prior]: Math.max(0, prev[prior] - 1) }));
      }
    } else {
      const es = new Set(errors); es.add(cursor); setErrors(es);
      if (errType && !errorTypeAtRef.current.has(cursor)) {
        errorTypeAtRef.current.set(cursor, errType);
        const kind = errType;
        setErrorCounts(prev => ({ ...prev, [kind]: prev[kind] + 1 }));
      }
    }

    setCursor(prev => prev + 1);

    // Final tallies are passed explicitly: the state updates above have not
    // flushed, and the memoized wpm/accuracy still hold the previous render.
    if (cursor + 1 === activeQuote.length && isCorrect) {
      handleComplete(correctChars + 1, totalTyped + 1, start);
    }

    const progress = Math.floor(((cursor + 1) / activeQuote.length) * 100);
    for (const milestone of [25, 50, 75]) {
      if (progress >= milestone && lastAnnouncedProgress.current < milestone) {
        announceProgress(milestone);
        lastAnnouncedProgress.current = milestone;
      }
    }
  }, [isComplete, startTime, cursor, activeQuote, typedChars, errors, correctChars, totalTyped, handleComplete, announceProgress]);

  const backspace = useCallback(() => {
    if (isComplete || cursor === 0) return;
    // Smart rewind: jump back to the earliest uncorrected mistake.
    let target = cursor - 1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (errors.has(i)) { target = i; break; }
    }
    const buf = [...typedChars];
    for (let i = target; i < buf.length; i++) buf[i] = '';
    setTypedChars(buf);
    setCursor(target);
    if (errors.has(target)) {
      const es = new Set(errors);
      es.delete(target);
      setErrors(es);
      const prior = errorTypeAtRef.current.get(target);
      if (prior) {
        errorTypeAtRef.current.delete(target);
        setErrorCounts(prev => ({ ...prev, [prior]: Math.max(0, prev[prior] - 1) }));
      }
    }
  }, [isComplete, cursor, errors, typedChars]);

  // Desktop path: keydown carries the character with the least latency.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.nativeEvent.isComposing || composingRef.current) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      audioEngine.keyDown('Backspace', { repeat: e.repeat });
      handledKeydownAtRef.current = e.timeStamp;
      backspace();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') return;
    if (e.key.length === 1) {
      e.preventDefault();
      audioEngine.keyDown(e.key, { repeat: e.repeat });
      handledKeydownAtRef.current = e.timeStamp;
      typeCharacter(e.key, e.timeStamp);
      return;
    }
    if (e.key === 'Shift' || e.key === 'CapsLock') {
      audioEngine.keyDown(e.key, { repeat: e.repeat });
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    audioEngine.keyUp(e.key);
  };

  // Mobile path: on-screen keyboards report most keys as "Unidentified" on
  // keydown and deliver the text through input events instead.
  const consumeInputValue = (el: HTMLInputElement, ts: number) => {
    const value = el.value;
    if (!value) return;
    el.value = '';
    for (const ch of value) {
      audioEngine.keyDown(ch);
      window.setTimeout(() => audioEngine.keyUp(ch), 60);
      typeCharacter(ch, ts);
      // typeCharacter closes over the current cursor; one character per
      // event is the common case, and bursts settle on the next render.
      break;
    }
    if (value.length > 1) {
      // Composed words arrive whole. Feed the rest back one at a time.
      const rest = Array.from(value).slice(1).join('');
      window.setTimeout(() => {
        const input = inputRef.current;
        if (input) {
          input.value = rest;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 0);
    }
  };

  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent;
    const type = native.inputType;
    // Already handled on keydown a moment ago (desktop): swallow the echo.
    if (e.timeStamp - handledKeydownAtRef.current < 8) {
      e.preventDefault();
      return;
    }
    if (type === 'deleteContentBackward' && !composingRef.current) {
      e.preventDefault();
      audioEngine.keyDown('Backspace');
      window.setTimeout(() => audioEngine.keyUp('Backspace'), 60);
      backspace();
      return;
    }
    if (type === 'insertText' && typeof native.data === 'string' && native.data.length > 0 && !composingRef.current) {
      e.preventDefault();
      const data = native.data;
      const ch = Array.from(data)[0] ?? '';
      audioEngine.keyDown(ch);
      window.setTimeout(() => audioEngine.keyUp(ch), 60);
      typeCharacter(ch, e.timeStamp);
      if (data.length > 1) {
        const rest = Array.from(data).slice(1).join('');
        window.setTimeout(() => {
          const input = inputRef.current;
          if (input) {
            input.value = rest;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 0);
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    if (composingRef.current) return;
    consumeInputValue(e.currentTarget, e.timeStamp);
  };

  const handleCompositionStart = () => { composingRef.current = true; };
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    composingRef.current = false;
    consumeInputValue(e.currentTarget, e.timeStamp);
  };

  // Focus management: keep the hidden input focused so typing never triggers
  // the browser's find bar, but never steal focus from an open dialog.
  useEffect(() => {
    inputRef.current?.focus();
    const input = inputRef.current;
    if (!input) return;
    let blurTimeout: number | null = null;
    const onBlur = () => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (blurTimeout !== null) window.clearTimeout(blurTimeout);
      blurTimeout = window.setTimeout(() => {
        const activeEl = document.activeElement;
        if (!activeEl || activeEl === document.body || activeEl === document.documentElement) {
          if (!isTouchDevice()) inputRef.current?.focus();
          else setTouchIdle(true);
        }
        blurTimeout = null;
      }, 0);
    };
    const onFocus = () => setTouchIdle(false);
    input.addEventListener('blur', onBlur);
    input.addEventListener('focus', onFocus);
    return () => {
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('focus', onFocus);
      if (blurTimeout !== null) window.clearTimeout(blurTimeout);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const el = document.activeElement as HTMLElement | null;
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (!inField && (e.key.length === 1 || e.key === 'Backspace')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

  useEffect(() => {
    if (isTouchDevice()) setTouchIdle(document.activeElement !== inputRef.current);
  }, []);

  useEffect(() => () => {
    if (progressTimeoutRef.current !== null) window.clearTimeout(progressTimeoutRef.current);
  }, []);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  // -- rendering -------------------------------------------------------------

  const renderChar = (char: string, index: number) => {
    const isTyped = index < cursor;
    const isCurrent = index === cursor;
    const hasError = errors.has(index);
    const typedChar = typedChars[index];

    let state = 'pending';
    if (isCurrent) state = 'current';
    else if (isTyped) state = hasError ? 'error' : 'correct';

    const isGhostPacer = index === ghostCursor && index > cursor;
    const displayChar = char === ' ' ? ' ' : char;
    const shown = isTyped && typedChar ? (hasError ? (typedChar === ' ' ? ' ' : typedChar) : displayChar) : displayChar;

    return (
      <span
        key={`qc_${index}`}
        className={`quote-char font-mono ${state}${isGhostPacer ? ' ghost-pacer' : ''}`}
        data-state={state}
      >
        {shown}
      </span>
    );
  };

  const renderRange = (start: number, end: number): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let word: React.ReactNode[] = [];
    let wordKey = start;
    const flush = () => {
      if (word.length) {
        nodes.push(<span key={`w${wordKey}`} className="quote-word">{word}</span>);
        word = [];
      }
    };
    for (let i = start; i < end; i++) {
      const ch = activeQuote[i] ?? '';
      if (ch === ' ') {
        flush();
        nodes.push(renderChar(' ', i));
      } else {
        if (word.length === 0) wordKey = i;
        word.push(renderChar(ch, i));
      }
    }
    flush();
    return nodes;
  };

  // Once the completion card is up the column can be taller than a short
  // viewport, so it scrolls; the bottom padding clears the fixed stats bar.
  const containerClass = isComplete
    ? 'quote-stage quote-stage-complete flex flex-col items-center w-full px-4 sm:px-6 pt-24 pb-48 gap-8 max-h-[100dvh] overflow-y-auto overscroll-contain'
    : 'quote-stage flex flex-col items-center justify-center w-full px-4 sm:px-6 py-8 pb-24';

  const shareCard = () => {
    try {
      downloadShareCard({
        mode: 'quote',
        timeSec: startTime && endTime ? (endTime.getTime() - startTime.getTime()) / 1000 : 0,
        words: activeQuote.split(/\s+/).filter(Boolean).length,
        wpm: wpmValue,
        accuracy: accuracyValue,
        ...(completion?.streak ? { streak: completion.streak } : {}),
        quote: activeQuote,
        ...(active.author ? { author: active.author } : {}),
        bestWpm: !!completion?.personalBest,
      });
    } catch (e) {
      console.error('Share card failed', e);
    }
  };

  return (
    <div className={containerClass}>
      <div role="status" aria-live="polite" className="sr-only">
        {progressAnnouncement ?? ''}
      </div>
      {storageWarning && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 max-w-md px-4 py-3 z-50 bg-love/20 border border-love/40 rounded-lg text-love text-sm shadow-lg backdrop-blur-sm"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <p className="flex-1 font-medium">{storageWarning}</p>
            <Button onClick={() => setStorageWarning(null)} variant="ghost" size="icon" className="h-6 w-6 text-love/70 hover:text-love" aria-label="Dismiss warning">
              <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </Button>
          </div>
        </div>
      )}
      <div className="w-full max-w-4xl">
        {/* Quote display. Tapping anywhere on the card focuses the input so
            on-screen keyboards open; it is the only way touch devices can type. */}
        <div
          ref={cardRef}
          className="glass quote-card relative rounded-2xl px-5 pt-6 pb-6 sm:px-8 sm:pt-8 sm:pb-7 mb-6"
          onPointerDown={focusInput}
        >
          <input
            ref={inputRef}
            type="text"
            className="quote-input"
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBeforeInput={handleBeforeInput}
            onInput={handleInput}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            data-typing-surface="quote"
            aria-label="Type the quote shown here"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
          />
          <div key={activeQuote} className="quote-body text-xl sm:text-2xl leading-relaxed select-none">
            {chunks.length === 0 && renderRange(0, activeQuote.length)}
            {chunks.length > 0 && chunks.map((c, ci) => (
              <div key={ci} className="quote-line">
                {renderRange(c.start, c.end)}
              </div>
            ))}
          </div>
          {active.author && (
            <div className="text-right text-muted text-base sm:text-lg mt-5">
              <span aria-hidden="true">—</span> {active.author}
            </div>
          )}
          <div
            className="quote-progress-track mt-6"
            role="progressbar"
            aria-label="Quote progress"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="quote-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {touchIdle && !isComplete && (
            <button
              type="button"
              className="quote-tap-hint"
              onClick={focusInput}
            >
              Tap to start typing
            </button>
          )}
        </div>

        {isComplete && (
          <div className="glass rounded-2xl p-6 sm:p-8 text-center completion-pulse">
            <div className="stagger-fade-in">
              <h2 className="text-2xl font-sans text-tint mb-1">
                Breathe. Begin again.
              </h2>
              <p className="text-sm text-muted mb-6">
                {completion?.personalBest ? 'A new personal best.' : completion && completion.streak > 1 ? `Day ${completion.streak} in a row.` : 'One more done.'}
              </p>
              <div className="flex items-stretch justify-center gap-10 mb-6">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted/80 mb-1">WPM</div>
                  <div className="text-5xl font-mono text-tint tabular-nums leading-none">
                    <AnimatedNumber value={wpmValue} showImprovement={true} />
                  </div>
                </div>
                <div className="w-px self-stretch bg-tint/20" aria-hidden="true" />
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted/80 mb-1">Accuracy</div>
                  <div className="text-5xl font-mono text-tint2 tabular-nums leading-none">
                    <AnimatedNumber value={accuracyValue} format={(v) => `${Math.round(v)}%`} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-left text-sm mb-6">
                <div className="rounded-xl border border-tint/15 bg-surface/40 p-4">
                  <div className="text-xs uppercase tracking-widest text-muted/80 mb-2">Mistakes</div>
                  <div className="font-mono text-text/90">Wrong key: {errorCounts.slip}</div>
                  <div className="font-mono text-text/90">Skipped: {errorCounts.skip}</div>
                  <div className="font-mono text-text/90">Extra: {errorCounts.extra}</div>
                </div>
                <div className="rounded-xl border border-tint/15 bg-surface/40 p-4">
                  <div className="text-xs uppercase tracking-widest text-muted/80 mb-2">This sitting</div>
                  <div className="font-mono text-text/90">Characters: {sittingTotal + totalTyped}</div>
                  <div className="font-mono text-text/90">Correct: {sittingCorrect + correctChars}</div>
                  <div className="font-mono text-text/90">Time: {Math.floor((sittingTimeSec) / 60)}:{String(sittingTimeSec % 60).padStart(2, '0')}</div>
                </div>
              </div>
              {showAudioHint && (
                <div className="mb-5 flex items-center justify-center gap-3 text-sm text-muted">
                  <span>Sound is available. Press Ctrl+M or the speaker button.</span>
                  <button type="button" className="text-tint hover:text-text underline underline-offset-2" onClick={() => setShowAudioHint(false)}>
                    Got it
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={handleReset}
                  className="px-6 py-2.5 rounded-xl bg-tint/20 hover:bg-tint/35 border border-tint/60 text-tint font-sans font-semibold text-base shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--theme-accent)_50%,transparent)] transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Type again
                </Button>
                <Button
                  onClick={() => window.dispatchEvent(new CustomEvent('newQuote'))}
                  variant="outline"
                  className="border-tint2/45 text-tint2 hover:bg-tint2/15"
                >
                  New quote
                </Button>
                <Button onClick={shareCard} variant="outline" className="border-tint/35 text-tint hover:bg-tint/15 flex items-center gap-1.5">
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  <span>Share card</span>
                </Button>
                <Button
                  onClick={() => window.dispatchEvent(new CustomEvent('toggleProgress', { detail: true }))}
                  variant="ghost"
                  className="text-muted hover:bg-overlay/50 hover:text-text"
                >
                  Progress
                </Button>
                <Button
                  onClick={() => toggleAutoAdvance(!autoAdvance)}
                  variant="ghost"
                  className={autoAdvance ? 'text-tint2 hover:bg-tint2/10' : 'text-muted hover:bg-overlay/50 hover:text-text'}
                >
                  {autoAdvance ? 'Auto next: on' : 'Auto next: off'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteTyper;
