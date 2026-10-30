import { useEffect, useState } from 'react';
import { clamp } from '../lib/math.js';

/** Returns how many words should be lit, based on how far the card has scrolled into view. */
export function useWordReveal(cardRef, count) {
  const [on, setOn] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = cardRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = clamp((window.innerHeight * 0.82 - r.top) / (window.innerHeight * 0.45));
      setOn(Math.round(p * count));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [cardRef, count]);
  return on;
}
