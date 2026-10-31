import { clamp, lerp, ss, kf, bezier, rng } from '../lib/math.js';

/*
 * The opening scene, played by the hero engine before the dot intro (the storyboard).
 *
 *   0.0   the most ordinary 404 page there is: white, big "404", "Page not found", a blue link.
 *         The browser tab says "404 Not Found" too, so a visitor believes the site is broken
 *   1.5   two rectangle eyes slide in from the right
 *   2.5   they say "oh...", then "let me fix it."
 *   4.55  they erase the page in one continuous movement, trailing dust: along the top of the digits,
 *         back along the bottom, then along the text, and straight on to the middle of the screen
 *   9.25  they merge into a circle there
 *   9.85  the circle squashes, shoots off the top of the screen and the page goes dark
 *   HANDOFF  the dot of the original intro falls in (that is the engine's time 0)
 *
 * Like the engine it is a pure function of time: render(tp) writes the styles for second tp, so seeking and
 * skipping just work (the dust included: every crumb is a formula of tp). Sizes are in units of H, the height
 * of the 404 digits, so the scene scales with the screen.
 */

const OUT = bezier(0.23, 1, 0.32, 1); // strong ease-out, for things arriving
const IO = bezier(0.77, 0, 0.175, 1); // strong ease-in-out, for things moving across the screen
const IN = bezier(0.5, 0, 0.75, 0); // ease-in, only for the launch: the circle is leaving, not arriving
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; // same as #proText in styles.css
const INKS = ['#212529', '#6c757d', '#0d6efd']; // digits and heading, the line of text, the link

// Eyes, in H units from the middle of the 404 digits (y points down).
const EYE = { w: 0.2, h: 0.58, gap: 0.12, r: 0.04 };
const REST = [1.76, -0.71]; // where they stand next to the 404

// Timeline, in seconds from the start of the page.
const EYES_IN = 1.5; // the eyes slide in, 0.5 s. Until then it is just a 404, long enough to fool someone
const SAY = [
  { text: 'oh...', in: 2.5, out: 3.3, per: 0.08 }, // per: seconds per letter
  { text: 'let me fix it.', in: 3.45, out: 4.45, per: 0.045 },
];
const BLINKS = [2.2, 4.0, 6.6];
const SY = [[0, 1], [2.5, 1], [2.65, 1.14], [3.05, 1], [3.45, 1], [3.65, 0.78], [4.4, 0.78], [4.55, 1]]; // wide-eyed at "oh...", narrowed at "let me fix it."
const LOOK = [[0, 0], [2.5, 0], [2.7, -0.07], [4.35, -0.07], [4.55, 0]]; // glance left at the page while talking
const SWEEP_AT = 4.55;
const SWEEP_DUR = 4.8; // one movement: the erasing and the trip to the middle
const SWEEP_END = SWEEP_AT + SWEEP_DUR;
const MERGE_AT = SWEEP_END - 0.3; // the eyes start to merge while they are still gliding in, 0.45 s
const SQUASH_AT = MERGE_AT + 0.45; // crouch before the jump, 0.15 s
const LAUNCH_AT = SQUASH_AT + 0.15; // shoot off the top, 0.3 s
const FADE_AT = LAUNCH_AT + 0.25; // the page goes dark, 0.35 s
const END = FADE_AT + 0.35;
/** Seconds until the dot of the original intro starts to fall. The engine's clock reads 0 at this moment. */
export const HANDOFF = END - 0.15;

// Speed along the sweep: a soft start, a long cruise, a soft stop. No stops in between.
const EASE_IN = 0.1; // fractions of SWEEP_DUR
const EASE_OUT = 0.14;
const VMAX = 1 / (1 - (EASE_IN + EASE_OUT) / 2);
/** Fraction of the path covered after fraction u of the sweep. */
export const prog = (u) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < EASE_IN) return (VMAX * u * u) / (2 * EASE_IN);
  if (u < 1 - EASE_OUT) return VMAX * (u - EASE_IN / 2);
  return 1 - (VMAX * (1 - u) * (1 - u)) / (2 * EASE_OUT);
};
/** The inverse: the fraction of the sweep at which fraction p of the path is covered. */
export const progInv = (p) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (p < (VMAX * EASE_IN) / 2) return Math.sqrt((2 * EASE_IN * p) / VMAX);
  if (p <= 1 - (VMAX * EASE_OUT) / 2) return p / VMAX + EASE_IN / 2;
  return 1 - Math.sqrt((2 * EASE_OUT * (1 - p)) / VMAX);
};

/** Walk through the points, cutting each inner corner with a circular arc of radius rs[i]. Returns samples about `step` apart. */
export function trace(pts, rs, step) {
  const out = [pts[0]];
  const line = (to) => {
    const from = out[out.length - 1];
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (dist < 1e-9) return; // already there: two arcs that meet
    const n = Math.max(1, Math.ceil(dist / step));
    for (let k = 1; k <= n; k++) out.push(k === n ? to : [lerp(from[0], to[0], k / n), lerp(from[1], to[1], k / n)]); // the last sample is exactly `to`
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const d1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1];
    const d2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
    const turn = Math.acos(clamp(d1[0] * d2[0] + d1[1] * d2[1], -1, 1));
    if (turn < 1e-3) continue;
    const t = Math.tan(turn / 2);
    const r = Math.min(rs[i], (0.5 * Math.min(l1, l2)) / t); // the arc may not use up more than half of a neighbouring segment
    const sign = Math.sign(d1[0] * d2[1] - d1[1] * d2[0]);
    const p1 = [b[0] - d1[0] * r * t, b[1] - d1[1] * r * t];
    const ctr = [p1[0] - sign * d1[1] * r, p1[1] + sign * d1[0] * r];
    const a0 = Math.atan2(p1[1] - ctr[1], p1[0] - ctr[0]);
    line(p1);
    const n = Math.max(2, Math.ceil((r * turn) / step));
    for (let k = 1; k <= n; k++) {
      const ang = a0 + (sign * turn * k) / n;
      out.push([ctr[0] + r * Math.cos(ang), ctr[1] + r * Math.sin(ang)]);
    }
  }
  line(pts[pts.length - 1]);
  return out;
}

export class Prologue {
  constructor(root) {
    const $ = (s) => root.querySelector(s);
    this.root = root;
    this.svg = $('svg');
    this.maskBox = $('#proMask');
    this.maskBg = $('#proMaskBg');
    this.trail = $('#proTrail');
    this.text = $('#proText');
    this.digits = $('#proN');
    this.head = $('#proH');
    this.para = $('#proP');
    this.link = $('#proL');
    this.eyes = $('#proEyes');
    this.eyeL = $('#eyeL');
    this.eyeR = $('#eyeR');
    this.dustCv = $('#proDust');
    this.dustCtx = this.dustCv.getContext('2d');
    this.bub = $('#proBub');
    this.shown = this.bub.querySelector('i');
    this.rest = this.bub.querySelector('b');
    this.title = document.title;
    this.theme = document.querySelector('meta[name="theme-color"]');
    this.dark = this.theme ? this.theme.content : '';
    this.on = null;
    this.dust = null;
    this.dustShown = false;
    this.H = 0;
  }

  /** R is the radius of the dot of the original intro, which the circle shrinks to. */
  layout(VW, VH, R) {
    const H = Math.min(0.34 * VH, (VW / 2 - 14) / 2.02); // digit height: as tall as the screen allows, with room for the eyes on the right
    const cx = VW / 2;
    // The text under the digits. Offsets are px below the middle of the digits.
    const hs = Math.max(15, 0.17 * H);
    const ps = Math.max(12, 0.085 * H);
    const top = 0.64 * H;
    const head = top + 0.72 * hs;
    const para = head + 0.5 * hs + 1.1 * ps;
    const link = para + 1.9 * ps;
    const bottom = link + 0.3 * ps;
    const cy = VH / 2 - (bottom - 0.5 * H) / 2; // the whole page, digits and text, is centred
    Object.assign(this, { H, cx, cy, VW, VH, xIn: VW / (2 * H) + 0.4, k: (2 * R) / (EYE.h * H), mu: -1, key: '' });
    const sizes = [[this.digits, 0.5 * H, H / 0.71], [this.head, head, hs], [this.para, para, ps], [this.link, link, ps]];
    sizes.forEach(([el, y, fs]) => {
      el.setAttribute('x', cx);
      el.setAttribute('y', cy + y);
      el.setAttribute('font-size', fs);
    });
    this.text.style.visibility = 'visible'; // hidden in the stylesheet until it has a place

    // How wide the page really is (it depends on the system font), so the eraser reaches every letter.
    let L = cx - 1.2 * H;
    let Rt = cx + 1.2 * H;
    [this.digits, this.head, this.para, this.link].forEach((el) => {
      const b = el.getBBox();
      if (b.width) {
        L = Math.min(L, b.x);
        Rt = Math.max(Rt, b.x + b.width);
      }
    });

    // The eraser path, in H units: three passes joined by U-turns, then on to the middle of the screen.
    // Each straight pass runs past both edges of the page and the turning happens outside it, so no corner is cut.
    const Lh = (L - cx) / H;
    const Rh = (Rt - cx) / H;
    const p3 = (top + bottom) / 2 / H; // the third pass is centred on the text
    const rr = Math.min(0.3, (p3 - 0.28) / 2);
    const xa = Lh - 0.18; // left U-turn: its straight part ends at xa + 0.28
    const xb = Rh + rr - 0.1; // right U-turn: its straight part ends at xb - rr
    const mid = [0, (0.33 * VH - cy) / H]; // where they turn into a circle: a third of the way down the screen
    const way = [REST, [REST[0] - 0.25, -0.28], [xa, -0.28], [xa, 0.28], [xb, 0.28], [xb, p3], [Lh - 0.5, p3], mid];
    this.way = trace(way, [0, 0.3, 0.28, 0.28, rr, rr, 0.25, 0], 0.04);
    this.cum = [0]; // distance travelled at each sample, in H
    for (let i = 1; i < this.way.length; i++) {
      this.cum.push(this.cum[i - 1] + Math.hypot(this.way[i][0] - this.way[i - 1][0], this.way[i][1] - this.way[i - 1][1]));
    }
    this.len = this.cum[this.cum.length - 1];

    this.svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
    [this.maskBox, this.maskBg].forEach((el) => {
      el.setAttribute('width', VW);
      el.setAttribute('height', VH);
    });
    this.bandW = Math.max(EYE.h * H, bottom - top + 12); // the eraser band: the eyes, or the text block if that is taller
    this.trailLen = this.len * H;
    this.trail.setAttribute('d', 'M' + this.way.map(([u, v]) => `${(cx + u * H).toFixed(1)} ${(cy + v * H).toFixed(1)}`).join('L'));
    this.trail.setAttribute('stroke-width', this.bandW);
    this.trail.setAttribute('stroke-dasharray', `${this.trailLen} ${this.trailLen * 2}`); // a long gap, so rounding can never leave a stray dash at the far end

    const fs = clamp(0.115 * H, 14, 40);
    this.bub.style.fontSize = fs + 'px';
    this.bx = cx + (REST[0] - EYE.gap / 2 - EYE.w) * H - 0.95 * fs; // right edge of the bubble, just left of the eyes
    this.by = cy + REST[1] * H - 0.03 * H;

    // the dust canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.dustCv.width = Math.round(VW * dpr);
    this.dustCv.height = Math.round(VH * dpr);
    this.dust = null;
    if (document.documentElement.classList.contains('pro')) {
      this.makeDust([L, Rt], { head, para, link, hs, ps }); // only when the scene will really play
    }
  }

  /**
   * Dust: the page crumbles. Crumbs are sampled from the real ink of the page, and each is born at the moment
   * the eraser first covers its spot. After that it is a formula of time: dragged along, rising a little, falling.
   */
  makeDust([L, Rt], t) {
    const { H, cx, cy } = this;
    const [x0, x1] = [Math.floor(L - 6), Math.ceil(Rt + 6)];
    const [y0, y1] = [Math.floor(cy - 0.6 * H), Math.ceil(cy + t.link + 0.4 * t.ps)];
    const sc = Math.min(1, 520 / (x1 - x0)); // sample at a lower resolution on big screens
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((x1 - x0) * sc);
    cv.height = Math.ceil((y1 - y0) * sc);
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.scale(sc, sc);
    g.translate(-x0, -y0);
    g.textAlign = 'center';
    const draw = (str, weight, size, y, ink) => {
      g.font = `${weight} ${size}px ${FONT}`;
      g.fillStyle = INKS[ink];
      g.fillText(str, cx, cy + y);
    };
    draw('404', 700, H / 0.71, 0.5 * H, 0);
    draw('Page not found', 600, t.hs, t.head, 0);
    draw("The page you're looking for doesn't exist.", 400, t.ps, t.para, 1);
    draw('Go back home', 400, t.ps, t.link, 2);
    const lw = g.measureText('Go back home').width;
    g.fillRect(cx - lw / 2, cy + t.link + 0.12 * t.ps, lw, Math.max(1, 0.07 * t.ps)); // the underline

    const px = g.getImageData(0, 0, cv.width, cv.height).data;
    const ink = [];
    for (let i = 3; i < px.length; i += 4) if (px[i] > 128) ink.push((i - 3) / 4);
    if (!ink.length) return;

    const N = 1500;
    const r = rng(11);
    const way = this.way.map(([u, v]) => [cx + u * H, cy + v * H]); // the eraser path in px
    const hb = this.bandW / 2;
    const D = { t: new Float32Array(N), x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N), size: new Float32Array(N), col: new Uint8Array(N), n: 0 };
    for (let k = 0; k < N; k++) {
      const i = ink[Math.floor(r() * ink.length)];
      const x = x0 + ((i % cv.width) + r()) / sc;
      const y = y0 + (Math.floor(i / cv.width) + r()) / sc;
      let j = 0; // first spot of the path where the eraser covers this pixel
      while (j < way.length && (Math.abs(x - way[j][0]) > hb || Math.abs(y - way[j][1]) > hb)) j++;
      if (j >= way.length) continue;
      const a = way[Math.max(0, j - 1)];
      const b = way[Math.min(way.length - 1, j + 1)];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const along = 0.35 + 0.9 * r(); // dragged along with the eraser, in H per second
      const m = i * 4;
      D.t[D.n] = SWEEP_AT + SWEEP_DUR * progInv(this.cum[j] / this.len) + 0.04 * r();
      D.x[D.n] = x;
      D.y[D.n] = y;
      D.vx[D.n] = (((b[0] - a[0]) / d) * along + (r() - 0.5) * 0.35) * H;
      D.vy[D.n] = (((b[1] - a[1]) / d) * along - (0.05 + 0.45 * r()) + (r() - 0.5) * 0.25) * H; // and rising a little
      D.life[D.n] = 0.6 + 0.9 * r();
      D.size[D.n] = (1.2 + 2.2 * r()) * clamp(H / 230, 0.7, 2);
      D.col[D.n] = px[m + 2] > 200 && px[m] < 100 ? 2 : px[m] > 80 ? 1 : 0;
      D.n++;
    }
    this.dust = D;
    this.gravity = 1.2 * H;
  }

  drawDust(tp) {
    const D = this.dust;
    const g = this.dustCtx;
    const active = !!D && tp > SWEEP_AT && tp < SWEEP_END + 1.6;
    if (!active) {
      if (this.dustShown) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, this.dustCv.width, this.dustCv.height);
        this.dustShown = false;
      }
      return;
    }
    this.dustShown = true;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.VW, this.VH);
    for (let i = 0; i < D.n; i++) {
      const tau = tp - D.t[i];
      if (tau < 0 || tau > D.life[i]) continue;
      const u = tau / D.life[i];
      g.globalAlpha = 0.9 * Math.pow(1 - u, 1.5);
      g.fillStyle = INKS[D.col[i]];
      const s = D.size[i];
      g.fillRect(D.x[i] + D.vx[i] * tau - s / 2, D.y[i] + D.vy[i] * tau + 0.5 * this.gravity * tau * tau - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }

  /** The point after travelling s (in H) along the eraser path. */
  at(s) {
    const { cum, way } = this;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const k = clamp((s - cum[lo]) / (cum[hi] - cum[lo] || 1));
    return [lerp(way[lo][0], way[hi][0], k), lerp(way[lo][1], way[hi][1], k)];
  }

  /** u = 0: two rectangles. u = 1: one circle as wide as the eyes are tall. */
  shape(u) {
    this.mu = u;
    const H = this.H;
    const off = (EYE.gap / 2 + EYE.w / 2) * (1 - u);
    const w = lerp(EYE.w, EYE.h, u) * H;
    [[this.eyeL, -off], [this.eyeR, off]].forEach(([el, o]) => {
      el.setAttribute('x', o * H - w / 2);
      el.setAttribute('y', (-EYE.h / 2) * H);
      el.setAttribute('width', w);
      el.setAttribute('height', EYE.h * H);
      el.setAttribute('rx', lerp(EYE.r, EYE.h / 2, u) * H);
    });
  }

  /** Distance along the eraser path at second tp, in H. */
  travelled(tp) {
    return this.len * prog((tp - SWEEP_AT) / SWEEP_DUR);
  }

  /** Middle of the eyes at second tp, in H units from the middle of the digits. */
  pose(tp) {
    if (tp < SWEEP_AT) {
      return [lerp(this.xIn, REST[0], OUT(clamp((tp - EYES_IN) / 0.5))) + kf(LOOK, tp), REST[1]];
    }
    const s = this.travelled(tp);
    const [x, y] = this.at(s);
    const v = (this.travelled(tp + 0.02) - s) / 0.02; // speed in H per second
    return [x, y + 0.018 * clamp(v / 0.8) * Math.sin(tp * 34)]; // scrub up and down while moving
  }

  render(tp) {
    const on = tp < END;
    if (on !== this.on) {
      this.on = on;
      document.documentElement.classList.toggle('pro', on); // shows the white page (see styles.css)
      document.title = on ? '404 Not Found' : this.title; // the browser tab and the phone's address bar play along
      if (this.theme) this.theme.content = on ? '#ffffff' : this.dark;
    }
    if (!on || !this.H) return;
    const { H, cx, cy, VH } = this;

    // the page is erased wherever the eyes have been, and crumbles into dust
    this.trail.style.strokeDashoffset = this.trailLen - this.travelled(tp) * H;
    this.drawDust(tp);

    // the eyes
    const [x, y] = this.pose(tp);
    let sx = 1;
    let sy = kf(SY, tp);
    BLINKS.forEach((b) => {
      const u = (tp - b) / 0.14;
      if (u > 0 && u < 1) sy *= 1 - 0.92 * Math.sin(Math.PI * u);
    });
    let ty = cy + y * H;
    const mu = IO(clamp((tp - MERGE_AT) / 0.45));
    if (mu !== this.mu) this.shape(mu);
    if (tp >= SQUASH_AT) {
      const q = OUT(clamp((tp - SQUASH_AT) / 0.15));
      sx = 1 + 0.12 * q;
      sy = 1 - 0.14 * q;
      if (tp >= LAUNCH_AT) {
        const u = clamp((tp - LAUNCH_AT) / 0.3);
        const k = lerp(1, this.k, OUT(u)); // shrinks to the size of the dot as it flies off
        sx = k * lerp(1.12, 0.86, ss(u));
        sy = k * lerp(0.86, 1.22, ss(u)); // ends stretched, like the dot that falls in next
        ty = lerp(ty, -0.12 * VH, IN(u));
      }
    }
    this.eyes.setAttribute('transform', `translate(${cx + x * H} ${ty}) scale(${sx} ${sy})`);
    this.eyes.setAttribute('visibility', tp < LAUNCH_AT + 0.3 ? 'visible' : 'hidden');

    // the speech bubble
    const say = SAY[tp >= SAY[1].in - 0.1 ? 1 : 0];
    const n = clamp(Math.floor((tp - say.in - 0.08) / say.per) + 1, 0, say.text.length);
    const key = say.text + n;
    if (key !== this.key) {
      this.key = key;
      this.shown.textContent = say.text.slice(0, n);
      this.rest.textContent = say.text.slice(n); // invisible, keeps the bubble at its full width
    }
    const pop = clamp((tp - say.in) / 0.22);
    const away = clamp((tp - say.out) / 0.14);
    this.bub.style.opacity = clamp((tp - say.in) / 0.12) * (1 - away);
    this.bub.style.transform = `translate(${this.bx}px,${this.by}px) translate(-100%,-100%) scale(${lerp(0.86, 1, OUT(pop)) * lerp(1, 0.94, away)})`;

    // the page goes dark
    this.root.style.opacity = 1 - IO(clamp((tp - FADE_AT) / 0.35));
  }
}
