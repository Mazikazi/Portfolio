import { clamp, rng, safe, calmMotion } from '../lib/math.js';

/*
 * The particle cloud below the hero, on one fixed WebGL canvas (#fx) behind the sections.
 *
 *   - As the hero portrait scatters on scroll, the same number of particles appear where its particles end up, and
 *     gather into a cloud in the middle of the screen: a loose, folding sheet of dots, like silk or smoke, that turns
 *     as the page scrolls. A third of the dots drift off it, so it looks scattered.
 *   - Every heading, card and row below the hero (each one is a <Reveal>, which reports here through track()) is
 *     built by it: as it scrolls in, a stream of particles spirals out of the cloud, comes forward, and lands on the
 *     shape of its text and borders. The real element fades in where they land, and they go back into the cloud.
 *   - At the end of the page the cloud flows into the box of the closing portrait (#mosaic in Contact) and fades
 *     there, as that portrait gathers (see the hero engine).
 *
 * The hero engine owns the clock: it calls render() every frame. Each element is built once per visit.
 * Without WebGL, with reduce motion on, or for crawlers, CLOUD is false and the elements simply fade in on scroll.
 */

const BOT = safe(() => /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|whatsapp/i.test(navigator.userAgent)); // same check as index.html
const hasGL = () => !!safe(() => document.createElement('canvas').getContext('webgl'));
export const CLOUD = typeof window !== 'undefined' && !BOT && !calmMotion() && hasGL();
if (CLOUD) document.documentElement.classList.add('fx'); // styles.css hides the elements until they are built

const MAXEL = 40; // elements the cloud can build
const FLY = 1.0; // seconds for a particle to fly out to its spot (they leave over the first 0.3 s)
const SHOW = 1.45; // the element fades in this long after its build starts, once the particles have drawn it
const BACK = 2.1; // the particles start back to the cloud
const SAFETY = 2.5; // seconds after an element is on screen when it is shown anyway, built or not

/* ---------- the elements, registered by useReveal() ---------- */

const items = [];

/** Shows every element at once: when the cloud cannot run after all, or is taken down. */
export const release = () => items.forEach((it) => it.reveal());

/** Called by useReveal(): `show` reveals the element. Returns the cleanup. */
export function track(el, show) {
  const it = { el, show, shown: false, start: null, k: -1 };
  it.reveal = () => {
    if (it.shown) return;
    it.shown = true;
    show();
  };
  // a safety net: whatever happens to the cloud, content that is on screen always appears
  let timer = 0;
  const io = new IntersectionObserver(
    (es) => {
      if (es.some((e) => e.isIntersecting)) {
        timer = setTimeout(it.reveal, SAFETY * 1000);
        io.disconnect();
      }
    },
    { threshold: 0.15 }
  );
  io.observe(el);
  items.push(it);
  return () => {
    clearTimeout(timer);
    io.disconnect();
    const i = items.indexOf(it);
    if (i >= 0) items.splice(i, 1);
  };
}

/* ---------- shaders ---------- */

const VS = `
precision highp float;
attribute vec2 a_birth;  // page px: where the hero particle ends up when the portrait has scattered
attribute vec2 a_uv;     // place on the sheet, -1..1
attribute vec4 a_seed;   // random 0..1
// Every particle helps build one element in each of up to five sections (they are built at different times):
// its spots on them in page px, and which elements they are (-1 for none).
attribute vec4 a_t01;
attribute vec4 a_t23;
attribute vec2 a_t4;
attribute vec4 a_e03;
attribute float a_e4;

uniform vec2 u_view;
uniform float u_dpr, u_time, u_scroll, u_born, u_form, u_end;
uniform vec2 u_box;
uniform float u_age[${MAXEL}];

varying float v_a;
varying vec3 v_c;

const float PI = 3.14159265;
float ease(float x) { return x * x * (3.0 - 2.0 * x); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }

// a thick sheet of dots folding like silk, with almost half of them drifting off it
vec3 silk(vec2 uv, vec4 s, float tm) {
  float u = uv.x, v = uv.y;
  vec3 p = vec3(
    u * 1.2 + 0.35 * sin(2.1 * v + tm * 1.3),
    v * 0.95 + 0.3 * sin(1.7 * u - tm * 1.1) + 0.2 * sin(3.1 * u + 2.3 * v + tm),
    0.7 * sin(1.3 * u + 1.9 * v + tm * 0.9) + 0.45 * cos(2.7 * u - tm * 1.2) + 0.25 * sin(4.0 * v - tm));
  p += (s.yzw - 0.5) * 0.14;
  if (s.x < 0.45) {
    float a = s.y * 6.2832 + tm * (0.3 + 0.4 * s.z);
    float b = (s.z - 0.5) * 3.0;
    p += (0.2 + 1.3 * s.w * s.w) * vec3(cos(a) * cos(b), sin(b), sin(a) * cos(b));
  }
  return p;
}

// how far out of the cloud this particle is for element el (0..1), and the two halves of its trip: out, back
vec3 trip(float el) {
  if (el < 0.0) return vec3(0.0);
  float age = u_age[int(el)];
  if (age < 0.0) return vec3(0.0);
  float f = ease(clamp((age - a_seed.w * 0.3) / ${FLY.toFixed(2)}, 0.0, 1.0));
  float r = ease(clamp((age - ${BACK.toFixed(2)} - a_seed.w * 0.3) / 1.2, 0.0, 1.0));
  return vec3(f * (1.0 - r), f, r);
}

void main() {
  float tm = u_time * 0.16;
  float m = min(u_view.x, u_view.y);
  float e = ease(u_end);
  vec2 C = mix(u_view * 0.5, u_box, e);                  // the cloud moves into the closing portrait's box at the end
  float R = 0.34 * m * mix(1.0, 0.3, e);
  vec3 q = rotX(rotY(silk(a_uv, a_seed, tm), tm * 0.7 + u_scroll * 0.0007), 0.25 + 0.2 * sin(tm * 0.6));
  vec3 cloud = vec3(C + q.xy * R, (q.z + 1.5) * R);     // x, y in screen px, z away from the viewer: behind the page

  // born where the hero particle has scattered to, then gathering into the cloud with a curl, as the page scrolls
  float fm = ease(clamp(u_form * 1.5 - a_seed.y * 0.5, 0.0, 1.0));
  vec3 P = mix(vec3(a_birth.x, a_birth.y - u_scroll, 0.0), cloud, fm);
  float an = a_seed.z * 6.2832 + fm * 4.0;
  P.xy += sin(PI * fm) * 0.22 * m * vec2(cos(an), sin(an));
  float alpha = u_born * mix(1.0, 0.8, fm);
  float big = 0.0;
  float away = 0.0; // 1 while it is out of the cloud, building something

  // building an element: out of the cloud on a spiral that comes forward, onto its spot, and back.
  // If two of its elements are building at once, it goes to the one it is further along with.
  vec3 b = vec3(0.0);
  vec2 T = vec2(0.0);
  vec3 c = trip(a_e03.x); if (c.x > b.x) { b = c; T = a_t01.xy; }
  c = trip(a_e03.y); if (c.x > b.x) { b = c; T = a_t01.zw; }
  c = trip(a_e03.z); if (c.x > b.x) { b = c; T = a_t23.xy; }
  c = trip(a_e03.w); if (c.x > b.x) { b = c; T = a_t23.zw; }
  c = trip(a_e4); if (c.x > b.x) { b = c; T = a_t4; }
  if (b.x > 0.0) {
    float k = b.x;
    float arc = sin(PI * k);
    vec3 Q = mix(P, vec3(T.x, T.y - u_scroll, 0.0), k);
    float a2 = a_seed.z * 6.2832 + (1.0 - b.y) * 6.0 - b.z * 6.0;
    Q.xy += arc * 0.08 * m * vec2(cos(a2), sin(a2));
    Q.z -= arc * 0.5 * R;                                 // it swings towards the viewer on the way
    P = Q;
    alpha = mix(alpha, 1.0, smoothstep(0.0, 0.3, k)); // full brightness while it is out building
    big = 0.6 + 0.4 * arc;
    away = k;
  }
  alpha *= mix(1.0 - smoothstep(0.75, 1.0, u_end), 1.0, away); // at the end the cloud fades, but not what is still building

  float F = 1.25 * max(u_view.x, u_view.y);
  float sc = F / (F + P.z);                                // perspective about the middle of the screen
  vec2 s = u_view * 0.5 + (P.xy - u_view * 0.5) * sc;
  gl_Position = vec4(s.x / u_view.x * 2.0 - 1.0, 1.0 - s.y / u_view.y * 2.0, 0.0, 1.0);
  gl_PointSize = (2.2 + 2.4 * a_seed.x + 1.5 * big) * sc * u_dpr;
  float lit = clamp(sc * 1.3 - 0.4 + 0.35 * a_seed.y, 0.0, 1.0); // nearer is brighter
  v_c = mix(vec3(0.4, 0.48, 0.72), vec3(0.88, 0.91, 1.0), lit);
  v_a = alpha * (0.5 + 0.5 * lit);
}`;

const FS = `
precision mediump float;
varying float v_a;
varying vec3 v_c;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(v_c, v_a * exp(-3.0 * r)); // a soft glow, so dots that overlap light up together
}`;

const ATTRS = [['a_birth', 2], ['a_uv', 2], ['a_seed', 4], ['a_t01', 4], ['a_t23', 4], ['a_t4', 2], ['a_e03', 4], ['a_e4', 1]];
const SECTIONS = 5; // targets each particle carries, one per section
const T0 = 8; // offset of the targets in a particle's data
const E0 = 18; // offset of the element numbers
const STRIDE = ATTRS.reduce((n, a) => n + a[1], 0);

/* ---------- where the particles land on an element ---------- */

/** Points on an element's text and borders, in page px: it is drawn to a small canvas, letter by letter at the real places. */
function inkOf(el) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return [];
  const k = Math.min(1, Math.sqrt(120000 / (r.width * r.height))); // big elements are sampled at a lower resolution
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((r.width + 4) * k);
  cv.height = Math.ceil((r.height + 4) * k);
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.scale(k, k);
  g.translate(2 - r.left, 2 - r.top);
  g.fillStyle = g.strokeStyle = '#fff';
  g.lineWidth = 2 / k;

  // borders: cards and buttons get their rounded outline, project rows the line above them
  for (const e of [el, ...el.querySelectorAll('*')]) {
    const cs = getComputedStyle(e);
    const top = parseFloat(cs.borderTopWidth) || 0;
    const left = parseFloat(cs.borderLeftWidth) || 0;
    if (!top && !left) continue;
    const b = e.getBoundingClientRect();
    if (left && g.roundRect) {
      g.beginPath();
      g.roundRect(b.left + 1, b.top + 1, b.width - 2, b.height - 2, parseFloat(cs.borderTopLeftRadius) || 0);
      g.stroke();
    } else g.fillRect(b.left, b.top, b.width, 2 / k);
  }

  // text, one letter at a time where the browser put it
  const range = document.createRange();
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const cs = getComputedStyle(n.parentElement);
    g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const asc = g.measureText('M').fontBoundingBoxAscent || 0.8 * parseFloat(cs.fontSize);
    const up = cs.textTransform === 'uppercase';
    const s = n.data;
    for (let i = 0; i < s.length; i++) {
      if (/\s/.test(s[i])) continue;
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const c = range.getBoundingClientRect();
      if (c.width) g.fillText(up ? s[i].toUpperCase() : s[i], c.left, c.top + asc);
    }
  }

  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  const sx = window.scrollX + r.left - 2;
  const sy = window.scrollY + r.top - 2;
  const pts = [];
  for (let i = 3, j = 0; i < d.length; i += 4, j++) {
    if (d[i] > 100) pts.push(sx + ((j % cv.width) + 0.5) / k, sy + (Math.floor(j / cv.width) + 0.5) / k);
  }
  return pts;
}

/* ---------- the cloud ---------- */

export class Cloud {
  constructor(cv) {
    this.cv = cv;
    const gl = (this.gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false }));
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pg = (this.pg = gl.createProgram());
    gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pg);
    if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pg));
    gl.useProgram(pg);
    this.u = {};
    ['u_view', 'u_dpr', 'u_time', 'u_scroll', 'u_born', 'u_form', 'u_end', 'u_box', 'u_age'].forEach((n) => (this.u[n] = gl.getUniformLocation(pg, n)));
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    let off = 0;
    for (const [name, size] of ATTRS) {
      const loc = gl.getAttribLocation(pg, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, off * 4);
      off += size;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive: brighter where the folds overlap

    this.N = 0;
    this.hx = null; // the hero particles the buffer was made from
    this.dirty = true; // the targets need measuring again
    this.ages = new Float32Array(MAXEL);
    this.clear = true; // the canvas is empty
    this.box = document.getElementById('mosaic');
    this.boxY = 0;
    this.boxX = 0;
    this.boxH = 0;
    this.size();
    this.onResize = () => this.size();
    window.addEventListener('resize', this.onResize);
    this.ro = new ResizeObserver(() => {
      clearTimeout(this.lt);
      this.lt = setTimeout(() => (this.dirty = true), 200); // the layout moved: measure the elements again
    });
    this.ro.observe(document.body);
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    this.ro.disconnect();
    clearTimeout(this.lt);
    release();
  }

  size() {
    const { cv } = this;
    this.W = cv.clientWidth;
    this.H = cv.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(this.W * this.dpr);
    cv.height = Math.round(this.H * this.dpr);
    this.gl.viewport(0, 0, cv.width, cv.height);
  }

  /** Measure every element and give each one its share of the particles, landing on its ink. */
  build(field) {
    const N = field.N;
    const r = rng(5);
    const live = items.filter((it) => !it.shown).slice(0, MAXEL);
    items.forEach((it) => (it.k = -1));
    const secs = [];
    const groups = []; // the elements of each section, in page order
    live.forEach((it, k) => {
      it.k = k;
      it.pts = inkOf(it.el);
      const b = it.el.getBoundingClientRect();
      it.top = b.top + window.scrollY;
      it.bottom = b.bottom + window.scrollY;
      const sec = it.el.closest('section');
      let g = secs.indexOf(sec);
      if (g < 0) g = secs.push(sec) - 1;
      (groups[g] = groups[g] || []).push(it);
    });
    if (this.box) {
      const b = this.box.getBoundingClientRect();
      this.boxX = b.left + b.width / 2;
      this.boxY = b.top + window.scrollY + b.height / 2;
      this.boxB = b.bottom + window.scrollY;
    }

    const data = new Float32Array(N * STRIDE);
    for (let i = 0; i < N; i++) {
      const o = i * STRIDE;
      data[o] = field.hx[i] + field.dxv[i];
      data[o + 1] = field.hy[i] + field.dyv[i];
      data[o + 2] = r() * 2 - 1;
      data[o + 3] = r() * 2 - 1;
      for (let c = 0; c < 4; c++) data[o + 4 + c] = r();
      for (let s = 0; s < SECTIONS; s++) data[o + E0 + s] = -1;
    }
    // in each section nine in ten particles build its elements, more of them for the ones with more ink (the big headings)
    groups.forEach((g, gi) => {
      const s = gi % SECTIONS; // a sixth section would share its particles with the first
      const w = g.map((it) => Math.pow(it.pts.length / 2, 0.7));
      const sum = w.reduce((a, b) => a + b, 0) || 1;
      const order = Array.from({ length: N }, (_, i) => i);
      for (let i = N - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      let at = 0;
      g.forEach((it, j) => {
        const n = Math.round((0.9 * N * w[j]) / sum);
        const m = it.pts.length / 2;
        for (let c = 0; c < n && at < N && m; c++, at++) {
          const o = order[at] * STRIDE;
          const p = Math.floor(r() * m) * 2;
          data[o + T0 + 2 * s] = it.pts[p];
          data[o + T0 + 2 * s + 1] = it.pts[p + 1];
          data[o + E0 + s] = it.k;
        }
        it.pts = null;
      });
    });

    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.N = N;
    this.hx = field.hx;
    this.dirty = false;
  }

  /** One frame. `t` is the hero engine's clock, `field` the hero portrait, `VH` the hero's height. */
  render(t, field, VH) {
    if (!field.N) return;
    this.t = t;
    const y = window.scrollY || 0;
    // at the top of the page there is nothing to draw: measure the elements once the intro has settled, or on the first scroll
    const idle = y < 1 && this.clear;
    if (idle && !(this.dirty && t > 6.5)) return;
    if (this.dirty || this.hx !== field.hx) this.build(field);
    if (idle) return;
    const { gl, W, H, ages } = this;

    // start each element's build as it scrolls in; one already scrolled past is simply shown
    let busy = false;
    ages.fill(-1);
    for (const it of items) {
      if (it.k < 0) continue;
      if (it.start == null && !it.shown && it.top - y < 0.85 * H) {
        if (it.bottom - y < 0) it.reveal();
        else it.start = t;
      }
      if (it.start == null) continue;
      const age = t - it.start;
      if (age >= SHOW) it.reveal();
      if (age < BACK + 1.6) busy = true;
      ages[it.k] = Math.min(age, 9);
    }

    const born = clamp((y / (0.25 * VH) - 0.35) / 0.5);
    const form = clamp((y - 0.2 * VH) / (0.9 * VH));
    const end = this.box ? clamp(1 - (this.boxB - y - H) / (0.7 * H)) : 0;
    if ((born <= 0 || end >= 1) && !busy) {
      if (this.clear) return; // nothing to show, and the canvas is already empty
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.clear = true;
      return;
    }
    this.clear = false;

    const u = this.u;
    gl.uniform2f(u.u_view, W, H);
    gl.uniform1f(u.u_dpr, this.dpr);
    gl.uniform1f(u.u_time, t);
    gl.uniform1f(u.u_scroll, y);
    gl.uniform1f(u.u_born, born);
    gl.uniform1f(u.u_form, form);
    gl.uniform1f(u.u_end, end);
    gl.uniform2f(u.u_box, this.boxX, this.boxY - y);
    gl.uniform1fv(u.u_age, ages);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, this.N);
  }
}
