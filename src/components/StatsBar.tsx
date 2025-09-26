import React, { useEffect, useState, useMemo } from 'react';
import { getSettings, type StatsBarMetricKey, DEFAULT_STATS_BAR_METRICS } from '../utils/storage';

interface StatsBarProps {
  mode: 'zen' | 'quote';
  visible: boolean;
  metrics: Record<string, number>;
}

const StatsBar: React.FC<StatsBarProps> = ({ mode, visible, metrics }) => {
  const [show, setShow] = useState<boolean>(visible);
  const [data, setData] = useState<Record<string, number>>(metrics || {});
  const [metricOrder, setMetricOrder] = useState<StatsBarMetricKey[]>(DEFAULT_STATS_BAR_METRICS[mode]);

  useEffect(() => {
    setShow(visible);
  }, [visible]);

  useEffect(() => {
    // Initialize from saved settings on client
    try {
      const s = getSettings();
      setShow(s.showStats);
      const selected = s.statsBarMetrics?.[mode];
      if (selected && selected.length) {
        setMetricOrder(selected);
      } else {
        setMetricOrder(DEFAULT_STATS_BAR_METRICS[mode]);
      }
    } catch {}

    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail as boolean;
      setShow(detail);
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
      <div className="stats-bar fixed bottom-24 md:bottom-20 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-4xl px-4" data-stats-bar>
        <div className="glass rounded-3xl px-6 py-3 flex flex-wrap items-center justify-center gap-6">
          {displayedMetrics.map((key) => {
            if (key === 'time') {
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted uppercase tracking-wider">Time</span>
                  <span className="text-lg font-mono text-foam">
                    {formatTime((data.time as number) || 0)}
                  </span>
                </div>
              );
            }

            if (key === 'words') {
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted uppercase tracking-wider">Words</span>
                  <span className="text-lg font-mono text-gold">
                    {data.words ?? 0}
                  </span>
                </div>
              );
            }

            if (key === 'wpm') {
              const value = data.wpm;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted uppercase tracking-wider">WPM</span>
                  <span className="text-lg font-mono text-rose">
                    {value !== undefined ? value : '—'}
                  </span>
                </div>
              );
            }

            if (key === 'accuracy' && mode === 'quote') {
              const value = data.accuracy;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted uppercase tracking-wider">Accuracy</span>
                  <span className="text-lg font-mono text-iris">
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
