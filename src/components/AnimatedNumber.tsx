import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';

interface AnimatedNumberProps {
  value: number;
  /** How long the count takes, in milliseconds. */
  duration?: number;
}

// Counts up to a whole number. Under reduced motion (the system setting or
// the app's own) it shows the number at once, and switching reduced motion on
// mid-count stops the count where it should have ended.
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 500 }) => {
  const reducedMotion = !!useSettings().reducedMotion;
  const [shown, setShown] = useState(0);
  const [counting, setCounting] = useState(false);
  const shownRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    const settle = () => {
      shownRef.current = value;
      setShown(value);
      setCounting(false);
    };
    const still = reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || from === value) {
      settle();
      return;
    }
    setCounting(true);
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      if (progress >= 1) {
        settle();
        return;
      }
      // Ease out: quick at first, settling into the final figure.
      shownRef.current = from + (value - from) * (1 - Math.pow(1 - progress, 3));
      setShown(shownRef.current);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reducedMotion]);

  return <span className={`animated-number${counting ? ' updating' : ''}`}>{Math.round(shown)}</span>;
};

export default AnimatedNumber;
