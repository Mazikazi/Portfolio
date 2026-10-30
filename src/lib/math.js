export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ss = (x) => x * x * (3 - 2 * x); // smoothstep
export const lin = (x) => x;
export const eOut3 = (x) => 1 - Math.pow(1 - x, 3);
export const eOut2 = (x) => 1 - (1 - x) * (1 - x);
export const eIO3 = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

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
