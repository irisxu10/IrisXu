// V4 renderer (Canvas 2D). Layers, back to front:
//   A  structural skeleton — the soft body itself (not drawn)
//   C  translucent membrane — outer surface + one inner surface, low alpha
//   B  filament network     — stable anchors mapped through the deformation
//   D  tension              — per-edge strain: stretched fibres straighten and
//                              brighten, compressed fibres bow and thicken in density
//   E  memory               — fibres in high-memory regions align (lose slack),
//                              brighten slightly, and dormant short fibres appear
// Filaments are batched into (depth × brightness) buckets so a frame issues
// ~40 strokes instead of one per filament. Nothing is allocated per frame.

import { FilamentNetwork } from './FilamentNetwork.js';
import { DEFAULT_VISUAL } from '../config.js';
import { mulberry32 } from '../util/math.js';
import { stageScale, stageCentre } from '../materials/sharedForm.js';

const NB = 12;           // brightness buckets
const DEPTHS = 3;        // far / mid / near
const PALETTE = {
  deep: [24, 44, 64],          // #182C40 deep structural blue
  secondary: [117, 189, 232],  // #75BDE8 main material blue
  primary: [199, 233, 255],    // #C7E9FF pale translucent blue
  highlight: [244, 249, 255],  // #F4F9FF white fibre highlight
};
const DEPTH_WIDTH = [0.5, 0.7, 0.95];
const DEPTH_ALPHA = [0.55, 0.8, 1];
const FOLDS = 4;         // overlapping translucent membrane sheets

const mix = (a, b, t) => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t));

export class FilamentRenderer {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = sim;
    this.net = new FilamentNetwork(sim.n);
    this.visual = { ...DEFAULT_VISUAL };
    this.detail = 1;             // auto-detail multiplier (1 or reduced)
    this.reducedMotion = false;
    this.time = 0;
    this.n = sim.n;
    this.ox = new Float32Array(sim.n); this.oy = new Float32Array(sim.n);   // outer membrane
    this.ix = new Float32Array(sim.n); this.iy = new Float32Array(sim.n);   // inner membrane
    this.foldX = Array.from({ length: FOLDS }, () => new Float32Array(sim.n));
    this.foldY = Array.from({ length: FOLDS }, () => new Float32Array(sim.n));
    this.buildStyles();
    this.rebuild();
    this.resize();
  }

  /** Regenerate the network for the simulation's current seed. */
  rebuild() {
    this.net.build(this.sim.seed, this.sim.body.baseRest);
    const B = DEPTHS * NB;
    this.bucketLen = new Uint16Array(B);
    this.bucketItems = Array.from({ length: B }, () => new Uint16Array(this.net.edgeCount));
    this.gradient = null;
    // seeded fold sheets: each is the body outline reshaped by a low harmonic and
    // offset slightly, so sheets overlap like folded translucent layers
    const rng = mulberry32((this.sim.seed ^ 0x51ed27) >>> 0);
    this.folds = Array.from({ length: FOLDS }, (_, k) => ({
      scale: [0.97, 0.84, 0.7, 0.55][k],
      m: 2 + Math.floor(rng() * 4),
      amp: 0.05 + rng() * 0.09,
      phase: rng() * Math.PI * 2,
      ox: (rng() - 0.5) * 0.14, oy: (rng() - 0.5) * 0.14,
      live: [0.85, 0.6, 0.4, 0.25][k],     // how much it follows the live surface vs the lagged field
    }));
  }

  buildStyles() {
    this.styles = [];
    for (let d = 0; d < DEPTHS; d++) {
      const [c0, c1] = d === 0 ? [PALETTE.deep, PALETTE.secondary] : d === 1 ? [PALETTE.secondary, PALETTE.primary] : [PALETTE.primary, PALETTE.highlight];
      for (let q = 0; q < NB; q++) {
        const b = (q + 0.5) / NB, c = mix(c0, c1, b);
        this.styles.push(`rgba(${c[0]},${c[1]},${c[2]},${((0.06 + b * 0.62) * DEPTH_ALPHA[d]).toFixed(3)})`);
      }
    }
    const p = PALETTE.primary;
    this.dotStyle = `rgba(${p[0]},${p[1]},${p[2]},0.22)`;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const cap = this.visual.lowDetail ? 1.5 : 2;
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, cap);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    // shared initial form: same centre and diameter for every material condition
    ({ cx: this.cx, cy: this.cy } = stageCentre(this.w, this.h));
    this.scale = stageScale(this.w, this.h);
  }

  toObject(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left - this.cx) / this.scale, y: (clientY - r.top - this.cy) / this.scale };
  }

  setVisual(key, value) {
    this.visual[key] = value;
    if (key === 'lowDetail') this.resize();
    if (key === 'membraneOpacity') this.gradient = null;
  }

  pathRing(xs, ys) {
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
    const { ctx, sim, net, visual: V } = this, b = sim.body, n = this.n;
    this.time += dt;
    const parallax = !this.reducedMotion && pointer?.present && !sim.grab;
    net.update(sim, {
      dt, t: this.time, reducedMotion: this.reducedMotion,
      parallaxX: parallax ? Math.max(-1.5, Math.min(1.5, pointer.x)) * 0.012 : 0,
      parallaxY: parallax ? Math.max(-1.5, Math.min(1.5, pointer.y)) * 0.012 : 0,
    });

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(this.scale, this.scale);
    const px = 1 / this.scale;

    // ---- C: membrane ----
    for (let i = 0; i < n; i++) {
      this.ox[i] = b.x(i); this.oy[i] = b.y(i);
      const r = b.restRadius(i) * 0.7;
      this.ix[i] = b.cos[i] * r + net.midX[i] * 0.78; this.iy[i] = b.sin[i] * r + net.midY[i] * 0.78;
    }
    const mo = V.membraneOpacity;
    if (mo > 0) {
      if (!this.gradient) {
        const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1.1);
        g.addColorStop(0, `rgba(24,44,64,${Math.min(1, 0.38 * mo)})`);
        g.addColorStop(0.8, `rgba(24,44,64,${Math.min(1, 0.26 * mo)})`);
        g.addColorStop(1, `rgba(117,189,232,${0.12 * mo})`);
        this.gradient = g;
        const f = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 1.05);
        f.addColorStop(0, `rgba(117,189,232,${0.012 * mo})`);
        f.addColorStop(0.7, `rgba(117,189,232,${0.03 * mo})`);
        f.addColorStop(1, `rgba(199,233,255,${0.06 * mo})`);
        this.foldGradient = f;
      }
      // body: deep-blue translucent volume
      this.pathRing(this.ox, this.oy);
      ctx.fillStyle = this.gradient; ctx.fill();
      // folded sheets (additive): low-alpha fills, soft edges — they deform with the body
      ctx.save();
      ctx.clip(); // folds stay inside the membrane (no smudges outside the edge)
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < FOLDS; k++) {
        const F = this.folds[k], fx = this.foldX[k], fy = this.foldY[k], live = F.live;
        const ds = Math.pow(F.scale, 0.7);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = b.restRadius(i) * (F.scale + F.amp * Math.sin(F.m * a + F.phase));
          const dx = b.dx[i] * live + net.lagX[i] * (1 - live), dy = b.dy[i] * live + net.lagY[i] * (1 - live);
          fx[i] = b.cos[i] * r + F.ox + dx * ds;
          fy[i] = b.sin[i] * r + F.oy + dy * ds;
        }
        this.pathRing(fx, fy);
        ctx.fillStyle = this.foldGradient; ctx.fill();
        ctx.lineWidth = 3.2 * px;
        ctx.strokeStyle = `rgba(117,189,232,${(0.035 * mo).toFixed(3)})`; ctx.stroke();
        ctx.lineWidth = 0.8 * px;
        ctx.strokeStyle = `rgba(199,233,255,${(0.2 * mo).toFixed(3)})`; ctx.stroke();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      // outer surface edge
      this.pathRing(this.ox, this.oy);
      ctx.lineWidth = 1 * px;
      ctx.strokeStyle = `rgba(199,233,255,${(0.32 * Math.min(1.5, mo)).toFixed(3)})`; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    // ---- B/D/E: filaments, bucketed ----
    const density = V.filamentDensity * this.detail * (V.lowDetail ? 0.55 : 1);
    const contrast = V.structuralContrast, th = V.tensionHighlight, vm = V.visualMemory;
    const lens = this.bucketLen; lens.fill(0);
    const M = net.edgeCount;
    for (let e = 0; e < M; e++) {
      if (net.rank[e] > density) continue;
      const m = net.edgeMem[e] * vm;
      let vis = 1;
      if (net.dormant[e] >= 0) {
        const t0 = net.dormant[e];
        vis = m <= t0 ? 0 : Math.min(1, (m - t0) / 0.2);
        if (vis <= 0) continue;
      }
      const st = net.strain[e], tens = st > 0 ? st : 0, comp = st < 0 ? -st : 0;
      const z = net.depth[e], ex = (net.exc[net.ea[e]] + net.exc[net.eb[e]]) * 0.5;
      let br = 0.26 + 0.24 * (z + 1) / 2
        + th * Math.min(0.55, tens * 2.4)
        + Math.min(0.14, comp * 1.2)
        + m * 0.16
        + ex * 0.22;
      br += (net.resp[net.ea[e]] + net.resp[net.eb[e]]) * 0.5;   // system 1 glow
      br *= vis;
      br = 0.5 + (br - 0.5) * contrast;
      if (br < 0.03) continue;
      const q = br >= 1 ? NB - 1 : Math.floor(br * NB);
      const d = z < -0.33 ? 0 : z < 0.33 ? 1 : 2;
      const k = d * NB + q;
      this.bucketItems[k][lens[k]++] = e;
    }
    ctx.globalCompositeOperation = 'lighter';
    const X = net.x, Y = net.y;
    for (let d = 0; d < DEPTHS; d++) {
      ctx.lineWidth = DEPTH_WIDTH[d] * px;
      for (let q = 0; q < NB; q++) {
        const k = d * NB + q, len = lens[k];
        if (!len) continue;
        const items = this.bucketItems[k];
        ctx.beginPath();
        for (let t = 0; t < len; t++) {
          const e = items[t], a = net.ea[e], c = net.eb[e];
          const ax = X[a], ay = Y[a], cx = X[c], cy = Y[c];
          const dx = cx - ax, dy = cy - ay;
          const st = net.strain[e], tens = st > 0 ? st : 0, comp = st < 0 ? -st : 0;
          // slack: stretched → straight; compressed → bows; memory → aligned (straighter)
          const sf = net.slack[e]
            * (1 - Math.min(0.92, tens * 4))
            * (1 + Math.min(1.2, comp * 6))
            * (1 - Math.min(0.8, net.edgeMem[e] * vm * 0.9));
          const pv = net.eprev[e], nx = net.enext[e];
          if (pv >= 0 || nx >= 0) {
            // strand segment: midpoint-smoothed so consecutive segments join without corners
            const sx = pv >= 0 ? (X[pv] + ax) * 0.5 : ax, sy = pv >= 0 ? (Y[pv] + ay) * 0.5 : ay;
            const exx = nx >= 0 ? (ax + cx) * 0.5 : cx, eyy = nx >= 0 ? (ay + cy) * 0.5 : cy;
            ctx.moveTo(sx, sy);
            if (pv >= 0) ctx.quadraticCurveTo(ax, ay, exx, eyy); else ctx.lineTo(exx, eyy);
            if (nx < 0 && pv >= 0) ctx.lineTo(cx, cy);
            continue;
          }
          ctx.moveTo(ax, ay);
          ctx.quadraticCurveTo(ax + dx * 0.5 - dy * sf, ay + dy * 0.5 + dx * sf, cx, cy);
        }
        ctx.strokeStyle = this.styles[k];
        ctx.stroke();
      }
    }

    // junctions
    if (!V.lowDetail) {
      ctx.beginPath();
      const s = 1.1 * px;
      for (let k = 0; k < net.count; k++) {
        if (net.degree[k] < 3) continue;
        ctx.rect(X[k] - s / 2, Y[k] - s / 2, s, s);
      }
      ctx.fillStyle = this.dotStyle; ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // pointer mark (screen space, faint; not for touch)
    if (pointer?.present && pointer.type !== 'touch') {
      const sx = this.cx + pointer.x * this.scale, sy = this.cy + pointer.y * this.scale, p = sim.proximity;
      if (sim.grab) {
        ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244,249,255,0.6)'; ctx.fill();
      } else if (p > 0.1) {
        ctx.beginPath(); ctx.arc(sx, sy, 6 + p * 5, 0, Math.PI * 2);
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(199,233,255,${(0.08 + p * 0.22).toFixed(3)})`; ctx.stroke();
      }
    }
  }

  resetLag() { this.rebuild(); }
}
