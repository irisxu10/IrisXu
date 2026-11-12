// Condition 04 — Silicone / Elasticity: a smooth, elastic membrane.
//
// Pure (no DOM), fixed step (config.STEP), deterministic per seed + input.
//
// MESH — a triangulated elastic disk: a centre node plus RINGS rings, ring k
// holding 6k nodes (6, 12, … 72), so triangles stay nearly uniform in size and no
// node has more than ~7 links (no singular centre). The outer ring lies exactly on
// the shared rest outline. Springs run along ring edges and triangle edges, so
// the sheet stays connected and deforms progressively.
//
// Per step (units: object units, per step):
//   spring      F = k_eff · (L − L0) · dir,  k_eff = k · (1 + resistance · strain²)
//               (capped) — STIFFER the further it is stretched
//   tether      −kT · (p − rest)  — weak shape memory (prevents rigid drift and
//               sets the recovery speed; it holds no history: no adaptation)
//   grab        a gaussian footprint of nodes is pulled toward
//               (their position at contact + pointer offset), the offset soft-
//               limited by maxDeformation (tanh), so the region follows the pointer
//   integrate   v = (v + F) · damp; p += v  — UNDERDAMPED: release overshoots
//               slightly and oscillates briefly before settling
//   safety      per-node velocity cap and displacement clamp (no explosions)
//
// Derived (for rendering and research): per-cell area ratio (thinning > 1 >
// compression), per-spring strain, max displacement / strain.

import { clamp } from '../util/math.js';
import { STEP, REGION_COUNT, SILICONE_DEFAULTS } from '../config.js';

const TAU = Math.PI * 2;
export { SILICONE_DEFAULTS };
export const RINGS = 12;

const K_CAP = 0.45;               // stability cap per spring (with 2 sub-steps: ≤ 8 springs × 2 × 0.45 / 4 < 2)
const K_GRAB = 0.17;              // finger ↔ membrane coupling (firm enough to follow, soft enough that stiffness is felt)
const K_AREA = 0.22;              // oriented area constraint: resists squeezing and unfolds inverted triangles
const GRAB_WIDTH = 0.22;          // gaussian width of the grabbed footprint
const CONTACT_MARGIN = 0.3;
const V_CAP = 0.08;               // per-step speed cap (safety)
const SUBSTEPS = 2;               // explicit sub-steps per physics step (stability margin ×4)
const SETTLE_DISP = 0.01, SETTLE_SPEED = 2e-4;
const SNAP_DISP = 0.002, SNAP_SPEED = 1e-5;

export class SiliconeBody {
  constructor(outline, seed, params = {}) {
    this.params = { ...SILICONE_DEFAULTS, ...params };
    this.seed = seed >>> 0;
    const R = (this.R = RINGS);
    this.outline = outline;
    const no = outline.length;
    const outR = (a) => { let u = (a / TAU) * no; u = ((u % no) + no) % no; const i0 = Math.floor(u) % no, i1 = (i0 + 1) % no, f = u - Math.floor(u); return outline[i0] * (1 - f) + outline[i1] * f; };
    this.outR = outR;
    // ---- nodes: centre + rings of 6k nodes ----
    this.ringStart = new Int32Array(R + 2); this.ringCount = new Int32Array(R + 1);
    this.ringStart[0] = 0; this.ringCount[0] = 1;
    let N = 1;
    for (let k = 1; k <= R; k++) { this.ringStart[k] = N; this.ringCount[k] = 6 * k; N += 6 * k; }
    this.N = N;
    this.rx = new Float32Array(N); this.ry = new Float32Array(N); this.ang = new Float32Array(N);
    for (let k = 1; k <= R; k++) for (let j = 0; j < 6 * k; j++) {
      const a = ((j + 0.5 * (k % 2)) / (6 * k)) * TAU, r = (k / R) * outR(a), i = this.ringStart[k] + j;
      this.rx[i] = Math.cos(a) * r; this.ry[i] = Math.sin(a) * r; this.ang[i] = a;
    }
    // ---- triangulation, ring by ring (merge by angle) ----
    const T = [], seen = new Set(), A = [], B = [];
    const edge = (a, b) => { const key = a < b ? a * N + b : b * N + a; if (seen.has(key)) return; seen.add(key); A.push(a); B.push(b); };
    const tri = (a, b, c) => { T.push(a, b, c); edge(a, b); edge(b, c); edge(c, a); };
    this.bandTris = [];
    for (let k = 1; k <= R; k++) {
      const band = [];
      const inner = k === 1 ? [0] : Array.from({ length: 6 * (k - 1) }, (_, j) => this.ringStart[k - 1] + j);
      const outer = Array.from({ length: 6 * k }, (_, j) => this.ringStart[k] + j);
      if (k === 1) { for (let j = 0; j < 6; j++) { band.push(T.length / 3); tri(0, outer[j], outer[(j + 1) % 6]); } }
      else {
        const nI = inner.length, nO = outer.length;
        const aI = (i) => this.ang[inner[i % nI]] + (i >= nI ? TAU : 0), aO = (o) => this.ang[outer[o % nO]] + (o >= nO ? TAU : 0);
        let i = 0, o = 0;
        while (i < nI || o < nO) {
          const advOuter = i >= nI || (o < nO && aO(o + 1) <= aI(i + 1));
          band.push(T.length / 3);
          if (advOuter) { tri(inner[i % nI], outer[o % nO], outer[(o + 1) % nO]); o++; }
          else { tri(inner[i % nI], outer[o % nO], inner[(i + 1) % nI]); i++; }
        }
      }
      this.bandTris.push(Int32Array.from(band));
    }
    this.tris = Int32Array.from(T);
    this.cellCount = T.length / 3;
    this.sa = Int32Array.from(A); this.sb = Int32Array.from(B);
    const M = (this.springCount = A.length);
    this.L0 = new Float32Array(M); this.strain = new Float32Array(M);
    for (let s = 0; s < M; s++) this.L0[s] = Math.hypot(this.rx[B[s]] - this.rx[A[s]], this.ry[B[s]] - this.ry[A[s]]) || 1e-6;
    const deg = new Uint16Array(N);
    for (let s = 0; s < M; s++) { deg[A[s]]++; deg[B[s]]++; }
    this.maxDegree = Math.max(...deg);
    this.kScale = new Float32Array(M);
    for (let s = 0; s < M; s++) this.kScale[s] = Math.min(1, 8 / Math.max(deg[A[s]], deg[B[s]]));
    this.outer = Array.from({ length: 6 * R }, (_, j) => this.ringStart[R] + j);
    for (const k of ['px', 'py', 'vx', 'vy', 'fx', 'fy', 'w', 'gx', 'gy']) this[k] = new Float32Array(N);
    this.px.set(this.rx); this.py.set(this.ry);
    this.cellArea0 = new Float32Array(this.cellCount); this.cellRatio = new Float32Array(this.cellCount).fill(1);
    for (let c = 0; c < this.cellCount; c++) this.cellArea0[c] = this.cellAreaNow(c);
    this.sqA0 = Float32Array.from(this.cellArea0, Math.sqrt);
    this.onEvent = null;
    this.reset();
  }

  /** The 3 corner nodes of triangle c. */
  cellNodes(c, out = [0, 0, 0]) { out[0] = this.tris[3 * c]; out[1] = this.tris[3 * c + 1]; out[2] = this.tris[3 * c + 2]; return out; }

  /** Signed area (positive in the rest orientation; negative if the triangle has folded over). */
  cellAreaNow(c) {
    const a = this.tris[3 * c], b = this.tris[3 * c + 1], d = this.tris[3 * c + 2], x = this.px, y = this.py;
    return ((x[b] - x[a]) * (y[d] - y[a]) - (x[d] - x[a]) * (y[b] - y[a])) / 2;
  }

  /** Number of triangles currently folded over (should stay 0). */
  invertedCount() { let n = 0; for (let c = 0; c < this.cellCount; c++) if (this.cellRatio[c] < 0) n++; return n; }

  reset() {
    this.px.set(this.rx); this.py.set(this.ry);
    this.vx.fill(0); this.vy.fill(0); this.w.fill(0); this.strain.fill(0); this.cellRatio.fill(1);
    this.timeMs = 0;
    this.input = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false };
    this.wasDown = false;
    this.contact = null;
    this.recovery = null;
    this.settled = true;
    this.maxDisp = 0; this.maxStrain = 0; this.meanSpeed = 0;
    this.regionContacts = new Uint16Array(REGION_COUNT);
    this.totals = { contactEpisodes: 0, interiorContacts: 0, contactMs: 0, dragDistance: 0, revisits: 0, recoveries: 0, peakDeformation: 0, peakStretch: 0, peakStrain: 0, peakReleaseVelocity: 0 };
  }

  setInput(inp) { Object.assign(this.input, inp); }
  emit(type, fields) { this.onEvent?.(type, fields); }
  regionAt(theta) { return Math.floor((((theta / TAU) * REGION_COUNT + 0.5) % REGION_COUNT + REGION_COUNT) % REGION_COUNT); }

  /** Current radius of the outer ring at angle theta. */
  radiusAt(theta) {
    const S = 6 * this.R, base = this.ringStart[this.R];
    let u = (theta / TAU) * S; u = ((u % S) + S) % S;     // outer ring has no angular offset (R even)
    const j0 = Math.floor(u) % S, j1 = (j0 + 1) % S, f = u - Math.floor(u), a = base + j0, b = base + j1;
    return Math.hypot(this.px[a], this.py[a]) * (1 - f) + Math.hypot(this.px[b], this.py[b]) * f;
  }

  /** Map a REST-space point to its current position (barycentric in its rest triangle). */
  map(x, y, out = [0, 0]) {
    const a = Math.atan2(y, x), r = Math.hypot(x, y), R = this.R;
    let k = Math.floor(clamp((r / this.outR(a)) * R, 0, R - 1e-6));
    const { rx, ry, px, py, tris } = this;
    for (let attempt = 0; attempt < 3; attempt++) {
      const band = this.bandTris[clamp(k + (attempt === 1 ? 1 : attempt === 2 ? -1 : 0), 0, R - 1)];
      for (let q = 0; q < band.length; q++) {
        const c = band[q], i0 = tris[3 * c], i1 = tris[3 * c + 1], i2 = tris[3 * c + 2];
        const x0 = rx[i0], y0 = ry[i0], d1x = rx[i1] - x0, d1y = ry[i1] - y0, d2x = rx[i2] - x0, d2y = ry[i2] - y0;
        const det = d1x * d2y - d2x * d1y; if (Math.abs(det) < 1e-12) continue;
        const ex = x - x0, ey = y - y0, u = (ex * d2y - d2x * ey) / det, v = (d1x * ey - ex * d1y) / det;
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        const w0 = 1 - u - v;
        out[0] = x + w0 * (px[i0] - x0) + u * (px[i1] - rx[i1]) + v * (px[i2] - rx[i2]);
        out[1] = y + w0 * (py[i0] - y0) + u * (py[i1] - ry[i1]) + v * (py[i2] - ry[i2]);
        return out;
      }
    }
    out[0] = x; out[1] = y;    // outside the mesh (should not happen inside the outline)
    return out;
  }

  derived(p) {
    return {
      k: 0.03 + 0.27 * clamp(p.stiffness, 0, 1),
      hard: 12 * clamp(p.resistance, 0, 1),
      // recovery speed scales both the pull home and the energy loss, so higher values
      // genuinely return faster; damping alone sets how bouncy the return is
      damp: 1 - (0.015 + 0.06 * clamp(p.damping, 0, 1)) * (0.6 + 0.8 * clamp(p.recovery, 0, 1)),
      kT: 0.002 + 0.02 * clamp(p.recovery, 0, 1),
      maxD: clamp(p.maxDeformation, 0.15, 0.8),
    };
  }

  step() {
    const p = this.params, inp = this.input, d = this.derived(p);
    this.timeMs += STEP * 1000;
    if (inp.down && !this.wasDown) this.beginContact();
    if (!inp.down && this.contact) this.endContact();
    this.wasDown = inp.down;
    const c = this.contact;
    if (!c && this.settled) return;          // at rest and untouched: nothing moves (no autonomous motion)
    if (c) {
      let ox = inp.x - c.sx, oy = inp.y - c.sy;
      const ol = Math.hypot(ox, oy);
      if (ol > 1e-6) { const sc = (d.maxD * Math.tanh(ol / d.maxD)) / ol; ox *= sc; oy *= sc; }   // resistance at the limit
      c.ox = ox; c.oy = oy;
    }
    // SUBSTEPS explicit sub-steps per step: forces are in per-step units, so each
    // sub-step applies F / SUBSTEPS² and the per-step damping ^(1/SUBSTEPS)
    const inv2 = 1 / (SUBSTEPS * SUBSTEPS), damp = Math.pow(d.damp, 1 / SUBSTEPS);
    for (let k = 0; k < SUBSTEPS; k++) this.substep(d, inv2, damp);

    const { px, py, rx, ry, vx, vy, strain } = this, N = this.N;
    let maxD = 0, sumV = 0;
    for (let i = 0; i < N; i++) { maxD = Math.max(maxD, Math.hypot(px[i] - rx[i], py[i] - ry[i])); sumV += Math.hypot(vx[i], vy[i]); }
    this.maxDisp = maxD; this.meanSpeed = (sumV / N) * SUBSTEPS;          // per-step units
    for (let k = 0; k < this.cellCount; k++) this.cellRatio[k] = this.cellAreaNow(k) / this.cellArea0[k];

    if (c) this.trackContact();
    if (this.recovery) this.trackRecovery();
    if (!c && maxD < SNAP_DISP && this.meanSpeed < SNAP_SPEED) {
      if (!this.settled) { px.set(rx); py.set(ry); vx.fill(0); vy.fill(0); strain.fill(0); this.cellRatio.fill(1); this.maxDisp = this.maxStrain = 0; }
      this.settled = true;
    } else this.settled = false;
  }

  substep(d, inv2, damp) {
    const { px, py, rx, ry, fx, fy, vx, vy, sa, sb, L0, strain, N } = this;
    for (let i = 0; i < N; i++) { fx[i] = -d.kT * (px[i] - rx[i]); fy[i] = -d.kT * (py[i] - ry[i]); }
    let maxS = 0;
    for (let s = 0; s < this.springCount; s++) {
      const a = sa[s], b = sb[s];
      const ex = px[b] - px[a], ey = py[b] - py[a], L = Math.hypot(ex, ey) || 1e-9;
      const st = (L - L0[s]) / L0[s];
      strain[s] = st;
      if (st > maxS) maxS = st;
      const kE = Math.min(K_CAP, d.k * (1 + d.hard * st * st)) * this.kScale[s];
      const f = kE * (L - L0[s]) / L, gx = ex * f, gy = ey * f;
      fx[a] += gx; fy[a] += gy; fx[b] -= gx; fy[b] -= gy;
    }
    this.maxStrain = maxS;
    // oriented area constraint (signed area, so a folded triangle reads as negative):
    // for compressed or inverted triangles push each corner along dA/dp — away from
    // the opposite edge — which resists squeezing and unfolds flips
    const { tris, cellArea0 } = this;
    for (let k = 0; k < this.cellCount; k++) {
      const a = tris[3 * k], b = tris[3 * k + 1], e = tris[3 * k + 2];
      const A = ((px[b] - px[a]) * (py[e] - py[a]) - (px[e] - px[a]) * (py[b] - py[a])) / 2;
      const ratio = A / cellArea0[k];
      if (ratio >= 1) continue;
      // force = K·(1−ratio)·∂A/∂p: its stiffness ≈ K·e²/(4A0) ≈ 0.58·K for any triangle size
      const g = K_AREA * Math.min(2, 1 - ratio) * 0.5;
      fx[a] += g * (py[b] - py[e]); fy[a] += g * (px[e] - px[b]);
      fx[b] += g * (py[e] - py[a]); fy[b] += g * (px[a] - px[e]);
      fx[e] += g * (py[a] - py[b]); fy[e] += g * (px[b] - px[a]);
    }
    const c = this.contact;
    if (c) {
      for (let i = 0; i < N; i++) {
        const w = this.w[i]; if (!w) continue;
        fx[i] += K_GRAB * w * (this.gx[i] + c.ox - px[i]);
        fy[i] += K_GRAB * w * (this.gy[i] + c.oy - py[i]);
      }
    }
    const hard = d.maxD * 1.15, vcap = V_CAP / SUBSTEPS;
    for (let i = 0; i < N; i++) {
      let nvx = (vx[i] + fx[i] * inv2) * damp, nvy = (vy[i] + fy[i] * inv2) * damp;
      const sp = Math.hypot(nvx, nvy);
      if (sp > vcap) { nvx *= vcap / sp; nvy *= vcap / sp; }
      vx[i] = nvx; vy[i] = nvy;
      px[i] += nvx; py[i] += nvy;
      const dx = px[i] - rx[i], dy = py[i] - ry[i], m = Math.hypot(dx, dy);
      if (m > hard) { px[i] = rx[i] + (dx * hard) / m; py[i] = ry[i] + (dy * hard) / m; vx[i] *= 0.5; vy[i] *= 0.5; }
    }
  }

  beginContact() {
    const inp = this.input;
    const r = Math.hypot(inp.x, inp.y), theta = r > 1e-6 ? Math.atan2(inp.y, inp.x) : 0;
    const rb = this.radiusAt(theta), dist = r - rb;
    if (dist > CONTACT_MARGIN) return;
    if (this.recovery) this.finishRecovery(false);
    // grab point: the pressed point, pulled inside the membrane if pressed just outside
    const gr = Math.min(r, rb * 0.98), cx = Math.cos(theta) * gr, cy = Math.sin(theta) * gr;
    let wsum = 0;
    for (let i = 0; i < this.N; i++) {
      const q = Math.hypot(this.px[i] - cx, this.py[i] - cy) / GRAB_WIDTH, w = Math.exp(-q * q);
      this.w[i] = w < 0.02 ? 0 : w; wsum += this.w[i];
      this.gx[i] = this.px[i]; this.gy[i] = this.py[i];
    }
    const region = this.regionAt(theta), interior = dist < -0.05;
    this.contact = { sx: inp.x, sy: inp.y, lx: inp.x, ly: inp.y, ox: 0, oy: 0, cx, cy, startMs: this.timeMs, region, interior, dragDist: 0, lastDragMs: this.timeMs, lastDragLogged: 0, peakStretch: 0, peakDef: 0, peakStrain: 0, wsum };
    this.totals.contactEpisodes++;
    if (interior) this.totals.interiorContacts++;
    this.emit('contact_start', { region, distance: dist, speed: Math.hypot(inp.vx, inp.vy), metadata: { x: +inp.x.toFixed(3), y: +inp.y.toFixed(3), interior, depthFromEdge: +Math.max(0, -dist).toFixed(3) } });
    if (this.regionContacts[region] > 0) { this.totals.revisits++; this.emit('region_revisit', { region, metadata: { previousContacts: this.regionContacts[region] } }); }
    this.regionContacts[region]++;
    this.settled = false;
  }

  /** Mean displacement (and velocity) of the grabbed footprint. */
  footprint() {
    let dx = 0, dy = 0, vx = 0, vy = 0, ws = 0;
    for (let i = 0; i < this.N; i++) {
      const w = this.w[i]; if (!w) continue;
      dx += w * (this.px[i] - this.rx[i]); dy += w * (this.py[i] - this.ry[i]); vx += w * this.vx[i]; vy += w * this.vy[i]; ws += w;
    }
    return ws ? { dx: dx / ws, dy: dy / ws, vx: (vx / ws) * SUBSTEPS, vy: (vy / ws) * SUBSTEPS } : { dx: 0, dy: 0, vx: 0, vy: 0 };   // velocity per step
  }

  trackContact() {
    const c = this.contact, inp = this.input, t = this.totals;
    const moved = Math.hypot(inp.x - c.lx, inp.y - c.ly);
    c.lx = inp.x; c.ly = inp.y; c.dragDist += moved; t.dragDistance += moved; t.contactMs += STEP * 1000;
    const f = this.footprint();
    c.peakStretch = Math.max(c.peakStretch, Math.hypot(f.dx, f.dy));
    c.peakDef = Math.max(c.peakDef, this.maxDisp);
    c.peakStrain = Math.max(c.peakStrain, this.maxStrain);
    if (this.timeMs - c.lastDragMs >= 400 && c.dragDist - c.lastDragLogged > 0.01) {
      this.emit('drag', { region: c.region, distance: c.dragDist, speed: Math.hypot(inp.vx, inp.vy), metadata: { stretch: +Math.hypot(f.dx, f.dy).toFixed(4) } });
      c.lastDragMs = this.timeMs; c.lastDragLogged = c.dragDist;
    }
  }

  endContact() {
    const c = this.contact, t = this.totals;
    const f = this.footprint();
    const releaseVelocity = Math.hypot(f.vx, f.vy) / STEP;        // object units / s at the moment of release
    t.peakDeformation = Math.max(t.peakDeformation, c.peakDef);
    t.peakStretch = Math.max(t.peakStretch, c.peakStretch);
    t.peakStrain = Math.max(t.peakStrain, c.peakStrain);
    this.emit('contact_end', {
      region: c.region, durationMs: this.timeMs - c.startMs, distance: c.dragDist,
      metadata: {
        interior: c.interior,
        stretchDistance: +c.peakStretch.toFixed(4),     // peak displacement of the grabbed footprint
        peakDeformation: +c.peakDef.toFixed(4),         // peak displacement of any node
        peakStrain: +c.peakStrain.toFixed(4),           // peak spring strain (fractional stretch)
        releaseDisplacement: +Math.hypot(f.dx, f.dy).toFixed(4),
      },
    });
    // recovery starts from the released state; count overshoots along the release direction
    const dirL = Math.hypot(f.dx, f.dy) || 1;
    this.recovery = { startMs: this.timeMs, releaseVelocity, dirX: f.dx / dirL, dirY: f.dy / dirL, lastSign: 1, overshoots: 0, minProj: 0, start: Math.hypot(f.dx, f.dy) };
    this.contact = null;
  }

  trackRecovery() {
    const r = this.recovery, f = this.footprint();
    const proj = f.dx * r.dirX + f.dy * r.dirY, sign = proj >= 0 ? 1 : -1;
    if (Math.abs(proj) > 0.004 && sign !== r.lastSign) { r.overshoots++; r.lastSign = sign; }
    r.minProj = Math.min(r.minProj, proj);
    if (this.maxDisp < SETTLE_DISP && this.meanSpeed < SETTLE_SPEED) this.finishRecovery(true);
  }

  finishRecovery(completed) {
    const r = this.recovery;
    this.totals.peakReleaseVelocity = Math.max(this.totals.peakReleaseVelocity, r.releaseVelocity);
    if (completed) this.totals.recoveries++;
    this.emit('recovery', {
      durationMs: this.timeMs - r.startMs,
      metadata: {
        kind: 'settle', completed,
        releaseVelocity: +r.releaseVelocity.toFixed(4),   // object units / s
        overshoots: r.overshoots,                         // crossings of the rest position along the release direction
        maxOvershoot: +Math.max(0, -r.minProj).toFixed(4),
      },
    });
    this.recovery = null;
  }

  signals() {
    return { tension: clamp(this.maxStrain / 0.6, 0, 1), motion: clamp(this.meanSpeed * 200, 0, 1), sweep: 0, kinetic: clamp(this.meanSpeed * 200, 0, 1) };
  }
}
