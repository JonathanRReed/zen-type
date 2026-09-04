import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useMotionPreference } from '../hooks/useMotionPreference';
import { AmbientRenderer, resolveColor, type AmbientPalette } from '../lib/ambient/renderer';
import { THEME_INDEX } from '../lib/ambient/shader';
import type { ThemeName } from '../utils/storage';

// The living background. A WebGL2 canvas that draws the current theme's
// scene; the CSS gradient on .theme-layer underneath is what paints before
// this mounts and what stays if WebGL is unavailable.

const BASE_BY_THEME: Record<ThemeName, [number, number, number]> = {
  Void: [0.043, 0.035, 0.086],
  Cosmic: [0.027, 0.016, 0.078],
  Aurora: [0.02, 0.043, 0.094],
  Ocean: [0.024, 0.086, 0.141],
  Glacier: [0.055, 0.133, 0.188],
  Forest: [0.024, 0.078, 0.063],
  Ember: [0.086, 0.039, 0.024],
  Sakura: [0.114, 0.075, 0.133],
};

function readPalette(theme: ThemeName): AmbientPalette {
  return {
    base: BASE_BY_THEME[theme],
    accent: resolveColor('var(--theme-accent)', [0.77, 0.65, 0.9]),
    accent2: resolveColor('var(--theme-accent-2)', [0.61, 0.81, 0.85]),
    text: resolveColor('var(--rp-text)', [0.88, 0.87, 0.96]),
  };
}

const AmbientLayer: React.FC = () => {
  const settings = useSettings();
  const { reducedMotion } = useMotionPreference();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<AmbientRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const theme = settings.theme;
  const motion = !reducedMotion && !settings.performanceMode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new AmbientRenderer(canvas);
    if (!renderer.supported) return;
    renderer.onFirstFrame = () => setReady(true);
    rendererRef.current = renderer;
    if (import.meta.env.DEV) {
      (window as unknown as { __ambient?: AmbientRenderer }).__ambient = renderer;
    }
    renderer.resize();
    renderer.setTheme(THEME_INDEX[theme], readPalette(theme));
    renderer.start();

    const onResize = () => renderer.resize();
    const onMove = (e: PointerEvent) => {
      renderer.setCursor(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.hasAttribute?.('data-typing-surface') && !e.metaKey && !e.ctrlKey) renderer.bumpEnergy(0.25);
    };
    const onVisibility = () => {
      if (document.hidden) renderer.stop(); else renderer.start();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('keydown', onKey, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
      rendererRef.current = null;
    };
    // The theme is read once here; later changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme changes flip the <html> class inside a view transition; wait a beat
  // so the accent variables have their new values before we read them.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const apply = () => renderer.setTheme(THEME_INDEX[theme], readPalette(theme));
    apply();
    const timer = window.setTimeout(apply, 120);
    return () => window.clearTimeout(timer);
  }, [theme, ready]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const small = window.innerWidth < 720;
    renderer.setOptions({
      motion,
      fps: small ? 24 : 30,
      scale: small ? 0.45 : 0.5,
    });
    renderer.start();
  }, [motion, ready]);

  return (
    <canvas
      ref={canvasRef}
      className={`ambient-layer${ready ? ' is-ready' : ''}`}
      aria-hidden="true"
    />
  );
};

export default AmbientLayer;
