// Core Web Vitals Performance Monitoring
// Tracks LCP, FID, and CLS metrics for performance optimization

interface PerformanceMetrics {
  lcp: number;
  fid: number;
  cls: number;
}

interface WebVitalsConfig {
  reportToConsole?: boolean;
  reportToAnalytics?: (metrics: PerformanceMetrics) => void;
  enableTracking?: boolean;
}

class WebVitalsTracker {
  private config: WebVitalsConfig;
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];

  constructor(config: WebVitalsConfig = {}) {
    this.config = {
      reportToConsole: true,
      enableTracking: true,
      ...config,
    };

    if (this.config.enableTracking) {
      this.initializeTracking();
    }
  }

  private initializeTracking() {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    this.trackLCP();
    this.trackFID();
    this.trackCLS();
    this.trackNavigationTiming();
  }

  private trackLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };

        this.metrics.lcp = lastEntry.startTime;

        if (this.config.reportToConsole) {
          console.log(`📊 LCP (Largest Contentful Paint): ${this.metrics.lcp}ms`);
        }

        this.reportMetrics();
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch {
      console.warn('LCP tracking not supported');
    }
  }

  private trackFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.fid = entry.processingStart - entry.startTime;

          if (this.config.reportToConsole) {
            console.log(`⚡ FID (First Input Delay): ${this.metrics.fid}ms`);
          }

          this.reportMetrics();
        });
      });

      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch {
      console.warn('FID tracking not supported');
    }
  }

  private trackCLS() {
    let clsValue = 0;
    let clsEntries: any[] = [];

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsEntries.push(entry);
            clsValue += entry.value;
          }
        });

        // CLS is the maximum value from all sessions
        this.metrics.cls = clsValue;

        if (this.config.reportToConsole) {
          console.log(`📐 CLS (Cumulative Layout Shift): ${this.metrics.cls}`);
        }

        this.reportMetrics();
      });

      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch {
      console.warn('CLS tracking not supported');
    }
  }

  private trackNavigationTiming() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      if (navigation) {
        const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
        const loadComplete = navigation.loadEventEnd - navigation.loadEventStart;

        if (this.config.reportToConsole) {
          console.log(`🏠 Navigation Timing:`);
          console.log(`   - DOM Content Loaded: ${domContentLoaded}ms`);
          console.log(`   - Load Complete: ${loadComplete}ms`);
          console.log(`   - Total Load Time: ${navigation.loadEventEnd - (navigation as any).navigationStart}ms`);
        }
      }
    }
  }

  private reportMetrics() {
    const completeMetrics = this.metrics as PerformanceMetrics;

    if (this.config.reportToAnalytics && completeMetrics.lcp && completeMetrics.fid && completeMetrics.cls) {
      this.config.reportToAnalytics(completeMetrics);
    }

    // Report complete metrics to console
    if (this.config.reportToConsole && completeMetrics.lcp && completeMetrics.fid && completeMetrics.cls) {
      console.log('🎯 Core Web Vitals Summary:', completeMetrics);
      this.evaluatePerformance(completeMetrics);
    }
  }

  private evaluatePerformance(metrics: PerformanceMetrics) {
    const { lcp, fid, cls } = metrics;

    console.log('📊 Performance Evaluation:');

    // LCP evaluation (Largest Contentful Paint)
    if (lcp <= 2500) {
      console.log('   ✅ LCP: Good (≤ 2.5s)');
    } else if (lcp <= 4000) {
      console.log('   ⚠️ LCP: Needs improvement (2.5s - 4s)');
    } else {
      console.log('   ❌ LCP: Poor (> 4s)');
    }

    // FID evaluation (First Input Delay)
    if (fid <= 100) {
      console.log('   ✅ FID: Good (≤ 100ms)');
    } else if (fid <= 300) {
      console.log('   ⚠️ FID: Needs improvement (100ms - 300ms)');
    } else {
      console.log('   ❌ FID: Poor (> 300ms)');
    }

    // CLS evaluation (Cumulative Layout Shift)
    if (cls <= 0.1) {
      console.log('   ✅ CLS: Good (≤ 0.1)');
    } else if (cls <= 0.25) {
      console.log('   ⚠️ CLS: Needs improvement (0.1 - 0.25)');
    } else {
      console.log('   ❌ CLS: Poor (> 0.25)');
    }
  }

  public getMetrics(): Partial<PerformanceMetrics> {
    return { ...this.metrics };
  }

  public disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Create singleton instance
let webVitalsTracker: WebVitalsTracker | null = null;

export function initializeWebVitals(config?: WebVitalsConfig) {
  if (webVitalsTracker) {
    return webVitalsTracker;
  }

  webVitalsTracker = new WebVitalsTracker(config);
  return webVitalsTracker;
}

export function getWebVitalsMetrics() {
  return webVitalsTracker?.getMetrics() || {};
}

export function disconnectWebVitals() {
  webVitalsTracker?.disconnect();
  webVitalsTracker = null;
}

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  // Initialize after page load to avoid blocking
  window.addEventListener('load', () => {
    setTimeout(() => {
      initializeWebVitals();
    }, 0);
  });
}

export default WebVitalsTracker;
