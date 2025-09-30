/**
 * Enhanced loading states and transitions for Zen Type
 * Provides smooth loading experiences and better user feedback
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

export interface LoadingState {
  isLoading: boolean;
  progress?: number; // 0-100
  message?: string;
  type: 'quote' | 'session' | 'export' | 'save' | 'general';
}

export interface TransitionOptions {
  duration?: number;
  easing?: string;
  delay?: number;
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'foam' | 'iris' | 'gold' | 'muted';
  message?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'foam',
  message,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const spinner = (
    <div className={`${sizeClasses[size]} ${className}`}>
      <svg
        className={`animate-spin text-${color}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );

  if (!message) return spinner;

  return (
    <div className="flex items-center gap-3">
      {spinner}
      <span className="text-sm text-muted animate-pulse">{message}</span>
    </div>
  );
};

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  progress?: number;
  onCancel?: () => void;
  className?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'Loading...',
  progress,
  onCancel,
  className = ''
}) => {
  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 z-[1500] bg-base/80 backdrop-blur-sm flex items-center justify-center ${className}`}>
      <div className="glass rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
        <LoadingSpinner size="lg" message={message} className="mx-auto mb-4" />

        {progress !== undefined && (
          <div className="mb-4">
            <div className="w-full bg-overlay/40 rounded-full h-2 mb-2">
              <div
                className="bg-foam h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
            <div className="text-sm text-muted">{Math.round(progress)}%</div>
          </div>
        )}

        {onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            className="bg-surface/60 hover:bg-surface/80 border-muted/20 text-text"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
  animate?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 3,
  className = '',
  animate = true
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-gradient-to-r from-overlay/60 via-overlay/80 to-overlay/60 rounded ${
            animate ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${Math.random() * 40 + 60}%`,
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

export class LoadingManager {
  private static instance: LoadingManager;
  private loadingStates = new Map<string, LoadingState>();
  private listeners = new Set<(states: Map<string, LoadingState>) => void>();

  static getInstance(): LoadingManager {
    if (!LoadingManager.instance) {
      LoadingManager.instance = new LoadingManager();
    }
    return LoadingManager.instance;
  }

  /**
   * Set loading state for a specific operation
   */
  setLoading(key: string, state: LoadingState): void {
    this.loadingStates.set(key, state);
    this.notifyListeners();
  }

  /**
   * Update loading progress
   */
  updateProgress(key: string, progress: number, message?: string): void {
    const current = this.loadingStates.get(key);
    if (current) {
      this.loadingStates.set(key, {
        ...current,
        progress: Math.min(100, Math.max(0, progress)),
        ...(message !== undefined && { message })
      });
      this.notifyListeners();
    }
  }

  /**
   * Clear loading state
   */
  clearLoading(key: string): void {
    this.loadingStates.delete(key);
    this.notifyListeners();
  }

  /**
   * Clear all loading states
   */
  clearAll(): void {
    this.loadingStates.clear();
    this.notifyListeners();
  }

  /**
   * Get current loading state
   */
  getLoadingState(key: string): LoadingState | undefined {
    return this.loadingStates.get(key);
  }

  /**
   * Check if any loading is in progress
   */
  isLoading(): boolean {
    return Array.from(this.loadingStates.values()).some(state => state.isLoading);
  }

  /**
   * Get all current loading states
   */
  getAllLoadingStates(): Map<string, LoadingState> {
    return new Map(this.loadingStates);
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(listener: (states: Map<string, LoadingState>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const states = new Map(this.loadingStates);
    this.listeners.forEach(listener => listener(states));
  }
}

// React hook for using loading manager
export const useLoadingManager = () => {
  const [loadingStates, setLoadingStates] = useState<Map<string, LoadingState>>(new Map());

  useEffect(() => {
    const unsubscribe = LoadingManager.getInstance().subscribe(setLoadingStates);
    return unsubscribe;
  }, []);

  const setLoading = useCallback((key: string, state: LoadingState) => {
    LoadingManager.getInstance().setLoading(key, state);
  }, []);

  const updateProgress = useCallback((key: string, progress: number, message?: string) => {
    LoadingManager.getInstance().updateProgress(key, progress, message);
  }, []);

  const clearLoading = useCallback((key: string) => {
    LoadingManager.getInstance().clearLoading(key);
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) {
      return LoadingManager.getInstance().getLoadingState(key)?.isLoading || false;
    }
    return LoadingManager.getInstance().isLoading();
  }, []);

  return {
    loadingStates,
    setLoading,
    updateProgress,
    clearLoading,
    isLoading
  };
};

// Smooth transition component
interface SmoothTransitionProps {
  isVisible: boolean;
  children: React.ReactNode;
  options?: TransitionOptions;
  className?: string;
}

export const SmoothTransition: React.FC<SmoothTransitionProps> = ({
  isVisible,
  children,
  options = {},
  className = ''
}) => {
  const {
    duration = 300,
    easing = 'ease-in-out',
    delay = 0
  } = options;

  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      return; // No cleanup needed when becoming visible
    } else {
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  if (!shouldRender) return null;

  return (
    <div
      className={`transition-all ${className}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: easing,
        transitionDelay: `${delay}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(-10px)'
      }}
    >
      {children}
    </div>
  );
};

// Quote loading component with skeleton
interface QuoteLoaderProps {
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const QuoteLoader: React.FC<QuoteLoaderProps> = ({
  isLoading,
  error,
  onRetry
}) => {
  if (error) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-love mb-4">⚠️</div>
        <h3 className="text-lg font-medium text-text mb-2">Failed to load quote</h3>
        <p className="text-muted mb-4">{error}</p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="bg-iris/20 hover:bg-iris/30 border-iris/40 text-iris"
          >
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-8">
        <div className="mb-6">
          <SkeletonLoader lines={4} className="mb-4" />
          <div className="text-right">
            <SkeletonLoader lines={1} className="w-24 ml-auto" />
          </div>
        </div>
        <div className="space-y-4">
          <SkeletonLoader lines={2} />
        </div>
      </div>
    );
  }

  return null;
};

// Export singleton instances
export const loadingManager = LoadingManager.getInstance();
