import { useEffect, useMemo, useState } from 'react';
import { getSettings, type Settings } from '../utils/storage';

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
};

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

  const [settingsReduced, setSettingsReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return Boolean(forced);
    try {
      const s = getSettings();
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
    return media.matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Settings>).detail;
      setSettingsReduced(!!detail.reducedMotion);
    };

    window.addEventListener('settingsChanged', handler as EventListener);
    return () => window.removeEventListener('settingsChanged', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!respectMedia || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setTimeout(() => {
      setSystemReduced(media.matches);
    }, 0);

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setSystemReduced(event.matches);
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleMediaChange);
    } else {
      const legacyMedia = media as LegacyMediaQueryList;
      legacyMedia.addListener?.call(media, handleMediaChange);
    }

    return () => {
      window.clearTimeout(timer);
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleMediaChange);
      } else {
        const legacyMedia = media as LegacyMediaQueryList;
        legacyMedia.removeListener?.call(media, handleMediaChange);
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
