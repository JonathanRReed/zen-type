import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** How long the count takes, in milliseconds. */
  duration?: number;
}

// Counts up to a whole number. Under reduced motion (the system setting or
// the app's own) it shows the number at once.
const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 500 }) => {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    const still = document.documentElement.getAttribute('data-motion') === 'off'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still || from === value) {
      setShown(value);
      return;
    }
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      // Ease out: quick at first, settling into the final figure.
      setShown(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="animated-number">{Math.round(shown)}</span>;
};

export default AnimatedNumber;
