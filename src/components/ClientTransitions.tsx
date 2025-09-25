import { useEffect } from 'react';

// Adds a short fade/slide transition when navigating between pages
// Respects prefers-reduced-motion
const ClientTransitions: React.FC = () => {
  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduceMotion) {
      let navLock = false;
      document.documentElement.classList.add('page-enter');
      const t = window.setTimeout(() => {
        document.documentElement.classList.remove('page-enter');
      }, 200);

      const onClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        // Find nearest anchor
        const a = target.closest('a') as HTMLAnchorElement | null;
        if (!a) return;
        const url = new URL(a.href, window.location.origin);
        if (url.origin !== window.location.origin) return; // external
        if (a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        // If navigating to same path, do nothing
        const same = url.pathname + url.search + url.hash === window.location.pathname + window.location.search + window.location.hash;
        if (same) { e.preventDefault(); return; }
        // Prevent double nav
        if (navLock) { e.preventDefault(); return; }
        e.preventDefault();
        navLock = true;
        document.documentElement.classList.add('page-exit');
        window.setTimeout(() => { window.location.href = url.pathname + url.search + url.hash; }, 200);
      };
      document.addEventListener('click', onClick);
      return () => {
        document.documentElement.classList.remove('page-enter');
        document.documentElement.classList.remove('page-exit');
        window.clearTimeout(t);
        document.removeEventListener('click', onClick);
      };
    }
  }, []);
  return null;
};

export default ClientTransitions;
