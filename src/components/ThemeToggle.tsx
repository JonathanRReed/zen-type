import React, { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, type Settings } from '../utils/storage';
import { useMotionPreference } from '../hooks/useMotionPreference';
import IconButton from './IconButton';
import { Button } from '@/components/ui/button';

type Theme = 'Void' | 'Forest' | 'Ocean' | 'Cosmic' | 'Ember' | 'Sakura' | 'Aurora' | 'Glacier';

interface ThemeToggleProps {
  className?: string;
}

type ViewTransitionStart = (cb: () => void) => { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void>; skipTransition: () => void };

const applyThemeClass = (newTheme: Theme) => {
  const root = document.documentElement;
  root.classList.remove('theme-void', 'theme-forest', 'theme-ocean', 'theme-cosmic', 'theme-ember', 'theme-sakura', 'theme-aurora', 'theme-glacier');
  root.classList.add(`theme-${newTheme.toLowerCase()}`);
};

const applyTheme = (newTheme: Theme) => {
  const root = document.documentElement;
  const currentThemeClass = `theme-${newTheme.toLowerCase()}`;

  // If the theme class is already applied (e.g. by the SEO pre-paint bootstrap
  // on initial load), there's nothing to animate and we should NOT start a
  // view transition — the snapshot/restore cycle can capture pseudo-elements
  // before they finish painting, leaving the user with a partially rendered
  // starfield until the next refresh.
  if (root.classList.contains(currentThemeClass)) {
    // Just clean up any legacy inline overrides and exit.
    root.style.removeProperty('--theme-gradient');
    root.style.removeProperty('--theme-gradient-angle');
    root.style.removeProperty('--theme-gradient-center-x');
    root.style.removeProperty('--theme-gradient-center-y');
    return;
  }

  const doc = document as Document & { startViewTransition?: ViewTransitionStart };
  const prefersReducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cross-fade the theme swap using the View Transitions API so there's no
  // hard pop between gradients. Falls back to an instant swap when either
  // the API is unavailable or the user prefers reduced motion.
  if (doc.startViewTransition && !prefersReducedMotion) {
    root.setAttribute('data-transition-theme', currentThemeClass);
    const transition = doc.startViewTransition(() => {
      applyThemeClass(newTheme);
    });
    transition.finished
      .catch(() => { /* AbortError: transition skipped by a newer transition — expected */ })
      .finally(() => {
        root.removeAttribute('data-transition-theme');
      });
  } else {
    applyThemeClass(newTheme);
  }

  // Theme gradients are defined in CSS per theme class (see globals.css), so
  // no inline style overrides are needed here. Just clear any legacy overrides.
  root.style.removeProperty('--theme-gradient');
  root.style.removeProperty('--theme-gradient-angle');
  root.style.removeProperty('--theme-gradient-center-x');
  root.style.removeProperty('--theme-gradient-center-y');
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  // ThemeToggle is client:load — never SSR'd — so reading localStorage in the
  // useState initializer is safe and avoids a hydration mismatch.
  const [theme, setTheme] = useState<Theme>(() => {
    try { return getSettings().theme; } catch { return 'Void'; }
  });
  const [isOpen, setIsOpen] = useState(false);
  // Keeps html[data-motion] in sync with the setting and the OS preference.
  useMotionPreference({ syncAttribute: true });
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const focusToggle = () => {
    wrapperRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  };

  // Dismiss the popup on Escape / click-away and hand focus back to the
  // toggle, so keyboard users are never stranded on an unmounted node.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        focusToggle();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const settings = getSettings();
    applyTheme(settings.theme);

    const themeChangedTimer: number | null = window.setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: settings.theme }));
      } catch {}
    }, 0);

    // Listen for external settings changes
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent).detail as Settings;
      if (s.theme) {
        setTheme(s.theme as Theme);
        applyTheme(s.theme as Theme);
      }
    };

    window.addEventListener('settingsChanged', onSettings as EventListener);
    return () => {
      if (themeChangedTimer !== null) {
        clearTimeout(themeChangedTimer);
      }
      window.removeEventListener('settingsChanged', onSettings as EventListener);
    };
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    updateSettings({ theme: newTheme });
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: newTheme }));

    setIsOpen(false);
    focusToggle();
  };

  const themes: Theme[] = ['Void', 'Cosmic', 'Aurora', 'Ocean', 'Glacier', 'Forest', 'Ember', 'Sakura'];

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      <IconButton
        shape="pill"
        subtle
        className="px-4 gap-2 text-sm font-semibold tracking-[0.08em]"
        aria-label={`${theme} theme, toggle theme`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
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
        <span suppressHydrationWarning>{theme}</span>
      </IconButton>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 z-50" role="menu" aria-label="Color themes">
          <div className="glass rounded-lg p-2 min-w-[140px]">
            {themes.map((t) => (
              <Button
                key={t}
                variant="ghost"
                className={`w-full justify-start px-4 py-2 text-sm font-sans transition-all duration-200 ${theme === t ? 'bg-iris/20 text-iris hover:bg-iris/25' : 'text-text hover:bg-overlay/50 hover:text-text'}`}
                onClick={() => handleThemeChange(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
