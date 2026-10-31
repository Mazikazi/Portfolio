export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = (x) => x * x * (3 - 2 * x); // smoothstep
export const lin = (x) => x;
export const eOut3 = (x) => 1 - Math.pow(1 - x, 3);
export const eOut2 = (x) => 1 - (1 - x) * (1 - x);
export const eIO3 = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** CSS-style cubic-bezier easing: bezier(x1, y1, x2, y2) returns a function of 0..1. */
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const X = (s) => ((ax * s + bx) * s + cx) * s;
  const Y = (s) => ((ay * s + by) * s + cy) * s;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let s = x;
    for (let i = 0; i < 32; i++) {
      const e = X(s) - x; // X is monotonic for x1, x2 in 0..1, so bisection always converges
      if (Math.abs(e) < 1e-5) break;
      if (e > 0) hi = s;
      else lo = s;
      s = (lo + hi) / 2;
    }
    return Y(s);
  };
}

/** Keyframe lookup: arr is [[time, value], ...]. Eases between neighbours. */
export function kf(arr, t, ease = ss) {
  if (t <= arr[0][0]) return arr[0][1];
  for (let i = 1; i < arr.length; i++) {
    if (t <= arr[i][0]) {
      const a = arr[i - 1];
      const b = arr[i];
      return lerp(a[1], b[1], ease((t - a[0]) / (b[0] - a[0])));
    }
  }
  return arr[arr.length - 1][1];
}

/** Small seeded random generator so the particles look the same on every load. */
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
