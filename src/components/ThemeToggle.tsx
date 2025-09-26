import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, type Settings } from '../utils/storage';

type Theme = 'Void' | 'Forest' | 'Ocean' | 'Cosmic';

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('Void');
  const [isOpen, setIsOpen] = useState(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const settings = getSettings();
    setTheme(settings.theme);
    applyTheme(settings.theme);

    let themeChangedTimer: number | null = window.setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: settings.theme }));
      } catch {}
    }, 0);

    const syncMotion = (reduced: boolean) => {
      root.setAttribute('data-motion', reduced ? 'off' : 'on');
      setReduceMotionEnabled(reduced);
    };

    let media: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      media = window.matchMedia('(prefers-reduced-motion: reduce)');
      syncMotion(!!settings.reducedMotion || media.matches);
    } else {
      syncMotion(!!settings.reducedMotion);
    }

    const onMediaChange = (e: MediaQueryListEvent) => {
      const s = getSettings();
      syncMotion(!!s.reducedMotion || e.matches);
    };

    if (media) {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onMediaChange);
      } else if (typeof media.addListener === 'function') {
        media.addListener(onMediaChange);
      }
    }

    // Listen for external settings changes
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent).detail as Settings;
      if (s.theme) {
        setTheme(s.theme as Theme);
        applyTheme(s.theme as Theme);
      }
      const mediaMatches = media?.matches ?? false;
      syncMotion(!!s.reducedMotion || mediaMatches);
    };

    window.addEventListener('settingsChanged', onSettings as EventListener);
    return () => {
      if (themeChangedTimer !== null) {
        clearTimeout(themeChangedTimer);
      }
      window.removeEventListener('settingsChanged', onSettings as EventListener);
      if (media) {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', onMediaChange);
        } else if (typeof media.removeListener === 'function') {
          media.removeListener(onMediaChange);
        }
      }
    };
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove('theme-void', 'theme-forest', 'theme-ocean', 'theme-cosmic');

    // Add new theme class
    root.classList.add(`theme-${newTheme.toLowerCase()}`);

    // Reset gradient helpers so each theme starts from its baseline
    root.style.setProperty('--theme-gradient-angle', '180deg');
    root.style.setProperty('--theme-gradient-center-x', '50%');
    root.style.setProperty('--theme-gradient-center-y', '50%');

    // Apply theme-specific styles
    switch (newTheme) {
      case 'Forest':
        root.style.setProperty(
          '--theme-gradient',
          'linear-gradient(var(--theme-gradient-angle, 180deg), color-mix(in oklab, #0d1f15 65%, var(--rp-pine) 35%) 0%, color-mix(in oklab, #1a2e22 45%, var(--rp-foam) 55%) 100%)'
        );
        break;
      case 'Ocean':
        root.style.setProperty(
          '--theme-gradient',
          'radial-gradient(ellipse at var(--theme-gradient-center-x, 50%) var(--theme-gradient-center-y, 50%), color-mix(in oklab, #0c1e2e 70%, #1a3d5a 30%) 0%, color-mix(in oklab, #081422 60%, #0f2844 40%) 100%)'
        );
        break;
      case 'Cosmic':
        root.style.setProperty(
          '--theme-gradient',
          'radial-gradient(ellipse at 50% 50%, color-mix(in oklab, #0a0014 80%, var(--rp-iris) 20%) 0%, color-mix(in oklab, #120825 70%, var(--rp-iris) 30%) 40%, #050008 100%)'
        );
        break;
      default:
        // Void (Rosé Pine OLED-dark gradient)
        root.style.setProperty(
          '--theme-gradient',
          'linear-gradient(var(--theme-gradient-angle, 180deg), color-mix(in oklab, var(--rp-base) 92%, #000000 8%) 0%, color-mix(in oklab, var(--rp-overlay) 96%, #000000 4%) 100%)'
        );
    }
  };

  // Ambient shift every ~90s unless locked (respects reduced motion)
  useEffect(() => {
    const root = document.documentElement;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let tick = 0;
    let interval: number | null = null;

    const resetGradientHelpers = () => {
      root.style.setProperty('--theme-gradient-angle', '180deg');
      root.style.setProperty('--theme-gradient-center-x', '50%');
      root.style.setProperty('--theme-gradient-center-y', '50%');
      root.style.setProperty('--theme-hue-shift', '0deg');
    };

    const stopShift = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
      resetGradientHelpers();
    };

    const isMotionDisabled = () => reduceMotionEnabled || motionQuery.matches;

    const startShift = () => {
      if (interval !== null || isMotionDisabled()) return;
      interval = window.setInterval(() => {
        if (isMotionDisabled()) {
          stopShift();
          return;
        }
        const s = getSettings();
        if (s.themeShiftLocked) return;
        tick = (tick + 1) % 90;

        // Forest: Breathing gradient shift between pine/foam
        if (theme === 'Forest') {
          const angle = 180 + Math.sin((tick / 90) * Math.PI * 2) * 4; // ±4deg subtle
          root.style.setProperty('--theme-gradient-angle', `${angle}deg`);
        }
        // Ocean: Gentle wave distortion
        if (theme === 'Ocean') {
          const x = 50 + Math.sin((tick / 90) * Math.PI * 2) * 3;
          const y = 50 + Math.cos((tick / 90) * Math.PI * 2) * 2;
          root.style.setProperty('--theme-gradient-center-x', `${x}%`);
          root.style.setProperty('--theme-gradient-center-y', `${y}%`);
        }
        // Cosmic: Small hue shift ±2°
        if (theme === 'Cosmic') {
          const hue = Math.sin((tick / 90) * Math.PI * 2) * 2; // ±2deg
          root.style.setProperty('--theme-hue-shift', `${hue}deg`);
        }
        // Void: Slow vertical gradient scroll
        if (theme === 'Void') {
          const angle = 180 + Math.sin((tick / 90) * Math.PI * 2) * 2; // ±2deg very subtle
          root.style.setProperty('--theme-gradient-angle', `${angle}deg`);
        }
      }, 1000);
    };

    if (isMotionDisabled()) {
      stopShift();
    } else {
      startShift();
    }

    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches || reduceMotionEnabled) {
        stopShift();
      } else {
        startShift();
      }
    };

    let removeMotionListener: (() => void) | undefined;
    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', handleMotionChange);
      removeMotionListener = () => motionQuery.removeEventListener('change', handleMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(handleMotionChange);
      removeMotionListener = () => motionQuery.removeListener(handleMotionChange);
    }

    return () => {
      stopShift();
      removeMotionListener?.();
    };
  }, [theme, reduceMotionEnabled]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    
    const currentSettings = getSettings();
    const nextSettings = { ...currentSettings, theme: newTheme } as Settings;
    saveSettings(nextSettings);
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: nextSettings }));
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: newTheme }));
    
    setIsOpen(false);
  };

  const themes: Theme[] = ['Void', 'Forest', 'Ocean', 'Cosmic'];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass px-4 py-2 rounded-lg flex items-center gap-2 
                   hover:bg-iris/10 transition-all duration-200
                   text-text text-sm font-sans"
        aria-label="Toggle theme"
        aria-expanded={isOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <span>{theme}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 z-50">
          <div className="glass rounded-lg p-2 min-w-[140px]">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`
                  w-full text-left px-4 py-2 rounded-md text-sm font-sans
                  transition-all duration-200
                  ${theme === t 
                    ? 'bg-iris/20 text-iris' 
                    : 'text-text hover:bg-overlay/50'
                  }
                `}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
