// Lightweight 2D soft body: a ring of perimeter nodes, each displaced from a
// rest shape. Forces are expressed per fixed step (see config.STEP).
//
//   a_i = -k_i * d_i                       spring to rest shape
//       + tension * (d_{i-1} + d_{i+1} - 2 d_i)   neighbour coupling
//       - volume * mean(radial d) * n_i        area preservation
//       + f_i                                  external (pointer) forces
//   v_i = (v_i + a_i) * damping;  d_i += v_i   (semi-implicit Euler)
//
// Displacement is clamped to maxDisplacement to keep motion bounded.

const TAU = Math.PI * 2;

export class SoftBody {
  constructor(n) {
    this.n = n;
    this.cos = new Float32Array(n);
    this.sin = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.cos[i] = Math.cos(a);
      this.sin[i] = Math.sin(a);
    }
    this.baseRest = new Float32Array(n); // seeded irregular rest radius
    this.plastic = new Float32Array(n);  // residual offset (from memory)
    this.ambient = new Float32Array(n);  // slow material fluctuation
    this.dx = new Float32Array(n);
    this.dy = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.fx = new Float32Array(n);
    this.fy = new Float32Array(n);
    this.ambientPhase = new Float32Array(3);
    this.energy = 0;
  }

  /** Build the seeded rest shape and clear all motion. */
  init(rng) {
    const amps = [0.015 + rng() * 0.02, 0.01 + rng() * 0.02, 0.006 + rng() * 0.012];
    const phases = [rng() * TAU, rng() * TAU, rng() * TAU];
    for (let i = 0; i < this.n; i++) {
      const a = (i / this.n) * TAU;
      this.baseRest[i] = 1 + amps[0] * Math.cos(2 * a + phases[0])
        + amps[1] * Math.cos(3 * a + phases[1]) + amps[2] * Math.cos(5 * a + phases[2]);
    }
    for (let k = 0; k < 3; k++) this.ambientPhase[k] = rng() * TAU;
    this.dx.fill(0); this.dy.fill(0); this.vx.fill(0); this.vy.fill(0);
    this.plastic.fill(0); this.ambient.fill(0); this.clearForces();
    this.energy = 0;
  }

  /** Low-frequency, non-rhythmic fluctuation (angular harmonics ≥ 2, so no global "breathing"). */
  updateAmbient(amplitude, t) {
    const p = this.ambientPhase;
    for (let i = 0; i < this.n; i++) {
      const a = (i / this.n) * TAU;
      this.ambient[i] = amplitude * (
        0.5 * Math.sin(2 * a + t * 0.11 + p[0])
        + 0.35 * Math.sin(3 * a - t * 0.073 + p[1])
        + 0.15 * Math.sin(5 * a + t * 0.047 + p[2]));
    }
  }

  restRadius(i) { return this.baseRest[i] + this.plastic[i] + this.ambient[i]; }
  x(i) { return this.cos[i] * this.restRadius(i) + this.dx[i]; }
  y(i) { return this.sin[i] * this.restRadius(i) + this.dy[i]; }
  radiusAt(i) { return Math.hypot(this.x(i), this.y(i)); }
  radialDisp(i) { return this.dx[i] * this.cos[i] + this.dy[i] * this.sin[i]; }

  /** Boundary radius at an arbitrary angle, interpolated between nodes. */
  boundaryAtAngle(theta) {
    let u = (theta / TAU) * this.n;
    u = ((u % this.n) + this.n) % this.n;
    const i0 = Math.floor(u) % this.n, i1 = (i0 + 1) % this.n, f = u - Math.floor(u);
    return this.radiusAt(i0) * (1 - f) + this.radiusAt(i1) * f;
  }

  clearForces() { this.fx.fill(0); this.fy.fill(0); }

  /** One fixed step. stiffness: Float32Array of per-node k. */
  integrate(stiffness, p) {
    const { n, dx, dy, vx, vy, fx, fy, cos, sin } = this;
    let meanRadial = 0;
    for (let i = 0; i < n; i++) meanRadial += dx[i] * cos[i] + dy[i] * sin[i];
    meanRadial /= n;
    const vol = -p.volume * meanRadial;

    // velocities first (Jacobi), using old displacements everywhere
    for (let i = 0; i < n; i++) {
      const im = i === 0 ? n - 1 : i - 1, ip = i === n - 1 ? 0 : i + 1;
      const k = stiffness[i];
      const ax = -k * dx[i] + p.tension * (dx[im] + dx[ip] - 2 * dx[i]) + vol * cos[i] + fx[i];
      const ay = -k * dy[i] + p.tension * (dy[im] + dy[ip] - 2 * dy[i]) + vol * sin[i] + fy[i];
      vx[i] = (vx[i] + ax) * p.damping;
      vy[i] = (vy[i] + ay) * p.damping;
    }
    let e = 0;
    const maxD = p.maxDisplacement;
    for (let i = 0; i < n; i++) {
      dx[i] += vx[i];
      dy[i] += vy[i];
      const m = Math.hypot(dx[i], dy[i]);
      if (m > maxD) {
        const s = maxD / m;
        dx[i] *= s; dy[i] *= s;
        vx[i] *= 0.5; vy[i] *= 0.5;
      }
      e += vx[i] * vx[i] + vy[i] * vy[i];
    }
    this.energy = e / n;
  }
}
