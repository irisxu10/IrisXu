// Condition 02 — Gel / Flow: viscous, volume-conserving contained fluid.
//
// Pure (no DOM), fixed step (config.STEP), deterministic per seed + input.
//
// BOUNDARY — 80 nodes, starting on the shared rest outline. Per step:
//   pressure    P = kP · pressure · (A0 − A) / A0           (A = enclosed polygon area)
//               applied along each node's outward normal → pressing one side
//               in raises P and pushes every other region OUT (redistribution,
//               area approximately conserved)
//   smoothing   ks · Laplacian of displacement              (surface stays smooth)
//   shape       −kR · displacement                          (weak return to the circle)
//   contact     kC · w_i · (target_i − p_i)                  (gaussian footprint around the press)
//   integration v = v · damp + F · gain, then viscous neighbour coupling of v
//               (heavy, overdamped: follows with delay, no springy overshoot,
//               motion continues briefly after release and dissipates)
//
// INTERIOR (visual, but simulated here so it is testable):
//   3 liquid layers  — rings whose displacement low-passes the boundary's at
//                      different rates, so layers slide relative to each other
//   flow lines       — tracer points carried by a flow field interpolated from
//                      boundary velocities (gaussian kernel), relaxing back to rest
//
// Settling: once motion and displacement are negligible the state snaps exactly
// to rest, so there is no autonomous movement after settling.

import { clamp, mulberry32 } from '../util/math.js';
import { STEP, REGION_COUNT, GEL_DEFAULTS } from '../config.js';

const TAU = Math.PI * 2;
export { GEL_DEFAULTS };   // defaults live in config.js

const K_PRESSURE = 0.5;        // per-step pressure gain at pressure = 1
const K_SMOOTH = 0.16;         // displacement Laplacian
const K_CONTACT = 0.06;        // pull of contacted nodes toward their target
const CONTACT_WIDTH = 0.46;    // gaussian width of the contact footprint
const CONTACT_MARGIN = 0.3;    // press within this of the edge (or inside) to engage
const PRESS_DEPTH = 0.3;       // how far a held press sinks in
const PRESS_TAU = 0.35;        // s — press sinks in with this time constant
const DRAG_FOLLOW = 0.85;      // fraction of the drag offset the footprint tries to follow
const MAX_DRAG = 0.55;
const MAX_DISP = 0.45;
const SETTLE_DISP = 0.01, SETTLE_SPEED = 2e-4;   // "recovered" thresholds (object units, units/step)
const SNAP_DISP = 0.002, SNAP_SPEED = 1e-5;      // exact-rest snap (≈0.6 px; invisible)
const FINAL_DISP = 0.02, FINAL_SPEED = 5e-4;     // below this, untouched: ease out the remainder
const FINAL_EASE = 0.97;                         // per step (≈0.55 s time constant)
const LAYER_SCALE = [0.86, 0.66, 0.44];
const LAYER_RATE = [4.5, 2.4, 1.2];              // 1/s at viscosity 0 (slower when more viscous)
const TRACERS = 11, TRACER_PTS = 22;
const FLOW_SIGMA = 0.35;
const FLOW_RELAX = 0.9;                          // 1/s

export class GelBody {
  constructor(outline, seed, params = {}) {
    const n = (this.n = outline.length);
    this.params = { ...GEL_DEFAULTS, ...params };
    this.seed = seed >>> 0;
    this.rx = new Float32Array(n); this.ry = new Float32Array(n);
    this.cos = new Float32Array(n); this.sin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.cos[i] = Math.cos(a); this.sin[i] = Math.sin(a);
      this.rx[i] = this.cos[i] * outline[i]; this.ry[i] = this.sin[i] * outline[i];
    }
    this.A0 = polygonArea(this.rx, this.ry);
    this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.fx = new Float32Array(n); this.fy = new Float32Array(n);
    this.tvx = new Float32Array(n); this.tvy = new Float32Array(n);
    this.w = new Float32Array(n);
    this.radial = new Float32Array(n);
    // layers
    const rng = mulberry32((this.seed ^ 0x6e15) >>> 0);
    this.layers = LAYER_SCALE.map((s, k) => ({
      s, m: 2 + Math.floor(rng() * 3), amp: 0.03 + rng() * 0.05, phase: rng() * TAU,
      ox: (rng() - 0.5) * 0.08, oy: (rng() - 0.5) * 0.08,
      dx: new Float32Array(n), dy: new Float32Array(n), x: new Float32Array(n), y: new Float32Array(n), k,
    }));
    // flow-line tracers (rest positions inside the body)
    const T = TRACERS * TRACER_PTS;
    this.trRestX = new Float32Array(T); this.trRestY = new Float32Array(T);
    this.trOX = new Float32Array(T); this.trOY = new Float32Array(T);
    this.trX = new Float32Array(T); this.trY = new Float32Array(T);
    for (let c = 0; c < TRACERS; c++) {
      const y0 = -0.78 + (c + 0.2 + rng() * 0.6) * (1.56 / TRACERS), amp = 0.05 + rng() * 0.09, ph = rng() * TAU, tilt = (rng() - 0.5) * 0.45;
      for (let k = 0; k < TRACER_PTS; k++) {
        const x = -0.95 + (1.9 * k) / (TRACER_PTS - 1);
        const j = c * TRACER_PTS + k;
        this.trRestX[j] = x; this.trRestY[j] = y0 + tilt * x + amp * Math.sin(x * 2.2 + ph);
      }
    }
    this.tracerCount = TRACERS; this.tracerPoints = TRACER_PTS;
    this.onEvent = null;   // (type, fields) => void
    this.reset();
  }

  reset() {
    this.px.set(this.rx); this.py.set(this.ry);
    this.vx.fill(0); this.vy.fill(0); this.w.fill(0); this.radial.fill(0);
    for (const L of this.layers) { L.dx.fill(0); L.dy.fill(0); }
    this.trOX.fill(0); this.trOY.fill(0);
    this.timeMs = 0;
    this.input = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false };
    this.wasDown = false;
    this.contact = null;
    this.recovery = null;           // { startMs } after a release until settled
    this.settled = true;
    this.area = this.A0;
    this.maxDisp = 0; this.meanSpeed = 0;
    this.regionContacts = new Uint16Array(REGION_COUNT);
    this.totals = { contactEpisodes: 0, contactMs: 0, dragDistance: 0, revisits: 0, recoveries: 0, peakDeformation: 0, peakRedistribution: 0 };
    this.updateVisual(STEP);
  }

  setInput(inp) { Object.assign(this.input, inp); }
  emit(type, fields) { this.onEvent?.(type, fields); }

  /** Radius of the CURRENT boundary at angle theta (interpolated). */
  radiusAt(theta) {
    const n = this.n;
    let u = (theta / TAU) * n; u = ((u % n) + n) % n;
    const i0 = Math.floor(u) % n, i1 = (i0 + 1) % n, f = u - Math.floor(u);
    return Math.hypot(this.px[i0], this.py[i0]) * (1 - f) + Math.hypot(this.px[i1], this.py[i1]) * f;
  }

  regionAt(theta) { return Math.floor((((theta / TAU) * REGION_COUNT + 0.5) % REGION_COUNT + REGION_COUNT) % REGION_COUNT); }

  step() {
    const p = this.params, n = this.n, dt = STEP, inp = this.input;
    this.timeMs += dt * 1000;
    const visc = clamp(p.viscosity, 0, 1);
    const gain = 0.42 * (1 - 0.55 * visc);       // heavier when more viscous
    const damp = 0.9 - 0.1 * visc;               // more dissipation → no overshoot
    const mu = 0.12 + 0.22 * visc;               // viscous neighbour coupling
    const kR = 0.0012 + 0.006 * clamp(p.recovery, 0, 1);

    // --- contact edges ---
    if (inp.down && !this.wasDown) this.beginContact();
    if (!inp.down && this.contact) this.endContact();
    this.wasDown = inp.down;

    // --- forces ---
    const { px, py, rx, ry, fx, fy } = this;
    this.area = polygonArea(px, py);
    const P = K_PRESSURE * p.pressure * (this.A0 - this.area) / this.A0;
    const segRest = (TAU * Math.sqrt(this.A0 / Math.PI)) / n;
    for (let i = 0; i < n; i++) {
      const im = i === 0 ? n - 1 : i - 1, ip = i === n - 1 ? 0 : i + 1;
      // outward normal from the neighbours' chord (nodes run counter-clockwise in object coordinates)
      const tx = px[ip] - px[im], ty = py[ip] - py[im], tl = Math.hypot(tx, ty) || 1;
      const nx = ty / tl, ny = -tx / tl, seg = (tl / 2) / segRest;
      const dxi = px[i] - rx[i], dyi = py[i] - ry[i];
      fx[i] = P * nx * seg + K_SMOOTH * ((px[im] - rx[im]) + (px[ip] - rx[ip]) - 2 * dxi) - kR * dxi;
      fy[i] = P * ny * seg + K_SMOOTH * ((py[im] - ry[im]) + (py[ip] - ry[ip]) - 2 * dyi) - kR * dyi;
    }
    if (this.contact) this.applyContact(dt);

    // --- heavy, overdamped integration + viscous neighbour coupling ---
    const { vx, vy, tvx, tvy } = this;
    for (let i = 0; i < n; i++) { vx[i] = vx[i] * damp + fx[i] * gain; vy[i] = vy[i] * damp + fy[i] * gain; }
    for (let i = 0; i < n; i++) {
      const im = i === 0 ? n - 1 : i - 1, ip = i === n - 1 ? 0 : i + 1;
      tvx[i] = vx[i] + mu * (vx[im] + vx[ip] - 2 * vx[i]);
      tvy[i] = vy[i] + mu * (vy[im] + vy[ip] - 2 * vy[i]);
    }
    let maxD = 0, sumV = 0;
    for (let i = 0; i < n; i++) {
      vx[i] = tvx[i]; vy[i] = tvy[i];
      px[i] += vx[i]; py[i] += vy[i];
      let dx = px[i] - rx[i], dy = py[i] - ry[i];
      const m = Math.hypot(dx, dy);
      if (m > MAX_DISP) { const s = MAX_DISP / m; dx *= s; dy *= s; px[i] = rx[i] + dx; py[i] = ry[i] + dy; vx[i] *= 0.5; vy[i] *= 0.5; }
      this.radial[i] = dx * this.cos[i] + dy * this.sin[i];
      maxD = Math.max(maxD, Math.min(m, MAX_DISP));
      sumV += Math.hypot(vx[i], vy[i]);
    }
    this.maxDisp = maxD; this.meanSpeed = sumV / n;

    // --- contact metrics / recovery bookkeeping ---
    if (this.contact) this.trackContact(dt);
    if (this.recovery && maxD < SETTLE_DISP && this.meanSpeed < SETTLE_SPEED) {
      this.totals.recoveries++;
      this.emit('recovery', { durationMs: this.timeMs - this.recovery.startMs, metadata: { kind: 'settle', completed: true } });
      this.recovery = null;
    }
    // final settle: once nearly at rest and untouched, ease the last few pixels out
    // instead of creeping toward rest for many seconds
    if (!this.contact && maxD < FINAL_DISP && this.meanSpeed < FINAL_SPEED) {
      for (let i = 0; i < n; i++) {
        px[i] = rx[i] + (px[i] - rx[i]) * FINAL_EASE; py[i] = ry[i] + (py[i] - ry[i]) * FINAL_EASE;
        vx[i] *= 0.9; vy[i] *= 0.9;
      }
      this.maxDisp = maxD * FINAL_EASE;
    }
    // exact rest once negligible (no autonomous motion after settling)
    if (!this.contact && maxD < SNAP_DISP && this.meanSpeed < SNAP_SPEED) {
      if (!this.settled) { px.set(rx); py.set(ry); vx.fill(0); vy.fill(0); }
      this.settled = true;
    } else this.settled = false;

    this.updateVisual(dt);
  }

  beginContact() {
    const inp = this.input;
    const r = Math.hypot(inp.x, inp.y), theta = r > 1e-6 ? Math.atan2(inp.y, inp.x) : 0;
    const rb = this.radiusAt(theta), dist = r - rb;
    if (dist > CONTACT_MARGIN) return;                       // pressed in empty space
    if (this.recovery) {                                     // interrupted before settling
      this.emit('recovery', { durationMs: this.timeMs - this.recovery.startMs, metadata: { kind: 'settle', completed: false } });
      this.recovery = null;
    }
    const cx = Math.cos(theta) * rb, cy = Math.sin(theta) * rb;
    let wMax = 0;
    for (let i = 0; i < this.n; i++) {
      const d = Math.hypot(this.px[i] - cx, this.py[i] - cy) / CONTACT_WIDTH;
      const w = Math.exp(-d * d);
      this.w[i] = w < 0.01 ? 0 : w;
      wMax = Math.max(wMax, w);
    }
    const region = this.regionAt(theta);
    this.contact = { sx: inp.x, sy: inp.y, lx: inp.x, ly: inp.y, startMs: this.timeMs, region, depth: 0, dragDist: 0, lastDragMs: this.timeMs, lastDragLogged: 0, peakDef: 0, peakRedis: 0, peakVol: 0 };
    this.totals.contactEpisodes++;
    this.emit('contact_start', { region, distance: dist, speed: Math.hypot(inp.vx, inp.vy), metadata: { x: +inp.x.toFixed(3), y: +inp.y.toFixed(3) } });
    if (this.regionContacts[region] > 0) { this.totals.revisits++; this.emit('region_revisit', { region, metadata: { previousContacts: this.regionContacts[region] } }); }
    this.regionContacts[region]++;
    this.settled = false;
  }

  applyContact(dt) {
    const c = this.contact, inp = this.input;
    c.depth += (PRESS_DEPTH - c.depth) * (1 - Math.exp(-dt / PRESS_TAU));
    let ox = (inp.x - c.sx) * DRAG_FOLLOW, oy = (inp.y - c.sy) * DRAG_FOLLOW;
    const ol = Math.hypot(ox, oy);
    if (ol > MAX_DRAG) { ox *= MAX_DRAG / ol; oy *= MAX_DRAG / ol; }
    for (let i = 0; i < this.n; i++) {
      const w = this.w[i];
      if (!w) continue;
      const tx = this.rx[i] + w * (-this.cos[i] * c.depth + ox), ty = this.ry[i] + w * (-this.sin[i] * c.depth + oy);
      this.fx[i] += K_CONTACT * w * (tx - this.px[i]);
      this.fy[i] += K_CONTACT * w * (ty - this.py[i]);
    }
  }

  trackContact(dt) {
    const c = this.contact, inp = this.input, t = this.totals;
    const moved = Math.hypot(inp.x - c.lx, inp.y - c.ly);
    c.lx = inp.x; c.ly = inp.y; c.dragDist += moved; t.dragDistance += moved; t.contactMs += dt * 1000;
    // peak deformation: deepest inward motion within the footprint;
    // redistribution: mean outward expansion of material outside it
    let inward = 0, outSum = 0, outN = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.w[i] > 0.5) inward = Math.max(inward, -this.radial[i]);
      else if (this.w[i] < 0.05) { outSum += Math.max(0, this.radial[i]); outN++; }
    }
    c.peakDef = Math.max(c.peakDef, inward);
    c.peakRedis = Math.max(c.peakRedis, outN ? outSum / outN : 0);
    c.peakVol = Math.max(c.peakVol, Math.abs(this.area / this.A0 - 1));
    if (this.timeMs - c.lastDragMs >= 400 && c.dragDist - c.lastDragLogged > 0.01) {
      this.emit('drag', { region: c.region, distance: c.dragDist, speed: Math.hypot(inp.vx, inp.vy) });
      c.lastDragMs = this.timeMs; c.lastDragLogged = c.dragDist;
    }
  }

  endContact() {
    const c = this.contact, t = this.totals;
    t.peakDeformation = Math.max(t.peakDeformation, c.peakDef);
    t.peakRedistribution = Math.max(t.peakRedistribution, c.peakRedis);
    this.emit('contact_end', {
      region: c.region, durationMs: this.timeMs - c.startMs, distance: c.dragDist,
      metadata: { peakDeformation: +c.peakDef.toFixed(4), redistribution: +c.peakRedis.toFixed(4), peakVolumeChange: +c.peakVol.toFixed(4) },
    });
    this.w.fill(0);
    this.contact = null;
    this.recovery = { startMs: this.timeMs };
  }

  /** Interior layers and flow lines, derived from the boundary (coherent with deformation). */
  updateVisual(dt) {
    const n = this.n, p = this.params, visc = clamp(p.viscosity, 0, 1), flow = Math.max(0, p.flow);
    for (const L of this.layers) {
      const a = 1 - Math.exp(-LAYER_RATE[L.k] * (1 - 0.5 * visc) * dt);
      const ds = Math.pow(L.s, 0.8) * (0.6 + 0.4 * Math.min(1, flow));
      for (let i = 0; i < n; i++) {
        const bx = this.px[i] - this.rx[i], by = this.py[i] - this.ry[i];
        L.dx[i] += (bx - L.dx[i]) * a; L.dy[i] += (by - L.dy[i]) * a;
        const ang = (i / n) * TAU, rr = Math.hypot(this.rx[i], this.ry[i]) * (L.s + L.amp * Math.sin(L.m * ang + L.phase));
        L.x[i] = this.cos[i] * rr + L.ox + L.dx[i] * ds;
        L.y[i] = this.sin[i] * rr + L.oy + L.dy[i] * ds;
      }
    }
    // flow lines: carried by boundary velocities, follow the mean deformation, relax to rest
    const T = this.trRestX.length, relax = Math.exp(-FLOW_RELAX * dt), s2 = FLOW_SIGMA * FLOW_SIGMA;
    const moving = this.meanSpeed > SNAP_SPEED || !this.settled;
    for (let j = 0; j < T; j++) {
      const qx = this.trRestX[j], qy = this.trRestY[j];
      let fxs = 0, fys = 0, dxs = 0, dys = 0, ws = 0;
      if (moving) {
        for (let i = 0; i < n; i++) {
          const ex = this.px[i] - qx, ey = this.py[i] - qy;
          const k = Math.exp(-(ex * ex + ey * ey) / s2);
          fxs += k * this.vx[i]; fys += k * this.vy[i];
          dxs += k * (this.px[i] - this.rx[i]); dys += k * (this.py[i] - this.ry[i]);
          ws += k;
        }
      }
      if (ws > 1e-9) { fxs /= ws; fys /= ws; dxs /= ws; dys /= ws; }
      this.trOX[j] = this.trOX[j] * relax + fxs * flow * 2.2;
      this.trOY[j] = this.trOY[j] * relax + fys * flow * 2.2;
      const depth = Math.min(1, Math.hypot(qx, qy));
      this.trX[j] = qx + dxs * (0.3 + 0.6 * depth) + this.trOX[j];
      this.trY[j] = qy + dys * (0.3 + 0.6 * depth) + this.trOY[j];
    }
    if (this.settled) { this.trOX.fill(0); this.trOY.fill(0); }
  }

  /** Smoothed 0..1 signals for the shared sound engine. */
  signals() {
    return { tension: clamp(this.maxDisp / 0.3, 0, 1), motion: clamp(this.meanSpeed * 160, 0, 1), sweep: 0, kinetic: clamp(this.meanSpeed * 160, 0, 1) };
  }
}

function polygonArea(xs, ys) {
  let a = 0;
  const n = xs.length;
  for (let i = 0, j = n - 1; i < n; j = i++) a += xs[j] * ys[i] - xs[i] * ys[j];
  return a / 2;
}
