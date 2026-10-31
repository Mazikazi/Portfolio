// Checks the maths behind the eraser sweep of the opening scene. Run: node scripts/check-sweep.mjs
import assert from 'node:assert/strict';
import { prog, progInv, trace } from '../src/hero/prologue.js';

// 1. One movement: after the soft start there is no moment where the eraser slows to a stop, until the soft stop.
let slowest = Infinity;
for (let i = 15; i <= 985; i++) slowest = Math.min(slowest, (prog((i + 1) / 1000) - prog(i / 1000)) * 1000);
const cruise = (prog(0.5001) - prog(0.5)) * 10000;
assert(slowest > 0.1 * cruise, `the eraser nearly stops mid-sweep (${slowest.toFixed(3)} vs cruise ${cruise.toFixed(3)})`);
assert.equal(prog(0), 0);
assert.equal(prog(1), 1);
for (let i = 0; i <= 100; i++) assert(Math.abs(prog(progInv(i / 100)) - i / 100) < 1e-9, `progInv is not the inverse of prog at ${i / 100}`);

// 2. The path: three passes joined by U-turns, with no sharp corners and no jumps.
const pts = [[1.76, -0.71], [1.4, -0.28], [-1.1, -0.28], [-1.1, 0.28], [1.1, 0.28], [1.1, 0.88], [-1.1, 0.88], [0, -0.2]];
const step = 0.04;
const way = trace(pts, [0, 0.3, 0.28, 0.28, 0.3, 0.3, 0.3, 0], step);
assert.deepEqual(way[0], pts[0]);
assert.deepEqual(way[way.length - 1], pts[pts.length - 1]);
let turnMax = 0;
for (let i = 1; i < way.length; i++) {
  const d = Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1]);
  assert(d <= step * 1.05, `a jump of ${d.toFixed(3)} in the path at sample ${i}`);
  if (i > 1) {
    const a = Math.atan2(way[i - 1][1] - way[i - 2][1], way[i - 1][0] - way[i - 2][0]);
    const b = Math.atan2(way[i][1] - way[i - 1][1], way[i][0] - way[i - 1][0]);
    turnMax = Math.max(turnMax, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))));
  }
}
assert(turnMax < 0.4, `a sharp corner in the path (${turnMax.toFixed(2)} rad between samples)`);
console.log(`sweep ok: slowest speed between 1.5% and 98.5% of the sweep is ${((slowest / cruise) * 100).toFixed(0)}% of cruise (the soft ends), ${way.length} path samples, sharpest turn ${turnMax.toFixed(2)} rad`);
