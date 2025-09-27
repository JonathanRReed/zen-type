// Hook for managing typing session state and statistics
import { useRef, useState, useCallback } from 'react';

interface TypingStats {
  words: number;
  chars: number;
  startTime: number;
}

interface TypingSessionOptions {
  onStats?: (stats: { words: number; chars: number; time: number; wpm: number }) => void;
  statsEmitInterval?: number;
}

export function useTypingSession({ onStats, statsEmitInterval = 1000 }: TypingSessionOptions = {}) {
  const [currentWord, setCurrentWord] = useState('');
  const [stats, setStats] = useState<TypingStats>({ words: 0, chars: 0, startTime: Date.now() });
  const lastStatsEmitRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const ghostLogRef = useRef<{ t: number; ch: string }[]>([]);
  const transcriptRef = useRef<string>('');

  const updateStats = useCallback((newChars: number = 0, newWords: number = 0) => {
    const now = Date.now();
    const updatedStats = {
      words: stats.words + newWords,
      chars: stats.chars + newChars,
      startTime: stats.startTime
    };
    
    setStats(updatedStats);

    // Emit stats if interval has passed
    if (onStats && now - lastStatsEmitRef.current > statsEmitInterval) {
      const elapsed = (now - updatedStats.startTime) / 60000; // minutes
      const wpm = elapsed > 0 ? Math.round(updatedStats.words / elapsed) : 0;
      
      onStats({
        words: updatedStats.words,
        chars: updatedStats.chars,
        time: now - updatedStats.startTime,
        wpm
      });
      
      lastStatsEmitRef.current = now;
    }
  }, [stats, onStats, statsEmitInterval]);

  const addToGhostLog = useCallback((char: string) => {
    const now = Date.now();
    ghostLogRef.current.push({ t: now, ch: char });
    
    // Keep only last 5 minutes of ghost data
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    ghostLogRef.current = ghostLogRef.current.filter(entry => entry.t > fiveMinutesAgo);
    
    transcriptRef.current += char;
  }, []);

  const processInput = useCallback((value: string) => {
    const trimmed = value.trim();
    const words = trimmed ? trimmed.split(/\s+/) : [];
    const newWordCount = Math.max(0, words.length - (currentWord ? 1 : 0));
    const newCharCount = value.length - currentWord.length;

    if (newCharCount > 0) {
      // Add new characters to ghost log
      const newChars = value.slice(currentWord.length);
      for (const char of newChars) {
        addToGhostLog(char);
      }
    }

    setCurrentWord(value);
    
    if (newWordCount > 0 || newCharCount > 0) {
      updateStats(newCharCount, newWordCount);
    }
  }, [currentWord, updateStats, addToGhostLog]);

  const resetSession = useCallback(() => {
    const now = Date.now();
    setCurrentWord('');
    setStats({ words: 0, chars: 0, startTime: now });
    sessionStartRef.current = now;
    lastStatsEmitRef.current = now;
    ghostLogRef.current = [];
    transcriptRef.current = '';
  }, []);

  const getGhostRecovery = useCallback((windowMinutes: number = 5): string => {
    const now = Date.now();
    const cutoff = now - (windowMinutes * 60 * 1000);
    const recentEntries = ghostLogRef.current.filter(entry => entry.t > cutoff);
    return recentEntries.map(entry => entry.ch).join('');
  }, []);

  return {
    currentWord,
    stats,
    sessionStartRef,
    ghostLogRef,
    transcriptRef,
    processInput,
    updateStats,
    resetSession,
    addToGhostLog,
    getGhostRecovery,
  };
}