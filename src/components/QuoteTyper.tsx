import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';
import {
  updateStats,
  updateStreak,
  getSettings,
  saveSettings,
  type Settings,
  getStoragePersistenceErrorEvent,
  type StorageFailureDetail,
} from '../utils/storage';
import { loadQuotes, getRandomQuote, getFallbackQuotes, type Quote } from '../utils/quotes';
import { Button } from '@/components/ui/button';
import AnimatedNumber from './AnimatedNumber';

interface QuoteTyperProps {
  quote: string;
  author?: string;
  reducedMotion?: boolean;
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

const QuoteTyper: React.FC<QuoteTyperProps> = ({
  quote,
  author,
  reducedMotion: _reducedMotion = false,
  onComplete,
}) => {
  // Active quote state (for seamless in-app switching)
  const [activeQuote, setActiveQuote] = useState<string>(quote);
  const [activeAuthor, setActiveAuthor] = useState<string | undefined>(author);
  const [cursor, setCursor] = useState(0);
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const [errorTypeAt, setErrorTypeAt] = useState<Map<number, 'slip' | 'skip' | 'extra'>>(new Map());
  const [errorCounts, setErrorCounts] = useState({ slip: 0, skip: 0, extra: 0 });
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [totalTyped, setTotalTyped] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAnnouncedProgress = useRef(0);
  const lastTypedCharRef = useRef<string>('');
  const lastPressTsRef = useRef<number>(0);
  // Auto-advance & affirmation state
  const [autoAdvance, setAutoAdvance] = useState<boolean>(() => {
    try { return !!getSettings().autoAdvanceQuotes; } catch { return false; }
  });
  const [advanceDelay, setAdvanceDelay] = useState<number>(() => {
    try { return Math.max(0, (getSettings().autoAdvanceDelayMs ?? 0)); } catch { return 0; }
  });
  // Cumulative streak metrics (across consecutive quotes)
  const [streakTimeSec, setStreakTimeSec] = useState(0);
  const [streakCorrect, setStreakCorrect] = useState(0);
  const [streakTotal, setStreakTotal] = useState(0);
  const quotesRef = useRef<Quote[]>([]);
  const fallbackQuotesRef = useRef<Quote[]>(getFallbackQuotes());
  const activeQuoteRef = useRef(activeQuote);
  const [isPending, startTransition] = useTransition();
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [progressAnnouncement, setProgressAnnouncement] = useState<string | null>(null);
  const progressTimeoutRef = useRef<number | null>(null);

  // Chunking
  type Chunk = { start: number; end: number; wordStart: number; wordEnd: number; };
  const chunkStartTimesRef = useRef<Map<number, number>>(new Map()); // ms timestamps
  const chunkCorrectRef = useRef<Map<number, number>>(new Map());
  const chunkTypedRef = useRef<Map<number, number>>(new Map());

  const handleReset = useCallback(() => {
    setCursor(0);
    setTypedChars([]);
    setErrors(new Set());
    setErrorTypeAt(new Map());
    setErrorCounts({ slip: 0, skip: 0, extra: 0 });
    setStartTime(null);
    setEndTime(null);
    setIsComplete(false);
    setTotalTyped(0);
    setCorrectChars(0);
    chunkStartTimesRef.current.clear();
    chunkCorrectRef.current.clear();
    chunkTypedRef.current.clear();
    if (progressTimeoutRef.current !== null) {
      window.clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
    setProgressAnnouncement(null);
    lastAnnouncedProgress.current = 0;
    inputRef.current?.focus();
  }, []);

  // Memoized WPM (only meaningful after completion)
  const wpmValue = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const minutes = (endTime.getTime() - startTime.getTime()) / 1000 / 60;
    if (minutes === 0) return 0;
    return Math.round((correctChars / 5) / minutes);
  }, [startTime, endTime, correctChars]);

  // Memoized accuracy
  const accuracyValue = useMemo(() => {
    if (totalTyped === 0) return 100;
    return Math.round((correctChars / totalTyped) * 100);
  }, [correctChars, totalTyped]);

  // Overall progress through the quote (0–100)
  const progressPct = useMemo(
    () => Math.max(0, Math.min(100, Math.round((cursor / Math.max(1, activeQuote.length)) * 100))),
    [cursor, activeQuote.length],
  );

  // Chunk helpers
  const toggleAutoAdvance = useCallback((enabled: boolean) => {
    setAutoAdvance(enabled);
    try {
      const current = getSettings();
      const next: Settings = {
        ...current,
        autoAdvanceQuotes: enabled,
        autoAdvanceDelayMs: current.autoAdvanceDelayMs ?? 0,
      };
      saveSettings(next);
      setAdvanceDelay(Math.max(0, next.autoAdvanceDelayMs ?? 0));
      window.dispatchEvent(new CustomEvent('settingsChanged', { detail: next }));
    } catch { }
  }, []);

  const triggerNewQuote = useCallback(() => {
    window.dispatchEvent(new CustomEvent('newQuote'));
  }, []);

  const chunks = useMemo<Chunk[]>(() => {
    // Split into ~10 word chunks, with 8 to 12 adaptive bounds.
    const words = activeQuote.split(/\s+/).filter(Boolean);
    const wordBoundaries: number[] = []; // char index where each word starts
    let idx = 0;
    let wi = 0;
    while (wi < words.length) {
      // find the next occurrence of word in quote starting at idx
      const w = words[wi];
      const found = activeQuote?.indexOf(w!, idx) ?? -1;
      if (found === -1) break;
      wordBoundaries.push(found);
      idx = found + w!.length;
      wi++;
    }
    const ch: Chunk[] = [];
    let w = 0;
    // Adaptive chunk sizing to keep ~10 words per chunk within 8..12
    const targetChunks = Math.max(1, Math.ceil(words.length / 10));
    const baseSize = Math.max(8, Math.min(12, Math.ceil(words.length / targetChunks)));
    while (w < words.length) {
      const size = Math.min(words.length - w, baseSize);
      const ws = w;
      const we = w + size - 1;
      const start = wordBoundaries[ws] ?? 0;
      // end char index inclusive: position after last word chars of chunk
      let end = (wordBoundaries[we] ?? activeQuote.length - 1) + (words[we]?.length ?? 0);
      // Expand end to include trailing punctuation/space up to next word start
      if (we + 1 < wordBoundaries.length) {
        end = wordBoundaries[we + 1] ?? activeQuote.length;
      } else {
        end = activeQuote.length;
      }
      ch.push({ start, end, wordStart: ws, wordEnd: we });
      w += size;
    }
    return ch;
  }, [activeQuote]);

  const currentChunkIndex = useMemo(
    () => chunks.findIndex(c => cursor >= c.start && cursor < c.end),
    [chunks, cursor],
  );

  useEffect(() => {
    chunkStartTimesRef.current.clear();
    chunkCorrectRef.current.clear();
    chunkTypedRef.current.clear();
  }, [activeQuote]);

  useEffect(() => {
    activeQuoteRef.current = activeQuote;
  }, [activeQuote]);

  useEffect(() => {
    let mounted = true;
    loadQuotes()
      .then(arr => { if (mounted) quotesRef.current = arr; })
      .catch(err => {
        console.error('Failed to load quotes', err);
      });
    const onSettings = (e: Event) => {
      try {
        const s = (e as CustomEvent).detail as Settings;
        setAutoAdvance(!!s.autoAdvanceQuotes);
        setAdvanceDelay(Math.max(0, Number(s.autoAdvanceDelayMs ?? 0)));
      } catch { }
    };
    const onNew = async (e: Event) => {
      const d = (e as CustomEvent).detail as { quote?: string; author?: string } | undefined;
      let nextQuote = d?.quote;
      let nextAuthor = d?.author;

      if (!nextQuote) {
        let pool = quotesRef.current;
        if (!pool.length) {
          try {
            pool = await loadQuotes();
            quotesRef.current = pool;
          } catch (error) {
            console.error('Failed to refresh quotes', error);
            pool = [];
          }
        }
        if (!pool.length) {
          pool = fallbackQuotesRef.current;
        }
        if (pool.length) {
          let next = getRandomQuote(pool);
          let guard = 0;
          const currentQuote = activeQuoteRef.current;
          while (next.text === currentQuote && guard++ < 5) {
            next = getRandomQuote(pool);
          }
          nextQuote = next.text;
          nextAuthor = next.author;
        }
      }

      if (typeof nextQuote === 'string') {
        activeQuoteRef.current = nextQuote!;
        startTransition(() => {
          setActiveQuote(nextQuote!);
          setActiveAuthor(nextAuthor);
          handleReset();
        });
      } else {
        handleReset();
      }
    };
    window.addEventListener('settingsChanged', onSettings as EventListener);
    window.addEventListener('newQuote', onNew as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener('settingsChanged', onSettings as EventListener);
      window.removeEventListener('newQuote', onNew as EventListener);
    };
  }, [handleReset]);

  // Listen for storage persistence errors and warn users
  useEffect(() => {
    const handleStorageError = (e: Event) => {
      const detail = (e as CustomEvent<StorageFailureDetail>).detail;
      if (detail.action === 'write') {
        setStorageWarning('Local storage is disabled or full. Your stats will not be saved.');
        console.warn('[QuoteTyper] Storage persistence disabled:', detail);
      }
    };

    const eventName = getStoragePersistenceErrorEvent();
    window.addEventListener(eventName, handleStorageError as EventListener);

    return () => {
      window.removeEventListener(eventName, handleStorageError as EventListener);
    };
  }, []);

  // Emit live quoteStats for StatsBar
  useEffect(() => {
    if (!startTime) return;
    const now = new Date();
    const elapsedSec = Math.max(0, Math.floor((now.getTime() - startTime.getTime()) / 1000));
    const minutes = Math.max(0.0001, (streakTimeSec + elapsedSec) / 60);
    const aggCorrect = streakCorrect + correctChars;
    const aggTyped = streakTotal + totalTyped;
    const words = Math.floor(aggCorrect / 5);
    const liveWpm = Math.round((aggCorrect / 5) / minutes);
    const acc = aggTyped === 0 ? 100 : Math.round((aggCorrect / aggTyped) * 100);
    window.dispatchEvent(new CustomEvent('quoteStats', { detail: { time: streakTimeSec + elapsedSec, words, wpm: liveWpm, accuracy: acc } }));
  }, [startTime, correctChars, totalTyped, streakTimeSec, streakCorrect, streakTotal]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComplete) return;

    // Start timer on first keypress
    if (!startTime && e.key.length === 1) {
      setStartTime(new Date());
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (cursor > 0) {
        // Smart rewind: jump to last incorrect index if any
        let target = cursor - 1;
        for (let i = cursor - 1; i >= 0; i--) {
          if (errors.has(i)) { target = i; break; }
        }
        const buf = [...typedChars];
        buf[target] = '';
        setTypedChars(buf);
        setCursor(target);
        const es = new Set(errors);
        if (es.delete(target)) {
          setErrors(es);
          const m = new Map(errorTypeAt);
          if (m.has(target)) {
            const t = m.get(target)!;
            m.delete(target);
            setErrorTypeAt(m);
            setErrorCounts(prev => {
              const next = { ...prev };
              next[t] = Math.max(0, prev[t] - 1);
              return next;
            });
          }
        }
      }
      return;
    }

    if (e.key.length === 1) {
      e.preventDefault();

      if (cursor >= activeQuote.length) return;
      // Optional debounce for ultra-fast duplicate keystrokes
      const thr = Math.max(0, getSettings().debounceMs || 0);
      const nowTs = e.timeStamp;
      if (thr > 0 && e.key === lastTypedCharRef.current && (nowTs - lastPressTsRef.current) < thr) {
        return;
      }
      lastTypedCharRef.current = e.key;
      lastPressTsRef.current = nowTs;

      // Determine current chunk and ensure start time
      if (!chunkStartTimesRef.current.has(currentChunkIndex)) {
        chunkStartTimesRef.current.set(currentChunkIndex, nowTs);
      }

      const buf = [...typedChars];
      buf[cursor] = e.key;
      setTypedChars(buf);
      setTotalTyped(prev => prev + 1);

      const expected = activeQuote?.[cursor];
      const isCorrect = e.key === expected;

      // Error classification
      let errType: 'slip' | 'skip' | 'extra' | null = null;
      if (!isCorrect) {
        const typedIsWs = /\s/.test(e.key);
        const expectedIsWs = expected ? /\s/.test(expected) : false;
        if (typedIsWs && !expectedIsWs) errType = 'skip';
        else if (!typedIsWs && expectedIsWs) errType = 'extra';
        else errType = 'slip';
      }

      if (isCorrect) {
        setCorrectChars(prev => prev + 1);
        // chunk counters
        chunkCorrectRef.current.set(currentChunkIndex, (chunkCorrectRef.current.get(currentChunkIndex) || 0) + 1);
        chunkTypedRef.current.set(currentChunkIndex, (chunkTypedRef.current.get(currentChunkIndex) || 0) + 1);
        const es = new Set(errors); es.delete(cursor); setErrors(es);
        const m = new Map(errorTypeAt);
        if (m.has(cursor)) {
          const t = m.get(cursor)!; m.delete(cursor); setErrorTypeAt(m);
          setErrorCounts(prev => {
            const next = { ...prev };
            next[t] = Math.max(0, prev[t] - 1);
            return next;
          });
        }
      } else {
        // Mark error and update chunk typed
        const es = new Set(errors); es.add(cursor); setErrors(es);
        chunkTypedRef.current.set(currentChunkIndex, (chunkTypedRef.current.get(currentChunkIndex) || 0) + 1);
        if (errType) {
          const m = new Map(errorTypeAt);
          if (!m.has(cursor)) {
            m.set(cursor, errType);
            setErrorTypeAt(m);
            setErrorCounts(prev => {
              const next = { ...prev };
              next[errType] = next[errType] + 1;
              return next;
            });
          }
        }
      }

      setCursor(cursor + 1);

      // Check for completion. The final tallies are passed in because the
      // setCorrectChars/setTotalTyped calls above have not flushed yet, and
      // the wpm/accuracy memos still hold the pre-completion render's values.
      if (cursor + 1 === activeQuote.length && isCorrect) {
        handleComplete(correctChars + 1, totalTyped + 1);
      }

      // Announce progress at milestones
      const progress = Math.floor(((cursor + 1) / activeQuote.length) * 100);
      if (progress >= 25 && lastAnnouncedProgress.current < 25) {
        announceProgress(25);
        lastAnnouncedProgress.current = 25;
      } else if (progress >= 50 && lastAnnouncedProgress.current < 50) {
        announceProgress(50);
        lastAnnouncedProgress.current = 50;
      } else if (progress >= 75 && lastAnnouncedProgress.current < 75) {
        announceProgress(75);
        lastAnnouncedProgress.current = 75;
      }
    }
  };

  // Handle completion.
  // `finalCorrect` / `finalTyped` are the tallies including the keystroke that
  // finished the quote. Reading the wpmValue/accuracyValue memos here would
  // read the render that is still in flight: endTime is null at that point, so
  // wpm would be persisted as 0 on every run.
  const handleComplete = (finalCorrect: number, finalTyped: number) => {
    const end = new Date();
    setEndTime(end);
    setIsComplete(true);

    if (startTime) {
      const words = activeQuote.split(' ').length;
      const minutes = (end.getTime() - startTime.getTime()) / 1000 / 60;
      const wpm = minutes > 0 ? Math.round((finalCorrect / 5) / minutes) : 0;
      const accuracy = finalTyped === 0 ? 100 : Math.round((finalCorrect / finalTyped) * 100);
      // Insights
      const summary = {
        mode: 'quote' as const,
        startedAt: startTime,
        endedAt: end,
        wordsTyped: words,
        charactersTyped: activeQuote.length,
        wpm,
        accuracy,
        slip: errorCounts.slip,
        skip: errorCounts.skip,
        extra: errorCounts.extra,
      };
      // Increment the streak before updateStats overwrites LAST_SESSION —
      // updateStreak compares against the *previous* session's date.
      if (accuracy >= 95) {
        updateStreak();
      }
      // Persist stats locally
      updateStats(summary as any);
      // Inform listeners
      window.dispatchEvent(new CustomEvent('quoteComplete', { detail: summary }));
      onComplete?.(summary);

      // Aggregate into streak metrics
      const elapsed = Math.max(0, Math.floor((end.getTime() - startTime.getTime()) / 1000));
      setStreakTimeSec(prev => prev + elapsed);
      setStreakCorrect(prev => prev + finalCorrect);
      setStreakTotal(prev => prev + finalTyped);

      // Auto-advance flow
      if (autoAdvance) {
        const runNext = () => {
          const pool = quotesRef.current;
          if (pool.length) {
            let next = getRandomQuote(pool);
            let guard = 0;
            const currentQuote = activeQuoteRef.current;
            while (next.text === currentQuote && guard++ < 5) next = getRandomQuote(pool);
            activeQuoteRef.current = next.text;
            setActiveQuote(next.text);
            setActiveAuthor(next.author);
          }
          handleReset();
        };
        const delay = Math.max(0, advanceDelay);
        if (delay === 0) {
          runNext();
        } else {
          setTimeout(runNext, delay);
        }
      }
    }

    announceProgress(100);
  };

  // Announce progress for accessibility
  const announceProgress = useCallback((percent: number) => {
    setProgressAnnouncement(`${percent}% complete`);
    if (progressTimeoutRef.current !== null) {
      window.clearTimeout(progressTimeoutRef.current);
    }
    progressTimeoutRef.current = window.setTimeout(() => {
      setProgressAnnouncement(null);
      progressTimeoutRef.current = null;
    }, 1000);
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep focus on hidden input to avoid browser "find" triggering when typing on the page
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onBlur = () => {
      // If a modal/dialog is open, don't steal focus
      const modalOpen = !!document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!modalOpen) {
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    input.addEventListener('blur', onBlur);
    return () => input.removeEventListener('blur', onBlur);
  }, []);

  // Capture printable keys globally to prevent browser quick-find when input isn't focused
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (!inField && (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler as any, { capture: true } as any);
  }, []);

  // Render a single character span \u2014 clean, borderless state system.
  const renderChar = (char: string, index: number) => {
    const isTyped = index < cursor;
    const isCurrent = index === cursor;
    const hasError = errors.has(index);
    const typedChar = typedChars[index];

    let state = 'pending';
    if (isCurrent) state = 'current';
    else if (isTyped) state = hasError ? 'error' : 'correct';

    const displayChar = char === ' ' ? '\u00A0' : char;
    const shown = isTyped && typedChar ? (hasError ? typedChar : displayChar) : displayChar;

    return (
      <span key={index} className={`quote-char font-mono ${state}`} data-state={state}>
        {shown}
      </span>
    );
  };

  // Render a range of the quote, grouping non-space runs into unbreakable words
  // (.quote-word) so the typing surface never wraps in the middle of a word.
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

  const containerClass = isComplete
    ? 'flex flex-col items-center h-full w-full px-6 pt-16 pb-24 gap-10'
    : 'flex flex-col items-center justify-center h-full w-full px-6 py-12 pb-24';

  useEffect(() => {
    return () => {
      if (progressTimeoutRef.current !== null) {
        window.clearTimeout(progressTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={containerClass}>
      <div role="status" aria-live="polite" className="sr-only">
        {progressAnnouncement ?? ''}
      </div>
      {storageWarning && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 max-w-md px-4 py-3 z-50
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
            <Button
              onClick={() => setStorageWarning(null)}
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-6 w-6 text-love/70 hover:text-love transition-colors"
              aria-label="Dismiss warning"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
      )}
      <div className="w-full max-w-4xl">
        {isPending && (
          <div className="mb-6 flex items-center justify-center" role="status" aria-live="polite">
            <span className="animate-pulse text-sm text-muted">
              Loading the next quote…
            </span>
          </div>
        )}
        {/* Quote display */}
        <div className="glass quote-card rounded-2xl px-8 pt-8 pb-7 mb-6">
          <div key={activeQuote} className="quote-body text-2xl leading-relaxed select-none">
            {chunks.length === 0 && renderRange(0, activeQuote.length)}
            {chunks.length > 0 && chunks.map((c, ci) => (
              <div key={ci} className="quote-line">
                {renderRange(c.start, c.end)}
              </div>
            ))}
          </div>
          {activeAuthor && (
            <div className="text-right text-muted text-lg mt-5">
              <span aria-hidden="true">—</span> {activeAuthor}
            </div>
          )}
          {/* Single, elegant progress indicator (live stats live in the StatsBar HUD) */}
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
        </div>

        {/* Completion message */}
        {isComplete && (
          <div className="glass rounded-2xl p-8 text-center completion-pulse">
            <div className="stagger-fade-in">
              <h2 className="text-2xl font-sans text-tint mb-6">
                Breathe. Begin again.
              </h2>
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
                  <div className="text-xs uppercase tracking-widest text-muted/80 mb-2">Errors</div>
                  <div className="font-mono text-text/90">Slip: {errorCounts.slip}</div>
                  <div className="font-mono text-text/90">Skip: {errorCounts.skip}</div>
                  <div className="font-mono text-text/90">Extra: {errorCounts.extra}</div>
                </div>
                <div className="rounded-xl border border-tint/15 bg-surface/40 p-4">
                  <div className="text-xs uppercase tracking-widest text-muted/80 mb-2">Totals</div>
                  <div className="font-mono text-text/90">Characters: {totalTyped}</div>
                  <div className="font-mono text-text/90">Correct: {correctChars}</div>
                  <div className="font-mono text-text/90">Streak time: {streakTimeSec}s</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={handleReset}
                  className="bg-tint/90 hover:bg-tint text-base font-semibold text-[color-mix(in_oklab,var(--rp-base)_88%,black_12%)] shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--theme-accent)_60%,transparent)]"
                >
                  Type Again
                </Button>
                <Button
                  onClick={() => triggerNewQuote()}
                  variant="outline"
                  className="border-tint2/45 text-tint2 hover:bg-tint2/15"
                >
                  New Quote
                </Button>
                <Button
                  onClick={() => toggleAutoAdvance(!autoAdvance)}
                  variant="ghost"
                  className={autoAdvance ? 'text-tint2 hover:bg-tint2/10' : 'text-muted hover:bg-overlay/50 hover:text-text'}
                >
                  {autoAdvance ? 'Auto Next: On' : 'Auto Next: Off'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden input for capturing keystrokes */}
        <input
          ref={inputRef}
          type="text"
          className="sr-only"
          onKeyDown={handleKeyDown}
          aria-label="Type the quote shown above"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />

      </div>
    </div>
  );
};

export default QuoteTyper;
