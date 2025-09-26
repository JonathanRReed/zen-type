import React, { useEffect, useState } from 'react';
import { getSettings } from '../utils/storage';

interface StatsBarProps {
  mode: 'zen' | 'quote';
  visible: boolean;
  metrics: Record<string, number>;
}

const StatsBar: React.FC<StatsBarProps> = ({ mode, visible, metrics }) => {
  const [show, setShow] = useState<boolean>(visible);
  const [data, setData] = useState<Record<string, number>>(metrics || {});

  useEffect(() => {
    setShow(visible);
  }, [visible]);

  useEffect(() => {
    // Initialize from saved settings on client
    try {
      const s = getSettings();
      setShow(s.showStats);
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

    window.addEventListener('toggleStats', handleToggle as EventListener);
    window.addEventListener('zenStats', handleZenStats as EventListener);
    window.addEventListener('quoteStats', handleQuoteStats as EventListener);
    return () => {
      window.removeEventListener('toggleStats', handleToggle as EventListener);
      window.removeEventListener('zenStats', handleZenStats as EventListener);
      window.removeEventListener('quoteStats', handleQuoteStats as EventListener);
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!show) return null;

  return (
    <div className="stats-cq">
      <div className="stats-bar fixed bottom-24 md:bottom-20 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-4xl px-4">
        <div className="glass rounded-3xl px-6 py-3 flex flex-wrap items-center justify-center gap-6">
          {/* Time */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted uppercase tracking-wider">Time</span>
            <span className="text-lg font-mono text-foam">
              {formatTime((data.time as number) || 0)}
            </span>
          </div>

          {/* Words */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted uppercase tracking-wider">Words</span>
            <span className="text-lg font-mono text-gold">
              {data.words || 0}
            </span>
          </div>

          {/* WPM */}
          {(mode === 'quote' || data.wpm !== undefined) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted uppercase tracking-wider">WPM</span>
              <span className="text-lg font-mono text-rose">
                {data.wpm || '—'}
              </span>
            </div>
          )}

          {/* Accuracy (Quote mode only) */}
          {mode === 'quote' && data.accuracy !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted uppercase tracking-wider">Accuracy</span>
              <span className="text-lg font-mono text-iris">
                {data.accuracy}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
