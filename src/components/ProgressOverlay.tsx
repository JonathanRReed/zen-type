import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getHistory, getStats, getStreak, getPracticeDays, type SessionRecord } from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import { useModal } from '../hooks/useModal';
import { markInteractiveReady } from '../utils/interactiveReady';
import { IconClose } from './icons';

// Progress, built only from what this browser has recorded. Opens from the
// pause menu, the completion card, or Ctrl/Cmd+P. When the stats bar is
// hidden the view goes quiet: days and words, no speeds.

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDuration = (sec: number): string => {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
};

const relativeDay = (iso: string): string => {
  const d = new Date(iso);
  const today = dayKey(new Date());
  const key = dayKey(d);
  if (key === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

interface WeekGrid {
  weeks: Array<Array<{ key: string; count: number; words: number; future: boolean }>>;
  monthLabels: Array<{ index: number; label: string }>;
}

function buildGrid(history: SessionRecord[], weeks = 16): WeekGrid {
  const perDay = new Map<string, { count: number; words: number }>();
  for (const r of history) {
    const key = dayKey(new Date(r.date));
    const cur = perDay.get(key) ?? { count: 0, words: 0 };
    cur.count += 1;
    cur.words += r.words;
    perDay.set(key, cur);
  }
  const today = new Date();
  const end = new Date(today);
  // Pad to the end of the current week (Saturday) so columns line up.
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - weeks * 7 + 1);
  const grid: WeekGrid['weeks'] = [];
  const monthLabels: WeekGrid['monthLabels'] = [];
  let lastMonth = -1;
  const cursor = new Date(start);
  for (let w = 0; w < weeks; w++) {
    const week: WeekGrid['weeks'][number] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(cursor);
      const cell = perDay.get(key);
      week.push({ key, count: cell?.count ?? 0, words: cell?.words ?? 0, future: cursor > today });
      // Label the column that contains the first of a month.
      if (cursor.getMonth() !== lastMonth && cursor <= today) {
        lastMonth = cursor.getMonth();
        if (monthLabels.length === 0 || monthLabels[monthLabels.length - 1]!.index !== w) {
          monthLabels.push({ index: w, label: cursor.toLocaleDateString(undefined, { month: 'short' }) });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(week);
  }
  return { weeks: grid, monthLabels };
}

function Sparkline({ values, best }: { values: number[]; best?: number }) {
  if (values.length < 2) return null;
  const w = 320;
  const h = 72;
  const pad = 6;
  const max = Math.max(...values, best ?? 0, 1);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1]![0].toFixed(1)},${h} L${pts[0]![0].toFixed(1)},${h} Z`;
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sparkline" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--theme-accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--theme-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={path} fill="none" stroke="var(--theme-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--theme-accent)" />
    </svg>
  );
}

const ProgressBody: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const settings = useSettings();
  const quiet = !settings.showStats;
  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener('sessionRecorded', refresh);
    return () => window.removeEventListener('sessionRecorded', refresh);
  }, []);

  const data = useMemo(() => {
    void tick;
    const history = getHistory();
    const stats = getStats();
    const streak = getStreak();
    const days = getPracticeDays();
    const quotes = history.filter(r => r.mode === 'quote' && r.wpm !== undefined);
    const zen = history.filter(r => r.mode === 'zen');
    const recentQuotes = quotes.slice(-30);
    const recentAccuracy = quotes.slice(-30).map(r => r.accuracy ?? 100);
    const avgAccuracy = recentAccuracy.length ? Math.round(recentAccuracy.reduce((a, b) => a + b, 0) / recentAccuracy.length) : null;
    const avgWpm = recentQuotes.length ? Math.round(recentQuotes.reduce((a, b) => a + (b.wpm ?? 0), 0) / recentQuotes.length) : null;
    const earlier = quotes.slice(-60, -30);
    const earlierWpm = earlier.length ? Math.round(earlier.reduce((a, b) => a + (b.wpm ?? 0), 0) / earlier.length) : null;
    const totalTime = history.reduce((a, r) => a + r.timeSec, 0);
    return {
      history,
      stats,
      streak,
      days,
      quotes,
      zen,
      recentQuotes,
      avgAccuracy,
      avgWpm,
      earlierWpm,
      totalTime,
      grid: buildGrid(history),
      recent: history.slice(-8).reverse(),
    };
  }, [tick]);

  useModal(backdropRef, onClose);
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const maxWords = Math.max(1, ...data.grid.weeks.flat().map(c => c.words));
  const empty = data.history.length === 0;

  return (
    <div ref={backdropRef} className="overlay-backdrop" role="dialog" aria-modal="true" aria-labelledby="progress-title">
      <div className="overlay-dismiss" aria-hidden="true" onClick={onClose} />
      <div ref={cardRef} tabIndex={-1} className="overlay-card sheet sheet-lg">
        <div className="sheet-head">
          <h2 id="progress-title" className="sheet-title">Progress</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close progress">
            <IconClose />
          </button>
        </div>

        {empty ? (
          <p className="sheet-lede">
            Nothing here yet. Finish a quote or write for a while in Zen mode, and this fills in. Everything stays in this browser.
          </p>
        ) : (
          <>
            <dl className="result-figures result-figures-sm">
              <div>
                <dt>Days practiced</dt>
                <dd>{data.days.length}</dd>
              </div>
              <div>
                <dt>In a row</dt>
                <dd className="is-streak">{data.streak}</dd>
              </div>
              <div>
                <dt>Words</dt>
                <dd>{data.stats.totalWords.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{formatDuration(data.totalTime)}</dd>
              </div>
            </dl>

            <section className="settings-group" aria-label="Practice calendar">
              <div className="progress-head">
                <h3>Last sixteen weeks</h3>
                <span>{data.history.length} {data.history.length === 1 ? 'session' : 'sessions'}</span>
              </div>
              <div className="progress-grid" role="img" aria-label={`Practice calendar: ${data.days.length} days with at least one session`}>
                <div className="progress-months">
                  {data.grid.monthLabels.map(m => (
                    <span key={`${m.label}-${m.index}`} style={{ gridColumnStart: m.index + 1 }}>{m.label}</span>
                  ))}
                </div>
                <div className="progress-weeks">
                  {data.grid.weeks.map((week, wi) => (
                    <div key={wi} className="progress-week">
                      {week.map(cell => {
                        const level = cell.count === 0 ? 0 : Math.min(4, 1 + Math.floor((cell.words / maxWords) * 3.99));
                        return (
                          <span
                            key={cell.key}
                            className={`progress-cell level-${level}${cell.future ? ' is-future' : ''}`}
                            title={cell.count ? `${cell.key}: ${cell.count} session${cell.count === 1 ? '' : 's'}, ${cell.words} words` : cell.key}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {!quiet && data.recentQuotes.length >= 2 && (
              <section className="settings-group" aria-label="Speed">
                <div className="progress-head">
                  <h3>Words a minute, last {data.recentQuotes.length} quotes</h3>
                  <span>
                    best {data.stats.bestWpm}
                    {data.avgWpm !== null && <>, average {data.avgWpm}</>}
                    {data.avgAccuracy !== null && <>, accuracy {data.avgAccuracy}%</>}
                  </span>
                </div>
                <Sparkline values={data.recentQuotes.map(r => r.wpm ?? 0)} best={data.stats.bestWpm} />
                {data.earlierWpm !== null && data.avgWpm !== null && (
                  <p className="setting-note">
                    {data.avgWpm > data.earlierWpm
                      ? `Up ${data.avgWpm - data.earlierWpm} from the thirty before.`
                      : data.avgWpm < data.earlierWpm
                        ? `Down ${data.earlierWpm - data.avgWpm} from the thirty before. Speed comes and goes; accuracy is the thing to hold.`
                        : 'Level with the thirty before.'}
                  </p>
                )}
              </section>
            )}

            {data.zen.length > 0 && (
              <section className="settings-group" aria-label="Zen sessions">
                <h3>Zen mode</h3>
                <p className="sheet-prose">
                  {data.zen.length} session{data.zen.length === 1 ? '' : 's'}, {data.zen.reduce((a, r) => a + r.words, 0).toLocaleString()} words written,
                  {' '}{formatDuration(data.zen.reduce((a, r) => a + r.timeSec, 0))} at the page.
                </p>
              </section>
            )}

            <section className="settings-group" aria-label="Recent sessions">
              <h3>Recent</h3>
              <ul className="progress-recent">
                {data.recent.map(r => (
                  <li key={r.id}>
                    <span className="progress-recent-day">{relativeDay(r.date)}</span>
                    <span className="progress-recent-what">{r.mode === 'quote' ? 'Quote' : 'Zen'}, {formatDuration(r.timeSec)}</span>
                    <span className="progress-recent-score">
                      {r.mode === 'quote' && !quiet && r.wpm !== undefined
                        ? `${r.wpm} wpm${r.accuracy !== undefined ? `, ${r.accuracy}%` : ''}`
                        : `${r.words} words`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="sheet-meta" style={{ marginTop: '1.25rem' }}>
              Kept in this browser only. Back it up from Settings if you want to take it with you.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const ProgressOverlay: React.FC = () => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent('focusTyping'));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOpen(prev => (typeof detail === 'boolean' ? detail : !prev));
    };
    window.addEventListener('toggleProgress', handler as EventListener);
    const releaseReady = markInteractiveReady('progress');
    return () => {
      releaseReady();
      window.removeEventListener('toggleProgress', handler as EventListener);
    };
  }, []);

  if (!open) return null;
  return <ProgressBody onClose={close} />;
};

export default ProgressOverlay;
