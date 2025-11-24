import { useEffect, useRef } from 'react';
import { navigate } from 'astro:transitions/client';
import { initializeWebVitals } from '../utils/webvitals';

const ClientTransitions: React.FC = () => {
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Initialize web vitals tracking
    initializeWebVitals();

    // Mark body as ready for any CSS transitions
    const root = document.documentElement;
    root.classList.add('body-ready');
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const navigateTo = async (to: string) => {
      if (isNavigatingRef.current) return;

      const current = window.location.pathname;
      if (current === to) return;

      isNavigatingRef.current = true;

      try {
        // Use Astro's navigate function for smooth View Transitions
        await navigate(to);
      } catch {
        // Fallback to standard navigation if View Transitions fail
        window.location.assign(to);
      } finally {
        isNavigatingRef.current = false;
      }
    };

    // Handle custom app:navigate events (from Tab key, etc.)
    const onAppNavigate = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (!detail) return;
      navigateTo(detail);
    };

    window.addEventListener('app:navigate', onAppNavigate as EventListener);

    return () => {
      window.removeEventListener('app:navigate', onAppNavigate as EventListener);
    };
  }, []);

  return null;
};

export default ClientTransitions;
