import { clamp, lerp, ss, kf, bezier, rng } from '../lib/math.js';

/*
 * The opening scene, played by the hero engine before the dot intro (the storyboard).
 *
 *   0.0   the most ordinary 404 page there is: white, big "404", "Page not found", a blue link.
 *         The browser tab says "404 Not Found" too, so a visitor believes the site is broken
 *   1.5   the orb of the site (the particle cloud, see fx/cloud.js) streams in from the right as a swarm and gathers
 *         next to the 404
 *   2.65  it says "hmm...", then "not on my watch."
 *   4.8   it bursts open: the swarm spreads out from it over the whole screen like a wave and engulfs the page. Where
 *         the wave has passed the white page is gone and the dark site shows, and the letters crumble as it takes them
 *   7.7   the whole swarm rushes to the middle of the screen and collapses into one dot
 *   8.9   the dot squashes and shoots off the top of the screen
 *   HANDOFF  the dot of the original intro falls in (that is the engine's time 0)
 *
 * Like the engine it is a function of time: render(tp) draws second tp, so seeking and skipping just work (the page
 * canvas keeps what is wiped, and is drawn again from the start when time goes back). Sizes are in units of H, the
 * height of the 404 digits, so the scene scales with the screen. The swarm is drawn light and blended as a difference:
 * dark on the white page, light where the site shows through.
 */

const OUT = bezier(0.23, 1, 0.32, 1); // strong ease-out, for things arriving
const IO = bezier(0.77, 0, 0.175, 1); // strong ease-in-out, for things moving across the screen
const IN = bezier(0.5, 0, 0.75, 0); // ease-in, only for the launch: the dot is leaving, not arriving
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'; // the plain system font of any stock 404 page
const INKS = ['#212529', '#6c757d', '#0d6efd']; // digits and heading, the line of text, the link
const TINTS = ['102,122,184', '163,176,220', '224,232,255']; // the swarm's dots, far to near: the colours of the particle cloud

// The orb, in H units from the middle of the 404 digits (y points down).
const REST = [1.76, -0.71]; // where it hovers next to the 404
const ORB = 0.3; // its radius there
const DOTS = 1500;

// Timeline, in seconds from the start of the page.
const SWARM_IN = 1.5; // the swarm streams in, about 1 s. Until then it is just a 404, long enough to fool someone
const SAY = [
  { text: 'hmm...', in: 2.65, out: 3.45, per: 0.08 }, // per: seconds per letter
  { text: 'not on my watch.', in: 3.6, out: 4.7, per: 0.045 },
];
const PUFF = [[0, 1], [2.65, 1], [2.8, 1.16], [3.2, 1], [3.6, 1], [3.8, 0.8], [4.65, 0.7], [4.8, 1]]; // it swells at "hmm...", and tightens at "not on my watch.", ready to burst
const LOOK = [[0, 0], [2.65, 0], [2.85, -0.07], [4.6, -0.07], [4.8, 0]]; // it leans towards the page while talking
const SWEEP_AT = 4.8; // it bursts
const SPREAD = 2.6; // seconds for the wave to cross the whole screen
const GATHER_AT = SWEEP_AT + SPREAD + 0.3; // the swarm turns and rushes to the middle, about 1 s
const SWEEP_END = GATHER_AT + 1.05;
const MERGE_AT = SWEEP_END - 0.3; // the dot it collapses into appears as the last of them arrive, 0.45 s
const SQUASH_AT = MERGE_AT + 0.45; // crouch before the jump, 0.15 s
const LAUNCH_AT = SQUASH_AT + 0.15; // shoot off the top, 0.3 s
const FADE_AT = LAUNCH_AT + 0.25; // what is left of the scene fades, 0.35 s
const END = FADE_AT + 0.35;
/** Seconds until the dot of the original intro starts to fall. The engine's clock reads 0 at this moment. */
export const HANDOFF = END - 0.15;

const WAVE = 1.25; // the wave starts gently and picks up: its reach goes with time to this power
const EDGE = 0.45; // width of the wave's smoky edge, in H

/** A soft round dot in one colour, drawn once and stamped for every particle. */
function dotSprite(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, `rgba(${rgb},1)`);
  gr.addColorStop(0.4, `rgba(${rgb},.5)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return c;
}

export class Prologue {
  constructor(root) {
    const $ = (s) => root.querySelector(s);
    this.root = root;
    this.page = $('#proPage');
    this.pg = this.page.getContext('2d');
    this.orbCv = $('#proOrb');
    this.og = this.orbCv.getContext('2d');
    this.bub = $('#proBub');
    this.shown = this.bub.querySelector('i');
    this.rest = this.bub.querySelector('b');
    this.title = document.title;
    this.theme = document.querySelector('meta[name="theme-color"]');
    this.dark = this.theme ? this.theme.content : '';
    this.on = null;
    this.dust = null;
    this.H = 0;
    this.seed = (Math.random() * 2 ** 31) | 0; // this visit's swarm
    this.dots = TINTS.map(dotSprite);
    this.puff = dotSprite('0,0,0'); // for the ragged edge of the wave

    // The swarm's particles: a place on the orb's folding sheet, four random numbers, and the spot on the screen
    // (0..1 across and down) each one flies out to. A third make up the orb; the rest stay hidden in it until it bursts.
    const r = rng(this.seed);
    this.pu = new Float32Array(DOTS);
    this.pv = new Float32Array(DOTS);
    this.ps = new Float32Array(DOTS * 4);
    this.px = new Float32Array(DOTS);
    this.py = new Float32Array(DOTS);
    for (let i = 0; i < DOTS; i++) {
      this.pu[i] = r() * 2 - 1;
      this.pv[i] = r() * 2 - 1;
      for (let c = 0; c < 4; c++) this.ps[i * 4 + c] = r();
      this.px[i] = r();
      this.py[i] = r();
    }
  }

  /** R is the radius of the dot of the original intro, which the swarm collapses into. */
  layout(VW, VH, R) {
    const H = Math.min(0.34 * VH, (VW / 2 - 14) / 2.02); // digit height: as tall as the screen allows, with room for the orb on the right
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
    // the orb, where the wave starts, and how far that is from the furthest corner of the screen (in px)
    const ox = cx + REST[0] * H;
    const oy = cy + REST[1] * H;
    const far = Math.hypot(Math.max(ox, VW - ox), Math.max(oy, VH - oy)) + (EDGE + 0.3) * H;
    Object.assign(this, { H, cx, cy, VW, VH, R, ox, oy, far, mx: cx, my: 0.33 * VH, xIn: VW / (2 * H), key: '', text: { head, para, link, hs, ps } });

    // the page (sharp on any screen) and the swarm above it
    const dpr = window.devicePixelRatio || 1;
    this.pdpr = Math.min(dpr, 3);
    this.dpr = Math.min(dpr, 2);
    this.page.width = Math.round(VW * this.pdpr);
    this.page.height = Math.round(VH * this.pdpr);
    this.orbCv.width = Math.round(VW * this.dpr);
    this.orbCv.height = Math.round(VH * this.dpr);
    this.drawPage();
    this.root.style.background = 'none'; // the stylesheet's white, until this canvas could take over

    const fs = clamp(0.115 * H, 14, 40);
    this.bub.style.fontSize = fs + 'px';
    this.bx = cx + (REST[0] - ORB - 0.06) * H - 0.95 * fs; // right edge of the bubble, just left of the orb
    this.by = cy + REST[1] * H - 0.03 * H;

    this.dust = null;
    if (document.documentElement.classList.contains('pro')) this.makeDust(); // only when the scene will really play
  }

  /** How far the wave has spread from the orb at second tp, in px. */
  front(tp) {
    return this.far * Math.pow(clamp((tp - SWEEP_AT) / SPREAD), WAVE);
  }

  /** The 404 page's text, drawn on `g` (the page itself, and the copy the crumbs are sampled from). */
  drawText(g) {
    const { H, cx, cy, text: t } = this;
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
  }

  /** The untouched page: white, with its text. */
  drawPage() {
    const g = this.pg;
    g.setTransform(this.pdpr, 0, 0, this.pdpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, this.VW, this.VH);
    this.drawText(g);
    this.wiped = 0; // how far out from the orb the page is wiped so far, px
  }

  /** Wipes the page out to `r` px from the orb. The canvas keeps what is wiped; going back redraws it. */
  erase(r) {
    if (r < this.wiped) this.drawPage();
    if (r <= this.wiped) return;
    const { pg: g, ox, oy, H } = this;
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 1;
    // everything inside the wave, with a soft edge
    const band = Math.min(r, EDGE * H);
    const gr = g.createRadialGradient(ox, oy, r - band, ox, oy, r);
    gr.addColorStop(0, '#000');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(ox, oy, r, 0, 6.2832);
    g.fill();
    // and puffs of smoke running ahead of it here and there, so its edge is ragged, not a clean circle
    const rand = rng(this.seed + Math.round(r));
    for (let k = 0; k < 10; k++) {
      const a = rand() * 6.2832;
      const d = r - band * (0.7 * rand() - 0.25);
      const pr = (0.25 + 0.5 * rand()) * EDGE * H;
      g.globalAlpha = 0.5;
      g.drawImage(this.puff, ox + Math.cos(a) * d - pr, oy + Math.sin(a) * d - pr, 2 * pr, 2 * pr);
    }
    g.globalAlpha = 1;
    this.wiped = r;
  }

  /**
   * Crumbs: the letters crumble as the wave takes them. They are sampled from the real ink of the page, and each is
   * born at the moment the wave reaches its spot. After that it is a formula of time: carried off with the wave.
   */
  makeDust() {
    const { H, cx, cy, ox, oy, text: t } = this;
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `400 ${t.ps}px ${FONT}`;
    const half = Math.max(1.25 * H, probe.measureText("The page you're looking for doesn't exist.").width / 2 + 6);
    const [x0, x1] = [Math.floor(cx - half), Math.ceil(cx + half)];
    const [y0, y1] = [Math.floor(cy - 0.6 * H), Math.ceil(cy + t.link + 0.4 * t.ps)];
    const sc = Math.min(1, 520 / (x1 - x0)); // sample at a lower resolution on big screens
    const cv = document.createElement('canvas');
    cv.width = Math.ceil((x1 - x0) * sc);
    cv.height = Math.ceil((y1 - y0) * sc);
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.scale(sc, sc);
    g.translate(-x0, -y0);
    this.drawText(g);

    const px = g.getImageData(0, 0, cv.width, cv.height).data;
    const ink = [];
    for (let i = 3; i < px.length; i += 4) if (px[i] > 128) ink.push((i - 3) / 4);
    if (!ink.length) return;

    const N = 1800;
    const r = rng(11);
    const D = { t: new Float32Array(N), x: new Float32Array(N), y: new Float32Array(N), vx: new Float32Array(N), vy: new Float32Array(N), life: new Float32Array(N), size: new Float32Array(N), n: N };
    for (let k = 0; k < N; k++) {
      const i = ink[Math.floor(r() * ink.length)];
      const x = x0 + ((i % cv.width) + r()) / sc;
      const y = y0 + (Math.floor(i / cv.width) + r()) / sc;
      const d = Math.hypot(x - ox, y - oy) || 1;
      const push = (0.5 + 1.1 * r()) * H; // carried outwards, px per second
      D.t[k] = SWEEP_AT + SPREAD * Math.pow(clamp((d - 0.5 * EDGE * H) / this.far), 1 / WAVE) + 0.05 * r();
      D.x[k] = x;
      D.y[k] = y;
      D.vx[k] = ((x - ox) / d) * push + (r() - 0.5) * 0.5 * H;
      D.vy[k] = ((y - oy) / d) * push + (r() - 0.5) * 0.5 * H;
      D.life[k] = 0.5 + 0.7 * r();
      D.size[k] = (1.8 + 2.8 * r()) * clamp(H / 230, 0.7, 2);
    }
    this.dust = D;
  }

  /** The swarm, the crumbs of the letters, and the dot it all collapses into. */
  drawOrb(tp) {
    const { og: g, H, cx, cy, VW, VH, R, ox, oy, mx, my, dots, pu, pv, ps, px, py } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'lighter';

    const mu = IO(clamp((tp - MERGE_AT) / 0.45)); // 0: the swarm. 1: the dot
    if (tp > SWARM_IN && tp < SWEEP_END + 0.2) {
      // the orb, as it hovers and talks
      const bob = 0.025 * Math.sin(tp * 2.4) * (1 - ss(clamp((tp - SWEEP_AT + 0.4) / 0.4))); // it steadies before it bursts
      const hx = ox + kf(LOOK, tp) * H;
      const hy = oy + bob * H;
      const rad = ORB * kf(PUFF, tp) * H;
      const k = rad / 1.5; // the sheet below reaches about 1.5 from its middle
      const F = 4 * rad + 1; // perspective
      const big = clamp(H / 300, 0.55, 1.2) * 1.3; // a little bigger than the cloud's own dots, to read on white
      const tm = tp * 0.45;
      const [cy1, sy1] = [Math.cos(tm * 0.7), Math.sin(tm * 0.7)];
      const tilt = 0.25 + 0.2 * Math.sin(tm * 0.6);
      const [cx1, sx1] = [Math.cos(tilt), Math.sin(tilt)];
      const front = this.front(tp);
      const burst = tp >= SWEEP_AT;
      for (let i = 0; i < DOTS; i++) {
        if (!burst && i % 3) continue; // the others are still hidden in the orb
        const [s0, s1, s2, s3] = [ps[i * 4], ps[i * 4 + 1], ps[i * 4 + 2], ps[i * 4 + 3]];
        const come = OUT(clamp((tp - SWARM_IN - 0.45 * s2) / 0.7)); // each one's flight in
        if (come <= 0) continue;
        // a thick sheet of dots folding like silk, with almost half of them drifting off it (silk() in fx/cloud.js)
        const u = pu[i];
        const v = pv[i];
        let x = u * 1.2 + 0.35 * Math.sin(2.1 * v + tm * 1.3) + (s1 - 0.5) * 0.14;
        let y = v * 0.95 + 0.3 * Math.sin(1.7 * u - tm * 1.1) + 0.2 * Math.sin(3.1 * u + 2.3 * v + tm) + (s2 - 0.5) * 0.14;
        let z = 0.7 * Math.sin(1.3 * u + 1.9 * v + tm * 0.9) + 0.45 * Math.cos(2.7 * u - tm * 1.2) + 0.25 * Math.sin(4 * v - tm) + (s3 - 0.5) * 0.14;
        if (s0 < 0.45) {
          const a = s1 * 6.2832 + tm * (0.3 + 0.4 * s2);
          const b = (s2 - 0.5) * 3;
          const d = 0.2 + 1.3 * s3 * s3;
          x += d * Math.cos(a) * Math.cos(b);
          y += d * Math.sin(b);
          z += d * Math.sin(a) * Math.cos(b);
        }
        // turned about the upright axis, then tilted towards the viewer
        const xr = cy1 * x + sy1 * z;
        const zr = -sy1 * x + cy1 * z;
        const yr = cx1 * y - sx1 * zr;
        const zz = sx1 * y + cx1 * zr;
        const sc = F / (F + zz * k);
        let X = hx + xr * k * sc;
        let Y = hy + yr * k * sc;
        let size = (2.4 + 3.6 * s0) * sc * big;
        if (come < 1) {
          // streaming in from beyond the right edge, on a curl
          const fx = cx + (this.xIn + 0.15 + 0.9 * s3) * H;
          const fy = cy + (REST[1] - 0.5 + (s1 - 0.5) * 2.6) * H;
          X = lerp(fx, X, come);
          Y = lerp(fy, Y, come) + Math.sin(Math.PI * come) * (s0 - 0.5) * 0.9 * H;
        }
        if (burst) {
          // It rides the wave out to its own spot on the screen, on a curl, and buzzes there. Some keep right at
          // the wave's edge, others hang back, so the edge is thick with them.
          const tx = px[i] * VW;
          const ty = py[i] * VH;
          const d = Math.hypot(tx - ox, ty - oy) || 1;
          const out = clamp((front * (0.72 + 0.33 * s0)) / d);
          const e = out * out * (3 - 2 * out);
          const swing = Math.sin(Math.PI * out) * (s1 - 0.5) * 0.5 * d;
          const buzz = 0.05 * H * out;
          let wx = lerp(X, tx, e) + (-(ty - oy) / d) * swing + buzz * Math.sin(tp * (4 + 5 * s1) + s2 * 6.28);
          let wy = lerp(Y, ty, e) + ((tx - ox) / d) * swing + buzz * Math.cos(tp * (4 + 5 * s3) + s0 * 6.28);
          // then the rush to the middle, the far ones a little later, curling in
          const home = IO(clamp((tp - GATHER_AT - 0.3 * s2) / 0.75));
          if (home > 0) {
            const hd = Math.hypot(wx - mx, wy - my) || 1;
            const curl = Math.sin(Math.PI * home) * (s3 - 0.5) * 0.7 * hd;
            const [bx, by] = [wx, wy];
            wx = lerp(bx, mx, home) + (-(by - my) / hd) * curl;
            wy = lerp(by, my, home) + ((bx - mx) / hd) * curl;
            size *= 1 - 0.5 * home;
            if (home >= 1) continue; // it is in the dot
          }
          X = wx;
          Y = wy;
        }
        const near = clamp(sc * 1.3 - 0.4 + 0.35 * s1); // nearer is brighter
        g.globalAlpha = (0.6 + 0.4 * near) * (0.8 + 0.2 * Math.sin(tp * (2 + 3 * s3) + s1 * 6.28));
        g.drawImage(dots[near > 0.62 ? 2 : near > 0.38 ? 1 : 0], X - size / 2, Y - size / 2, size, size);
      }
    }

    // the crumbs of the letters, carried off by the wave
    const D = this.dust;
    if (D && tp > SWEEP_AT && tp < GATHER_AT + 1.5) {
      for (let i = 0; i < D.n; i++) {
        const tau = tp - D.t[i];
        if (tau < 0 || tau > D.life[i]) continue;
        const u = tau / D.life[i];
        const s = D.size[i] * (1 - 0.5 * u);
        const go = tau * (1 - 0.35 * u); // it slows as it fades
        g.globalAlpha = 0.95 * (1 - u * u);
        g.drawImage(dots[2], D.x[i] + D.vx[i] * go - s / 2, D.y[i] + D.vy[i] * go - s / 2, s, s);
      }
    }

    // the dot it becomes: it crouches, then shoots off the top, ending stretched like the dot that falls in next
    if (mu > 0 && tp < LAUNCH_AT + 0.3) {
      let sx = 1;
      let sy = 1;
      let ty = my;
      if (tp >= SQUASH_AT) {
        const q = OUT(clamp((tp - SQUASH_AT) / 0.15));
        sx = 1 + 0.12 * q;
        sy = 1 - 0.14 * q;
        if (tp >= LAUNCH_AT) {
          const u = clamp((tp - LAUNCH_AT) / 0.3);
          sx = lerp(1.12, 0.86, ss(u));
          sy = lerp(0.86, 1.22, ss(u));
          ty = lerp(ty, -0.12 * VH, IN(u));
        }
      }
      const flash = Math.sin(Math.PI * mu) * 6 * R; // a glow as the swarm lands in it
      if (flash > 1) {
        g.globalAlpha = 0.5;
        g.drawImage(dots[2], mx - flash, ty - flash, 2 * flash, 2 * flash);
      }
      g.globalAlpha = mu;
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(mx, ty, R * sx * lerp(0.4, 1, mu), R * sy * lerp(0.4, 1, mu), 0, 0, 6.2832);
      g.fill();
    }
    g.globalAlpha = 1;
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

    // the page is gone wherever the wave has passed
    this.erase(this.front(tp));
    this.page.style.opacity = 1 - clamp((tp - GATHER_AT) / 0.3); // the last traces of it
    this.drawOrb(tp);

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

    // what is left of the scene fades
    this.root.style.opacity = 1 - IO(clamp((tp - FADE_AT) / 0.35));
  }
}
