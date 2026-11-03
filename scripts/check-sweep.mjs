// Checks the maths behind the eraser sweep of the opening scene. Run: node scripts/check-sweep.mjs
import assert from 'node:assert/strict';
import { prog, progInv, sweepPath, pace, RHO } from '../src/hero/prologue.js';

// 1. One movement: after the soft start there is no moment where the eraser slows to a stop, until the soft stop.
let slowest = Infinity;
for (let i = 15; i <= 985; i++) slowest = Math.min(slowest, (prog((i + 1) / 1000) - prog(i / 1000)) * 1000);
const cruise = (prog(0.5001) - prog(0.5)) * 10000;
assert(slowest > 0.1 * cruise, `the eraser nearly stops mid-sweep (${slowest.toFixed(3)} vs cruise ${cruise.toFixed(3)})`);
assert.equal(prog(0), 0);
assert.equal(prog(1), 1);
for (let i = 0; i <= 100; i++) assert(Math.abs(prog(progInv(i / 100)) - i / 100) < 1e-9, `progInv is not the inverse of prog at ${i / 100}`);

// 2. The path, on the page as prologue.js lays it out on a few screens (text widths are estimates of the system font):
//    no jumps, no sharp corners, a pace that never nearly stops, and every bit of the page within reach of the round eraser.
const step = 0.03;
let report = '';
for (const [VW, VH] of [[1920, 1080], [1440, 900], [1024, 768], [390, 664], [375, 812]]) {
  const H = Math.min(0.34 * VH, (VW / 2 - 14) / 2.02);
  const hs = Math.max(15, 0.17 * H);
  const ps = Math.max(12, 0.085 * H);
  const head = 0.64 * H + 0.72 * hs;
  const para = head + 0.5 * hs + 1.1 * ps;
  const link = para + 1.9 * ps;
  const bottom = link + 0.3 * ps;
  // the ink, as boxes in H units: [left, right, top, bottom]
  const ink = [
    [1.2 * H, -0.5 * H, 0.5 * H], // 404
    [(14 * 0.55 * hs) / 2, head - 0.72 * hs, head + 0.2 * hs], // Page not found
    [(42 * 0.47 * ps) / 2, para - 0.72 * ps, para + 0.22 * ps], // the line of text
    [(12 * 0.5 * ps) / 2, link - 0.72 * ps, link + 0.3 * ps], // Go back home
  ].map(([w, y0, y1]) => [-w / H, w / H, y0 / H, y1 / H]);
  const cy = VH / 2 - (bottom - 0.5 * H) / 2;
  const mid = [0, (0.33 * VH - cy) / H];
  const L = Math.min(...ink.map((b) => b[0]));
  const R = Math.max(...ink.map((b) => b[1]));
  const way = sweepPath({ L, R, top: -0.5, bottom: bottom / H }, mid, step);
  const q = pace(way);
  const at = `on ${VW}x${VH}`;
  assert.deepEqual(way[way.length - 1], mid, `the path does not end in the middle ${at}`);

  let turnMax = 0;
  let vmin = Infinity;
  let vmax = 0;
  for (let i = 1; i < way.length; i++) {
    const d = Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1]);
    assert(d <= step * 1.05, `a jump of ${d.toFixed(3)} in the path at sample ${i} ${at}`);
    const v = d / (q[i] - q[i - 1]);
    vmin = Math.min(vmin, v);
    vmax = Math.max(vmax, v);
    if (i > 1) {
      const a = Math.atan2(way[i - 1][1] - way[i - 2][1], way[i - 1][0] - way[i - 2][0]);
      const b = Math.atan2(way[i][1] - way[i - 1][1], way[i][0] - way[i - 1][0]);
      turnMax = Math.max(turnMax, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))));
    }
  }
  assert(turnMax < 0.4, `a sharp corner in the path ${at} (${turnMax.toFixed(2)} rad between samples)`);
  assert(vmin > 0.35 * vmax, `the pace nearly stops ${at} (${((vmin / vmax) * 100).toFixed(0)}% of the fastest)`);

  let worst = 0;
  for (const [x0, x1, y0, y1] of ink)
    for (let x = x0; x <= x1; x += 0.02)
      for (let y = y0; y <= y1; y += 0.02) {
        let d = Infinity;
        for (const p of way) d = Math.min(d, Math.hypot(x - p[0], y - p[1]));
        assert(d <= RHO, `the eraser misses (${x.toFixed(2)}, ${y.toFixed(2)}) ${at}, ${d.toFixed(3)} H from the path`);
        worst = Math.max(worst, d);
      }
  report += `\n  ${VW}x${VH}: ${way.length} samples, sharpest turn ${turnMax.toFixed(2)} rad, slowest pace ${((vmin / vmax) * 100).toFixed(0)}% of the fastest, farthest ink ${worst.toFixed(2)} H from the path (eraser radius ${RHO})`;
}
console.log(`sweep ok: slowest speed between 1.5% and 98.5% of the sweep is ${((slowest / cruise) * 100).toFixed(0)}% of cruise (the soft ends)${report}`);
