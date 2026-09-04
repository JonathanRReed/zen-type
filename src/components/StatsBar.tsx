import React, { useEffect, useState, useMemo } from 'react';
import { getSettings, type StatsBarMetricKey, DEFAULT_STATS_BAR_METRICS } from '../utils/storage';

interface StatsBarProps {
  mode: 'zen' | 'quote';
  visible: boolean;
  metrics: Record<string, number>;
}

const StatsBar: React.FC<StatsBarProps> = ({ mode, visible, metrics }) => {
  const [userToggledShow, setUserToggledShow] = useState<boolean | null>(() => {
    try {
      return getSettings().showStats;
    } catch {
      return null;
    }
  });
  const [data, setData] = useState<Record<string, number>>(metrics || {});
  const [metricOrder, setMetricOrder] = useState<StatsBarMetricKey[]>(() => {
    try {
      const s = getSettings();
      const selected = s.statsBarMetrics?.[mode];
      if (selected && selected.length) return selected;
    } catch {}
    return DEFAULT_STATS_BAR_METRICS[mode];
  });
  const show = userToggledShow !== null ? userToggledShow : visible;

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail as boolean;
      setUserToggledShow(detail);
    };
    const handleZenStats = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, number>;
      setData(detail);
      (window as any).__zenStats = detail;
    };
    const handleQuoteStats = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, number>;
      setData(detail);
      (window as any).__quoteStats = detail;
    };
    const handleMetricsChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as ReturnType<typeof getSettings>;
      const selected = detail.statsBarMetrics?.[mode];
      if (selected && selected.length) {
        setMetricOrder(selected);
      } else {
        setMetricOrder(DEFAULT_STATS_BAR_METRICS[mode]);
      }
    };

    window.addEventListener('toggleStats', handleToggle as EventListener);
    window.addEventListener('zenStats', handleZenStats as EventListener);
    window.addEventListener('quoteStats', handleQuoteStats as EventListener);
    window.addEventListener('settingsChanged', handleMetricsChange as EventListener);
    return () => {
      window.removeEventListener('toggleStats', handleToggle as EventListener);
      window.removeEventListener('zenStats', handleZenStats as EventListener);
      window.removeEventListener('quoteStats', handleQuoteStats as EventListener);
      window.removeEventListener('settingsChanged', handleMetricsChange as EventListener);
    };
  }, [mode]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const displayedMetrics = useMemo(() => {
    return metricOrder.filter((key) => {
      if (mode === 'zen' && key === 'accuracy') return false;
      if (mode === 'quote' && key === 'accuracy') return true;
      if (key === 'wpm') {
        if (mode === 'zen') return data.wpm !== undefined;
        if (mode === 'quote') return data.wpm !== undefined;
      }
      return true;
    });
  }, [metricOrder, mode, data]);

  if (!show) return null;

  return (
    <div className="stats-cq">
      <div className="stats-bar fixed bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))] md:bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] left-1/2 transform -translate-x-1/2 z-40 w-full max-w-4xl px-4" data-stats-bar role="region" aria-label={mode === 'zen' ? 'Zen session statistics' : 'Quote session statistics'}>
        <div className="rounded-full px-8 py-3.5 flex flex-wrap items-center justify-center gap-8
                        bg-surface/40 backdrop-blur-xl border border-tint/25
                        shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]
                        transition-colors duration-300 hover:bg-surface/50 hover:border-tint/35">
          {displayedMetrics.map((key) => {
            if (key === 'time') {
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  <span className="text-[10px] text-muted/80 uppercase tracking-widest font-medium">Time</span>
                  <span className="text-xl font-mono text-tint font-semibold tabular-nums">
                    {formatTime((data.time as number) || 0)}
                  </span>
                </div>
              );
            }

            if (key === 'words') {
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  <span className="text-[10px] text-muted/80 uppercase tracking-widest font-medium">Words</span>
                  <span className="text-xl font-mono text-tint2 font-semibold tabular-nums">
                    {data.words ?? 0}
                  </span>
                </div>
              );
            }

            if (key === 'wpm') {
              const value = data.wpm;
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  <span className="text-[10px] text-muted/80 uppercase tracking-widest font-medium">WPM</span>
                  <span className="text-xl font-mono text-tint font-semibold tabular-nums">
                    {value !== undefined ? value : '—'}
                  </span>
                </div>
              );
            }

            if (key === 'accuracy' && mode === 'quote') {
              const value = data.accuracy;
              return (
                <div key={key} className="flex items-center gap-2.5 px-1">
                  <span className="text-[10px] text-muted/80 uppercase tracking-widest font-medium">Accuracy</span>
                  <span className="text-xl font-mono text-tint2 font-semibold tabular-nums">
                    {value !== undefined ? `${value}%` : '—'}
                  </span>
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
