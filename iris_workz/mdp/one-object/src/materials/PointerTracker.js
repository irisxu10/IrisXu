// Generic pointer bookkeeping for materials that do not (yet) have their own
// physics. It logs the same core events as Condition 01 — approach,
// contact_start / contact_end, drag, region_revisit, recovery (stillness) —
// with the same field meanings, so encounters remain comparable.
// Pure: no DOM. The surface is the shared rest outline (no deformation).

import { REGION_COUNT, DEFAULT_PARAMS } from '../config.js';
import { clamp, approach } from '../util/math.js';

const TAU = Math.PI * 2;
const APPROACH_ON = 0.35, APPROACH_OFF = 0.1, APPROACH_MIN_GAP_MS = 1500;
const DRAG_LOG_INTERVAL_MS = 400;
const STILL_SPEED = 0.15, STILL_MIN_MS = 3000;

export class PointerTracker {
  /** opts.contacts = false: track approach / proximity / stillness only (the material logs its own contacts). */
  constructor(outline, logger, { contacts = true } = {}) {
    this.outline = outline;          // rest radius per node (Float32Array)
    this.logger = logger;
    this.contacts = contacts;
    this.reset();
  }

  reset() {
    this.timeMs = 0;
    this.proximity = 0;
    this.boundaryDistance = Infinity;
    this.speed = 0;
    this.grab = null;
    this.wasDown = false;
    this.stillMs = 0;
    this.approachArmed = true;
    this.lastApproachMs = -Infinity;
    this.regionContacts = new Uint16Array(REGION_COUNT);
    this.input = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false };
    this.lastX = 0; this.lastY = 0;
    this.totals = { contactMs: 0, interactionMs: 0, contactEpisodes: 0, dragDistance: 0, revisits: 0, stillnessPeriods: 0 };
  }

  log(type, fields) { this.logger?.log(type, this.timeMs, fields); }

  radiusAt(theta) {
    const n = this.outline.length;
    let u = (theta / TAU) * n; u = ((u % n) + n) % n;
    const i0 = Math.floor(u) % n, i1 = (i0 + 1) % n, f = u - Math.floor(u);
    return this.outline[i0] * (1 - f) + this.outline[i1] * f;
  }

  regionAt(theta) {
    return Math.floor((((theta / TAU) * REGION_COUNT + 0.5) % REGION_COUNT + REGION_COUNT) % REGION_COUNT);
  }

  setInput(inp) { Object.assign(this.input, inp); }

  step(dt) {
    const inp = this.input, ms = dt * 1000, t = this.totals;
    this.timeMs += ms;
    this.speed = Math.hypot(inp.vx, inp.vy);
    const r = Math.hypot(inp.x, inp.y), theta = r > 1e-6 ? Math.atan2(inp.y, inp.x) : 0;
    this.boundaryDistance = inp.present ? r - this.radiusAt(theta) : Infinity;
    const pRaw = inp.present ? clamp(1 - Math.max(0, this.boundaryDistance) / DEFAULT_PARAMS.proximityRadius, 0, 1) : 0;
    this.proximity += (pRaw - this.proximity) * approach(8, dt);

    if (this.contacts && inp.down && !this.wasDown && this.boundaryDistance <= DEFAULT_PARAMS.contactMargin) {
      const region = this.regionAt(theta);
      this.grab = { region, startMs: this.timeMs, dist: 0, lastLogMs: this.timeMs, lastLogged: 0 };
      t.contactEpisodes++;
      this.log('contact_start', { region, distance: this.boundaryDistance, speed: this.speed, metadata: { x: +inp.x.toFixed(3), y: +inp.y.toFixed(3) } });
      if (this.regionContacts[region] > 0) { t.revisits++; this.log('region_revisit', { region, metadata: { previousContacts: this.regionContacts[region] } }); }
      this.regionContacts[region]++;
    }
    if (!inp.down && this.grab) {
      const g = this.grab;
      this.log('contact_end', { region: g.region, durationMs: this.timeMs - g.startMs, distance: g.dist });
      this.grab = null;
    }
    this.wasDown = inp.down;

    const moved = Math.hypot(inp.x - this.lastX, inp.y - this.lastY);
    this.lastX = inp.x; this.lastY = inp.y;
    if (this.grab) {
      const g = this.grab;
      t.contactMs += ms; g.dist += moved; t.dragDistance += moved;
      if (this.timeMs - g.lastLogMs >= DRAG_LOG_INTERVAL_MS && g.dist - g.lastLogged > 0.01) {
        this.log('drag', { region: g.region, distance: g.dist, speed: this.speed });
        g.lastLogMs = this.timeMs; g.lastLogged = g.dist;
      }
    }
    if (this.grab || (inp.present && this.proximity > 0.05)) t.interactionMs += ms;

    if (this.approachArmed && !inp.down && this.proximity > APPROACH_ON && this.timeMs - this.lastApproachMs > APPROACH_MIN_GAP_MS) {
      this.approachArmed = false; this.lastApproachMs = this.timeMs;
      this.log('approach', { distance: Math.max(0, this.boundaryDistance), speed: this.speed });
    } else if (this.proximity < APPROACH_OFF) this.approachArmed = true;

    const active = this.grab || (!this.contacts && inp.down) || (inp.present && this.speed > STILL_SPEED);
    if (active) {
      if (this.stillMs >= STILL_MIN_MS && t.contactEpisodes > 0) {
        t.stillnessPeriods++;
        this.log('recovery', { durationMs: this.stillMs, metadata: { kind: 'stillness' } });
      }
      this.stillMs = 0;
    } else this.stillMs += ms;
  }
}
