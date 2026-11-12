// The behavioural core. Pure JavaScript, no DOM: it can run headlessly in
// tests with scripted input. Call setInput() whenever the pointer changes and
// step() once per fixed timestep.

import {
  STEP, NODE_COUNT, REGION_COUNT, DEFAULT_SEED, DEFAULT_PARAMS,
} from '../config.js';
import { mulberry32, clamp, approach } from '../util/math.js';
import { SoftBody } from '../physics/SoftBody.js';
import { MemorySystem } from '../behavior/MemorySystem.js';
import { AdaptationSystem } from '../behavior/AdaptationSystem.js';

const TAU = Math.PI * 2;
const DRAG_LOG_INTERVAL_MS = 400;
const APPROACH_ON = 0.35, APPROACH_OFF = 0.1, APPROACH_MIN_GAP_MS = 1500;
const STILL_SPEED = 0.15, STILL_MIN_MS = 3000;

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
    this.contactW = new Float32Array(n);
    this.intensity = new Float32Array(n);
    this.radial = new Float32Array(n);
    this.k = new Float32Array(n);
    this.input = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false };
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this.body.init(mulberry32(this.seed));
    this.memory.reset();
    this.adapt.reset();
    this.contactW.fill(0);
    this.intensity.fill(0);
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

    // contact edges
    if (inp.down && !this.wasDown) this.tryGrab(theta, rb);
    if (!inp.down && this.grab) this.release();
    this.wasDown = inp.down;

    b.clearForces();
    if (this.grab) this.applyGrip();
    else if (inp.present) this.applyProximityField();

    for (let i = 0; i < n; i++) this.k[i] = p.stiffness * this.adapt.stiffMul[i];
    b.integrate(this.k, p);

    // memory intensity: contact + strong deformation
    for (let i = 0; i < n; i++) {
      const dmag = Math.hypot(b.dx[i], b.dy[i]);
      this.radial[i] = b.radialDisp(i);
      const deform = clamp(dmag / p.maxDisplacement, 0, 1);
      const contact = this.grab ? this.contactW[i] * (0.35 + 0.65 * Math.min(1, dmag / 0.25)) : 0;
      this.intensity[i] = Math.max(contact, 0.25 * Math.max(0, deform - 0.3));
    }
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
  }

  release() {
    const g = this.grab;
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
    const push = p.proximityPush + p.proximitySpeedGain * Math.min(this.speed, 5);
    const wx = inp.vx * STEP * p.proximityWake, wy = inp.vy * STEP * p.proximityWake;
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

  track(dt, _sens) {
    const inp = this.input, ms = dt * 1000, t = this.totals;
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
      approach: !this.grab && this.input.present && this.proximity > 0.05,
    };
    const order = ['contact', 'adaptation', 'recovery', 'exploration', 'approach'];
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
