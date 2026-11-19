import React, { useEffect, useState } from 'react';
import { DEFAULT_STATS_BAR_METRICS, getStreak, type StatsBarMetricKey } from '../utils/storage';
import { useSettings } from '../hooks/useSettings';
import { getLiveStats, type LiveStats } from '../utils/liveStats';

interface StatsBarProps {
  mode: 'zen' | 'quote';
}

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const LABELS: Record<StatsBarMetricKey, string> = {
  time: 'Time',
  words: 'Words',
  wpm: 'WPM',
  accuracy: 'Accuracy',
  streak: 'Day',
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
    window.addEventListener(eventName, handleStats);
    window.addEventListener('sessionRecorded', handleRecorded);
    return () => {
      window.removeEventListener(eventName, handleStats);
      window.removeEventListener('sessionRecorded', handleRecorded);
    };
  }, [mode]);

  if (!settings.showStats) return null;

  const order = settings.statsBarMetrics?.[mode] ?? DEFAULT_STATS_BAR_METRICS[mode];
  const metrics = order.filter((key: StatsBarMetricKey) => {
    if (key === 'accuracy') return mode === 'quote';
    if (key === 'streak') return streak > 0;
    return true;
  });

  const value = (key: StatsBarMetricKey): string => {
    switch (key) {
      case 'time': return formatTime(data.time || 0);
      case 'words': return String(data.words ?? 0);
      case 'wpm': return data.wpm !== undefined ? String(data.wpm) : '–';
      case 'accuracy': return data.accuracy !== undefined ? `${data.accuracy}%` : '–';
      case 'streak': return String(streak);
    }
  };

  return (
    <div
      className="stats-bar"
      data-stats-bar
      role="region"
      aria-label={mode === 'zen' ? 'Zen session statistics' : 'Quote session statistics'}
    >
      <dl className="tally">
        {metrics.map(key => (
          <div key={key} title={key === 'streak' ? 'Days in a row with a finished session' : undefined}>
            <dt>{LABELS[key]}</dt>
            <dd className={key === 'streak' ? 'is-streak' : undefined}>{value(key)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default StatsBar;
