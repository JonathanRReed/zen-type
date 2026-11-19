import React, { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, THEME_NAMES, THEME_COLORS, type Settings, type ThemeName } from '../utils/storage';
import { useMotionPreference } from '../hooks/useMotionPreference';
import { IconCheck } from './icons';

type ViewTransitionStart = (cb: () => void) => { finished: Promise<void> };

/** Picker order, and the two colours each scene is known by. */
export const THEMES: ReadonlyArray<{ name: ThemeName; note: string; swatch: [string, string] }> = [
  { name: 'Void', note: 'Indigo night', swatch: ['#1c1838', '#c4a7e7'] },
  { name: 'Cosmic', note: 'Deep-field nebula', swatch: ['#1c1140', '#e07ba8'] },
  { name: 'Aurora', note: 'Polar curtains', swatch: ['#0a1628', '#9ccfd8'] },
  { name: 'Ocean', note: 'Light through water', swatch: ['#0f4058', '#8fc8d1'] },
  { name: 'Glacier', note: 'Ice in daylight', swatch: ['#1f4a5c', '#cfeef3'] },
  { name: 'Forest', note: 'Canopy at dusk', swatch: ['#0b2119', '#3fb388'] },
  { name: 'Ember', note: 'Low fire', swatch: ['#3d1810', '#f6c177'] },
  { name: 'Sakura', note: 'Petals at dusk', swatch: ['#2a1b30', '#ea9a97'] },
  { name: 'Washi', note: 'Ink on paper', swatch: ['#efe9dc', '#2b2a33'] },
];

const themeClass = (theme: ThemeName) => `theme-${theme.toLowerCase()}`;

const applyThemeClass = (theme: ThemeName) => {
  const root = document.documentElement;
  root.classList.remove(...THEME_NAMES.map(themeClass));
  root.classList.add(themeClass(theme));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
};

const applyTheme = (theme: ThemeName) => {
  const root = document.documentElement;
  // Already applied (the pre-paint bootstrap in SEO.astro does this on load):
  // nothing to animate, and a view transition here would snapshot the page
  // before the scene has painted.
  if (root.classList.contains(themeClass(theme))) return;

  const doc = document as Document & { startViewTransition?: ViewTransitionStart };
  const reduced = root.getAttribute('data-motion') === 'off';
  if (doc.startViewTransition && !reduced) {
    root.setAttribute('data-transition-theme', themeClass(theme));
    doc.startViewTransition(() => applyThemeClass(theme)).finished
      .catch(() => { /* superseded by a newer transition */ })
      .finally(() => root.removeAttribute('data-transition-theme'));
  } else {
    applyThemeClass(theme);
  }
};

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<ThemeName>(() => {
    try { return getSettings().theme; } catch { return 'Void'; }
  });
  const [isOpen, setIsOpen] = useState(false);
  // Keeps html[data-motion] in sync with the setting and the OS preference.
  useMotionPreference({ syncAttribute: true });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const current = THEMES.find(t => t.name === theme) ?? THEMES[0]!;

  const focusToggle = () => {
    wrapperRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  };

  // Dismiss on Escape or a click elsewhere, and hand focus back to the
  // toggle so keyboard users are never stranded on an unmounted node.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        focusToggle();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = Array.from(wrapperRef.current?.querySelectorAll<HTMLButtonElement>('.theme-option') ?? []);
      if (!items.length) return;
      e.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    wrapperRef.current?.querySelector<HTMLButtonElement>('.theme-option[aria-pressed="true"]')?.focus();
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const settings = getSettings();
    applyTheme(settings.theme);
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('themeChanged', { detail: settings.theme }));
    }, 0);
    const onSettings = (e: Event) => {
      const next = (e as CustomEvent).detail as Settings;
      if (next.theme) {
        setTheme(next.theme);
        applyTheme(next.theme);
      }
    };
    window.addEventListener('settingsChanged', onSettings);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('settingsChanged', onSettings);
    };
  }, []);

  const choose = (next: ThemeName) => {
    setTheme(next);
    applyTheme(next);
    updateSettings({ theme: next });
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: next }));
    setIsOpen(false);
    focusToggle();
  };

  return (
    <div ref={wrapperRef} className="theme-picker">
      <button
        type="button"
        className="act act-icon"
        aria-label={`${theme} theme, toggle theme`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`Theme: ${theme}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <i className="swatch" style={{ '--swatch-a': current.swatch[0], '--swatch-b': current.swatch[1] } as React.CSSProperties} />
      </button>

      {isOpen && (
        <div className="theme-menu sheet" role="menu" aria-label="Color themes">
          {THEMES.map(t => (
            <button
              key={t.name}
              type="button"
              className="theme-option"
              aria-label={t.name}
              aria-pressed={theme === t.name}
              onClick={() => choose(t.name)}
            >
              <i className="swatch" style={{ '--swatch-a': t.swatch[0], '--swatch-b': t.swatch[1] } as React.CSSProperties} />
              <span className="theme-option-name">{t.name}</span>
              <span className="theme-option-note">{t.note}</span>
              {theme === t.name && <IconCheck className="theme-option-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
