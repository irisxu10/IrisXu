// Condition 02 — Gel / Flow: a viscous, volume-conserving contained hydrogel.
//
// Pure (no DOM), fixed step (config.STEP), deterministic per seed + input.
//
// Two coupled parts, so the WHOLE interior is interactive:
//
// 1. BOUNDARY — 80 nodes on the shared rest outline.
//      pressure    P = kP · pressure · (A0 − A)/A0 along each outward normal
//                  (press one side in → the rest moves out; area ≈ conserved)
//      smoothing   Laplacian of boundary displacement
//      shape       weak spring back to the rest outline
//      edge dent   when a press is near the edge, a gaussian footprint sinks in
//      interior →  each node is pulled toward the interior field's displacement
//                  sampled just inside it (the inside pushes the contour)
//
// 2. INTERIOR — a G×G displacement grid (≈750 cells inside the body).
//      elasticity  Laplacian coupling between neighbouring cells, so a local
//                  disturbance propagates outward over time
//      boundary →  cells next to the edge use the boundary's displacement as
//                  their outside neighbour (the contour holds/pushes the inside)
//      restoring   weak spring back to zero displacement (no rigid drift)
//      indenter    a press ANYWHERE pushes material away from the finger
//                  (local indentation + a compressed ring around it); it deepens
//                  while held, toward a stable compressed state
//      drag        material near the (viscously lagged) contact point is carried
//                  along with the pointer
//      density     compression = −div(u); drives the rendered density/refraction
//      lag fields  two low-passed copies of u (deeper layers move later)
//      trail       a decaying record of recent interior motion (short flow history)
//
//  Integration for both: v = v·damp + F·gain (+ viscous neighbour coupling),
//  heavy and overdamped. Once everything is negligible and untouched it eases
//  out and snaps exactly to rest: no autonomous motion after settling.

import { clamp } from '../util/math.js';
import { STEP, REGION_COUNT, GEL_DEFAULTS } from '../config.js';

const TAU = Math.PI * 2;
export { GEL_DEFAULTS };   // defaults live in config.js

// boundary
const K_PRESSURE = 0.5;
const K_SMOOTH = 0.16;
const K_EDGE = 0.06;            // edge dent pull
const K_COUPLE_B = 0.05;        // boundary ← interior coupling
const EDGE_WIDTH = 0.42;        // gaussian width of the edge dent footprint
const EDGE_DEPTH = 0.24;
const CONTACT_MARGIN = 0.3;     // press within this outside the edge (or anywhere inside) to engage
const MAX_DISP = 0.45;
// interior
export const GRID = 31;
export const EXTENT = 1.2;      // grid spans [−EXTENT, EXTENT]²
const K_ELASTIC = 0.11;         // neighbour coupling (propagation)
const K_RESTORE_I = 0.004;      // interior spring to rest
const K_INDENT = 0.14;          // indenter pull toward its target field
const INDENT_RADIUS = 0.3;      // footprint scale of the indenter
const INDENT_DEPTH = 0.22;      // peak radial push at full press
const PRESS_TAU = 0.45;         // s — sinks in with this time constant (settles under a hold)
const TOUCH_DEPTH = 0.35;       // fraction of the indentation applied immediately on contact (first-contact feedback)
const DRAG_FOLLOW = 0.75;       // how much interior material near the finger is carried
const CONTACT_LAG = 9;          // 1/s — the indenter follows the pointer with viscous lag
const MAX_DRAG = 0.55;
const MAX_U = 0.4;
const LAG_RATES = [3.2, 1.3];   // 1/s at viscosity 0
const TRAIL_TAU = 0.9;          // s — flow history fades
const SPREAD = 0.075;           // pressing in raises the body's target area by up to this fraction (footprint spreads)
const SPREAD_TAU = 0.4;         // s — interior pressure builds/relaxes with this delay
// settling
const SETTLE_DISP = 0.01, SETTLE_SPEED = 2e-4;
const FINAL_DISP = 0.02, FINAL_SPEED = 5e-4, FINAL_EASE = 0.97;
const SNAP_DISP = 0.002, SNAP_SPEED = 1e-5;
const BOUNDARY_RESPONSE = 0.004; // mean outward boundary motion that counts as "pressure has reached the contour"

export class GelBody {
  constructor(outline, seed, params = {}) {
    const n = (this.n = outline.length);
    this.params = { ...GEL_DEFAULTS, ...params };
    this.seed = seed >>> 0;
    this.outline = outline;
    // ---- boundary ----
    this.rx = new Float32Array(n); this.ry = new Float32Array(n);
    this.cos = new Float32Array(n); this.sin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.cos[i] = Math.cos(a); this.sin[i] = Math.sin(a);
      this.rx[i] = this.cos[i] * outline[i]; this.ry[i] = this.sin[i] * outline[i];
    }
    this.A0 = polygonArea(this.rx, this.ry);
    for (const k of ['px', 'py', 'vx', 'vy', 'fx', 'fy', 'tvx', 'tvy', 'w', 'radial', 'sampX', 'sampY']) this[k] = new Float32Array(n);
    // ---- interior grid ----
    const G = GRID, N = G * G, h = (this.h = (2 * EXTENT) / (G - 1));
    this.G = G;
    this.cx = new Float32Array(N); this.cy = new Float32Array(N);
    this.inside = new Uint8Array(N);
    for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
      const j = gy * G + gx, x = -EXTENT + gx * h, y = -EXTENT + gy * h;
      this.cx[j] = x; this.cy[j] = y;
      const r = Math.hypot(x, y), th = Math.atan2(y, x);
      this.inside[j] = r < this.restRadiusAt(th) * 0.985 ? 1 : 0;
    }
    // neighbours: inside index, or −1 with a boundary sample (node index + fraction) as Dirichlet value
    this.nb = new Int32Array(N * 4); this.nbNode = new Int32Array(N * 4); this.nbFrac = new Float32Array(N * 4);
    const OFF = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let j = 0; j < N; j++) {
      if (!this.inside[j]) continue;
      const gx = j % G, gy = (j / G) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = gx + OFF[k][0], ny = gy + OFF[k][1], q = j * 4 + k;
        const nj = ny * G + nx;
        if (nx >= 0 && ny >= 0 && nx < G && ny < G && this.inside[nj]) { this.nb[q] = nj; continue; }
        this.nb[q] = -1;
        let u = (Math.atan2(-EXTENT + ny * h, -EXTENT + nx * h) / TAU) * n; u = ((u % n) + n) % n;
        this.nbNode[q] = Math.floor(u) % n; this.nbFrac[q] = u - Math.floor(u);
      }
    }
    this.insideList = Int32Array.from([...this.inside.keys()].filter((j) => this.inside[j]));
    for (const k of ['ux', 'uy', 'uvx', 'uvy', 'ufx', 'ufy', 'div', 'trail', 'l1x', 'l1y', 'l2x', 'l2y', 'tmpx', 'tmpy']) this[k] = new Float32Array(N);
    // boundary sample points (just inside each node) for interior → boundary coupling
    for (let i = 0; i < n; i++) { this.sampX[i] = this.rx[i] * 0.9; this.sampY[i] = this.ry[i] * 0.9; }
    this.onEvent = null;
    this.reset();
  }

  restRadiusAt(theta) {
    const n = this.n;
    let u = (theta / TAU) * n; u = ((u % n) + n) % n;
    const i0 = Math.floor(u) % n, i1 = (i0 + 1) % n, f = u - Math.floor(u);
    return this.outline[i0] * (1 - f) + this.outline[i1] * f;
  }

  reset() {
    this.px.set(this.rx); this.py.set(this.ry);
    for (const k of ['vx', 'vy', 'w', 'radial', 'ux', 'uy', 'uvx', 'uvy', 'div', 'trail', 'l1x', 'l1y', 'l2x', 'l2y']) this[k].fill(0);
    this.timeMs = 0;
    this.input = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false };
    this.wasDown = false;
    this.contact = null;
    this.recovery = null;
    this.settled = true;
    this.area = this.A0;
    this.maxDisp = 0; this.meanSpeed = 0; this.maxU = 0; this.meanUSpeed = 0; this.maxCompression = 0;
    this.pInt = 0;                // interior pressure (0..1): builds under a press, relaxes after release
    this.regionContacts = new Uint16Array(REGION_COUNT);
    this.totals = {
      contactEpisodes: 0, interiorContacts: 0, contactMs: 0, dragDistance: 0, revisits: 0, recoveries: 0,
      peakDeformation: 0, peakRedistribution: 0, peakCompression: 0, peakInternalDisplacement: 0,
    };
  }

  setInput(inp) { Object.assign(this.input, inp); }
  emit(type, fields) { this.onEvent?.(type, fields); }

  /** Radius of the CURRENT boundary at angle theta. */
  radiusAt(theta) {
    const n = this.n;
    let u = (theta / TAU) * n; u = ((u % n) + n) % n;
    const i0 = Math.floor(u) % n, i1 = (i0 + 1) % n, f = u - Math.floor(u);
    return Math.hypot(this.px[i0], this.py[i0]) * (1 - f) + Math.hypot(this.px[i1], this.py[i1]) * f;
  }

  regionAt(theta) { return Math.floor((((theta / TAU) * REGION_COUNT + 0.5) % REGION_COUNT + REGION_COUNT) % REGION_COUNT); }

  /** Bilinear sample of a grid field (fx, fy) at (x, y) in rest coordinates; returns [ux, uy] into out. */
  sample(x, y, fx = this.ux, fy = this.uy, out = [0, 0]) {
    const G = this.G, h = this.h;
    let gx = (x + EXTENT) / h, gy = (y + EXTENT) / h;
    gx = clamp(gx, 0, G - 1.001); gy = clamp(gy, 0, G - 1.001);
    const x0 = gx | 0, y0 = gy | 0, tx = gx - x0, ty = gy - y0, j = y0 * G + x0;
    const a = (1 - tx) * (1 - ty), b = tx * (1 - ty), c = (1 - tx) * ty, d = tx * ty;
    out[0] = fx[j] * a + fx[j + 1] * b + fx[j + G] * c + fx[j + G + 1] * d;
    out[1] = fy[j] * a + fy[j + 1] * b + fy[j + G] * c + fy[j + G + 1] * d;
    return out;
  }

  sampleScalar(x, y, f) {
    const G = this.G, h = this.h;
    let gx = clamp((x + EXTENT) / h, 0, G - 1.001), gy = clamp((y + EXTENT) / h, 0, G - 1.001);
    const x0 = gx | 0, y0 = gy | 0, tx = gx - x0, ty = gy - y0, j = y0 * G + x0;
    return f[j] * (1 - tx) * (1 - ty) + f[j + 1] * tx * (1 - ty) + f[j + G] * (1 - tx) * ty + f[j + G + 1] * tx * ty;
  }

  step() {
    const p = this.params, n = this.n, dt = STEP, inp = this.input;
    this.timeMs += dt * 1000;
    const visc = clamp(p.viscosity, 0, 1), flow = Math.max(0, p.flow);
    const gain = 0.42 * (1 - 0.55 * visc), damp = 0.9 - 0.1 * visc, mu = 0.12 + 0.22 * visc;
    const kR = 0.0012 + 0.006 * clamp(p.recovery, 0, 1);
    const kRi = K_RESTORE_I * (0.5 + clamp(p.recovery, 0, 1));

    if (inp.down && !this.wasDown) this.beginContact();
    if (!inp.down && this.contact) this.endContact();
    this.wasDown = inp.down;
    const c = this.contact;
    if (c) {
      c.depth += (1 - c.depth) * (1 - Math.exp(-dt / PRESS_TAU));               // 0 → 1 while held
      const a = 1 - Math.exp(-CONTACT_LAG * (1 - 0.6 * visc) * dt);             // viscous lag of the indenter
      c.ix += (inp.x - c.ix) * a; c.iy += (inp.y - c.iy) * a;
    }

    // interior pressure: pressing INTO the gel displaces volume sideways, so the footprint
    // spreads. It is driven by how far the interior has ACTUALLY been displaced (inside
    // first, contour later), builds/relaxes with a delay, and relaxes after release.
    const pTarget = c ? clamp(this.maxU / 0.12, 0, 1) * (0.35 + 0.65 * (1 - c.edge)) : 0;
    this.pInt += (pTarget - this.pInt) * (1 - Math.exp(-dt / SPREAD_TAU));
    const Atarget = this.A0 * (1 + SPREAD * this.pInt * Math.min(1, p.pressure));

    // ================= boundary forces =================
    const { px, py, rx, ry, fx, fy } = this;
    this.area = polygonArea(px, py);
    const P = K_PRESSURE * Math.max(0.15, p.pressure) * (Atarget - this.area) / this.A0;
    const segRest = (TAU * Math.sqrt(this.A0 / Math.PI)) / n, s = [0, 0];
    for (let i = 0; i < n; i++) {
      const im = i === 0 ? n - 1 : i - 1, ip = i === n - 1 ? 0 : i + 1;
      const tx = px[ip] - px[im], ty = py[ip] - py[im], tl = Math.hypot(tx, ty) || 1;
      const nx = ty / tl, ny = -tx / tl, seg = (tl / 2) / segRest;
      const dxi = px[i] - rx[i], dyi = py[i] - ry[i];
      this.sample(this.sampX[i], this.sampY[i], this.ux, this.uy, s);
      fx[i] = P * nx * seg + K_SMOOTH * ((px[im] - rx[im]) + (px[ip] - rx[ip]) - 2 * dxi) - kR * dxi + K_COUPLE_B * (s[0] - dxi);
      fy[i] = P * ny * seg + K_SMOOTH * ((py[im] - ry[im]) + (py[ip] - ry[ip]) - 2 * dyi) - kR * dyi + K_COUPLE_B * (s[1] - dyi);
    }
    if (c && c.edge > 0.01) {
      let ox = (c.ix - c.sx) * DRAG_FOLLOW, oy = (c.iy - c.sy) * DRAG_FOLLOW;
      const ol = Math.hypot(ox, oy); if (ol > MAX_DRAG) { ox *= MAX_DRAG / ol; oy *= MAX_DRAG / ol; }
      const depth = EDGE_DEPTH * c.edge * c.depth;
      for (let i = 0; i < n; i++) {
        const w = this.w[i]; if (!w) continue;
        const tx = rx[i] + w * (-this.cos[i] * depth + ox * c.edge), ty = ry[i] + w * (-this.sin[i] * depth + oy * c.edge);
        fx[i] += K_EDGE * w * (tx - px[i]); fy[i] += K_EDGE * w * (ty - py[i]);
      }
    }

    // ================= interior forces =================
    const { ux, uy, ufx, ufy, insideList, nb, nbNode, nbFrac } = this;
    const kE = K_ELASTIC * (0.6 + 0.4 * Math.min(1.5, flow));
    for (let q = 0; q < insideList.length; q++) {
      const j = insideList[q];
      let lx = 0, ly = 0;
      for (let k = 0; k < 4; k++) {
        const t = j * 4 + k, m = nb[t];
        let vx_, vy_;
        if (m >= 0) { vx_ = ux[m]; vy_ = uy[m]; }
        else { const a = nbNode[t], b = a === n - 1 ? 0 : a + 1, f = nbFrac[t]; vx_ = (px[a] - rx[a]) * (1 - f) + (px[b] - rx[b]) * f; vy_ = (py[a] - ry[a]) * (1 - f) + (py[b] - ry[b]) * f; }
        lx += vx_ - ux[j]; ly += vy_ - uy[j];
      }
      ufx[j] = kE * lx - kRi * ux[j]; ufy[j] = kE * ly - kRi * uy[j];
    }
    if (c) this.applyIndenter(c, flow);

    // ================= integrate =================
    const { vx, vy, tvx, tvy } = this;
    for (let i = 0; i < n; i++) { vx[i] = vx[i] * damp + fx[i] * gain; vy[i] = vy[i] * damp + fy[i] * gain; }
    for (let i = 0; i < n; i++) {
      const im = i === 0 ? n - 1 : i - 1, ip = i === n - 1 ? 0 : i + 1;
      tvx[i] = vx[i] + mu * (vx[im] + vx[ip] - 2 * vx[i]); tvy[i] = vy[i] + mu * (vy[im] + vy[ip] - 2 * vy[i]);
    }
    let maxD = 0, sumV = 0;
    for (let i = 0; i < n; i++) {
      vx[i] = tvx[i]; vy[i] = tvy[i]; px[i] += vx[i]; py[i] += vy[i];
      let dx = px[i] - rx[i], dy = py[i] - ry[i];
      const m = Math.hypot(dx, dy);
      if (m > MAX_DISP) { const sc = MAX_DISP / m; dx *= sc; dy *= sc; px[i] = rx[i] + dx; py[i] = ry[i] + dy; vx[i] *= 0.5; vy[i] *= 0.5; }
      this.radial[i] = dx * this.cos[i] + dy * this.sin[i];
      maxD = Math.max(maxD, Math.min(m, MAX_DISP)); sumV += Math.hypot(vx[i], vy[i]);
    }
    this.maxDisp = maxD; this.meanSpeed = sumV / n;

    const { uvx, uvy, trail } = this, igain = gain * 1.1, trailDecay = Math.exp(-dt / TRAIL_TAU);
    let maxU = 0, sumUV = 0;
    for (let q = 0; q < insideList.length; q++) {
      const j = insideList[q];
      uvx[j] = uvx[j] * damp + ufx[j] * igain; uvy[j] = uvy[j] * damp + ufy[j] * igain;
      ux[j] += uvx[j]; uy[j] += uvy[j];
      const m = Math.hypot(ux[j], uy[j]);
      if (m > MAX_U) { const sc = MAX_U / m; ux[j] *= sc; uy[j] *= sc; uvx[j] *= 0.5; uvy[j] *= 0.5; }
      const sp = Math.hypot(uvx[j], uvy[j]);
      trail[j] = Math.min(1, trail[j] * trailDecay + sp * (c ? 9 : 2.5) * flow);   // mostly pointer-driven flow
      if (trail[j] < 0.004) trail[j] = 0;
      maxU = Math.max(maxU, Math.min(m, MAX_U)); sumUV += sp;
    }
    this.maxU = maxU; this.meanUSpeed = sumUV / insideList.length;
    this.computeDensity();
    this.updateLagFields(dt, visc);

    if (c) this.trackContact(dt);
    // recovery = everything back near rest
    const near = Math.max(maxD, maxU);
    if (this.recovery && near < SETTLE_DISP && this.meanSpeed < SETTLE_SPEED && this.meanUSpeed < SETTLE_SPEED) {
      this.totals.recoveries++;
      this.emit('recovery', { durationMs: this.timeMs - this.recovery.startMs, metadata: { kind: 'settle', completed: true } });
      this.recovery = null;
    }
    // final ease + exact rest snap (no autonomous motion after settling)
    if (!c && this.pInt < 0.02 && near < FINAL_DISP && this.meanSpeed < FINAL_SPEED && this.meanUSpeed < FINAL_SPEED) {
      for (let i = 0; i < n; i++) { px[i] = rx[i] + (px[i] - rx[i]) * FINAL_EASE; py[i] = ry[i] + (py[i] - ry[i]) * FINAL_EASE; vx[i] *= 0.9; vy[i] *= 0.9; }
      for (let q = 0; q < insideList.length; q++) { const j = insideList[q]; ux[j] *= FINAL_EASE; uy[j] *= FINAL_EASE; uvx[j] *= 0.9; uvy[j] *= 0.9; }
      this.maxDisp = maxD * FINAL_EASE; this.maxU = maxU * FINAL_EASE;
    }
    const trailMax = this.trailMax();
    if (!c && this.pInt < 0.002 && near < SNAP_DISP && this.meanSpeed < SNAP_SPEED && this.meanUSpeed < SNAP_SPEED && trailMax < 0.01) {
      if (!this.settled) {
        px.set(rx); py.set(ry); vx.fill(0); vy.fill(0);
        for (const k of ['ux', 'uy', 'uvx', 'uvy', 'div', 'trail', 'l1x', 'l1y', 'l2x', 'l2y']) this[k].fill(0);
        this.maxDisp = this.maxU = this.maxCompression = 0; this.pInt = 0;
      }
      this.settled = true;
    } else this.settled = false;
  }

  /** The indenter: push material away from the (lagged) contact point; carry nearby material with a drag. */
  applyIndenter(c, flow) {
    const { ux, uy, ufx, ufy, cx, cy, insideList } = this;
    const R = INDENT_RADIUS, depth = INDENT_DEPTH * c.depth * (0.55 + 0.45 * Math.min(1.5, flow));
    let ox = (c.ix - c.sx) * DRAG_FOLLOW, oy = (c.iy - c.sy) * DRAG_FOLLOW;
    const ol = Math.hypot(ox, oy); if (ol > MAX_DRAG) { ox *= MAX_DRAG / ol; oy *= MAX_DRAG / ol; }
    const R2 = (1.7 * R) ** 2;
    for (let q = 0; q < insideList.length; q++) {
      const j = insideList[q];
      // material that started near the press is carried by the drag
      const ex0 = cx[j] - c.sx, ey0 = cy[j] - c.sy, d0 = ex0 * ex0 + ey0 * ey0;
      const carry = Math.exp(-d0 / ((1.2 * R) ** 2));
      // indentation around the current (lagged) contact point: radial push, peak at ~0.7 R
      const ex = cx[j] + ux[j] - c.ix, ey = cy[j] + uy[j] - c.iy, d2 = ex * ex + ey * ey;
      if (d2 > R2 && carry < 0.01) continue;
      const d = Math.sqrt(d2) || 1e-6, rr = d / R;
      const push = depth * rr * Math.exp(0.5 - 0.5 * rr * rr * 2);   // ∝ r·e^(−r²/R²), max ≈ depth
      const tx = (ex / d) * push + ox * carry, ty = (ey / d) * push + oy * carry;
      const wt = Math.max(Math.exp(-d2 / R2), carry);
      const k = K_INDENT * (1 + 1.5 * Math.exp(-(this.timeMs - c.startMs) / 120));   // quick first response, then viscous
      ufx[j] += k * wt * (tx - ux[j]);
      ufy[j] += k * wt * (ty - uy[j]);
    }
  }

  /** compression = −div(u) (central differences; outside cells count as 0 displacement change) */
  computeDensity() {
    const { ux, uy, div, G, h, insideList, inside } = this;
    let maxC = 0;
    for (let q = 0; q < insideList.length; q++) {
      const j = insideList[q];
      const e = inside[j + 1] ? ux[j + 1] : ux[j], w = inside[j - 1] ? ux[j - 1] : ux[j];
      const s = inside[j + G] ? uy[j + G] : uy[j], nn = inside[j - G] ? uy[j - G] : uy[j];
      const dv = (e - w + s - nn) / (2 * h);
      div[j] = -dv;
      if (-dv > maxC) maxC = -dv;
    }
    this.maxCompression = maxC;
  }

  updateLagFields(dt, visc) {
    const a1 = 1 - Math.exp(-LAG_RATES[0] * (1 - 0.5 * visc) * dt), a2 = 1 - Math.exp(-LAG_RATES[1] * (1 - 0.5 * visc) * dt);
    const { ux, uy, l1x, l1y, l2x, l2y, insideList } = this;
    for (let q = 0; q < insideList.length; q++) {
      const j = insideList[q];
      l1x[j] += (ux[j] - l1x[j]) * a1; l1y[j] += (uy[j] - l1y[j]) * a1;
      l2x[j] += (ux[j] - l2x[j]) * a2; l2y[j] += (uy[j] - l2y[j]) * a2;
    }
  }

  trailMax() { let m = 0; for (let q = 0; q < this.insideList.length; q++) m = Math.max(m, this.trail[this.insideList[q]]); return m; }

  beginContact() {
    const inp = this.input;
    const r = Math.hypot(inp.x, inp.y), theta = r > 1e-6 ? Math.atan2(inp.y, inp.x) : 0;
    const rb = this.radiusAt(theta), dist = r - rb;
    if (dist > CONTACT_MARGIN) return;
    if (this.recovery) {
      this.emit('recovery', { durationMs: this.timeMs - this.recovery.startMs, metadata: { kind: 'settle', completed: false } });
      this.recovery = null;
    }
    // edge influence fades in over the last 0.3 units before the edge
    const edge = clamp((dist + 0.3) / 0.35, 0, 1);
    const bx = Math.cos(theta) * rb, by = Math.sin(theta) * rb;
    for (let i = 0; i < this.n; i++) {
      const d = Math.hypot(this.px[i] - bx, this.py[i] - by) / EDGE_WIDTH, w = Math.exp(-d * d);
      this.w[i] = w < 0.01 ? 0 : w;
    }
    // the indenter starts at the press point, but never outside the body
    const inR = Math.min(r, rb * 0.97), ix = Math.cos(theta) * inR, iy = Math.sin(theta) * inR;
    const region = this.regionAt(theta), interior = dist < -0.05;
    this.contact = {
      sx: ix, sy: iy, ix, iy, lx: inp.x, ly: inp.y, startMs: this.timeMs, region, edge, depth: TOUCH_DEPTH, interior,
      dragDist: 0, lastDragMs: this.timeMs, lastDragLogged: 0,
      peakDef: 0, peakRedis: 0, peakVol: 0, peakComp: 0, peakU: 0, boundaryAtMs: null,
    };
    this.totals.contactEpisodes++;
    if (interior) this.totals.interiorContacts++;
    this.emit('contact_start', {
      region, distance: dist, speed: Math.hypot(inp.vx, inp.vy),
      metadata: { x: +inp.x.toFixed(3), y: +inp.y.toFixed(3), interior, depthFromEdge: +Math.max(0, -dist).toFixed(3) },
    });
    if (this.regionContacts[region] > 0) { this.totals.revisits++; this.emit('region_revisit', { region, metadata: { previousContacts: this.regionContacts[region] } }); }
    this.regionContacts[region]++;
    this.settled = false;
  }

  trackContact(dt) {
    const c = this.contact, inp = this.input, t = this.totals;
    const moved = Math.hypot(inp.x - c.lx, inp.y - c.ly);
    c.lx = inp.x; c.ly = inp.y; c.dragDist += moved; t.dragDistance += moved; t.contactMs += dt * 1000;
    let inward = 0, outSum = 0, outN = 0, outAll = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.w[i] > 0.5 && c.edge > 0.05) inward = Math.max(inward, -this.radial[i]);
      else if (this.w[i] < 0.05 || c.edge <= 0.05) { outSum += Math.max(0, this.radial[i]); outN++; }
      outAll += Math.max(0, this.radial[i]);
    }
    // local compression / displacement within ~1.5 R of the contact
    let comp = 0, um = 0;
    const R2 = (1.5 * INDENT_RADIUS) ** 2;
    for (let q = 0; q < this.insideList.length; q++) {
      const j = this.insideList[q], ex = this.cx[j] - c.ix, ey = this.cy[j] - c.iy;
      if (ex * ex + ey * ey > R2) continue;
      comp = Math.max(comp, this.div[j]); um = Math.max(um, Math.hypot(this.ux[j], this.uy[j]));
    }
    c.peakComp = Math.max(c.peakComp, comp);
    c.peakU = Math.max(c.peakU, this.maxU);
    c.peakDef = Math.max(c.peakDef, inward, um);
    c.peakRedis = Math.max(c.peakRedis, outN ? outSum / outN : 0);
    c.peakVol = Math.max(c.peakVol, Math.abs(this.area / this.A0 - 1));
    if (c.boundaryAtMs === null && outAll / this.n > BOUNDARY_RESPONSE) c.boundaryAtMs = this.timeMs - c.startMs;
    if (this.timeMs - c.lastDragMs >= 400 && c.dragDist - c.lastDragLogged > 0.01) {
      this.emit('drag', { region: c.region, distance: c.dragDist, speed: Math.hypot(inp.vx, inp.vy), metadata: { interior: c.interior } });
      c.lastDragMs = this.timeMs; c.lastDragLogged = c.dragDist;
    }
  }

  endContact() {
    const c = this.contact, t = this.totals;
    t.peakDeformation = Math.max(t.peakDeformation, c.peakDef);
    t.peakRedistribution = Math.max(t.peakRedistribution, c.peakRedis);
    t.peakCompression = Math.max(t.peakCompression, c.peakComp);
    t.peakInternalDisplacement = Math.max(t.peakInternalDisplacement, c.peakU);
    this.emit('contact_end', {
      region: c.region, durationMs: this.timeMs - c.startMs, distance: c.dragDist,
      metadata: {
        interior: c.interior,
        peakDeformation: +c.peakDef.toFixed(4),            // max(edge indent, interior displacement near the contact)
        localCompression: +c.peakComp.toFixed(4),          // peak −div(u) near the contact
        internalDisplacement: +c.peakU.toFixed(4),         // peak |u| anywhere inside
        redistribution: +c.peakRedis.toFixed(4),           // peak mean outward boundary expansion outside the footprint
        pressurePropagationMs: c.boundaryAtMs === null ? null : Math.round(c.boundaryAtMs), // time until the contour responded
        peakVolumeChange: +c.peakVol.toFixed(4),
      },
    });
    this.w.fill(0);
    this.contact = null;
    this.recovery = { startMs: this.timeMs };
  }

  /** 0..1 signals for the shared sound engine. */
  signals() {
    return { tension: clamp(Math.max(this.maxDisp, this.maxU) / 0.3, 0, 1), motion: clamp((this.meanSpeed + this.meanUSpeed) * 120, 0, 1), sweep: 0, kinetic: clamp((this.meanSpeed + this.meanUSpeed) * 120, 0, 1) };
  }
}

function polygonArea(xs, ys) {
  let a = 0;
  const n = xs.length;
  for (let i = 0, j = n - 1; i < n; j = i++) a += xs[j] * ys[i] - xs[i] * ys[j];
  return a / 2;
}
