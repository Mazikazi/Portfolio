import { useEffect, useRef, useState } from 'react';
import { CLOUD, track } from '../fx/cloud.js';

/** Adds the `in` class the first time the element is at least 15% on screen, or, with the particle cloud, once it has built it. */
export function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (CLOUD) return track(el, () => setShown(true));
    if (!('IntersectionObserver' in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}
