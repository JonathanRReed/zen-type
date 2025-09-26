import { useCallback, useEffect, useRef } from 'react';
import { initializeWebVitals } from '../utils/webvitals';

const isSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome|Chromium|Edg|Edge|OPR/.test(ua);
};

const shouldUseViewTransition = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // @ts-ignore experimental API
  const vt = (document as any).startViewTransition;
  if (reduceMotion || typeof vt !== 'function') return false;
  if (isSafari()) return false;
  return true;
};

const ClientTransitions: React.FC = () => {
  const pendingNavigateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('page-exit');
    root.classList.add('page-enter');
    root.classList.add('body-ready');
    const raf = window.requestAnimationFrame(() => {
      root.classList.remove('page-enter');
    });
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const runTransition = useCallback((navigate: () => void) => {
    // @ts-ignore experimental API
    const vt = typeof document !== 'undefined' ? (document as any).startViewTransition : undefined;
    if (!shouldUseViewTransition() || typeof vt !== 'function') {
      navigate();
      return;
    }

    // @ts-ignore startViewTransition signature
    const transition = vt(navigate);
    const root = document.documentElement;
    const timeout = window.setTimeout(() => {
      root.removeAttribute('data-transition-theme');
    }, 600);

    transition.finished
      .catch(() => {})
      .finally(() => {
        root.removeAttribute('data-transition-theme');
        window.clearTimeout(timeout);
        pendingNavigateRef.current?.();
        pendingNavigateRef.current = null;
      });
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const supportsViewTransition = shouldUseViewTransition();

    if (supportsViewTransition) {
      initializeWebVitals();
    }

    let isNavigating = false;

    const navigateTo = (to: string) => {
      if (isNavigating) {
        pendingNavigateRef.current = () => navigateTo(to);
        return;
      }

      isNavigating = true;
      const go = () => {
        isNavigating = false;
        window.location.assign(to);
      };

      const startExit = () => {
        root.classList.remove('page-enter');
        root.classList.add('page-exit');
      };

      if (supportsViewTransition) {
        const currentTheme = root.className
          .split(/\s+/)
          .find(cls => cls.startsWith('theme-')) ?? '';
        if (currentTheme) root.setAttribute('data-transition-theme', currentTheme);
        startExit();
        runTransition(go);
        return;
      }

      const body = document.body;

      if (!body) {
        startExit();
        go();
        return;
      }

      let fallbackTimeout = 0;

      const cleanup = () => {
        body.removeEventListener('transitionend', handleTransitionEnd);
        if (fallbackTimeout) {
          window.clearTimeout(fallbackTimeout);
        }
      };

      const handleTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== body) return;
        cleanup();
        go();
      };

      body.addEventListener('transitionend', handleTransitionEnd);

      fallbackTimeout = window.setTimeout(() => {
        cleanup();
        go();
      }, 320);

      window.requestAnimationFrame(() => {
        startExit();
      });
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;

      const url = new URL(anchor.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (anchor.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const current = window.location.pathname + window.location.search + window.location.hash;
      const next = url.pathname + url.search + url.hash;
      if (current === next) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      navigateTo(next);
    };

    const onAppNavigate = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail) return;
      navigateTo(detail);
    };

    document.addEventListener('click', onClick);
    window.addEventListener('app:navigate', onAppNavigate as EventListener);

    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('app:navigate', onAppNavigate as EventListener);
      root.removeAttribute('data-transition-theme');
    };
  }, [runTransition]);

  return null;
};

export default ClientTransitions;
