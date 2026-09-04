import { useEffect, useState } from 'react';

/**
 * Height of the on-screen keyboard, in CSS pixels, on devices that report a
 * visual viewport. Zero on desktop. Also mirrored to `--kb-inset` on <html>
 * so fixed elements can stay above the keyboard from CSS.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const next = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Small differences are browser chrome, not a keyboard.
      const value = next > 80 ? next : 0;
      setInset(value);
      document.documentElement.style.setProperty('--kb-inset', `${value}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.documentElement.style.removeProperty('--kb-inset');
    };
  }, []);
  return inset;
}
