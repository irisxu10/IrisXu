// Condition 03 — Plastic / Crease: a thin, stiff sheet that FOLDS and KEEPS its creases.
//
// Pure (no DOM), fixed step (config.STEP), deterministic per seed + input.
//
// MODEL — the sheet is a set of flat FACETS. Each facet is a polygon in rest
// space with an affine map M (rest → current position), a 3D unit normal N (for
// shading; N.z < 0 means its back is showing) and a layer (draw order). At rest
// there is one facet: the shared outline. A fold splits facets along a straight
// line and moves the pieces on one side:
//
//   fold about a line by angle θ (rotation of the flap out of the plane, seen from
//   above):  q' = q − n · (n·q − off) · (1 − cos θ)
//   θ = 0 flat · θ = 90° edge-on · θ = 180° folded flat over (mirror image)
//
// GESTURE — press anywhere and drag:
//   loading   until the drag exceeds the YIELD distance the sheet does not move;
//             a faint stress line shows where it is about to give
//   yield     the gesture is classified once, from the drag direction:
//               edge   the part of the sheet behind the press point is small →
//                      it lifts and folds over along the perpendicular bisector of
//                      press point and pointer (the press point lands under the pointer)
//               ridge  pressed further in → the sheet buckles into a raised ridge
//                      just ahead of the finger (two parallel creases); the material
//                      under the finger moves with it, the far side stays put
//               resist pulling outward (nothing to fold against) → no deformation
//   release   the fold springs back only PART of the way (elastic part), to a
//             residual angle = peak angle × plasticity factor, then stops. The bend
//             and the crease lines are baked in and persist; later folds add more.
//
// No autonomous motion, no recovery of the original form (RESET restores it), no
// stiffness adaptation. Crease records keep geometry only (no "memory" of the person).

import { clamp } from '../util/math.js';
import { STEP, REGION_COUNT, PLASTIC_DEFAULTS } from '../config.js';

export { PLASTIC_DEFAULTS };
const TAU = Math.PI * 2;
const PRE_BEND = 0.35;          // rad: fold angle at the moment of yielding
const FOLD_RATE = 0.22;         // per step: fold angle → 180° after yielding (the sheet "gives")
const CONTACT_MARGIN = 0.2;
const EDGE_MODE_MAX = 0.38;     // behind-area fraction at yield up to which a gesture folds an edge flap
const RIDGE_KEEP_FLAT = 0.15;   // a ridge needs at least this fraction of the sheet ahead of it to stay flat
const RIDGE_GAP = 0.05;         // distance of the ridge ahead of the finger
const MAX_RESIDUAL = 1.36;      // rad (78°): a residual bend never reaches edge-on, so every facet stays invertible
const MAX_FACETS = 360;         // beyond this the sheet is "saturated": further gestures are resisted
const SETTLE_EPS = 0.004;       // rad: spring-back finished
const EPS = 1e-9;

const mapX = (M, x, y) => M[0] * x + M[2] * y + M[4];
const mapY = (M, x, y) => M[1] * x + M[3] * y + M[5];

/** Polygon area (signed, shoelace). */
export function polyArea(xs, ys) {
  let a = 0;
  for (let i = 0, n = xs.length; i < n; i++) { const j = i + 1 === n ? 0 : i + 1; a += xs[i] * ys[j] - xs[j] * ys[i]; }
  return a / 2;
}

/** Affine F∘M for a fold about the screen line n·q = off by angle with cosine c. */
function foldM(M, nx, ny, off, c) {
  const k = 1 - c;
  const lin = (vx, vy) => { const d = (nx * vx + ny * vy) * k; return [vx - nx * d, vy - ny * d]; };
  const [a, b] = lin(M[0], M[1]), [cc, d] = lin(M[2], M[3]), [e, f] = lin(M[4], M[5]);
  return [a, b, cc, d, e + k * off * nx, f + k * off * ny];
}

/** Rotate normal N by θ about the in-plane fold axis, lifting the flap side n toward +z. */
function rotateN(N, nx, ny, theta) {
  const ax = ny, ay = -nx, c = Math.cos(theta), s = Math.sin(theta);
  const [vx, vy, vz] = N, dot = ax * vx + ay * vy;
  // Rodrigues: v c + (a × v) s + a (a·v)(1 − c), a = (ax, ay, 0)
  const cx = ay * vz, cy = -ax * vz, cz = ax * vy - ay * vx;
  const r = [vx * c + cx * s + ax * dot * (1 - c), vy * c + cy * s + ay * dot * (1 - c), vz * c + cz * s];
  const m = Math.hypot(r[0], r[1], r[2]) || 1;
  return [r[0] / m, r[1] / m, r[2] / m];
}

/**
 * Clip facet f to the side where sign·(n·q − off) ≥ 0 (q = current position).
 * Rest coordinates are interpolated (the side value is affine in rest space), so
 * pieces keep their texture. New edges along the cut get `cutKind`.
 */
function clipFacet(f, v, sign, cutKind) {
  const xs = [], ys = [], ks = [], n = f.x.length;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1, si = sign * v[i], sj = sign * v[j];
    const inI = si >= 0, inJ = sj >= 0;
    if (inI) { xs.push(f.x[i]); ys.push(f.y[i]); ks.push(f.k[i]); }
    if (inI !== inJ) {
      const t = si / (si - sj);
      xs.push(f.x[i] + (f.x[j] - f.x[i]) * t); ys.push(f.y[i] + (f.y[j] - f.y[i]) * t);
      ks.push(inI ? cutKind : f.k[i]);     // leaving the side: the next edge runs along the cut
    }
  }
  if (xs.length < 3 || Math.abs(polyArea(xs, ys)) < 1e-7) return null;
  return { x: xs, y: ys, k: ks, M: f.M, N: f.N, layer: f.layer };
}

/** Split facet f by the screen line n·q = off → { pos (n·q > off), neg }. */
function splitFacet(f, nx, ny, off, cutKind) {
  const n = f.x.length, v = new Array(n);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const q = nx * mapX(f.M, f.x[i], f.y[i]) + ny * mapY(f.M, f.x[i], f.y[i]) - off;
    v[i] = q; if (q < lo) lo = q; if (q > hi) hi = q;
  }
  if (lo >= -1e-7) return { pos: f, neg: null };
  if (hi <= 1e-7) return { pos: null, neg: f };
  return { pos: clipFacet(f, v, 1, cutKind), neg: clipFacet(f, v, -1, cutKind) };
}

/** Area of facet f's current (screen) polygon on the side n·q > off. */
function areaBeyond(f, nx, ny, off) {
  const n = f.x.length; let a = 0;
  let px = 0, py = 0, pv = 0;
  const X = [], Y = [];
  for (let i = 0; i <= n; i++) {
    const ii = i % n, x = mapX(f.M, f.x[ii], f.y[ii]), y = mapY(f.M, f.x[ii], f.y[ii]), v = nx * x + ny * y - off;
    if (i > 0) {
      if (pv >= 0) { X.push(px); Y.push(py); }
      if ((pv >= 0) !== (v >= 0)) { const t = pv / (pv - v); X.push(px + (x - px) * t); Y.push(py + (y - py) * t); }
    }
    px = x; py = y; pv = v;
  }
  if (X.length >= 3) a = Math.abs(polyArea(X, Y));
  return a;
}

export class PlasticBody {
  constructor(outline, seed, params = {}) {
    this.params = { ...PLASTIC_DEFAULTS, ...params };
    this.seed = seed >>> 0;
    this.outline = outline;
    const n = outline.length;
    this.restX = []; this.restY = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; this.restX.push(Math.cos(a) * outline[i]); this.restY.push(Math.sin(a) * outline[i]); }
    this.restArea = Math.abs(polyArea(this.restX, this.restY));
    this.onEvent = null;
    this.reset();
  }

  reset() {
    this.facets = [{ x: [...this.restX], y: [...this.restY], k: new Array(this.restX.length).fill(-1), M: [1, 0, 0, 1, 0, 0], N: [0, 0, 1], layer: 0 }];
    this.view = this.facets;
    this.creases = [];           // { id, mode, peakAngle, residualAngle, length }
    this.timeMs = 0;
    this.input = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false };
    this.wasDown = false;
    this.contact = null;
    this.spring = null;          // partial elastic spring-back in progress
    this.preview = null;         // { dx, dy, a, load } stress line before yielding (rendering only)
    this.stress = 0;
    this.theta = 0; this.dTheta = 0;
    this.regionContacts = new Uint16Array(REGION_COUNT);
    this.totals = { contactEpisodes: 0, interiorContacts: 0, contactMs: 0, dragDistance: 0, revisits: 0, folds: 0, edgeFolds: 0, ridgeFolds: 0, resisted: 0, creases: 0, creaseLength: 0, peakFoldAngle: 0, springbacks: 0 };
    this.metrics = this.measure();
  }

  setInput(inp) { Object.assign(this.input, inp); }
  emit(type, fields) { this.onEvent?.(type, fields); }
  regionAt(theta) { return Math.floor((((theta / TAU) * REGION_COUNT + 0.5) % REGION_COUNT + REGION_COUNT) % REGION_COUNT); }

  derived(p = this.params) {
    return {
      yieldDist: 0.03 + 0.1 * clamp(p.stiffness, 0, 1),          // drag needed before the sheet gives
      follow: 0.75 - 0.4 * clamp(p.stiffness, 0, 1),             // per-step pointer following (stiffer = slight lag)
      residual: 0.12 + 0.3 * clamp(p.plasticity, 0, 1),          // fraction of the peak fold angle that stays
      springRate: 0.06 + 0.3 * clamp(p.springBack, 0, 1),        // per-step approach to the residual angle
      maxFlap: clamp(p.foldLimit, 0.2, 0.6),
    };
  }

  // ---------- geometry queries (on the committed sheet) ----------
  totalArea(facets = this.facets) { let a = 0; for (const f of facets) a += Math.abs(polyArea(f.x, f.y) * (f.M[0] * f.M[3] - f.M[1] * f.M[2])); return a; }

  /** Fraction of the committed sheet's (projected) area where D̂·q < a. */
  fracBehind(dx, dy, a) {
    let s = 0;
    for (const f of this.facets) s += areaBeyond(f, -dx, -dy, -a);
    return s / (this.areaNow || 1);
  }

  /** Line position a (along D̂) where fracBehind = target (monotone → bisection). */
  solveLine(dx, dy, target) {
    let lo = Infinity, hi = -Infinity;
    for (const f of this.facets) for (let i = 0; i < f.x.length; i++) { const s = dx * mapX(f.M, f.x[i], f.y[i]) + dy * mapY(f.M, f.x[i], f.y[i]); if (s < lo) lo = s; if (s > hi) hi = s; }
    for (let it = 0; it < 26; it++) { const m = (lo + hi) / 2; if (this.fracBehind(dx, dy, m) < target) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  /** Is (x, y) on the sheet (any facet), and how far outside it is otherwise (approx.). */
  hit(x, y) {
    let inside = false, best = Infinity;
    for (const f of this.view) {
      const n = f.x.length; let c = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = mapX(f.M, f.x[i], f.y[i]), yi = mapY(f.M, f.x[i], f.y[i]), xj = mapX(f.M, f.x[j], f.y[j]), yj = mapY(f.M, f.x[j], f.y[j]);
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        const ex = xj - xi, ey = yj - yi, L2 = ex * ex + ey * ey || 1e-12, t = clamp(((x - xi) * ex + (y - yi) * ey) / L2, 0, 1);
        best = Math.min(best, Math.hypot(x - xi - ex * t, y - yi - ey * t));
      }
      if (c) inside = true;
    }
    return { inside, dist: inside ? -best : best };
  }

  // ---------- folding ----------
  /** Apply a fold operation to a facet list at angle theta → new facet list (pure). */
  applyOp(facets, op, theta) {
    const { dx, dy, a, w, mode, kinds } = op, nx = -dx, ny = -dy, c = Math.cos(theta);
    let top = -Infinity; for (const f of facets) top = Math.max(top, f.layer);
    const fixed = [], band = [], far = [];
    for (const f of facets) {
      const s1 = splitFacet(f, nx, ny, -a, kinds[0]);       // pos: behind the line (D̂·q < a)
      if (s1.neg) fixed.push(s1.neg);
      if (!s1.pos) continue;
      if (mode === 'ridge') {
        const s2 = splitFacet(s1.pos, nx, ny, -(a - w), kinds[1]);
        if (s2.pos) far.push(s2.pos);
        if (s2.neg) band.push(s2.neg);
      } else band.push(s1.pos);
    }
    const restack = (list, base, flipped) => {
      if (!list.length) return base;
      let lo = Infinity, hi = -Infinity; for (const f of list) { lo = Math.min(lo, f.layer); hi = Math.max(hi, f.layer); }
      for (const f of list) f.layer = base + 1 + (flipped ? hi - f.layer : f.layer - lo);
      return base + 1 + (hi - lo);
    };
    const out = fixed.slice();
    const folded = band.map((f) => ({ ...f, M: foldM(f.M, nx, ny, -a, c), N: rotateN(f.N, nx, ny, theta) }));
    let next = restack(folded, top, c < 0);
    out.push(...folded);
    if (far.length) {
      const sh = w * (1 - c);
      const moved = far.map((f) => ({ ...f, M: [f.M[0], f.M[1], f.M[2], f.M[3], f.M[4] + dx * sh, f.M[5] + dy * sh] }));
      next = restack(moved, next, false);
      out.push(...moved);
    }
    return out;
  }

  /** The fold operation for the current drag (direction D̂, distance δ) in the classified mode. */
  makeOp(c, dx, dy, delta) {
    const sG = dx * c.gx + dy * c.gy;
    if (c.mode === 'edge') {
      const aMax = this.solveLine(dx, dy, this.derived().maxFlap);
      return { mode: 'edge', dx, dy, a: Math.min(sG + delta / 2, aMax), w: 0, kinds: c.kinds };
    }
    const aLim = this.solveLine(dx, dy, 1 - RIDGE_KEEP_FLAT);
    const w = clamp(delta / 2, 0, Math.max(0, (aLim - sG - RIDGE_GAP) / 2));
    return { mode: 'ridge', dx, dy, a: sG + RIDGE_GAP + w, w, kinds: c.kinds };
  }

  /** Classify a gesture at the yield point (once per gesture). */
  classify(c, dx, dy) {
    if (this.facets.length > MAX_FACETS) return 'resist';
    const sG = dx * c.gx + dy * c.gy, yd = this.derived().yieldDist;
    const behind = this.fracBehind(dx, dy, sG + yd / 2);
    if (behind <= EDGE_MODE_MAX) return 'edge';
    const aLim = this.solveLine(dx, dy, 1 - RIDGE_KEEP_FLAT);
    if (aLim - sG - RIDGE_GAP > yd / 2) return 'ridge';
    return 'resist';
  }

  newCrease(mode) {
    const id = this.creases.length + 1;
    this.creases.push({ id, mode, peakAngle: 0, residualAngle: 0, length: 0, strength: 0 });
    return id;
  }

  // ---------- step ----------
  step() {
    const inp = this.input, d = this.derived();
    this.timeMs += STEP * 1000;
    if (inp.down && !this.wasDown) this.beginContact();
    if (!inp.down && this.contact) this.endContact();
    this.wasDown = inp.down;
    const c = this.contact;
    const prevTheta = this.theta;
    if (c) {
      c.ex += (inp.x - c.ex) * d.follow; c.ey += (inp.y - c.ey) * d.follow;
      const Dx = c.ex - c.gx, Dy = c.ey - c.gy, dist = Math.hypot(Dx, Dy);
      if (dist > 1e-4) { c.dx = Dx / dist; c.dy = Dy / dist; }
      c.dist = dist;
      if (c.phase === 'loading') {
        const load = dist / d.yieldDist;
        if (load >= 1) {
          c.mode = this.classify(c, c.dx, c.dy);
          if (c.mode === 'resist') { c.phase = 'resist'; this.totals.resisted++; }
          else {
            c.phase = 'folding';
            c.kinds = c.mode === 'ridge' ? [this.newCrease('ridge'), this.newCrease('ridge')] : [this.newCrease('edge'), 0];
            this.theta = PRE_BEND;
            this.totals.folds++; this.totals[c.mode === 'edge' ? 'edgeFolds' : 'ridgeFolds']++;
            this.emit('fold', { region: c.region, metadata: { mode: c.mode, direction: +((Math.atan2(c.dy, c.dx) * 180) / Math.PI).toFixed(1), flapFraction: +this.fracBehind(c.dx, c.dy, c.dx * c.gx + c.dy * c.gy + d.yieldDist / 2).toFixed(3), atMs: Math.round(this.timeMs - c.startMs) } });
          }
          this.preview = null;
        } else {
          const sG = c.dx * c.gx + c.dy * c.gy;
          this.preview = dist > 0.005 ? { dx: c.dx, dy: c.dy, a: sG + Math.max(dist, d.yieldDist * 0.5) / 2, load } : null;
        }
      }
      if (c.phase === 'folding') {
        this.theta += (Math.PI - this.theta) * FOLD_RATE;
        c.op = this.makeOp(c, c.dx, c.dy, dist);
        c.peakTheta = Math.max(c.peakTheta, this.theta);
        c.peakDelta = Math.max(c.peakDelta, dist);
        this.view = this.applyOp(this.facets, c.op, this.theta);
      }
      this.stress = c.phase === 'resist' ? clamp(dist / (d.yieldDist * 3), 0, 1) : c.phase === 'loading' ? clamp(dist / d.yieldDist, 0, 1) : 0;
      this.trackContact();
    } else if (this.spring) {
      const s = this.spring;
      this.theta += (s.target - this.theta) * d.springRate;
      if (Math.abs(this.theta - s.target) < SETTLE_EPS) this.finishSpring(true);
      else this.view = this.applyOp(this.facets, s.op, this.theta);
    } else this.stress = 0;
    this.dTheta = Math.abs(this.theta - prevTheta);
  }

  beginContact() {
    const inp = this.input;
    const h = this.hit(inp.x, inp.y);
    if (h.dist > CONTACT_MARGIN) return;
    if (this.spring) this.finishSpring(false);
    const r = Math.hypot(inp.x, inp.y), theta = r > 1e-6 ? Math.atan2(inp.y, inp.x) : 0, region = this.regionAt(theta), interior = h.dist < -0.05;
    this.contact = { gx: inp.x, gy: inp.y, ex: inp.x, ey: inp.y, lx: inp.x, ly: inp.y, dx: 1, dy: 0, dist: 0, phase: 'loading', mode: null, kinds: null, op: null, peakTheta: 0, peakDelta: 0, startMs: this.timeMs, region, interior, dragDist: 0, lastDragMs: this.timeMs, lastDragLogged: 0 };
    this.totals.contactEpisodes++;
    if (interior) this.totals.interiorContacts++;
    this.emit('contact_start', { region, distance: h.dist, speed: Math.hypot(inp.vx, inp.vy), metadata: { x: +inp.x.toFixed(3), y: +inp.y.toFixed(3), interior, depthFromEdge: +Math.max(0, -h.dist).toFixed(3) } });
    if (this.regionContacts[region] > 0) { this.totals.revisits++; this.emit('region_revisit', { region, metadata: { previousContacts: this.regionContacts[region] } }); }
    this.regionContacts[region]++;
  }

  trackContact() {
    const c = this.contact, inp = this.input, t = this.totals;
    const moved = Math.hypot(inp.x - c.lx, inp.y - c.ly);
    c.lx = inp.x; c.ly = inp.y; c.dragDist += moved; t.dragDistance += moved; t.contactMs += STEP * 1000;
    if (this.timeMs - c.lastDragMs >= 400 && c.dragDist - c.lastDragLogged > 0.01) {
      this.emit('drag', { region: c.region, distance: c.dragDist, speed: Math.hypot(inp.vx, inp.vy), metadata: { phase: c.phase, foldAngle: +((this.theta * 180) / Math.PI).toFixed(1) } });
      c.lastDragMs = this.timeMs; c.lastDragLogged = c.dragDist;
    }
  }

  endContact() {
    const c = this.contact, d = this.derived();
    const peakDeg = (c.peakTheta * 180) / Math.PI;
    this.totals.peakFoldAngle = Math.max(this.totals.peakFoldAngle, peakDeg);
    this.emit('contact_end', {
      region: c.region, durationMs: this.timeMs - c.startMs, distance: c.dragDist,
      metadata: {
        interior: c.interior,
        outcome: c.phase === 'folding' ? c.mode : c.phase === 'resist' ? 'resisted' : 'no_yield',
        peakFoldAngle: +peakDeg.toFixed(1),           // degrees (180 = folded flat over)
        foldDistance: +c.peakDelta.toFixed(4),        // peak drag distance while folding (object units)
      },
    });
    if (c.phase === 'folding') {
      const target = Math.min(MAX_RESIDUAL, c.peakTheta * d.residual);
      this.spring = { op: c.op, target, peakTheta: c.peakTheta, startMs: this.timeMs, kinds: c.kinds, mode: c.mode };
    }
    this.contact = null;
    this.preview = null;
  }

  /** Bake the residual fold into the sheet (permanent). */
  finishSpring(completed) {
    const s = this.spring;
    this.theta = s.target;
    this.facets = this.applyOp(this.facets, s.op, s.target);
    // normalise layers
    const order = [...this.facets].sort((p, q) => p.layer - q.layer);
    order.forEach((f, i) => { f.layer = i; });
    this.facets = order;
    this.view = this.facets;
    for (const id of s.kinds) {
      if (!id) continue;
      const cr = this.creases[id - 1];
      cr.peakAngle = (s.peakTheta * 180) / Math.PI; cr.residualAngle = (s.target * 180) / Math.PI;
      cr.strength = clamp(s.peakTheta / Math.PI, 0.2, 1);
      cr.length = this.creaseLength(id);
      if (cr.length > 0) { this.totals.creases++; this.totals.creaseLength += cr.length; }
    }
    this.totals.springbacks++;
    this.metrics = this.measure();
    this.emit('recovery', {
      durationMs: this.timeMs - s.startMs,
      metadata: {
        kind: 'springback', completed, mode: s.mode,
        peakFoldAngle: +((s.peakTheta * 180) / Math.PI).toFixed(1),
        residualAngle: +((s.target * 180) / Math.PI).toFixed(1),     // degrees that stay bent (permanent)
        creases: this.totals.creases, facets: this.facets.length,
        projectedArea: this.metrics.projectedArea, meanTilt: this.metrics.meanTilt,
      },
    });
    this.spring = null;
    this.theta = 0;
  }

  /** Length (rest units) of crease `id` in the committed sheet. */
  creaseLength(id) {
    let L = 0;
    for (const f of this.facets) for (let i = 0, n = f.x.length; i < n; i++) if (f.k[i] === id) { const j = (i + 1) % n; L += Math.hypot(f.x[j] - f.x[i], f.y[j] - f.y[i]); }
    return L / 2;                                         // each crease edge borders two facets
  }

  /** Deformation metrics of the committed sheet. */
  measure() {
    let proj = 0, tilt = 0, rest = 0, maxLayer = 0;
    for (const f of this.facets) {
      const ra = Math.abs(polyArea(f.x, f.y));
      rest += ra; proj += ra * Math.abs(f.M[0] * f.M[3] - f.M[1] * f.M[2]);
      tilt += ra * Math.acos(clamp(Math.abs(f.N[2]), 0, 1));
      maxLayer = Math.max(maxLayer, f.layer);
    }
    this.areaNow = proj;
    return {
      projectedArea: +(proj / this.restArea).toFixed(4),            // 1 = flat; < 1 where bends stay tilted
      meanTilt: +(((tilt / (rest || 1)) * 180) / Math.PI).toFixed(2),  // degrees, area-weighted
      facets: this.facets.length,
      layers: maxLayer + 1,
    };
  }

  get folding() { return this.contact?.phase === 'folding'; }
  get settled() { return !this.contact && !this.spring; }

  signals() {
    return { tension: clamp(Math.max(this.stress, this.folding ? this.theta / Math.PI : 0), 0, 1), motion: clamp(this.dTheta * 6, 0, 1), sweep: 0, kinetic: clamp(this.dTheta * 6, 0, 1) };
  }
}
