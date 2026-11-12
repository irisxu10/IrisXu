// Canvas 2D renderer. Reads simulation state; never mutates it.
// Layers: concentric contours whose displacement lags behind the outer
// membrane (depth), fine structural lines that darken under local strain,
// a clipped grain texture, and memory traces (hatching + tonal edge).

import { mulberry32 } from '../util/math.js';

const LAYERS = 6;
const LAYER_SCALE = [1, 0.88, 0.76, 0.64, 0.52, 0.4];
const LAYER_RATE = [0, 11, 8, 6, 4.5, 3.5];   // lag (1/s) for inner layers
const CORE_SCALE = 0.17;

export const THEMES = {
  light: { bg: '#ecebe6', obj: [62, 76, 68], line: [36, 44, 39], trace: [96, 82, 66], grain: 0 },
  dark: { bg: '#121412', obj: [176, 188, 179], line: [208, 216, 210], trace: [190, 170, 146], grain: 255 },
};

export class ObjectRenderer {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = sim;
    const n = sim.n;
    this.lagX = Array.from({ length: LAYERS }, () => new Float32Array(n));
    this.lagY = Array.from({ length: LAYERS }, () => new Float32Array(n));
    this.px = Array.from({ length: LAYERS + 1 }, () => new Float32Array(n));
    this.py = Array.from({ length: LAYERS + 1 }, () => new Float32Array(n));
    this.w = 1; this.h = 1; this.dpr = 1; this.cx = 0; this.cy = 0; this.scale = 1;
    this.reducedMotion = false;
    this.setTheme('light');
    this.resize();
  }

  setTheme(name) {
    this.themeName = THEMES[name] ? name : 'light';
    this.theme = THEMES[this.themeName];
    this.grain = this.makeGrain(this.theme.grain);
  }

  makeGrain(tone) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(128, 128);
    const rng = mulberry32(7);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = img.data[i + 1] = img.data[i + 2] = tone;
      img.data[i + 3] = rng() < 0.5 ? Math.floor(rng() * 34) : 0;
    }
    g.putImageData(img, 0, 0);
    return this.ctx.createPattern(c, 'repeat');
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.cx = this.w / 2;
    this.cy = this.h * 0.5;
    const narrow = this.w < 640;
    this.scale = Math.min(this.w, this.h) * (narrow ? 0.3 : 0.24);
  }

  /** Client (CSS px) → object units. */
  toObject(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.cx) / this.scale, y: (clientY - r.top - this.cy) / this.scale };
  }

  pathFrom(xs, ys) {
    const ctx = this.ctx, n = xs.length;
    ctx.beginPath();
    ctx.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
    for (let i = 0; i < n; i++) {
      const j = i === n - 1 ? 0 : i + 1;
      ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
    }
    ctx.closePath();
  }

  draw(dt, pointer) {
    const { ctx, sim, theme } = this, b = sim.body, n = sim.n, mem = sim.memory.level, ad = sim.adapt.level;
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    // lagged layer displacements + positions (object units)
    for (let k = 0; k <= LAYERS; k++) {
      const isCore = k === LAYERS;
      const s = isCore ? CORE_SCALE : LAYER_SCALE[k];
      const lk = isCore ? LAYERS - 1 : k;
      if (!isCore && k > 0) {
        const a = 1 - Math.exp(-LAYER_RATE[k] * dt);
        for (let i = 0; i < n; i++) {
          this.lagX[k][i] += (b.dx[i] - this.lagX[k][i]) * a;
          this.lagY[k][i] += (b.dy[i] - this.lagY[k][i]) * a;
        }
      }
      const dScale = Math.pow(s, 0.6);
      for (let i = 0; i < n; i++) {
        const lx = lk === 0 ? b.dx[i] : this.lagX[lk][i];
        const ly = lk === 0 ? b.dy[i] : this.lagY[lk][i];
        const rr = b.restRadius(i) * s;
        this.px[k][i] = b.cos[i] * rr + lx * dScale;
        this.py[k][i] = b.sin[i] * rr + ly * dScale;
      }
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(this.scale, this.scale);
    const px = 1 / this.scale; // one CSS pixel in object units

    // translucent layers, outer → inner
    for (let k = 0; k < LAYERS; k++) {
      this.pathFrom(this.px[k], this.py[k]);
      ctx.fillStyle = rgba(theme.obj, 0.05 + k * 0.013);
      ctx.fill();
      ctx.lineWidth = (k === 0 ? 1.3 : 0.7) * px;
      ctx.strokeStyle = rgba(theme.line, k === 0 ? 0.55 : 0.16 + k * 0.035);
      ctx.stroke();
    }

    // grain clipped to the outer membrane
    if (this.grain) {
      ctx.save();
      this.pathFrom(this.px[0], this.py[0]);
      ctx.clip();
      ctx.scale(px, px);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.grain;
      ctx.fillRect(-this.cx, -this.cy, this.w, this.h);
      ctx.restore();
    }

    // structural lines, darker under local strain
    ctx.lineWidth = 0.6 * px;
    const inner = this.px[LAYERS - 1], innerY = this.py[LAYERS - 1];
    for (let i = 0; i < n; i += 2) {
      const j = (i + 1) % n;
      const strain = Math.hypot(b.dx[i] - b.dx[j], b.dy[i] - b.dy[j]) * 8 + Math.hypot(b.dx[i], b.dy[i]) * 0.7;
      const a = Math.min(0.34, 0.035 + strain);
      ctx.strokeStyle = rgba(theme.line, a);
      ctx.beginPath();
      ctx.moveTo(inner[i], innerY[i]);
      ctx.lineTo(this.px[0][i], this.py[0][i]);
      ctx.stroke();
    }

    // memory traces: inward hatching + tonal edge
    const ox = this.px[0], oy = this.py[0];
    for (let i = 0; i < n; i++) {
      const m = mem[i];
      if (m < 0.04) continue;
      const len = 0.025 + 0.075 * m + 0.03 * ad[i];
      ctx.strokeStyle = rgba(theme.trace, Math.min(0.6, m * 0.6));
      ctx.lineWidth = (0.7 + ad[i] * 0.6) * px;
      ctx.beginPath();
      ctx.moveTo(ox[i], oy[i]);
      ctx.lineTo(ox[i] - b.cos[i] * len, oy[i] - b.sin[i] * len);
      ctx.stroke();
      const j = (i + 1) % n, mm = (m + mem[j]) / 2;
      ctx.lineWidth = 2.2 * px;
      ctx.strokeStyle = rgba(theme.trace, mm * 0.5);
      ctx.beginPath();
      ctx.moveTo(ox[i], oy[i]);
      ctx.lineTo(ox[j], oy[j]);
      ctx.stroke();
    }

    // core
    this.pathFrom(this.px[LAYERS], this.py[LAYERS]);
    ctx.fillStyle = rgba(theme.obj, 0.22);
    ctx.fill();
    ctx.restore();

    // pointer marks (screen space, very faint)
    if (pointer?.present && pointer.type !== 'touch') {
      const sx = this.cx + pointer.x * this.scale, sy = this.cy + pointer.y * this.scale;
      const p = sim.proximity;
      if (sim.grab) {
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = rgba(theme.line, 0.35); ctx.fill();
      } else if (p > 0.1) {
        ctx.beginPath(); ctx.arc(sx, sy, 7 + p * 5, 0, Math.PI * 2);
        ctx.lineWidth = 1; ctx.strokeStyle = rgba(theme.line, 0.08 + p * 0.22); ctx.stroke();
      }
    }
  }

  resetLag() { for (let k = 0; k < LAYERS; k++) { this.lagX[k].fill(0); this.lagY[k].fill(0); } }
}
