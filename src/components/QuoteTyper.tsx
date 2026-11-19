import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
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
import { markInteractiveReady } from '../utils/interactiveReady';
import { computeTextMetrics } from '../lib/textMetrics';
import { useGlidingCaret } from '../hooks/useGlidingCaret';
import { loadQuotes, pickQuote, getFallbackQuotes, splitSource, type Quote } from '../utils/quotes';
import QuoteResult from './QuoteResult';
import CustomTextDialog from './CustomTextDialog';
import { audio } from '../utils/audio';
import { publishLiveStats, resetLiveStats } from '../utils/liveStats';
import { downloadShareCard } from '../utils/shareCard';
import { markTyping, clearTyping } from '../utils/focusMode';
import { INITIAL_TYPING, typingReducer, typedRuns, describeMistakes } from '../utils/typingEngine';

const STATIC_FALLBACK_QUOTES = getFallbackQuotes();

interface QuoteTyperProps {
  quote: string;
  author?: string;
  source?: string;
  quoteId?: string;
}

interface ActiveQuote {
  id?: string;
  text: string;
  author?: string;
  source?: string;
}

const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

/** Longer texts step the type down so a pasted paragraph still fits a screen. */
const sizeFor = (length: number): 'display' | 'long' | 'longer' =>
  length > 420 ? 'longer' : length > 190 ? 'long' : 'display';

const QuoteTyper: React.FC<QuoteTyperProps> = ({ quote, author, source, quoteId }) => {
  const settings = useSettings();
  const [active, setActive] = useState<ActiveQuote>({
    text: quote,
    ...(author ? { author } : {}),
    ...(source ? { source } : {}),
    ...(quoteId ? { id: quoteId } : {}),
  });
  const activeQuote = active.text;
  const [ts, dispatch] = useReducer(typingReducer, INITIAL_TYPING);
  const { cursor, errors, correct: correctChars, total: totalTyped, counts: errorCounts, complete: isComplete } = ts;

  const [completion, setCompletion] = useState<{ streak: number; personalBest: boolean } | null>(null);
  const [showAudioHint, setShowAudioHint] = useState(false);
  const [touchIdle, setTouchIdle] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  // False for the passage that came with the page, true for every one after.
  const [replaced, setReplaced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAnnouncedProgress = useRef(0);
  const composingRef = useRef(false);
  const handledKeydownAtRef = useRef(0);
  const completedAtRef = useRef<number | null>(null);
  // Totals across the quotes finished in this sitting. The completion marker
  // lives with them, so the quote on screen is counted exactly once: as the
  // quote in progress until its totals are banked, and not again after.
  const [sitting, setSitting] = useState({
    timeSec: 0, correct: 0, total: 0, completedAt: null as number | null,
  });
  const banked = isComplete && ts.endedAt !== null && sitting.completedAt === ts.endedAt;
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
    if (!ts.startedAt || isComplete) return;
    const targetWpm = settings.targetWpm || 0;
    if (targetWpm <= 0) return;
    const startMs = ts.startedAt;
    const interval = window.setInterval(() => {
      const elapsedSec = (Date.now() - startMs) / 1000;
      const targetCps = (targetWpm * 5) / 60;
      setGhostCursor(Math.min(activeQuote.length - 1, Math.floor(elapsedSec * targetCps)));
    }, 80);
    return () => {
      window.clearInterval(interval);
      setGhostCursor(-1);
    };
  }, [ts.startedAt, isComplete, activeQuote.length, settings.targetWpm]);

  const handleReset = useCallback(() => {
    dispatch({ type: 'reset' });
    completedAtRef.current = null;
    setCompletion(null);
    setShowAudioHint(false);
    if (progressTimeoutRef.current !== null) {
      window.clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
    setProgressAnnouncement(null);
    lastAnnouncedProgress.current = 0;
    inputRef.current?.focus();
  }, []);

  const elapsedSec = ts.startedAt && ts.endedAt ? (ts.endedAt - ts.startedAt) / 1000 : 0;
  const wpmValue = elapsedSec > 0 ? Math.round((correctChars / 5) / (elapsedSec / 60)) : 0;
  const accuracyValue = totalTyped === 0 ? 100 : Math.round((correctChars / totalTyped) * 100);
  const progressPct = Math.max(0, Math.min(100, Math.round((cursor / Math.max(1, activeQuote.length)) * 100)));

  const nextQuote = useCallback((pool: Quote[]): Quote => {
    const s = getSettings();
    return pickQuote(pool, {
      lengths: s.quoteLengths ?? [],
      tags: s.quoteTags ?? [],
      ...(activeRef.current.id ? { excludeId: activeRef.current.id } : {}),
    });
  }, []);

  const loadNext = useCallback((next: Quote) => {
    const value: ActiveQuote = {
      id: next.id,
      text: next.text,
      ...(next.author ? { author: next.author } : {}),
      ...(next.source ? { source: next.source } : {}),
    };
    activeRef.current = value;
    setActive(value);
    setReplaced(true);
    handleReset();
  }, [handleReset]);

  useEffect(() => {
    let mounted = true;
    // The first passage came with the page. The rest of the pool is only
    // needed for the next one, so fetch it once the page has settled.
    const preload = () => {
      loadQuotes()
        .then(arr => { if (mounted) quotesRef.current = arr; })
        .catch(err => console.error('Failed to load quotes', err));
    };
    const preloadTimer = window.setTimeout(preload, 1500);

    const onNew = async () => {
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
      const d = (e as CustomEvent).detail as { text: string } | undefined;
      const text = d?.text?.trim();
      if (text) loadNext({ id: `custom-${Date.now()}`, text, author: 'Your own text' });
    };
    const onOpenCustom = () => setCustomOpen(true);
    // Reset Session from the pause menu means "give me a fresh quote".
    const onReset = () => { void onNew(); };
    window.addEventListener('newQuote', onNew);
    window.addEventListener('loadCustomQuote', onCustomQuote);
    window.addEventListener('openCustomText', onOpenCustom);
    window.addEventListener('resetSession', onReset);
    return () => {
      mounted = false;
      window.clearTimeout(preloadTimer);
      window.removeEventListener('newQuote', onNew);
      window.removeEventListener('loadCustomQuote', onCustomQuote);
      window.removeEventListener('openCustomText', onOpenCustom);
      window.removeEventListener('resetSession', onReset);
    };
  }, [loadNext, nextQuote]);

  useEffect(() => {
    const handleStorageError = (e: Event) => {
      const detail = (e as CustomEvent<StorageFailureDetail>).detail;
      if (detail.action === 'write') {
        setStorageWarning('This browser is not saving data right now, so stats from this visit will not be kept.');
      }
    };
    const eventName = getStoragePersistenceErrorEvent();
    window.addEventListener(eventName, handleStorageError as EventListener);
    return () => window.removeEventListener(eventName, handleStorageError as EventListener);
  }, []);

  // Live numbers for the stats bar. Ticks once a second while the clock runs
  // and on every change while typing.
  useEffect(() => {
    if (!ts.startedAt) return;
    const startedAt = ts.startedAt;
    const tick = () => {
      const liveSec = banked ? 0 : Math.max(0, Math.floor(((ts.endedAt ?? Date.now()) - startedAt) / 1000));
      const totalSec = sitting.timeSec + liveSec;
      const minutes = Math.max(1 / 60, totalSec / 60);
      const aggCorrect = sitting.correct + (banked ? 0 : correctChars);
      const aggTyped = sitting.total + (banked ? 0 : totalTyped);
      publishLiveStats('quote', {
        time: totalSec,
        words: Math.floor(aggCorrect / 5),
        chars: aggCorrect,
        wpm: Math.round((aggCorrect / 5) / minutes),
        accuracy: aggTyped === 0 ? 100 : Math.round((aggCorrect / aggTyped) * 100),
        startedAt,
      });
    };
    tick();
    if (isComplete) return;
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [ts.startedAt, ts.endedAt, isComplete, banked, correctChars, totalTyped, sitting.timeSec, sitting.correct, sitting.total]);

  useEffect(() => () => { resetLiveStats('quote'); clearTyping(); }, []);

  const announceProgress = useCallback((percent: number) => {
    setProgressAnnouncement(`${percent}% complete`);
    if (progressTimeoutRef.current !== null) window.clearTimeout(progressTimeoutRef.current);
    progressTimeoutRef.current = window.setTimeout(() => {
      setProgressAnnouncement(null);
      progressTimeoutRef.current = null;
    }, 1000);
  }, []);

  // Progress milestones for screen readers.
  useEffect(() => {
    if (cursor === 0) return;
    const progress = Math.floor((cursor / Math.max(1, activeQuote.length)) * 100);
    for (const milestone of [25, 50, 75]) {
      if (progress >= milestone && lastAnnouncedProgress.current < milestone) {
        announceProgress(milestone);
        lastAnnouncedProgress.current = milestone;
      }
    }
  }, [cursor, activeQuote.length, announceProgress]);

  // Completion side effects, once per finished quote.
  useEffect(() => {
    if (!isComplete || !ts.startedAt || !ts.endedAt) return;
    if (completedAtRef.current === ts.endedAt) return;
    completedAtRef.current = ts.endedAt;
    clearTyping();

    const start = new Date(ts.startedAt);
    const end = new Date(ts.endedAt);
    const words = computeTextMetrics(activeRef.current.text).words;
    const minutes = (end.getTime() - start.getTime()) / 1000 / 60;
    const wpm = minutes > 0 ? Math.round((ts.correct / 5) / minutes) : 0;
    const accuracy = ts.total === 0 ? 100 : Math.round((ts.correct / ts.total) * 100);
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
      errors: { ...ts.counts },
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

    const elapsed = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    setSitting(prev => ({
      timeSec: prev.timeSec + elapsed,
      correct: prev.correct + ts.correct,
      total: prev.total + ts.total,
      completedAt: ts.endedAt,
    }));

    // The one-time nudge toward sound, after the first finished quote.
    try {
      const hints = getHints();
      if (!hints.audio && !getSettings().soundEnabled) {
        setShowAudioHint(true);
        markHint('audio');
      }
    } catch { /* storage blocked */ }

    announceProgress(100);

    if (getSettings().autoAdvanceQuotes) {
      const delay = Math.max(0, getSettings().autoAdvanceDelayMs ?? 1500);
      const timer = window.setTimeout(() => {
        const pool = quotesRef.current.length ? quotesRef.current : STATIC_FALLBACK_QUOTES;
        loadNext(nextQuote(pool));
      }, delay);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [isComplete, ts.startedAt, ts.endedAt, ts.correct, ts.total, ts.counts, announceProgress, loadNext, nextQuote]);

  const { box: textRef, target: nowRef, caret: caretRef } = useGlidingCaret<HTMLParagraphElement, HTMLSpanElement, HTMLSpanElement>([cursor, activeQuote, isComplete]);

  // -- input ----------------------------------------------------------------

  const typeCharacter = useCallback((ch: string, timeStamp: number) => {
    markTyping();
    dispatch({ type: 'type', ch, ts: timeStamp, quote: activeRef.current.text, debounceMs: Math.max(0, getSettings().debounceMs || 0) });
  }, []);

  const backspace = useCallback(() => {
    dispatch({ type: 'backspace' });
  }, []);

  // Desktop path: keydown carries the character with the least latency.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.nativeEvent.isComposing || composingRef.current) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      audio.keyDown('Backspace', { repeat: e.repeat });
      handledKeydownAtRef.current = e.timeStamp;
      backspace();
      return;
    }
    if (e.key === 'Enter') {
      // With the quote finished, Enter is "next quote". Mid-quote it does nothing.
      if (isComplete && !e.repeat) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('newQuote'));
      }
      return;
    }
    if (e.key === 'Tab' || e.key === 'Escape') return;
    if (e.key.length === 1) {
      e.preventDefault();
      audio.keyDown(e.key, { repeat: e.repeat });
      handledKeydownAtRef.current = e.timeStamp;
      typeCharacter(e.key, e.timeStamp);
      return;
    }
    if (e.key === 'Shift' || e.key === 'CapsLock') {
      audio.keyDown(e.key, { repeat: e.repeat });
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    audio.keyUp(e.key);
  };

  // Mobile path: on-screen keyboards report most keys as "Unidentified" on
  // keydown and deliver the text through input events instead. Composed
  // words arrive whole and are fed through character by character.
  const consumeInputValue = (el: HTMLInputElement, timeStamp: number) => {
    const value = el.value;
    if (!value) return;
    el.value = '';
    const chars = Array.from(value);
    for (const ch of chars) typeCharacter(ch, timeStamp);
    const first = chars[0];
    if (first) {
      audio.keyDown(first);
      window.setTimeout(() => audio.keyUp(first), 60);
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
      audio.keyDown('Backspace');
      window.setTimeout(() => audio.keyUp('Backspace'), 60);
      backspace();
      return;
    }
    if (type === 'insertText' && typeof native.data === 'string' && native.data.length > 0 && !composingRef.current) {
      e.preventDefault();
      const chars = Array.from(native.data);
      for (const ch of chars) typeCharacter(ch, e.timeStamp);
      const first = chars[0];
      if (first) {
        audio.keyDown(first);
        window.setTimeout(() => audio.keyUp(first), 60);
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
    const onFocusTyping = () => inputRef.current?.focus();
    input.addEventListener('blur', onBlur);
    window.addEventListener('focusTyping', onFocusTyping);
    return () => {
      input.removeEventListener('blur', onBlur);
      window.removeEventListener('focusTyping', onFocusTyping);
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

  // On touch devices a programmatic focus() at load does not open the
  // keyboard, so the tap prompt stays until the first real tap or keystroke.
  useEffect(() => {
    if (!isTouchDevice()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTouchIdle(true);
  }, []);
  const showTapHint = touchIdle && cursor === 0 && !isComplete;

  useEffect(() => {
    const releaseReady = markInteractiveReady('typing');
    return () => {
      releaseReady();
      if (progressTimeoutRef.current !== null) window.clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  const focusInput = () => {
    inputRef.current?.focus();
    setTouchIdle(false);
  };

  // -- rendering -------------------------------------------------------------

  const runs = useMemo(() => typedRuns(activeQuote, cursor, errors), [activeQuote, cursor, errors]);
  const pace = ghostCursor > cursor && ghostCursor < activeQuote.length ? ghostCursor : -1;
  const credit = useMemo(() => splitSource(active.source), [active.source]);

  const shareCard = () => {
    downloadShareCard({
      timeSec: elapsedSec,
      wpm: wpmValue,
      accuracy: accuracyValue,
      ...(completion?.streak ? { streak: completion.streak } : {}),
      quote: activeQuote,
      ...(active.author ? { author: active.author } : {}),
      ...(active.source ? { source: active.source } : {}),
      bestWpm: !!completion?.personalBest,
    }).catch((e: unknown) => console.error('Share card failed', e));
  };

  return (
    <div className={`quote-stage${isComplete ? ' is-complete' : ''}`}>
      <div role="status" aria-live="polite" className="sr-only">
        {progressAnnouncement ?? ''}
      </div>
      {storageWarning && (
        <div className="notice notice-warn" role="alert">
          <p>{storageWarning}</p>
          <button type="button" className="notice-close" onClick={() => setStorageWarning(null)} aria-label="Dismiss warning">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      )}
      {/* Tapping anywhere on the passage focuses the input so on-screen
          keyboards open; it is the only way touch devices can type. The
          passage itself is not a control: the keyboard-reachable element is
          the input inside it, and the handlers only forward taps to it. */}
      {/* eslint-disable-next-line jsx-a11y-x/click-events-have-key-events, jsx-a11y-x/no-static-element-interactions */}
      <div
        className="passage"
        data-size={sizeFor(activeQuote.length)}
        // Both: pointerdown so iOS treats it as the gesture that may open the
        // keyboard, click because a tap on a non-focusable box would otherwise
        // move focus to the body right after.
        onPointerDown={focusInput}
        onClick={focusInput}
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
        <p
          key={activeQuote}
          ref={textRef}
          className={`passage-text${replaced ? ' is-next' : ''}`}
          data-cursor={cursor}
          data-errors={errors.size}
        >
          {runs.map(run => (
            <span key={run.key} className={`q-${run.kind}`}>{run.text}</span>
          ))}
          {cursor < activeQuote.length && (
            <span ref={nowRef} className="q-now">{activeQuote[cursor]}</span>
          )}
          {pace === -1 ? (
            activeQuote.slice(cursor + 1)
          ) : (
            <>
              {activeQuote.slice(cursor + 1, pace)}
              <span className="q-pace">{activeQuote[pace]}</span>
              {activeQuote.slice(pace + 1)}
            </>
          )}
          {!isComplete && <span ref={caretRef} className="passage-caret" aria-hidden="true" />}
        </p>
        {(active.author || credit.title) && (
          <p className="passage-credit">
            {active.author && active.author !== 'Proverb' && <span className="credit-author">{active.author}</span>}
            {credit.title && <cite>{credit.title}</cite>}
            {credit.detail && <span className="credit-detail">{credit.detail}</span>}
          </p>
        )}
        <div
          className="passage-meter"
          role="progressbar"
          aria-label="Quote progress"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ transform: `scaleX(${progressPct / 100})` }} />
        </div>
        {showTapHint && (
          <button type="button" className="quote-tap-hint" onClick={focusInput}>
            Tap to start typing
          </button>
        )}
      </div>

      {isComplete && (
        <QuoteResult
          wpm={wpmValue}
          accuracy={accuracyValue}
          seconds={elapsedSec}
          mistakes={describeMistakes(errorCounts)}
          personalBest={!!completion?.personalBest}
          streak={completion?.streak ?? 0}
          showAudioHint={showAudioHint}
          autoAdvance={autoAdvance}
          onDismissAudioHint={() => setShowAudioHint(false)}
          onNext={() => window.dispatchEvent(new CustomEvent('newQuote'))}
          onAgain={handleReset}
          onSave={shareCard}
          onProgress={() => window.dispatchEvent(new CustomEvent('toggleProgress', { detail: true }))}
          onToggleAutoAdvance={() => updateSettings({ autoAdvanceQuotes: !autoAdvance })}
        />
      )}

      {customOpen && (
        <CustomTextDialog
          onClose={() => { setCustomOpen(false); inputRef.current?.focus(); }}
          onSubmit={(text) => {
            setCustomOpen(false);
            window.dispatchEvent(new CustomEvent('loadCustomQuote', { detail: { text } }));
          }}
        />
      )}
    </div>
  );
};

export default QuoteTyper;
