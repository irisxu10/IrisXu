// SYSTEM 1 — IMMEDIATE RESPONSE: temporary reactions to current input.
// Pure state (no DOM). The renderer turns it into local line offsets and
// brightness; nothing here writes to behavioural memory.
//
//   x, y     smoothed pointer position (object units) — avoids abrupt jumps
//   level    0..1  hovering near / over the sphere (eased by responseRate)
//   dwell    0..1  pointer has stayed within dwellRadius for ≥ dwellDelay s
//                  (eases in over dwellRamp, fades over dwellRelease)
import { approach, smoothstep } from '../util/math.js';

export class ImmediateResponse {
  constructor() { this.reset(); }

  reset() {
    this.x = 0; this.y = 0; this.hasPos = false;
    this.level = 0; this.dwell = 0;
    this.anchorX = 0; this.anchorY = 0; this.dwellMs = 0;
    this.dwellActive = false; this.dwellStartMs = 0; this.dwellX = 0; this.dwellY = 0;
  }

  /** near: pointer within interactionRadius of the surface (or inside). */
  update(inp, near, grabbing, p, dt, nowMs, onDwellEnd) {
    const active = inp.present && !inp.down && !grabbing && near;
    if (inp.present) {
      if (!this.hasPos) { this.x = inp.x; this.y = inp.y; this.hasPos = true; }
      const a = approach(14, dt);
      this.x += (inp.x - this.x) * a; this.y += (inp.y - this.y) * a;
    }
    this.level += ((active ? 1 : 0) - this.level) * approach(p.responseRate, dt);

    // dwell: time spent within dwellRadius of where the pointer settled
    if (active && Math.hypot(inp.x - this.anchorX, inp.y - this.anchorY) <= p.dwellRadius) this.dwellMs += dt * 1000;
    else { this.anchorX = inp.x; this.anchorY = inp.y; this.dwellMs = 0; }
    const t0 = p.dwellDelay * 1000, target = active ? smoothstep(t0, t0 + p.dwellRamp * 1000, this.dwellMs) : 0;
    const rate = target > this.dwell ? 3 : 1 / Math.max(0.05, p.dwellRelease);
    this.dwell += (target - this.dwell) * approach(rate, dt);

    // dwell episodes (hysteresis) for logging
    if (!this.dwellActive && this.dwell > 0.5) {
      this.dwellActive = true; this.dwellStartMs = nowMs; this.dwellX = this.anchorX; this.dwellY = this.anchorY;
    } else if (this.dwellActive && this.dwell < 0.2) {
      this.dwellActive = false;
      onDwellEnd?.(nowMs - this.dwellStartMs, this.dwellX, this.dwellY);
    }
  }
}
