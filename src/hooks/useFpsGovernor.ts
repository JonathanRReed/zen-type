// Hook for FPS monitoring and performance throttling
import { useRef, useCallback } from 'react';

interface FpsGovernorState {
  frameTimesRef: React.MutableRefObject<number[]>;
  perfGuardRef: React.MutableRefObject<boolean>;
  dynCapRef: React.MutableRefObject<number>;
}

interface FpsGovernorReturn extends FpsGovernorState {
  updateFps: () => { avgFps: number; shouldThrottle: boolean };
  resetPerformanceGuard: () => void;
  getThrottledCap: (maxTokens: number, perfMode: boolean) => number;
}

export function useFpsGovernor(maxTokens: number): FpsGovernorReturn {
  const frameTimesRef = useRef<number[]>([]);
  const perfGuardRef = useRef<boolean>(false);
  const dynCapRef = useRef<number>(maxTokens);

  const updateFps = useCallback(() => {
    const frames = frameTimesRef.current;
    const nowMs = performance.now();
    frames.push(nowMs);
    
    // Keep last ~2s (120 frames at 60fps)
    if (frames.length > 120) frames.shift();
    
    let avgFps = 60; // Default fallback
    let shouldThrottle = false;
    
    if (frames.length > 30) {
      // Calculate average FPS
      const firstFrame = frames[0];
      const lastFrame = frames[frames.length - 1];
      if (firstFrame !== undefined && lastFrame !== undefined) {
        const totalDt = lastFrame - firstFrame;
        avgFps = (frames.length - 1) * 1000 / Math.max(1, totalDt);
        
        // Performance guard logic
        if (avgFps < 55 && !perfGuardRef.current) {
          perfGuardRef.current = true;
          dynCapRef.current = Math.min(80, maxTokens); // Throttle to 80 tokens max
          shouldThrottle = true;
        } else if (avgFps >= 58 && perfGuardRef.current) {
          perfGuardRef.current = false;
          dynCapRef.current = maxTokens;
          shouldThrottle = false;
        }
      }
    }
    
    return { avgFps, shouldThrottle };
  }, [maxTokens]);

  const resetPerformanceGuard = useCallback(() => {
    perfGuardRef.current = false;
    dynCapRef.current = maxTokens;
    frameTimesRef.current = [];
  }, [maxTokens]);

  const getThrottledCap = useCallback((defaultMaxTokens: number, perfMode: boolean) => {
    if (perfMode) {
      return Math.min(80, defaultMaxTokens);
    }
    return dynCapRef.current;
  }, []);

  return {
    frameTimesRef,
    perfGuardRef,
    dynCapRef,
    updateFps,
    resetPerformanceGuard,
    getThrottledCap,
  };
}