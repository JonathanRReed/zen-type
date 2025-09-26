import { useCallback, useEffect } from 'react';

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
      });
  }, []);

  useEffect(() => {
    if (!shouldUseViewTransition()) {
      return;
    }

    const root = document.documentElement;

    const navigateTo = (to: string) => {
      const go = () => {
        window.location.assign(to);
      };

      const currentTheme = root.className
        .split(/\s+/)
        .find(cls => cls.startsWith('theme-')) ?? '';
      if (currentTheme) root.setAttribute('data-transition-theme', currentTheme);

      runTransition(go);
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
