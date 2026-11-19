import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const IDLE_MS = 650;

/**
 * Keep one caret element on the character about to be typed.
 *
 * The position is written straight onto the node rather than through state:
 * a keystroke should not cost a second React render to move a bar a few
 * pixels. CSS turns the transform into a short glide and, once the keys go
 * quiet, a blink.
 *
 * Attach the returned refs: `box` to the positioned element the caret lives
 * in, `target` to the character to sit on (leave it unattached to hide the
 * caret), and `caret` to the caret itself.
 *
 * @param deps values that move the target (the cursor, the text)
 */
export function useGlidingCaret<Box extends HTMLElement, Target extends HTMLElement, Caret extends HTMLElement>(
  deps: readonly unknown[],
): { box: RefObject<Box | null>; target: RefObject<Target | null>; caret: RefObject<Caret | null> } {
  const box = useRef<Box | null>(null);
  const target = useRef<Target | null>(null);
  const caret = useRef<Caret | null>(null);
  const idleTimer = useRef<number | null>(null);
  const line = useRef<number | null>(null);

  const place = useCallback(() => {
    const el = caret.current;
    const now = target.current;
    const frame = box.current;
    if (!el || !frame) return;
    if (!now) {
      el.style.opacity = '0';
      return;
    }
    const r = now.getBoundingClientRect();
    const b = frame.getBoundingClientRect();
    const y = r.top - b.top;
    // A move to another line snaps; sliding diagonally across the text reads
    // as a glitch, not as motion.
    const jumped = line.current !== null && Math.abs(y - line.current) > r.height * 0.5;
    line.current = y;
    if (jumped) el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.transform = `translate3d(${(r.left - b.left).toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    el.style.setProperty('--cw', `${r.width.toFixed(2)}px`);
    el.style.setProperty('--ch', `${r.height.toFixed(2)}px`);
    if (jumped) {
      // Read layout so the snap lands before the transition is restored.
      void el.offsetWidth;
      el.style.transition = '';
    }
    el.classList.remove('is-idle');
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => el.classList.add('is-idle'), IDLE_MS);
  }, []);

  useLayoutEffect(() => {
    place();
    return () => {
      if (idleTimer.current !== null) {
        window.clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
    };
    // The caller lists what moves the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, ...deps]);

  useEffect(() => {
    // Watch the box's parent, not the box: the text element is replaced when
    // a new passage loads, and its container changes size whenever it does.
    const frame = box.current?.parentElement ?? box.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    // Fires on window resizes and when a web font swaps in and reflows the text.
    const observer = new ResizeObserver(() => place());
    observer.observe(frame);
    window.addEventListener('fontChanged', place);
    void document.fonts?.ready.then(place).catch(() => {});
    return () => {
      observer.disconnect();
      window.removeEventListener('fontChanged', place);
    };
  }, [place]);

  return { box, target, caret };
}
