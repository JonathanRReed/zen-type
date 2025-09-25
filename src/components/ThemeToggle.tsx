import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, type Settings } from '../utils/storage';

type Theme = 'Plain' | 'Forest' | 'Ocean' | 'Cosmic';

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('Plain');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const settings = getSettings();
    setTheme(settings.theme);
    applyTheme(settings.theme);
    // Listen for external settings changes
    const onSettings = (e: Event) => {
      const s = (e as CustomEvent).detail as Settings;
      if (s.theme) {
        setTheme(s.theme as Theme);
        applyTheme(s.theme as Theme);
      }
    };
    window.addEventListener('settingsChanged', onSettings as EventListener);
    return () => window.removeEventListener('settingsChanged', onSettings as EventListener);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove('theme-plain', 'theme-forest', 'theme-ocean', 'theme-cosmic');
    
    // Add new theme class
    root.classList.add(`theme-${newTheme.toLowerCase()}`);
    
    // Apply theme-specific styles
    switch (newTheme) {
      case 'Forest':
        root.style.setProperty('--theme-gradient', 'linear-gradient(180deg, var(--rp-pine) 0%, var(--rp-foam) 100%)');
        break;
      case 'Ocean':
        root.style.setProperty('--theme-gradient', 'radial-gradient(circle at center, var(--rp-base) 0%, var(--rp-foam) 100%)');
        break;
      case 'Cosmic':
        root.style.setProperty('--theme-gradient', 'conic-gradient(from 180deg at 50% 50%, var(--rp-base), var(--rp-iris), var(--rp-base))');
        break;
      default:
        // Plain (Rosé Pine OLED-dark gradient)
        root.style.setProperty('--theme-gradient', 'linear-gradient(180deg, var(--rp-base) 0%, var(--rp-overlay) 100%)');
    }
  };

  // Ambient shift every ~60s unless locked
  useEffect(() => {
    let tick = 0;
    let raf: number | null = null;
    const interval = setInterval(() => {
      const s = getSettings();
      if (s.themeShiftLocked) return;
      tick = (tick + 1) % 60;
      const root = document.documentElement;
      // Subtle angle shift for linear/conic gradients
      const angle = 180 + Math.sin(tick / 60 * Math.PI * 2) * 6; // ±6deg
      if (theme === 'Forest' || theme === 'Plain') {
        const base = theme === 'Forest' ? 'var(--rp-pine), var(--rp-foam)' : 'var(--rp-base), var(--rp-overlay)';
        root.style.setProperty('--theme-gradient', `linear-gradient(${angle}deg, ${base})`);
      } else if (theme === 'Cosmic') {
        const start = angle;
        root.style.setProperty('--theme-gradient', `conic-gradient(from ${start}deg at 50% 50%, var(--rp-base), var(--rp-iris), var(--rp-base))`);
      } else if (theme === 'Ocean') {
        // slight radial center drift
        const x = 50 + Math.sin(tick / 60 * Math.PI * 2) * 4;
        const y = 50 + Math.cos(tick / 60 * Math.PI * 2) * 4;
        root.style.setProperty('--theme-gradient', `radial-gradient(circle at ${x}% ${y}%, var(--rp-base) 0%, var(--rp-foam) 100%)`);
      }
    }, 1000);
    return () => {
      clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    
    const settings = getSettings();
    saveSettings({ ...settings, theme: newTheme });
    
    setIsOpen(false);
  };

  const themes: Theme[] = ['Plain', 'Forest', 'Ocean', 'Cosmic'];

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
