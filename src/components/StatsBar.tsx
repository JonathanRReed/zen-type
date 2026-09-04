import React, { useEffect, useState, useMemo } from 'react';
import { DEFAULT_STATS_BAR_METRICS, getStreak, type StatsBarMetricKey } from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import { getLiveStats, type LiveStats } from '../utils/liveStats';

interface StatsBarProps {
  mode: 'zen' | 'quote';
}

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const StatsBar: React.FC<StatsBarProps> = ({ mode }) => {
  const settings = useSettings();
  const [data, setData] = useState<LiveStats>(() => getLiveStats(mode));
  const [streak, setStreak] = useState<number>(() => {
    try { return getStreak(); } catch { return 0; }
  });

  useEffect(() => {
    const eventName = mode === 'zen' ? 'zenStats' : 'quoteStats';
    const handleStats = (e: Event) => setData((e as CustomEvent).detail as LiveStats);
    const handleRecorded = () => {
      try { setStreak(getStreak()); } catch { /* storage blocked */ }
    };
    window.addEventListener(eventName, handleStats as EventListener);
    window.addEventListener('sessionRecorded', handleRecorded);
    return () => {
      window.removeEventListener(eventName, handleStats as EventListener);
      window.removeEventListener('sessionRecorded', handleRecorded);
    };
  }, [mode]);

  const metricOrder = settings.statsBarMetrics?.[mode] ?? DEFAULT_STATS_BAR_METRICS[mode];

  const displayedMetrics = useMemo(() => {
    return metricOrder.filter((key: StatsBarMetricKey) => {
      if (key === 'accuracy') return mode === 'quote';
      if (key === 'streak') return streak > 0;
      return true;
    });
  }, [metricOrder, mode, streak]);

  if (!settings.showStats) return null;

  const label = (text: string) => (
    <span className="text-[10px] text-muted/80 uppercase tracking-widest font-medium">{text}</span>
  );

  return (
    <div className="stats-cq">
      <div
        className="stats-bar fixed bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))] md:bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] left-1/2 transform -translate-x-1/2 z-40 w-full max-w-4xl px-4"
        data-stats-bar
        role="region"
        aria-label={mode === 'zen' ? 'Zen session statistics' : 'Quote session statistics'}
      >
        <div className="rounded-full px-8 py-3.5 flex flex-wrap items-center justify-center gap-8
                        bg-surface/40 backdrop-blur-xl border border-tint/25
                        shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]
                        transition-colors duration-300 hover:bg-surface/50 hover:border-tint/35">
          {displayedMetrics.map((key) => {
            if (key === 'time') {
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  {label('Time')}
                  <span className="text-xl font-mono text-tint font-semibold tabular-nums">{formatTime(data.time || 0)}</span>
                </div>
              );
            }
            if (key === 'words') {
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  {label('Words')}
                  <span className="text-xl font-mono text-tint2 font-semibold tabular-nums">{data.words ?? 0}</span>
                </div>
              );
            }
            if (key === 'wpm') {
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  {label('WPM')}
                  <span className="text-xl font-mono text-tint font-semibold tabular-nums">{data.wpm !== undefined ? data.wpm : '—'}</span>
                </div>
              );
            }
            if (key === 'accuracy') {
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  {label('Accuracy')}
                  <span className="text-xl font-mono text-tint2 font-semibold tabular-nums">{data.accuracy !== undefined ? `${data.accuracy}%` : '—'}</span>
                </div>
              );
            }
            if (key === 'streak') {
              return (
                <div key={key} className="flex items-center gap-2.5 px-1" title="Consecutive days with a finished session">
                  {label('Day')}
                  <span className="text-xl font-mono text-gold font-semibold tabular-nums">{streak}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
