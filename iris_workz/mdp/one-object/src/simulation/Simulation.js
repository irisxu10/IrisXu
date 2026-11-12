// The behavioural core. Pure JavaScript, no DOM: it can run headlessly in
// tests with scripted input. Call setInput() whenever the pointer changes and
// step() once per fixed timestep.

import { STEP, NODE_COUNT, REGION_COUNT, DEFAULT_SEED, DEFAULT_PARAMS, } from '../config.js';
import { mulberry32, clamp, approach } from '../util/math.js';
import { SoftBody } from '../physics/SoftBody.js';
import { MemorySystem } from '../behavior/MemorySystem.js';
import { AdaptationSystem } from '../behavior/AdaptationSystem.js';
import { ImmediateResponse } from '../behavior/ImmediateResponse.js';

const TAU = Math.PI * 2;
const DRAG_LOG_INTERVAL_MS = 400;
const APPROACH_ON = 0.35, APPROACH_OFF = 0.1, APPROACH_MIN_GAP_MS = 1500;
const STILL_SPEED = 0.15, STILL_MIN_MS = 3000;
const MAX_FORCE_SPEED = 3;     // object units / s; pointer speed beyond this adds no extra force
const SWEEP_OVER = 0.08;        // pointer must be within this of the edge (or inside)
const SWEEP_WIDTH = 0.35;       // angular width (rad) of a sweep's footprint
const SWEEP_END_MS = 150;       // gap that ends a sweep episode
const EXCITE_DECAY = 2.2;       // 1/s
const EXCITE_DIFFUSION = 6;     // nodes² / s (lets the excitation travel)

export class Simulation {
  constructor({ params = {}, seed = DEFAULT_SEED, logger = null, reducedMotion = false } = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.logger = logger;
    this.reducedMotion = reducedMotion;
    const n = (this.n = NODE_COUNT);
    this.regionCount = REGION_COUNT;
    this.regionOf = new Uint8Array(n);
    // regions are centred on their angle: region r covers r·30° ± 15°
    for (let i = 0; i < n; i++) this.regionOf[i] = Math.floor(((i + n / (2 * REGION_COUNT)) % n) * REGION_COUNT / n);
    this.body = new SoftBody(n);
    this.memory = new MemorySystem(n, REGION_COUNT, this.regionOf);
    this.adapt = new AdaptationSystem(n, REGION_COUNT);
    this.immediate = new ImmediateResponse();   // system 1: temporary input response
    this.contactW = new Float32Array(n);
    this.intensity = new Float32Array(n);
    this.radial = new Float32Array(n);
    this.k = new Float32Array(n);
    this.excite = new Float32Array(n);   // sweep excitation (drives fine vibration)
    this.exciteTmp = new Float32Array(n);
    this.hooks = {};                     // optional: { contact(strength), release(tension) }
    this.signals = { tension: 0, motion: 0, sweep: 0, kinetic: 0 };
    this.input = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false };
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this.body.init(mulberry32(this.seed));
    this.memory.reset();
    this.adapt.reset();
    this.immediate.reset();
    this.contactW.fill(0);
    this.intensity.fill(0);
    this.excite.fill(0);
    this.sweep = null;
    this.sweepActive = false;
    this.signals.tension = this.signals.motion = this.signals.sweep = this.signals.kinetic = 0;
    this.timeMs = 0;
    this.proximity = 0;
    this.boundaryDistance = Infinity;
    this.speed = 0;
    this.grab = null;
    this.wasDown = false;
    this.lastX = this.input.x; this.lastY = this.input.y;
    this.approachArmed = true;
    this.lastApproachMs = -Infinity;
    this.stillMs = 0;
    this.lastContactEndMs = -Infinity;
    this.regionContacts = new Uint16Array(REGION_COUNT);
    this.totals = {
      contactMs: 0, interactionMs: 0, contactEpisodes: 0, dragDistance: 0,
      revisits: 0, adaptationEvents: 0, regionReleases: 0, stillnessPeriods: 0,
      sweeps: 0, sweepMs: 0, dwells: 0, dwellMs: 0,
    };
  }

  setInput(inp) { Object.assign(this.input, inp); }

  log(type, fields) { this.logger?.log(type, this.timeMs, fields); }

  step() {
    const p = this.params, dt = STEP, b = this.body, n = this.n, inp = this.input;
    const sens = this.adapt.sensitivity;
    this.timeMs += dt * 1000;

    // rest shape: seeded base + memory residual + ambient fluctuation
    b.updateAmbient(this.reducedMotion ? 0 : p.ambientAmplitude, this.timeMs / 1000);
    for (let i = 0; i < n; i++) b.plastic[i] = this.memory.plasticOffset(i, p);

    // pointer kinematics + proximity (continuous falloff, smoothed)
    this.speed = Math.hypot(inp.vx, inp.vy);
    const pr = Math.hypot(inp.x, inp.y);
    const theta = pr > 1e-6 ? Math.atan2(inp.y, inp.x) : 0;
    const rb = b.boundaryAtAngle(theta);
    this.boundaryDistance = inp.present ? pr - rb : Infinity;
    const pRaw = inp.present ? clamp(1 - Math.max(0, this.boundaryDistance) / p.proximityRadius, 0, 1) : 0;
    this.proximity += (pRaw - this.proximity) * approach(8, dt);

    // system 1 — immediate response (proximity + dwell); logged when a dwell ends
    this.immediate.update(inp, this.boundaryDistance < p.interactionRadius, !!this.grab, p, dt, this.timeMs, (dur, x, y) => {
      this.totals.dwells++; this.totals.dwellMs += dur;
      const r = this.regionOf[Math.round(((Math.atan2(y, x) / TAU) * n + n) % n) % n];
      this.log('dwell', { region: r, durationMs: dur, memoryLevel: this.memory.regionLevel(r), metadata: { x: +x.toFixed(3), y: +y.toFixed(3) } });
    });

    // contact edges
    if (inp.down && !this.wasDown) this.tryGrab(theta, rb);
    if (!inp.down && this.grab) this.release();
    this.wasDown = inp.down;

    b.clearForces();
    this.sweepActive = false;
    if (this.grab) this.applyGrip();
    else if (inp.present) { this.applyProximityField(); this.applySweep(theta, pr, rb); }

    for (let i = 0; i < n; i++) this.k[i] = p.stiffness * this.adapt.stiffMul[i];
    b.integrate(this.k, p);

    // memory intensity: contact + strong deformation
    for (let i = 0; i < n; i++) {
      const dmag = Math.hypot(b.dx[i], b.dy[i]);
      this.radial[i] = b.radialDisp(i);
      const deform = clamp(dmag / p.maxDisplacement, 0, 1);
      const contact = this.grab ? this.contactW[i] * (0.35 + 0.65 * Math.min(1, dmag / 0.25)) : 0;
      this.intensity[i] = Math.max(contact, 0.25 * Math.max(0, deform - 0.3), p.sweepMemory * this.excite[i] * (this.sweepActive ? 1 : 0));
    }
    this.updateExcitation(dt);
    this.updateSignals();
    this.memory.update(this.intensity, this.radial, this.grab ? this.contactW : null, p, dt);
    this.adapt.update(this.memory, p, dt,
      (region, m) => { this.totals.adaptationEvents++; this.log('adaptation_threshold', { region, memoryLevel: m }); },
      (region, m) => { this.totals.regionReleases++; this.log('recovery', { region, memoryLevel: m, metadata: { kind: 'region_released' } }); });

    this.track(dt, sens);
  }

  tryGrab(theta, rb) {
    const p = this.params, b = this.body, inp = this.input;
    if (this.boundaryDistance > p.contactMargin) return; // pressed in empty space
    const px = Math.cos(theta) * rb, py = Math.sin(theta) * rb;
    let nearest = Math.round(((theta / TAU) * this.n + this.n) % this.n) % this.n;
    const cr = p.contactRadius * (1 + p.adaptWiden * this.adapt.level[nearest]);
    let wMax = 0;
    for (let i = 0; i < this.n; i++) {
      const d = Math.hypot(b.x(i) - px, b.y(i) - py) / cr;
      const w = Math.exp(-d * d);
      this.contactW[i] = w < 0.01 ? 0 : w;
      if (w > wMax) { wMax = w; nearest = i; }
    }
    const region = this.regionOf[nearest];
    this.grab = { sx: inp.x, sy: inp.y, startMs: this.timeMs, region, dragDist: 0, lastDragLogMs: this.timeMs, lastLoggedDist: 0 };
    this.totals.contactEpisodes++;
    const memoryLevel = this.memory.regionLevel(region);
    this.log('contact_start', {
      region, distance: this.boundaryDistance, speed: this.speed, memoryLevel,
      metadata: { x: +inp.x.toFixed(3), y: +inp.y.toFixed(3) },
    });
    if (this.regionContacts[region] > 0) {
      this.totals.revisits++;
      this.log('region_revisit', { region, memoryLevel, metadata: { previousContacts: this.regionContacts[region] } });
    }
    this.regionContacts[region]++;
    this.hooks.contact?.(Math.min(1, 0.4 + this.speed * 0.15));
  }

  release() {
    const g = this.grab;
    let tension = 0;
    for (let i = 0; i < this.n; i++) if (this.contactW[i] > 0.2) tension = Math.max(tension, Math.hypot(this.body.dx[i], this.body.dy[i]));
    this.hooks.release?.(Math.min(1, tension / this.params.maxDisplacement));
    this.log('contact_end', {
      region: g.region, durationMs: this.timeMs - g.startMs, distance: g.dragDist,
      memoryLevel: this.memory.regionLevel(g.region),
    });
    this.lastContactEndMs = this.timeMs;
    this.contactW.fill(0);
    this.grab = null;
  }

  applyGrip() {
    const p = this.params, b = this.body, inp = this.input, g = this.grab;
    const sens = this.adapt.sensitivity, maxD = p.maxDisplacement;
    const tx = inp.x - g.sx + inp.vx * p.flingGain;
    const ty = inp.y - g.sy + inp.vy * p.flingGain;
    for (let i = 0; i < this.n; i++) {
      const w = this.contactW[i];
      if (!w) continue;
      const gain = w * sens[i] * p.responsiveness;
      let rx = tx * gain - b.cos[i] * p.pressDepth * gain;
      let ry = ty * gain - b.sin[i] * p.pressDepth * gain;
      const m = Math.hypot(rx, ry);
      if (m > 1e-6) { const s = (maxD * Math.tanh(m / maxD)) / m; rx *= s; ry *= s; } // resists as it stretches
      b.fx[i] += p.grip * w * (rx - b.dx[i]);
      b.fy[i] += p.grip * w * (ry - b.dy[i]);
    }
  }

  applyProximityField() {
    const p = this.params, b = this.body, inp = this.input, sens = this.adapt.sensitivity;
    const R = 0.6;
    const push = p.proximityPush + p.proximitySpeedGain * Math.min(this.speed, MAX_FORCE_SPEED);
    const vcap = this.speed > MAX_FORCE_SPEED ? MAX_FORCE_SPEED / this.speed : 1; // saturate very fast flicks
    const wx = inp.vx * vcap * STEP * p.proximityWake, wy = inp.vy * vcap * STEP * p.proximityWake;
    for (let i = 0; i < this.n; i++) {
      const ex = b.x(i) - inp.x, ey = b.y(i) - inp.y;
      const d = Math.hypot(ex, ey);
      let s = 1 - d / R;
      if (s <= 0) continue;
      s = s * s * (3 - 2 * s);
      const g = s * sens[i] * p.responsiveness;
      if (d > 1e-4) { b.fx[i] += (ex / d) * push * g; b.fy[i] += (ey / d) * push * g; }
      b.fx[i] += wx * g; b.fy[i] += wy * g;
    }
  }

  /** Brush / sweep: fast movement over the surface without pressing. */
  applySweep(theta, pr, rb) {
    const p = this.params, b = this.body, inp = this.input, sens = this.adapt.sensitivity;
    if (this.boundaryDistance > SWEEP_OVER || this.speed < p.sweepSpeed) return;
    this.sweepActive = true;
    const strength = clamp((this.speed - p.sweepSpeed) / 3, 0, 1) * 0.7 + 0.3;
    const radial = 0.4 + 0.6 * clamp(pr / Math.max(rb, 1e-3), 0, 1); // stronger near the rim
    const vcap = this.speed > MAX_FORCE_SPEED ? MAX_FORCE_SPEED / this.speed : 1;
    const vtx = inp.vx * vcap * STEP, vty = inp.vy * vcap * STEP;
    for (let i = 0; i < this.n; i++) {
      let da = Math.abs(((i / this.n) * TAU - theta) % TAU);
      if (da > Math.PI) da = TAU - da;
      const q = da / SWEEP_WIDTH;
      const wa = Math.exp(-q * q) * radial;
      if (wa < 0.01) continue;
      const g = wa * sens[i] * p.responsiveness;
      // tangential drag (friction) + brief inward deflection
      const tx = -b.sin[i], ty = b.cos[i];
      const vt = vtx * tx + vty * ty;
      b.fx[i] += tx * vt * p.sweepGain * g - b.cos[i] * p.sweepDent * strength * g;
      b.fy[i] += ty * vt * p.sweepGain * g - b.sin[i] * p.sweepDent * strength * g;
      const e = strength * wa * sens[i];
      if (e > this.excite[i]) this.excite[i] = e;
    }
  }

  updateExcitation(dt) {
    const n = this.n, e = this.excite, tmp = this.exciteTmp;
    const decay = Math.exp(-EXCITE_DECAY * dt), D = EXCITE_DIFFUSION * dt;
    for (let i = 0; i < n; i++) {
      const im = i === 0 ? n - 1 : i - 1, ip = i === n - 1 ? 0 : i + 1;
      tmp[i] = (e[i] + D * (e[im] + e[ip] - 2 * e[i])) * decay;
    }
    e.set(tmp);
  }

  /** Smoothed scalar signals for sound and inspection (0..1). */
  updateSignals() {
    const b = this.body, s = this.signals;
    let maxD = 0, sumE = 0;
    for (let i = 0; i < this.n; i++) { maxD = Math.max(maxD, Math.hypot(b.dx[i], b.dy[i])); sumE += this.excite[i]; }
    const tension = maxD / this.params.maxDisplacement;
    const motion = clamp(Math.sqrt(b.energy) * 120, 0, 1);
    const a = 0.2;
    s.tension += (tension - s.tension) * a;
    s.motion += (motion - s.motion) * a;
    s.sweep += (clamp(sumE / this.n * 6, 0, 1) - s.sweep) * a;
    s.kinetic = motion;
  }

  track(dt, _sens) {
    const inp = this.input, ms = dt * 1000, t = this.totals;

    // sweep episodes (logged once when each ends)
    if (this.sweepActive) {
      t.sweepMs += ms;
      if (!this.sweep) {
        const r = this.regionOf[Math.round(((Math.atan2(inp.y, inp.x) / TAU) * this.n + this.n) % this.n) % this.n];
        this.sweep = { startMs: this.timeMs, lastMs: this.timeMs, region: r, peak: this.speed, dist: 0 };
      }
      this.sweep.lastMs = this.timeMs;
      this.sweep.peak = Math.max(this.sweep.peak, this.speed);
    } else if (this.sweep && this.timeMs - this.sweep.lastMs > SWEEP_END_MS) {
      t.sweeps++;
      this.log('sweep', { region: this.sweep.region, durationMs: this.sweep.lastMs - this.sweep.startMs, speed: this.sweep.peak, memoryLevel: this.memory.regionLevel(this.sweep.region) });
      this.sweep = null;
    }
    const moved = Math.hypot(inp.x - this.lastX, inp.y - this.lastY);
    this.lastX = inp.x; this.lastY = inp.y;

    if (this.grab) {
      const g = this.grab;
      t.contactMs += ms;
      g.dragDist += moved;
      t.dragDistance += moved;
      if (this.timeMs - g.lastDragLogMs >= DRAG_LOG_INTERVAL_MS && g.dragDist - g.lastLoggedDist > 0.01) {
        this.log('drag', { region: g.region, distance: g.dragDist, speed: this.speed });
        g.lastDragLogMs = this.timeMs; g.lastLoggedDist = g.dragDist;
      }
    }
    if (this.grab || (inp.present && this.proximity > 0.05)) t.interactionMs += ms;

    // approach (hysteresis + minimum gap, so it is not logged every frame)
    if (this.approachArmed && !inp.down && this.proximity > APPROACH_ON && this.timeMs - this.lastApproachMs > APPROACH_MIN_GAP_MS) {
      this.approachArmed = false;
      this.lastApproachMs = this.timeMs;
      this.log('approach', { distance: Math.max(0, this.boundaryDistance), speed: this.speed });
    } else if (this.proximity < APPROACH_OFF) this.approachArmed = true;

    // stillness periods (only meaningful after some contact)
    const active = this.grab || (inp.present && this.speed > STILL_SPEED);
    if (active) {
      if (this.stillMs >= STILL_MIN_MS && t.contactEpisodes > 0) {
        t.stillnessPeriods++;
        this.log('recovery', { durationMs: this.stillMs, memoryLevel: this.memory.max(), metadata: { kind: 'stillness' } });
      }
      this.stillMs = 0;
    } else this.stillMs += ms;
  }

  /** Continuous behavioural conditions; several may be true at once. */
  getState() {
    const t = this.totals, sinceContact = this.timeMs - this.lastContactEndMs;
    const flags = {
      contact: !!this.grab,
      adaptation: this.adapt.max() > 0.5,
      recovery: !this.grab && t.contactEpisodes > 0 && sinceContact > 2000 && (this.memory.max() > 0.05 || this.body.energy > 1e-6),
      exploration: t.contactEpisodes >= 2 && (this.grab || sinceContact < 8000),
      sweep: this.sweepActive,
      dwell: this.immediate.dwellActive,
      approach: !this.grab && this.input.present && this.proximity > 0.05,
    };
    const order = ['contact', 'sweep', 'dwell', 'adaptation', 'recovery', 'exploration', 'approach'];
    const primary = order.find((k) => flags[k]) || 'idle';
    return { primary: primary.toUpperCase(), flags };
  }

  /** Mean displacement magnitude across nodes in a region (for tests/inspection). */
  regionDisplacement(r) {
    let s = 0, c = 0;
    for (let i = 0; i < this.n; i++) if (this.regionOf[i] === r) { s += Math.hypot(this.body.dx[i], this.body.dy[i]); c++; }
    return s / c;
  }

  maxDisplacement() {
    let m = 0;
    for (let i = 0; i < this.n; i++) m = Math.max(m, Math.hypot(this.body.dx[i], this.body.dy[i]));
    return m;
  }
}
