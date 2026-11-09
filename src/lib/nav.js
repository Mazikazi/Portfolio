import { eIO3 } from './math.js';

let raf = 0;

/**
 * Glides to a section. Done here rather than with scrollIntoView({ behavior: 'smooth' }), because browsers make that
 * jump instantly when the system's animations are off (Windows "Animation effects", for one).
 */
export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const from = window.scrollY;
  const to = Math.min(from + el.getBoundingClientRect().top, document.documentElement.scrollHeight - window.innerHeight);
  const d = to - from;
  cancelAnimationFrame(raf);
  if (Math.abs(d) < 1) return;
  const dur = Math.min(1200, 500 + Math.abs(d) * 0.15); // longer trips take a little longer
  const t0 = performance.now();
  let last = from;
  const step = (now) => {
    if (Math.abs(window.scrollY - last) > 2) return; // the visitor scrolled themselves: let go
    const k = Math.min(1, (now - t0) / dur);
    last = Math.round(from + d * eIO3(k));
    window.scrollTo(0, last);
    if (k < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
