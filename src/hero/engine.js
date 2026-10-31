import { clamp, kf, lin, ss, eOut3, eOut2, eIO3, safe, prefersReducedMotion } from '../lib/math.js';
import { drawBust } from './placeholderBust.js';
import { ParticleField } from './particles.js';
import { Prologue, HANDOFF } from './prologue.js';

/*
 * The hero intro, written as a pure function of time `t` (seconds). On a first visit the opening scene
 * (prologue.js) plays before it, so `t` starts at -HANDOFF and the dot below begins to fall at t = 0.
 * Timings were read frame by frame from the reference video (15 fps).
 *
 *   0.07  dot falls in, squashes, bounces twice
 *   0.77  the stem of the "I" drops onto the dot
 *   1.10  the stem swings like a pendulum while the letters spin in around it
 *   2.13  the stem snaps upright and becomes the "I"; the dot fades
 *   2.47  letters are swapped one by one until the word reads PORTFOLIO
 *   3.40  the title slides to the bottom, role line and buttons fade in
 *   3.90  star dust fades in
 *   4.55  particles gather into the portrait; the nav fades in at 4.62
 *   scroll: the portrait scatters back into dust
 */
const PHI = [[0.75, 0], [0.933, 8], [1.0, 0], [1.1, 0], [1.133, -10], [1.2, -62], [1.267, -62], [1.45, -54], [1.533, -46], [1.6, -8], [1.667, 58], [1.8, 66], [2.0, 70], [2.067, 64], [2.13, 3]];
const GRP = [[1.3, 55], [1.53, 34], [1.6, 13], [1.667, 5], [1.8, 0]];
const GB = [[1.067, 0], [1.2, 0.45], [1.4, 0.55], [1.7, 0.3], [2.0, 0.12], [2.2, 0]];
const STEM_D = [[0.75, 3.6], [0.8, 2.4], [0.867, 1.1], [0.933, 0.22], [1.0, 0.47], [1.1, 0.47], [1.2, 0.27], [2.0, 0.27], [2.1, 0.32]];
const A0L = [-100, 150, -90, 120];
const A0R = [-65, 55, -40, 45];
const PULSE = [[0.267, 0.45, 0.09], [0.667, 0.45, 0.09], [0.933, 1, 0.12]];
const FONT = "900 200px 'Inter Tight','Inter',sans-serif";

export class HeroEngine {
  /**
   * @param {object} o
   * @param {object} o.els          DOM elements of the hero (from React refs)
   * @param {object} o.config       site config (intro letters, role, photo)
   * @param {(s:string)=>void} o.setTitleText  synchronously re-renders the title letters
   * @param {()=>HTMLElement|null} o.getNav
   * @param {(label:string)=>void} o.onPhotoLabel
   */
  constructor({ els, config, setTitleText, getNav, onPhotoLabel }) {
    this.els = els;
    this.cfg = config;
    this.setTitleText = setTitleText;
    this.getNav = getNav;
    this.onPhotoLabel = onPhotoLabel;

    this.ctx = els.cv.getContext('2d');
    this.field = new ParticleField();
    this.pro = els.pro ? new Prologue(els.pro) : null;
    this.P = 0; // seconds of opening scene before t = 0 (0 when it is skipped)
    this.src = document.createElement('canvas');
    this.src.width = 800;
    this.src.height = 1000;
    this.sctx = this.src.getContext('2d');
    this.usingPlaceholder = true;

    this.VW = 0;
    this.VH = 0;
    this.dpr = 1;
    this.F = 100;
    this.C = 70;
    this.R = 12;
    this.yB = 0;
    this.yDot = 0;
    this.yF = 0;
    this.asc = 0;
    this.inkW = 10;
    this.idxI = -1;
    this.slot = [];
    this.chars = [];
    this.curText = '';
    this.curW = 0;
    this.shift0 = 0;
    this.states = [];
    this.wP = 0;

    this.t0 = performance.now();
    this.tNow = 0;
    this.frozen = null;
    this.introDone = false;
    this.heroVisible = true;
    this.ready = false;
    this.destroyed = false;
    this.formStart = 4.55;
    this.dissolve = 0;
    this.mx = -999;
    this.my = -999;
    this.raf = 0;
    this.resizeTimer = 0;
    this.cleanups = [];
    this.reduce = prefersReducedMotion();
    this.seen = safe(() => sessionStorage.getItem('mk-intro'));
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn, opts));
  }

  async init() {
    await null; // never touch React state synchronously inside the mount effect
    const fonts = document.fonts;
    if (fonts && fonts.load) {
      await Promise.race([
        Promise.all([fonts.load("900 100px 'Inter Tight'"), fonts.load("700 20px 'Inter'"), fonts.load("italic 300 20px 'Inter'")]),
        new Promise((r) => setTimeout(r, 2500)),
      ]).catch(() => {});
    }
    if (this.destroyed) return;

    this.layout();
    this.field.buildStars(this.VW, this.VH);
    drawBust(this.sctx);
    this.usingPlaceholder = true;
    this.field.buildPortrait(this.src, this.VW, this.VH);
    this.ready = true;

    const saved = safe(() => localStorage.getItem('mk-photo'));
    if (saved) this.loadSrc(saved, false, true);
    else if (this.cfg.photo) this.loadSrc(this.cfg.photo, false, false);

    const skip = this.reduce || this.seen;
    if (skip) this.formStart = -10;
    else {
      this.lockScroll(true);
      // the scrollbar is gone now, so measure the opening scene again against the real width
      if (this.pro) this.pro.layout(this.els.hero.clientWidth, this.els.hero.clientHeight, this.R);
    }

    this.on(this.els.hero, 'pointermove', (e) => {
      const r = this.els.hero.getBoundingClientRect();
      this.mx = e.clientX - r.left;
      this.my = e.clientY - r.top;
    });
    this.on(this.els.hero, 'pointerleave', () => {
      this.mx = this.my = -999;
    });
    this.on(window, 'scroll', this.onScroll, { passive: true });
    this.on(window, 'resize', this.onResize);
    window.__seek = (t) => {
      this.frozen = t;
      this.introDone = false;
      this.curText = '';
    };
    window.__seekP = (tp) => window.__seek(tp - this.P); // jump inside the opening scene (testing)
    window.__pro = this.pro; // the opening scene, for poking at in the console (testing)

    this.onScroll();
    this.P = skip ? 0 : HANDOFF;
    this.t0 = performance.now() - (skip ? 6200 : 0);
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.resizeTimer);
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.lockScroll(false);
    if (window.__seek) delete window.__seek;
  }

  lockScroll(on) {
    const v = on ? 'hidden' : '';
    document.documentElement.style.overflow = v;
    document.body.style.overflow = v;
    this.locked = on;
  }

  skip() {
    this.P = 0;
    this.t0 = performance.now() - 6200;
    this.introDone = false;
    this.markSeen();
  }

  markSeen() {
    safe(() => sessionStorage.setItem('mk-intro', '1'));
  }

  /* ---------- title and layout ---------- */

  setTitle(str) {
    this.setTitleText(str);
    this.chars = Array.from(this.els.title.querySelectorAll('.c'));
    this.curW = this.els.title.offsetWidth;
    this.curText = str;
  }

  buildStates() {
    const T = 'PORTFOLIO';
    const cur = this.cfg.intro.split('');
    const out = [{ t: 0, s: this.cfg.intro }];
    let tt = 2.47;
    const n = Math.max(cur.length, T.length);
    for (let i = 0; i < n; i++) {
      if (i < T.length) cur[i] = T[i];
      else cur.length = T.length;
      out.push({ t: tt, s: cur.join('') });
      tt += 0.067;
      if (i === 6) tt += 0.133;
    }
    return out;
  }

  layout() {
    const { hero, title, pivotG, pivotS, dot, stem, gl, sub, cta, cv, pill, down } = this.els;
    this.VW = hero.clientWidth;
    this.VH = hero.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(this.VW * this.dpr);
    cv.height = Math.round(this.VH * this.dpr);
    pivotG.style.transform = 'none';
    const root = document.documentElement;
    root.style.setProperty('--F', '100px');

    // Fit the font size so PORTFOLIO fills 72% of the width (88% on phones).
    this.setTitle('PORTFOLIO');
    title.style.left = '0px';
    title.style.top = '0px';
    const w0 = title.offsetWidth;
    const target = this.VW < 700 ? 0.88 : 0.72;
    const g = document.createElement('canvas').getContext('2d');
    g.font = FONT;
    const mH = g.measureText('H');
    const mI = g.measureText('I');
    const capRatio = (mH.actualBoundingBoxAscent || 146) / 200;
    let F = (100 * target * this.VW) / w0;
    F = Math.min(F, (0.21 * this.VH) / capRatio);
    this.F = F;
    root.style.setProperty('--F', F + 'px');
    const C = (this.C = F * capRatio);
    const R = (this.R = 0.18 * C);
    this.inkW = ((mI.actualBoundingBoxLeft + mI.actualBoundingBoxRight) || 36) / 200 * F;
    this.wP = title.offsetWidth;

    // Metrics of the intro word (letter slots, baseline).
    this.setTitle(this.cfg.intro);
    this.slot = this.chars.map((c) => ({ x: c.offsetLeft, w: c.offsetWidth }));
    this.asc = title.querySelector('.bl').getBoundingClientRect().bottom - title.getBoundingClientRect().top;
    this.idxI = this.cfg.intro.indexOf('I');
    this.shift0 = this.idxI >= 0 ? this.curW / 2 - (this.slot[this.idxI].x + this.slot[this.idxI].w / 2) : 0;
    this.states = this.buildStates();

    // Anchors
    this.yB = 0.51 * this.VH + C / 2;
    this.yDot = this.yB + 0.32 * C;
    this.yF = Math.max(0.83 * this.VH, this.yB + 0.12 * this.VH);

    dot.style.width = dot.style.height = 2 * R + 'px';
    dot.style.left = dot.style.top = -R + 'px';
    stem.style.width = this.inkW + 'px';
    stem.style.height = C + 'px';
    gl.forEach((e) => {
      e.style.width = e.style.height = 5 * C + 'px';
    });
    pivotS.style.left = this.VW / 2 + 'px';
    pivotS.style.top = this.yDot + 'px';
    pivotG.style.left = this.VW / 2 + 'px';
    pivotG.style.top = this.yDot + 'px';

    sub.style.fontSize = Math.max(14, 0.155 * F) + 'px';
    const leftP = (this.VW - this.wP) / 2;
    sub.style.left = leftP + 0.016 * this.wP + 'px';
    cta.style.fontSize = Math.max(10.5, 0.088 * F) + 'px';
    cta.style.right = this.VW - (leftP + 0.945 * this.wP) + 'px';
    cta.style.height = Math.max(25, 0.2 * F) + 'px';
    pill.style.padding = '0 1.45em';
    pill.style.height = '100%';
    down.style.height = '100%';
    this.curText = '';
    if (this.pro) this.pro.layout(this.VW, this.VH, R);
  }

  /* ---------- the intro, one frame ---------- */

  introFrame(t) {
    const { dot, stem, stemRot, title, pivotG, gl, sub, cta } = this.els;
    const { VH, C, inkW, idxI, slot, cfg } = this;
    const stemD = (tt) => kf(STEM_D, tt, tt < 0.933 ? lin : ss) * C;

    // dot: falls, squashes, bounces
    let dy = 0;
    let sx = 1;
    let sy = 1;
    let dotO = 0;
    if (t >= 0.05 && t < 2.4) {
      dotO = 1 - clamp((t - 2.2) / 0.12);
      if (t < 0.267) {
        const f = clamp((t - 0.067) / 0.2);
        dy = -0.65 * VH * (1 - f);
        sx = 0.86;
        sy = 1.22;
        dotO *= clamp((t - 0.05) / 0.02);
      } else {
        const a = (t - 0.467) / 0.2;
        dy = t < 0.667 ? -0.1 * VH * (1 - a * a) : 0;
        const s1 = t >= 0.267 ? clamp(1 - (t - 0.267) / 0.1) : 0;
        const s2 = t >= 0.667 ? clamp(1 - (t - 0.667) / 0.1) : 0;
        const s = Math.max(s1, s2);
        sx = 1 + 0.55 * s;
        sy = 1 - 0.5 * s;
      }
    }
    dot.style.opacity = dotO;
    dot.style.transform = `translate3d(0,${dy}px,0) scale(${sx},${sy})`;

    // stem of the I: drops, swings, snaps upright
    if (t >= 0.75 && t < 2.13) {
      stem.style.display = 'block';
      stemRot.style.transform = `rotate(${kf(PHI, t)}deg)`;
      const sq = 1 - 0.35 * clamp(1 - Math.abs(t - 0.94) / 0.07);
      stem.style.transformOrigin = '50% 100%';
      stem.style.transform = `translate(${-inkW / 2}px,${-(stemD(t) + C)}px) scaleY(${sq})`;
    } else {
      stem.style.display = 'none';
    }

    // title text: intro word, then letter-by-letter swap to PORTFOLIO
    if (t < 2.47) {
      if (this.curText !== cfg.intro) this.setTitle(cfg.intro);
    } else {
      let k = 0;
      for (let i = 0; i < this.states.length; i++) if (this.states[i].t <= t) k = i;
      if (this.states[k].s !== this.curText) this.setTitle(this.states[k].s);
    }
    const shift = this.shift0 * (1 - eIO3(clamp((t - 2.2) / 0.27)));
    const ty = (this.yF - this.yB) * eOut2(clamp((t - 3.4) / 0.5));
    title.style.left = -this.curW / 2 + shift + 'px';
    title.style.top = this.yB + ty - this.yDot - this.asc + 'px';
    pivotG.style.transform = `rotate(${t < 2.47 ? kf(GRP, t) : 0}deg)`;

    // letters spin in around the pivot
    const glowAt = [];
    if (t < 2.47) {
      const n = this.chars.length;
      const Lc = idxI >= 0 ? idxI : Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const c = this.chars[i];
        if (i === idxI) {
          c.style.opacity = t >= 2.13 ? 1 : 0;
          continue;
        }
        const left = i < Lc;
        const j = idxI >= 0 ? (left ? idxI - 1 - i : i - idxI - 1) : left ? Lc - 1 - i : i - Lc;
        if (left) {
          const ts = 1.3 + 0.065 * j;
          const u = clamp((t - ts) / 0.34);
          if (t < ts) {
            c.style.opacity = 0;
            continue;
          }
          const e = eOut3(u);
          c.style.opacity = clamp((t - ts) / 0.1);
          c.style.transform = `rotate(${A0L[j % 4] * (1 - e)}deg)`;
          c.style.filter = u < 0.5 ? `blur(${(1 - u * 2) * 5}px)` : 'none';
        } else {
          const ts = 1.77 + 0.07 * j;
          const u = clamp((t - ts) / 0.32);
          if (t < ts) {
            c.style.opacity = 0;
            continue;
          }
          const e = eOut3(u);
          c.style.opacity = clamp((t - ts) / 0.08);
          c.style.transform = `translate(${0.25 * C * (1 - e)}px,${-1.1 * C * (1 - e)}px) rotate(${A0R[j % 4] * (1 - e)}deg)`;
          glowAt.push({ tk: ts + 0.12, x: -this.curW / 2 + shift + slot[i].x + slot[i].w / 2, y: -0.82 * C });
        }
      }
    }

    // glows: dot impacts, swing, and each letter landing
    let I0 = kf(GB, t);
    PULSE.forEach((p) => {
      if (t >= p[0]) I0 += p[1] * Math.exp(-(t - p[0]) / p[2]);
    });
    gl[0].style.opacity = clamp(I0, 0, 1);
    gl[0].style.left = -2.5 * C + 'px';
    gl[0].style.top = -2.5 * C + kf([[0.9, -0.12], [1.1, -0.6]], t) * C + 'px';
    for (let i = 0; i < 3; i++) {
      const gg = glowAt[i];
      const el = gl[i + 1];
      if (gg && t >= gg.tk) {
        el.style.opacity = clamp(0.6 * Math.exp(-(t - gg.tk) / 0.1), 0, 1);
        el.style.left = gg.x - 2.5 * C + 'px';
        el.style.top = gg.y - 2.5 * C + 'px';
      } else {
        el.style.opacity = 0;
      }
    }

    // role line and buttons
    const eS = eOut2(clamp((t - 3.4) / 0.5));
    const so = clamp((t - 3.47) / 0.3);
    const co = clamp((t - 3.6) / 0.25);
    const subFS = parseFloat(sub.style.fontSize);
    const ctaH = parseFloat(cta.style.height);
    const yS = 0.9 * VH - (1 - eS) * (this.yF - this.yB) * 0.9;
    sub.style.opacity = so;
    sub.style.top = yS - subFS * 0.55 + 'px';
    cta.style.opacity = co;
    cta.style.top = yS - ctaH / 2 + 'px';
  }

  /* ---------- loop ---------- */

  render(t) {
    if (!this.ready) return;
    if (this.pro) this.pro.render(this.P > 0 ? t + this.P : Infinity);
    if (t < 4.0 || !this.introDone) {
      this.introFrame(Math.min(t, 9));
      if (t >= 4.0) this.introDone = true;
    }
    const nav = this.getNav();
    if (nav) nav.style.opacity = clamp((t - 4.62) / 0.12);
    const { photoBtn, skipBtn } = this.els;
    photoBtn.style.opacity = clamp((t - 5.8) / 0.5) * 0.7;
    const hold = this.P > 0 ? clamp((t + this.P - 1.3) / 0.4) : 1; // no skip button on the fake 404: a real one has none
    skipBtn.style.opacity = clamp(1 - (t - 4.4) / 0.5) * hold;
    skipBtn.style.visibility = t > 4.95 || hold < 0.02 ? 'hidden' : 'visible';
    if (t > 5.9 && this.locked) this.lockScroll(false);
    if (t > 5.9 && this.frozen == null && !this.marked) {
      this.marked = true;
      this.markSeen(); // a reload in the same tab skips straight to the portrait
    }
    if (this.heroVisible) {
      this.field.draw(this.ctx, t, {
        VW: this.VW,
        VH: this.VH,
        dpr: this.dpr,
        dissolve: this.dissolve,
        mx: this.mx,
        my: this.my,
        formStart: this.formStart,
      });
    }
  }

  tick = (now) => {
    if (this.destroyed) return;
    this.tNow = this.frozen != null ? this.frozen : (now - this.t0) / 1000 - this.P;
    this.render(this.tNow);
    this.raf = requestAnimationFrame(this.tick);
  };

  onScroll = () => {
    const y = window.scrollY || 0;
    this.dissolve = clamp(y / (0.25 * (this.VH || 1)));
    this.heroVisible = y < (this.VH || 0) * 1.05;
  };

  onResize = () => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      if (!this.ready || this.destroyed) return;
      this.layout();
      this.field.buildStars(this.VW, this.VH);
      if (this.usingPlaceholder) this.field.buildPortrait(this.src, this.VW, this.VH);
      else {
        const sv = safe(() => localStorage.getItem('mk-photo'));
        if (sv) this.loadSrc(sv, false, true);
        else if (this.cfg.photo) this.loadSrc(this.cfg.photo, false, false);
      }
      this.introDone = false;
      this.onScroll();
    }, 150);
  };

  /* ---------- portrait photo ---------- */

  setPhoto(img, persist, vignette) {
    if (this.destroyed) return;
    const g = this.sctx;
    const r = Math.max(800 / img.width, 1000 / img.height);
    const w = img.width * r;
    const h = img.height * r;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 800, 1000);
    g.drawImage(img, (800 - w) / 2, (1000 - h) * 0.25, w, h);
    if (vignette) {
      // Uploaded photos have a background, so fade the edges to black.
      const vg = g.createRadialGradient(400, 430, 170, 400, 520, 640);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.93)');
      g.fillStyle = vg;
      g.fillRect(0, 0, 800, 1000);
    }
    this.usingPlaceholder = false;
    this.field.buildPortrait(this.src, this.VW, this.VH);
    if (persist && this.tNow > 5.5) this.formStart = this.tNow - 0.1;
    this.onPhotoLabel('Change photo');
    if (persist) {
      safe(() => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        localStorage.setItem('mk-photo', c.toDataURL('image/jpeg', 0.82));
      });
    }
  }

  loadSrc(url, persist, vignette) {
    const im = new Image();
    if (/^https?:/.test(url)) im.crossOrigin = 'anonymous';
    im.onload = () => this.setPhoto(im, persist, vignette);
    im.src = url;
  }

  loadFile(file) {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => this.loadSrc(fr.result, true, true);
    fr.readAsDataURL(file);
  }
}
