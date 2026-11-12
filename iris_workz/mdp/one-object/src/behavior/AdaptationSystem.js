// Turns accumulated memory into changed behaviour.
//
// Per node:
//   target_i  = smoothstep(T − H, T + 0.1, memory_i)        (0 when adaptive off)
//   level_i   eases toward target_i with time constant tau  (no sudden switch)
//   sensitivity_i = 1 − strength × (0.3·memory_i + 0.7·level_i)
//   stiffness multiplier = 1 + adaptStiffen × level_i
//
// Per region (for logging) a hysteresis flag: enters at mean memory ≥ T,
// exits when it falls below T − H.

import { smoothstep } from '../util/math.js';

const MIN_SENSITIVITY = 0.08;

export class AdaptationSystem {
  constructor(n, regionCount) {
    this.n = n;
    this.regionCount = regionCount;
    this.level = new Float32Array(n);
    this.sensitivity = new Float32Array(n).fill(1);
    this.stiffMul = new Float32Array(n).fill(1);
    this.regionFlag = new Uint8Array(regionCount);
  }

  reset() {
    this.level.fill(0);
    this.sensitivity.fill(1);
    this.stiffMul.fill(1);
    this.regionFlag.fill(0);
  }

  update(memory, p, dt, onEnter, onExit) {
    const T = p.adaptationThreshold, H = p.adaptationHysteresis;
    const ease = 1 - Math.exp(-dt / p.adaptationTau);
    for (let i = 0; i < this.n; i++) {
      const m = memory.level[i];
      const target = p.adaptiveEnabled ? smoothstep(T - H, T + 0.1, m) : 0;
      this.level[i] += (target - this.level[i]) * ease;
      const s = p.adaptiveEnabled
        ? 1 - p.adaptationStrength * (0.3 * m + 0.7 * this.level[i])
        : 1;
      this.sensitivity[i] = s < MIN_SENSITIVITY ? MIN_SENSITIVITY : s;
      this.stiffMul[i] = 1 + p.adaptStiffen * this.level[i];
    }
    for (let r = 0; r < this.regionCount; r++) {
      const rm = memory.regionLevel(r);
      if (!this.regionFlag[r] && p.adaptiveEnabled && rm >= T) {
        this.regionFlag[r] = 1;
        onEnter?.(r, rm);
      } else if (this.regionFlag[r] && (rm < T - H || !p.adaptiveEnabled)) {
        this.regionFlag[r] = 0;
        onExit?.(r, rm);
      }
    }
  }

  max() { let m = 0; for (const v of this.level) if (v > m) m = v; return m; }
  adaptedRegions() { let c = 0; for (const f of this.regionFlag) c += f; return c; }
}
