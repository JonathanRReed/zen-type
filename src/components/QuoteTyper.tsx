import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { updateStats, updateStreak, exportSessionCard, exportSessionCardSVG, getSettings, saveSettings, type Settings } from '../utils/storage';
import { loadQuotes, getRandomQuote, getFallbackQuotes, type Quote } from '../utils/quotes';

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
  const [isPending, startTransition] = useTransition();

  // Chunking
  type Chunk = { start: number; end: number; wordStart: number; wordEnd: number; };
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const chunkStartTimesRef = useRef<Map<number, number>>(new Map()); // ms timestamps
  const chunkCorrectRef = useRef<Map<number, number>>(new Map());
  const chunkTypedRef = useRef<Map<number, number>>(new Map());

  // Calculate WPM
  const calculateWPM = useCallback(() => {
    if (!startTime || !endTime) return 0;
    const minutes = (endTime.getTime() - startTime.getTime()) / 1000 / 60;
    if (minutes === 0) return 0;
    return Math.round((correctChars / 5) / minutes);
  }, [startTime, endTime, correctChars]);

  // Calculate accuracy
  const calculateAccuracy = useCallback(() => {
    if (totalTyped === 0) return 100;
    return Math.round((correctChars / totalTyped) * 100);
  }, [correctChars, totalTyped]);

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
    } catch {}
  }, []);

  const computeChunks = useCallback(() => {
    // Split into ~10 word chunks (8–12 adaptive bounds)
    const words = activeQuote.split(/\s+/).filter(Boolean);
    const wordBoundaries: number[] = []; // char index where each word starts
    let idx = 0;
    let wi = 0;
    while (wi < words.length) {
      // find the next occurrence of word in quote starting at idx
      const w = words[wi];
      const found = activeQuote.indexOf(w, idx);
      if (found === -1) break;
      wordBoundaries.push(found);
      idx = found + w.length;
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
        end = wordBoundaries[we + 1];
      } else {
        end = activeQuote.length;
      }
      ch.push({ start, end, wordStart: ws, wordEnd: we });
      w += size;
    }
    setChunks(ch);
  }, [activeQuote]);

  useEffect(() => { computeChunks(); }, [computeChunks]);

  // Load quotes on client and listen for setting changes and manual newQuote requests
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
      } catch {}
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
          while (next.text === activeQuote && guard++ < 5) {
            next = getRandomQuote(pool);
          }
          nextQuote = next.text;
          nextAuthor = next.author;
        }
      }

      if (typeof nextQuote === 'string') {
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
  }, [activeQuote]);

  // Current chunk index by cursor
  useEffect(() => {
    const i = chunks.findIndex(c => cursor >= c.start && cursor < c.end);
    if (i !== -1 && i !== currentChunkIndex) setCurrentChunkIndex(i);
  }, [cursor, chunks, currentChunkIndex]);

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
            setErrorCounts(prev => ({ ...prev, [t]: Math.max(0, (prev as any)[t] - 1) }));
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
      const nowTs = performance.now();
      if (thr > 0 && e.key === lastTypedCharRef.current && (nowTs - lastPressTsRef.current) < thr) {
        return;
      }
      lastTypedCharRef.current = e.key;
      lastPressTsRef.current = nowTs;

      // Determine current chunk and ensure start time
      const chIndex = chunks.findIndex(c => cursor >= c.start && cursor < c.end);
      if (!chunkStartTimesRef.current.has(chIndex)) {
        chunkStartTimesRef.current.set(chIndex, Date.now());
      }

      const buf = [...typedChars];
      buf[cursor] = e.key;
      setTypedChars(buf);
      setTotalTyped(totalTyped + 1);

      const expected = activeQuote[cursor];
      const isCorrect = e.key === expected;

      // Error classification
      let errType: 'slip' | 'skip' | 'extra' | null = null;
      if (!isCorrect) {
        const typedIsWs = /\s/.test(e.key);
        const expectedIsWs = /\s/.test(expected);
        if (typedIsWs && !expectedIsWs) errType = 'skip';
        else if (!typedIsWs && expectedIsWs) errType = 'extra';
        else errType = 'slip';
      }

      if (isCorrect) {
        setCorrectChars(correctChars + 1);
        // chunk counters
        chunkCorrectRef.current.set(chIndex, (chunkCorrectRef.current.get(chIndex) || 0) + 1);
        chunkTypedRef.current.set(chIndex, (chunkTypedRef.current.get(chIndex) || 0) + 1);
        const es = new Set(errors); es.delete(cursor); setErrors(es);
        const m = new Map(errorTypeAt);
        if (m.has(cursor)) {
          const t = m.get(cursor)!; m.delete(cursor); setErrorTypeAt(m);
          setErrorCounts(prev => ({ ...prev, [t]: Math.max(0, (prev as any)[t] - 1) }));
        }
      } else {
        // Mark error and update chunk typed
        const es = new Set(errors); es.add(cursor); setErrors(es);
        chunkTypedRef.current.set(chIndex, (chunkTypedRef.current.get(chIndex) || 0) + 1);
        if (errType) {
          const m = new Map(errorTypeAt);
          if (!m.has(cursor)) {
            m.set(cursor, errType);
            setErrorTypeAt(m);
            setErrorCounts(prev => ({ ...prev, [errType!]: (prev as any)[errType!] + 1 }));
          }
        }
      }

      setCursor(cursor + 1);
      
      // Check for completion
      if (cursor + 1 === activeQuote.length && isCorrect) {
        handleComplete();
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

  // Handle completion
  const handleComplete = () => {
    const end = new Date();
    setEndTime(end);
    setIsComplete(true);
    
    if (startTime) {
      const words = activeQuote.split(' ').length;
      const wpm = calculateWPM();
      const accuracy = calculateAccuracy();
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
      // Persist stats locally
      updateStats(summary as any);
      // Increment streak only with ≥95% accuracy or full completion
      if (accuracy >= 95) {
        updateStreak();
      }
      // Inform listeners
      window.dispatchEvent(new CustomEvent('quoteComplete', { detail: summary }));
      onComplete?.(summary);

      // Aggregate into streak metrics
      const elapsed = Math.max(0, Math.floor((end.getTime() - startTime.getTime()) / 1000));
      setStreakTimeSec(prev => prev + elapsed);
      setStreakCorrect(prev => prev + correctChars);
      setStreakTotal(prev => prev + totalTyped);

      // Auto-advance flow
      if (autoAdvance) {
        const runNext = () => {
          const pool = quotesRef.current;
          if (pool.length) {
            let next = getRandomQuote(pool);
            let guard = 0;
            while (next.text === activeQuote && guard++ < 5) next = getRandomQuote(pool);
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
  const announceProgress = (percent: number) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `${percent}% complete`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Reset function
  const handleReset = () => {
    setCursor(0);
    setTypedChars([]);
    setErrors(new Set());
    setStartTime(null);
    setEndTime(null);
    setIsComplete(false);
    setTotalTyped(0);
    setCorrectChars(0);
    lastAnnouncedProgress.current = 0;
    inputRef.current?.focus();
  };

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

  // Render character span
  const renderChar = (char: string, index: number) => {
    const isTyped = index < cursor;
    const isCurrent = index === cursor;
    const hasError = errors.has(index);
    const typedChar = typedChars[index];
    
    let className = 'inline-block px-[2px] py-1 font-mono text-lg transition-all ';
    
    if (isCurrent) {
      className += 'bg-iris/20 border-b-2 border-iris ';
    } else if (isTyped) {
      if (hasError) {
        className += 'text-love underline decoration-wavy underline-offset-4 border-b-2 border-dashed border-love/70 ';
      } else {
        className += 'text-foam border-b-2 border-foam/70 ';
      }
    } else {
      className += 'text-muted border-b-2 border-dotted border-muted/40 ';
    }
    
    // Handle spaces
    const displayChar = char === ' ' ? '\u00A0' : char;
    
    return (
      <span key={index} className={className}>
        {isTyped && typedChar ? (hasError ? typedChar : displayChar) : displayChar}
      </span>
    );
  };

  const containerClass = isComplete
    ? 'flex flex-col items-center min-h-screen w-full px-6 pt-16 pb-56 gap-10'
    : 'flex flex-col items-center justify-center min-h-screen w-full px-6 py-12 pb-40';

  return (
    <div className={containerClass}>
      <div className="w-full max-w-4xl">
        {isPending && (
          <div className="mb-6 flex items-center justify-center" role="status" aria-live="polite">
            <span className="animate-pulse text-sm text-muted">
              Loading the next quote…
            </span>
          </div>
        )}
        {/* Quote display */}
        <div className="glass rounded-2xl p-8 mb-8">
          <div className="text-2xl leading-relaxed mb-4 select-none">
            {chunks.length === 0 && activeQuote.split('').map((char, i) => renderChar(char, i))}
            {chunks.length > 0 && chunks.map((c, ci) => (
              <div key={ci} className={`mb-2 relative ${ci === currentChunkIndex ? 'opacity-100' : 'opacity-80'}`}>
                <span>
                  {activeQuote.slice(c.start, c.end).split('').map((char, i) => renderChar(char, c.start + i))}
                </span>
                {/* Pace band under current chunk */}
                {ci === currentChunkIndex && (
                  <div className="mt-2 h-1 w-full bg-overlay/40 rounded-full overflow-hidden">
                    {(() => {
                      const cs = chunkStartTimesRef.current.get(ci);
                      let w = 0;
                      if (cs) {
                        const elapsed = Math.max(0.1, (Date.now() - cs) / 1000 / 60);
                        const typed = (chunkCorrectRef.current.get(ci) || 0);
                        const wpm = (typed/5)/elapsed;
                        w = Math.max(0, Math.min(1, (wpm - 20) / 80));
                      }
                      return <div className="h-full bg-foam/60" style={{ width: `${w*100}%` }} />;
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
          {activeAuthor && (
            <div className="text-right text-muted text-lg">
              — {activeAuthor}
            </div>
          )}
        </div>

        {/* Stats display */}
        <div className="glass rounded-xl p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-muted mb-1">Progress</div>
              <div className="text-2xl font-mono text-foam">
                {Math.floor((cursor / activeQuote.length) * 100)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">WPM</div>
              <div className="text-2xl font-mono text-gold">
                {startTime && !isComplete ? '—' : calculateWPM()}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">Accuracy</div>
              <div className="text-2xl font-mono text-rose">
                {totalTyped === 0 ? '100' : calculateAccuracy()}%
              </div>
            </div>
            <div>
              <div className="text-sm text-muted mb-1">Errors</div>
              <div className="text-2xl font-mono text-love">
                {errors.size}
              </div>
            </div>
          </div>
        </div>

        {/* Completion message */}
        {isComplete && (
          <div className="glass rounded-xl p-6 text-center animate-fade-in">
            <h2 className="text-2xl font-sans text-foam mb-2">
              Breathe. Begin again.
            </h2>
            <p className="text-muted mb-4">
              {calculateWPM()} WPM • {calculateAccuracy()}% accuracy
            </p>
            <div className="grid grid-cols-2 gap-4 text-left text-sm mb-4">
              <div className="glass rounded p-3">
                <div className="text-xs text-muted mb-1">Errors</div>
                <div className="font-mono">Slip: {errorCounts.slip}</div>
                <div className="font-mono">Skip: {errorCounts.skip}</div>
                <div className="font-mono">Extra: {errorCounts.extra}</div>
              </div>
              <div className="glass rounded p-3">
                <div className="text-xs text-muted mb-1">Totals</div>
                <div className="font-mono">Characters typed: {totalTyped}</div>
                <div className="font-mono">Correct chars: {correctChars}</div>
                <div className="font-mono">Streak time: {streakTimeSec}s</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  if (!startTime || !endTime) return;
                  exportSessionCard({
                    mode: 'quote',
                    date: new Date().toISOString(),
                    time: Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
                    words: Math.floor(correctChars / 5),
                    wpm: calculateWPM(),
                    accuracy: calculateAccuracy(),
                  });
                }}
                className="px-6 py-2 bg-gold/20 hover:bg-gold/30 \
                         border border-gold/40 rounded-lg
                         text-gold font-sans transition-all"
              >
                Export session card
              </button>
              <button
                onClick={() => {
                  if (!startTime || !endTime) return;
                  exportSessionCardSVG({
                    mode: 'quote',
                    date: new Date().toISOString(),
                    time: Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
                    words: Math.floor(correctChars / 5),
                    wpm: calculateWPM(),
                    accuracy: calculateAccuracy(),
                  });
                }}
                className="px-6 py-2 bg-foam/20 hover:bg-foam/30 border border-foam/40 rounded-lg text-foam font-sans transition-all"
              >
                Export SVG card
              </button>
              <button
                onClick={() => toggleAutoAdvance(!autoAdvance)}
                className={`px-6 py-2 border rounded-lg font-sans transition-all ${autoAdvance ? 'bg-surface/60 hover:bg-surface/80 border-muted/30 text-text' : 'bg-foam/20 hover:bg-foam/30 border-foam/40 text-foam'}`}
              >
                {autoAdvance ? 'Disable Auto Next' : 'Enable Auto Next'}
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-iris/20 hover:bg-iris/30 
                         border border-iris/40 rounded-lg
                         text-iris font-sans transition-all"
              >
                Type Again
              </button>
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
          autoCapitalize="off"
          spellCheck={false}
        />

      </div>
    </div>
  );
};

export default QuoteTyper;
