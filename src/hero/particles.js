import { clamp, lerp, ss, eIO3, rng } from '../lib/math.js';

const LV = 12; // brightness levels
const COLS = Array.from({ length: LV }, (_, i) => {
  const l = i / (LV - 1);
  return `rgb(${Math.round(96 + 116 * l)},${Math.round(116 + 104 * l)},${Math.round(168 + 78 * l)})`;
});
const STAR_SIZES = [1.1, 1.7, 2.5];

/**
 * Everything drawn on the hero canvas: the star dust and the portrait made of
 * small squares. The portrait particles start as a loose cloud, fly to their
 * place in the picture, react to the pointer, and scatter again on scroll.
 */
export class ParticleField {
  constructor() {
    this.N = 0;
    this.cell = 4;
    this.SN = 0;
    this.buckets = Array.from({ length: LV * 4 }, () => []);
  }

  /** Turn the 800x1000 source picture into particles (one per bright mosaic cell). */
  buildPortrait(src, VW, VH) {
    if (!VW) return;
    const Hp = Math.min(0.9 * VH, 1.55 * VW);
    const Wp = Hp * 0.8;
    let s = Math.max(3, Math.round(Hp / 150));
    let cols;
    let rows;
    for (;;) {
      cols = Math.round(Wp / s);
      rows = Math.round(Hp / s);
      if (cols * rows * 0.5 <= 11000) break;
      s++;
    }
    this.cell = s;

    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const o = off.getContext('2d');
    o.imageSmoothingQuality = 'high';
    const mid = document.createElement('canvas');
    mid.width = cols * 2;
    mid.height = rows * 2;
    const mg = mid.getContext('2d');
    mg.imageSmoothingQuality = 'high';
    mg.drawImage(src, 0, 0, cols * 2, rows * 2);
    o.drawImage(mid, 0, 0, cols, rows);

    const d = o.getImageData(0, 0, cols, rows).data;
    const lum = new Float32Array(cols * rows);
    const hist = new Uint32Array(256);
    for (let i = 0; i < cols * rows; i++) {
      const v = Math.round(0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]);
      lum[i] = v;
      hist[v]++;
    }
    const tot = cols * rows;
    let acc = 0;
    let lo = 0;
    let hi = 255;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc > tot * 0.55) {
        lo = i;
        break;
      }
    }
    acc = 0;
    for (let i = 255; i >= 0; i--) {
      acc += hist[i];
      if (acc > tot * 0.02) {
        hi = i;
        break;
      }
    }
    if (hi - lo < 30) {
      lo = 0;
      hi = 255;
    }

    const r = rng(7);
    const x0 = VW / 2 - Wp / 2;
    const y0 = VH - Hp;
    const tmp = [];
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        let L = clamp((lum[cy * cols + cx] - lo) / (hi - lo));
        L = Math.pow(L, 1.15);
        if (L < 0.12) continue;
        if (L < 0.5 && r() > L * 1.5 + 0.25) continue;
        tmp.push([x0 + (cx + 0.5) * s, y0 + (cy + 0.5) * s, L, cy / rows]);
      }
    }

    const N = (this.N = tmp.length);
    this.hx = new Float32Array(N);
    this.hy = new Float32Array(N);
    this.sx0 = new Float32Array(N);
    this.sy0 = new Float32Array(N);
    this.dl = new Float32Array(N);
    this.du = new Float32Array(N);
    this.cu = new Float32Array(N);
    this.lb = new Uint8Array(N);
    this.ph = new Float32Array(N);
    this.dxv = new Float32Array(N);
    this.dyv = new Float32Array(N);
    this.ox = new Float32Array(N);
    this.oy = new Float32Array(N);
    this.vx = new Float32Array(N);
    this.vy = new Float32Array(N);

    const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(6.2832 * r());
    for (let i = 0; i < N; i++) {
      const p = tmp[i];
      this.hx[i] = p[0];
      this.hy[i] = p[1];
      this.lb[i] = Math.min(LV - 1, Math.floor(p[2] * LV));
      this.sx0[i] = VW / 2 + gauss() * 0.05 * VW;
      this.sy0[i] = 0.38 * VH + gauss() * 0.075 * VH;
      this.dl[i] = 0.55 * p[3] + r() * 0.1;
      this.du[i] = 0.45 + r() * 0.3;
      this.cu[i] = (r() - 0.5) * 0.1 * VW;
      this.ph[i] = r() * 6.28;
      this.dxv[i] = gauss() * 0.2 * VW;
      this.dyv[i] = (r() - 0.35) * 0.55 * VH;
    }
  }

  buildStars(VW, VH) {
    const r = rng(3);
    const SN = (this.SN = Math.min(4600, Math.round((VW * VH) / 330)));
    this.stx = new Float32Array(SN);
    this.sty = new Float32Array(SN);
    this.stz = new Uint8Array(SN);
    this.stp = new Float32Array(SN);
    this.sts = new Float32Array(SN);
    for (let i = 0; i < SN; i++) {
      this.stx[i] = r() * VW;
      this.sty[i] = r() * VH;
      this.stz[i] = r() < 0.12 ? 2 : r() < 0.4 ? 1 : 0;
      this.stp[i] = r() * 6.28;
      this.sts[i] = 0.6 + r() * 1.8;
    }
  }

  draw(ctx, t, { VW, VH, dpr, dissolve, mx, my, formStart }) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    const sa = ss(clamp((t - 3.9) / 0.55));

    if (sa > 0 && this.SN) {
      const sb = [0, 1, 2, 3].map(() => [[], [], []]);
      for (let i = 0; i < this.SN; i++) {
        const z = this.stz[i];
        const a = sa * (0.75 + 0.25 * Math.sin(t * this.sts[i] + this.stp[i])) * (z === 0 ? 0.55 : z === 1 ? 0.8 : 1);
        sb[Math.min(3, Math.floor(a * 4))][z].push(i);
      }
      ctx.fillStyle = '#fff';
      for (let b = 0; b < 4; b++) {
        ctx.globalAlpha = ((b + 0.5) / 4) * 0.95;
        for (let z = 0; z < 3; z++) {
          const arr = sb[b][z];
          if (!arr.length) continue;
          ctx.beginPath();
          const sz = STAR_SIZES[z];
          for (let i = 0; i < arr.length; i++) ctx.rect(this.stx[arr[i]], this.sty[arr[i]], sz, sz);
          ctx.fill();
        }
      }
    }

    if (this.N && t > formStart) {
      const { buckets, hx, hy, sx0, sy0, dl, du, cu, lb, ph, dxv, dyv, ox, oy, vx, vy, cell } = this;
      for (let b = 0; b < buckets.length; b++) buckets[b].length = 0;
      const dd = dissolve;
      const rr = 80;
      const moving = mx > -900;
      for (let i = 0; i < this.N; i++) {
        const raw = t - formStart - dl[i];
        if (raw <= 0) continue;
        const u = clamp(raw / du[i]);
        const e = eIO3(u);
        let x = lerp(sx0[i], hx[i], e) + Math.sin(Math.PI * e) * cu[i];
        let y = lerp(sy0[i], hy[i], e);
        if (u >= 1) {
          const ex = ox[i];
          const ey = oy[i];
          if (moving) {
            const ddx = x + ex - mx;
            const ddy = y + ey - my;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            if (dist < rr && dist > 0.1) {
              const f = (1 - dist / rr) * 5;
              vx[i] += (ddx / dist) * f;
              vy[i] += (ddy / dist) * f;
            }
          }
          if (ex !== 0 || ey !== 0 || vx[i] !== 0 || vy[i] !== 0) {
            vx[i] = (vx[i] - ex * 0.07) * 0.84;
            vy[i] = (vy[i] - ey * 0.07) * 0.84;
            ox[i] = ex + vx[i];
            oy[i] = ey + vy[i];
            if (Math.abs(ox[i]) + Math.abs(oy[i]) + Math.abs(vx[i]) + Math.abs(vy[i]) < 0.02) {
              ox[i] = oy[i] = vx[i] = vy[i] = 0;
            }
          }
          x += ox[i];
          y += oy[i];
        }
        if (dd > 0) {
          x += dxv[i] * dd;
          y += dyv[i] * dd;
        }
        const al = clamp(raw / 0.12) * (1 - 0.5 * dd) * (0.72 + 0.28 * Math.sin(t * 2.6 + ph[i])) * 0.92;
        const aq = Math.min(3, Math.floor(al * 4));
        buckets[lb[i] * 4 + aq].push(x, y, lerp(1.7, cell * 0.8, e * e) * (1 - 0.4 * dd));
      }
      for (let b = 0; b < buckets.length; b++) {
        const arr = buckets[b];
        if (!arr.length) continue;
        ctx.globalAlpha = ((b & 3) + 1) / 4;
        ctx.fillStyle = COLS[b >> 2];
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 3) {
          const q = arr[i + 2];
          ctx.rect(arr[i] - q / 2, arr[i + 1] - q / 2, q, q);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
