import { useEffect } from 'react';

// Minimal navigation smoother: use View Transitions if available; otherwise immediate nav.
// Avoids double-load look by not applying any enter animations on arrival.
const ClientTransitions: React.FC = () => {
  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const navigate = (to: string) => {
      const go = () => { window.location.href = to; };
      // @ts-ignore experimental API
      const vt = (document as any).startViewTransition;
      if (!reduceMotion && typeof vt === 'function') {
        // @ts-ignore
        vt(go);
      } else {
        // Fallback: immediate navigation, no extra CSS animations
        go();
      }
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const a = target.closest('a') as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.origin);
      if (url.origin !== window.location.origin) return; // external
      if (a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const same = url.pathname + url.search + url.hash === window.location.pathname + window.location.search + window.location.hash;
      if (same) { e.preventDefault(); return; }
      e.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };

    document.addEventListener('click', onClick);

    const onAppNavigate = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (!url) return;
      navigate(url);
    };
    window.addEventListener('app:navigate', onAppNavigate as EventListener);

    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('app:navigate', onAppNavigate as EventListener);
    };
  }, []);
  return null;
};

export default ClientTransitions;
