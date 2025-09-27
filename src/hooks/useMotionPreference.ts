import { useEffect, useMemo, useRef, useState } from 'react';
import { getSettings, type Settings } from '../utils/storage';

type MotionPreferenceOptions = {
  forced?: boolean;
  respectMedia?: boolean;
  syncAttribute?: boolean;
  attributeTarget?: HTMLElement | null;
};

type MotionPreferenceResult = {
  reducedMotion: boolean;
  settingsReduced: boolean;
  systemReduced: boolean;
};

export function useMotionPreference(options: MotionPreferenceOptions = {}): MotionPreferenceResult {
  const { forced, respectMedia = true, syncAttribute = false, attributeTarget } = options;
  const settingsRef = useRef<Settings | null>(null);
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  const [settingsReduced, setSettingsReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return Boolean(forced);
    try {
      const s = getSettings();
      settingsRef.current = s;
      return !!s.reducedMotion;
    } catch {
      return false;
    }
  });

  const [systemReduced, setSystemReduced] = useState<boolean>(() => {
    if (!respectMedia || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQueryRef.current = media;
    return media.matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const s = getSettings();
      settingsRef.current = s;
      setSettingsReduced(!!s.reducedMotion);
    } catch {
      setSettingsReduced(false);
      settingsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Settings>).detail;
      settingsRef.current = detail;
      setSettingsReduced(!!detail.reducedMotion);
    };

    window.addEventListener('settingsChanged', handler as EventListener);
    return () => window.removeEventListener('settingsChanged', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!respectMedia || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      mediaQueryRef.current = null;
      setSystemReduced(false);
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQueryRef.current = media;
    setSystemReduced(media.matches);

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setSystemReduced(event.matches);
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleMediaChange);
    } else if (typeof media.addListener === 'function') {
      // @ts-ignore - Legacy fallback for older browsers
      media.addListener(handleMediaChange);
    }

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleMediaChange);
      } else if (typeof media.removeListener === 'function') {
        // @ts-ignore - Legacy fallback for older browsers
        media.removeListener(handleMediaChange);
      }
    };
  }, [respectMedia]);

  const reducedMotion = useMemo(() => {
    if (typeof forced === 'boolean') {
      return forced;
    }
    return settingsReduced || (respectMedia ? systemReduced : false);
  }, [forced, respectMedia, settingsReduced, systemReduced]);

  useEffect(() => {
    if (!syncAttribute || typeof document === 'undefined') return;
    const target = attributeTarget ?? document.documentElement;
    if (!target) return;
    target.setAttribute('data-motion', reducedMotion ? 'off' : 'on');
  }, [attributeTarget, reducedMotion, syncAttribute]);

  return useMemo(() => ({
    reducedMotion,
    settingsReduced,
    systemReduced: respectMedia ? systemReduced : false,
  }), [reducedMotion, respectMedia, settingsReduced, systemReduced]);
}
