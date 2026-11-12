// Filament network: a seeded, stable set of anchors and edges defined in
// MATERIAL coordinates (u = angle fraction around the body, s = radius
// fraction, z = depth). Anchors never regenerate during a session; each frame
// they are mapped through the soft body's current deformation, so the
// structure deforms with the material rather than floating over it.
//
// Pure module (no DOM): positions and per-edge state are testable headlessly.

import { mulberry32, clamp } from '../util/math.js';

const TAU = Math.PI * 2;
const LAG_RATE_OUTER = 10, LAG_RATE_INNER = 2.5; // 1/s — inner structure trails the rim

export class FilamentNetwork {
  constructor(n) {
    this.n = n;
    this.lagX = new Float32Array(n); this.lagY = new Float32Array(n);   // slow field (deep/inner)
    this.midX = new Float32Array(n); this.midY = new Float32Array(n);   // medium field
    this.parX = 0; this.parY = 0;                                       // eased parallax
  }

  /** Build the network for a seed. Deterministic. */
  build(seed, baseRest) {
    const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    const A = { u: [], s: [], z: [], kind: [] };
    const add = (u, s, z, kind) => { A.u.push(((u % 1) + 1) % 1); A.s.push(s); A.z.push(z); A.kind.push(kind); return A.u.length - 1; };
    const chains = [];

    // 1. rim shell: dense, fibrous, slightly irregular band near the surface
    const RIM = 120;
    for (let i = 0; i < RIM; i++) add((i + rng() * 0.6) / RIM, 0.9 + rng() * 0.09, rng() * 2 - 1, 0);

    // 2. strands: long flowing fibres — chords that bow through the interior
    //    and arcs that wrap partway around. They give the woven, silk-like grain.
    const STRANDS = 30;
    for (let f = 0; f < STRANDS; f++) {
      const z = rng() * 2 - 1, chain = [];
      const len = 7 + Math.floor(rng() * 6), ph = rng() * TAU;
      if (rng() < 0.6) {
        const a0 = rng() * TAU, a1 = a0 + Math.PI * (0.45 + rng() * 0.9) * (rng() < 0.5 ? -1 : 1);
        const r0 = 0.82 + rng() * 0.14, r1 = 0.82 + rng() * 0.14;
        const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0, x1 = Math.cos(a1) * r1, y1 = Math.sin(a1) * r1;
        const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
        const bend = (rng() - 0.5) * 0.7;
        for (let k = 0; k < len; k++) {
          const t = k / (len - 1), off = bend * Math.sin(Math.PI * t) + 0.012 * Math.sin(t * 7 + ph);
          const x = x0 + (x1 - x0) * t + nx * off, y = y0 + (y1 - y0) * t + ny * off;
          chain.push(add(Math.atan2(y, x) / TAU, clamp(Math.hypot(x, y), 0.05, 0.98), clamp(z + (rng() - 0.5) * 0.15, -1, 1), 1));
        }
      } else {
        const s0 = 0.3 + rng() * 0.62, u0 = rng(), du = (0.12 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1);
        for (let k = 0; k < len; k++) {
          const t = k / (len - 1);
          chain.push(add(u0 + du * t, clamp(s0 + 0.07 * Math.sin(t * Math.PI * 2 + ph), 0.08, 0.98), clamp(z + (rng() - 0.5) * 0.15, -1, 1), 1));
        }
      }
      chains.push(chain);
    }

    // 3. clusters: localised dense knots of structure
    const CL = 7 + Math.floor(rng() * 3);
    for (let c = 0; c < CL; c++) {
      const cu = rng(), cs = 0.25 + rng() * 0.6, z = rng() * 2 - 1;
      const cnt = 8 + Math.floor(rng() * 8), spread = 0.08 + rng() * 0.1;
      for (let k = 0; k < cnt; k++) {
        const a = cu * TAU, x = Math.cos(a) * cs + (rng() - 0.5) * 2 * spread, y = Math.sin(a) * cs + (rng() - 0.5) * 2 * spread;
        add(Math.atan2(y, x) / TAU, clamp(Math.hypot(x, y), 0.08, 0.98), clamp(z + (rng() - 0.5) * 0.5, -1, 1), 2);
      }
    }

    // 4. sparse interior
    for (let i = 0; i < 34; i++) add(rng(), Math.sqrt(rng()) * 0.85, rng() * 2 - 1, 3);

    const N = A.u.length;
    this.count = N;
    this.u = Float32Array.from(A.u); this.s = Float32Array.from(A.s); this.z = Float32Array.from(A.z);
    this.kind = Uint8Array.from(A.kind);
    this.cosA = new Float32Array(N); this.sinA = new Float32Array(N);
    this.i0 = new Uint16Array(N); this.fr = new Float32Array(N);
    this.restX = new Float32Array(N); this.restY = new Float32Array(N);
    this.x = new Float32Array(N); this.y = new Float32Array(N);
    this.mem = new Float32Array(N); this.exc = new Float32Array(N);
    this.respX = new Float32Array(N); this.respY = new Float32Array(N); this.resp = new Float32Array(N); // system 1 offsets / glow
    this.vibPhase = new Float32Array(N); this.vibDirX = new Float32Array(N); this.vibDirY = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = this.u[i] * TAU;
      this.cosA[i] = Math.cos(a); this.sinA[i] = Math.sin(a);
      const f = this.u[i] * this.n;
      this.i0[i] = Math.floor(f) % this.n; this.fr[i] = f - Math.floor(f);
      const j = (this.i0[i] + 1) % this.n, r = baseRest[this.i0[i]] * (1 - this.fr[i]) + baseRest[j] * this.fr[i];
      this.restX[i] = this.cosA[i] * r * this.s[i]; this.restY[i] = this.sinA[i] * r * this.s[i];
      this.vibPhase[i] = rng() * TAU;
      const va = rng() * TAU; this.vibDirX[i] = Math.cos(va); this.vibDirY[i] = Math.sin(va);
    }

    // ---- edges ----
    const E = { a: [], b: [], dormant: [], strand: [], prev: [], next: [] };
    const seen = new Set();
    const link = (a, b, dormant = -1, strand = 0, prev = -1, next = -1) => {
      if (a === b) return;
      const key = a < b ? a * 4096 + b : b * 4096 + a;
      if (seen.has(key)) return;
      seen.add(key); E.a.push(a); E.b.push(b); E.dormant.push(dormant); E.strand.push(strand); E.prev.push(prev); E.next.push(next);
    };
    const d2 = (a, b) => (this.restX[a] - this.restX[b]) ** 2 + (this.restY[a] - this.restY[b]) ** 2;

    // rim: circumferential fibres to the next 1–3 rim anchors
    for (let i = 0; i < RIM; i++) {
      link(i, (i + 1) % RIM);
      if (rng() < 0.55) link(i, (i + 2) % RIM);
      if (rng() < 0.2) link(i, (i + 3 + Math.floor(rng() * 3)) % RIM);
    }
    // strand segments know their neighbours so they can be drawn as one smooth curve
    for (const ch of chains) for (let k = 1; k < ch.length; k++) link(ch[k - 1], ch[k], -1, 1, k > 1 ? ch[k - 2] : -1, k < ch.length - 1 ? ch[k + 1] : -1);

    // nearest-neighbour bridges (denser inside clusters)
    const order = Array.from({ length: N }, (_, i) => i);
    for (let i = 0; i < N; i++) {
      order.sort((p, q) => d2(i, p) - d2(i, q));
      const k = this.kind[i] === 2 ? 3 : this.kind[i] === 0 ? 1 : this.kind[i] === 1 ? (rng() < 0.25 ? 1 : 0) : 2;
      let made = 0;
      for (let m = 1; m < order.length && made < k; m++) {
        const j = order[m];
        if (d2(i, j) > 0.34 * 0.34) break;
        if (rng() < 0.7) { link(i, j); made++; }
      }
      // dormant short fibres: only appear in regions with accumulated memory
      if (this.s[i] > 0.6 && (this.kind[i] === 0 || this.kind[i] === 2)) {
        for (let r = 0; r < 2; r++) {
          const j = order[2 + Math.floor(rng() * 6)];
          if (j !== undefined && d2(i, j) < 0.3 * 0.3) link(i, j, 0.12 + rng() * 0.5);
        }
      }
    }
    // a few long cross strands
    for (let c = 0; c < 14; c++) {
      const a = Math.floor(rng() * N), b = Math.floor(rng() * N);
      const dd = Math.sqrt(d2(a, b));
      if (dd > 0.5 && dd < 1.5) link(a, b);
    }

    const M = E.a.length;
    this.edgeCount = M;
    this.ea = Uint16Array.from(E.a); this.eb = Uint16Array.from(E.b);
    this.dormant = Float32Array.from(E.dormant);
    this.eprev = Int16Array.from(E.prev); this.enext = Int16Array.from(E.next);
    this.restLen = new Float32Array(M); this.slack = new Float32Array(M);
    this.rank = new Float32Array(M); this.depth = new Float32Array(M);
    this.strain = new Float32Array(M); this.edgeMem = new Float32Array(M);
    for (let e = 0; e < M; e++) {
      this.restLen[e] = Math.max(1e-3, Math.sqrt(d2(this.ea[e], this.eb[e])));
      // curvature follows a smooth flow field (coherent bowing), strands stay nearly straight
      const a = this.ea[e], c = this.eb[e];
      const mx = (this.restX[a] + this.restX[c]) / 2, my = (this.restY[a] + this.restY[c]) / 2;
      const field = Math.sin(Math.atan2(my, mx) * 3 + Math.hypot(mx, my) * 4 + seed % 7);
      this.slack[e] = E.strand[e] ? 0.012 * Math.sign(field || 1) : (0.03 + rng() * 0.07) * Math.sign(field || 1);
      this.rank[e] = rng(); // stable order for density control
      this.depth[e] = (this.z[this.ea[e]] + this.z[this.eb[e]]) / 2;
    }
    this.degree = new Uint8Array(N);
    for (let e = 0; e < M; e++) if (this.dormant[e] < 0) { this.degree[this.ea[e]]++; this.degree[this.eb[e]]++; }
    this.lagX.fill(0); this.lagY.fill(0); this.midX.fill(0); this.midY.fill(0);
    this.parX = this.parY = 0;
    return this;
  }

  /**
   * Map anchors through the body's current state.
   * opts: { dt, t, parallaxX, parallaxY, vibration (0..1 scale), reducedMotion }
   */
  update(sim, opts) {
    const b = sim.body, n = this.n, mem = sim.memory.level, exc = sim.excite;
    const aOuter = 1 - Math.exp(-LAG_RATE_OUTER * opts.dt), aInner = 1 - Math.exp(-LAG_RATE_INNER * opts.dt);
    for (let i = 0; i < n; i++) {
      this.midX[i] += (b.dx[i] - this.midX[i]) * aOuter; this.midY[i] += (b.dy[i] - this.midY[i]) * aOuter;
      this.lagX[i] += (b.dx[i] - this.lagX[i]) * aInner; this.lagY[i] += (b.dy[i] - this.lagY[i]) * aInner;
    }
    const pa = 1 - Math.exp(-3 * opts.dt);
    this.parX += ((opts.parallaxX || 0) - this.parX) * pa;
    this.parY += ((opts.parallaxY || 0) - this.parY) * pa;
    const vib = opts.reducedMotion ? 0 : (opts.vibration ?? 1);
    const t = opts.t;
    const im = sim.immediate, P = sim.params, R = P.interactionRadius;
    const aResp = 1 - Math.exp(-P.responseRate * opts.dt);
    for (let k = 0; k < this.count; k++) {
      const i = this.i0[k], j = i === n - 1 ? 0 : i + 1, f = this.fr[k], g = 1 - f, s = this.s[k], z = this.z[k];
      const r = b.restRadius(i) * g + b.restRadius(j) * f;
      // depth-weighted blend: rim follows the live surface, deep/inner points trail
      const live = clamp(s * s * (1.15 - 0.3 * (z + 1) / 2), 0, 1);
      const curX = b.dx[i] * g + b.dx[j] * f, curY = b.dy[i] * g + b.dy[j] * f;
      const midX = this.midX[i] * g + this.midX[j] * f, midY = this.midY[i] * g + this.midY[j] * f;
      const lagX = this.lagX[i] * g + this.lagX[j] * f, lagY = this.lagY[i] * g + this.lagY[j] * f;
      const w1 = live, w2 = (1 - live) * 0.6, w3 = 1 - w1 - w2;
      const ds = Math.pow(s, 0.7);
      let x = this.cosA[k] * r * s + (curX * w1 + midX * w2 + lagX * w3) * ds;
      let y = this.sinA[k] * r * s + (curY * w1 + midY * w2 + lagY * w3) * ds;
      // sweep excitation → brief fine vibration (decays with the simulation field)
      const e = exc[i] * g + exc[j] * f;
      this.exc[k] = e;
      if (e > 0.01 && vib > 0) {
        const amp = e * 0.022 * vib * (0.4 + 0.6 * s) * Math.sin(t * 38 + this.vibPhase[k]);
        x += this.vibDirX[k] * amp; y += this.vibDirY[k] * amp;
      }
      // system 1 — immediate response: local, smoothed offset + glow near the pointer
      {
        const dx = x - im.x, dy = y - im.y, d = Math.hypot(dx, dy);
        let u = 1 - d / R, tx = 0, ty = 0, glow = 0;
        if (u > 0 && (im.level > 0.002 || im.dwell > 0.002)) {
          u = u * u * (3 - 2 * u);
          if (d > 1e-4) {
            const push = P.proximityResponse * im.level * (1 - im.dwell) * u;   // hover: ease away
            const pull = Math.min(d * 0.5, P.dwellAttraction * im.dwell * u);   // dwell: draw in
            tx = (dx / d) * (push - pull); ty = (dy / d) * (push - pull);
          }
          if (vib > 0 && im.dwell > 0.01) {                                    // dwell: fine activity
            const sh = P.dwellActivity * im.dwell * u * Math.sin(t * 9 + this.vibPhase[k]);
            tx += this.vibDirX[k] * sh; ty += this.vibDirY[k] * sh;
          }
          glow = u * (P.proximityGlow * im.level + P.dwellGlow * im.dwell);
        }
        this.respX[k] += (tx - this.respX[k]) * aResp;
        this.respY[k] += (ty - this.respY[k]) * aResp;
        this.resp[k] += (glow - this.resp[k]) * aResp;
        x += this.respX[k]; y += this.respY[k];
      }
      // subtle depth parallax
      x += this.parX * z; y += this.parY * z;
      this.x[k] = x; this.y[k] = y;
      this.mem[k] = (mem[i] * g + mem[j] * f) * clamp((s - 0.25) / 0.6, 0, 1);
    }
    for (let e = 0; e < this.edgeCount; e++) {
      const a = this.ea[e], c = this.eb[e];
      const L = Math.hypot(this.x[a] - this.x[c], this.y[a] - this.y[c]);
      this.strain[e] = L / this.restLen[e] - 1;
      this.edgeMem[e] = (this.mem[a] + this.mem[c]) / 2;
    }
  }
}
