// Per-node behavioural memory in [0, 1].
//
//   memory_i += intensity_i * learningRate * dt      (only when memory enabled)
//   memory_i *= exp(-decayRate * dt)
//   + light diffusion to neighbours (spatial falloff beyond the contact gaussian)
//
// Memory also keeps a signed "residual" of the radial deformation experienced
// under contact. The visible residual (plastic offset) = residual × memory ×
// plasticity, so it fades as memory decays. Nothing here is permanent.

const DIFFUSION = 0.6;      // nodes² per second
const MAX_PLASTIC = 0.06;   // object units

export class MemorySystem {
  constructor(n, regionCount, regionOf) {
    this.n = n;
    this.regionCount = regionCount;
    this.regionOf = regionOf;
    this.level = new Float32Array(n);
    this.residual = new Float32Array(n);
    this.tmp = new Float32Array(n);
  }

  reset() { this.level.fill(0); this.residual.fill(0); }

  update(intensity, radialDisp, contactW, p, dt) {
    const { n, level, residual, tmp } = this;
    const decay = Math.exp(-p.decayRate * dt);
    const gain = p.memoryEnabled ? p.learningRate * dt : 0;
    for (let i = 0; i < n; i++) {
      tmp[i] = Math.min(1, (level[i] + intensity[i] * gain) * decay);
      if (contactW && contactW[i] > 0.05) {
        residual[i] += (radialDisp[i] - residual[i]) * Math.min(1, contactW[i] * 3 * dt);
      }
    }
    const D = DIFFUSION * dt;
    for (let i = 0; i < n; i++) {
      const im = i === 0 ? n - 1 : i - 1, ip = i === n - 1 ? 0 : i + 1;
      level[i] = tmp[i] + D * (tmp[im] + tmp[ip] - 2 * tmp[i]);
    }
  }

  plasticOffset(i, p) {
    if (!p.memoryEnabled) return 0;
    const v = this.residual[i] * this.level[i] * p.plasticity;
    return v > MAX_PLASTIC ? MAX_PLASTIC : v < -MAX_PLASTIC ? -MAX_PLASTIC : v;
  }

  regionLevel(r) {
    let s = 0, c = 0;
    for (let i = 0; i < this.n; i++) if (this.regionOf[i] === r) { s += this.level[i]; c++; }
    return c ? s / c : 0;
  }

  max() { let m = 0; for (const v of this.level) if (v > m) m = v; return m; }
  mean() { let s = 0; for (const v of this.level) s += v; return s / this.n; }
}
