// Condition 04 — Silicone / Elasticity.
// A smooth elastic membrane (physics/SiliconeBody.js: triangulated mass-spring
// disk, stretch-stiffening springs, oriented area constraint, weak shape
// tether) drawn by rendering/SiliconeRenderer.js. Grab anywhere and pull: the
// region follows, neighbours stretch progressively, resistance rises; release
// springs back with a slight overshoot and settles. No memory or adaptation:
// repeated interactions behave the same.
//
// Research logging (all values derived directly from the simulation):
//   contact_start   region, distance to the surface, pointer speed, location (x, y),
//                   interior, depthFromEdge
//   drag            cumulative drag distance + current stretch (≈ every 400 ms)
//   contact_end     durationMs (stretch duration), drag distance, and metadata:
//                     stretchDistance      peak displacement of the grabbed footprint
//                     peakDeformation      peak displacement of any node
//                     peakStrain           peak spring strain (fractional stretch)
//                     releaseDisplacement  footprint displacement at release
//   recovery        kind 'settle': durationMs from release until max displacement < 0.01;
//                   metadata releaseVelocity (units/s), overshoots (rest crossings
//                   along the release direction), maxOvershoot; completed:false if interrupted
//   region_revisit, approach, recovery (kind 'stillness') as in the other conditions

import { STEP, MAX_SUBSTEPS, DEFAULT_SEED } from '../config.js';
import { Material } from './Material.js';
import { PointerTracker } from './PointerTracker.js';
import { restOutline } from './sharedForm.js';
import { SiliconeBody, SILICONE_DEFAULTS } from '../physics/SiliconeBody.js';
import { SiliconeRenderer } from '../rendering/SiliconeRenderer.js';
import { buildBasicPayload } from '../research/Exporter.js';

/** Researcher-only parameters (labels in translations: researcher.params.<label>). */
export const SILICONE_PARAM_SPEC = Object.freeze([
  { key: 'stiffness', label: 'siliconeStiffness', min: 0, max: 1, step: 0.01, group: 'material' },
  { key: 'resistance', label: 'siliconeResistance', min: 0, max: 1, step: 0.01, group: 'material' },
  { key: 'damping', label: 'siliconeDamping', min: 0, max: 1, step: 0.01, group: 'behaviour' },
  { key: 'recovery', label: 'siliconeRecovery', min: 0, max: 1, step: 0.01, group: 'behaviour' },
  { key: 'maxDeformation', label: 'siliconeMaxDeformation', min: 0.15, max: 0.8, step: 0.01, group: 'behaviour' },
]);

export default class SiliconeMaterial extends Material {
  initialize() {
    super.initialize();
    const { canvas, logger, audio, seed, materialParams } = this.ctx;
    this.seed = (seed ?? DEFAULT_SEED) >>> 0;
    this.outline = restOutline(this.seed);
    this.body = new SiliconeBody(this.outline, this.seed, { ...SILICONE_DEFAULTS, ...(materialParams?.silicone || {}) });
    this.body.onEvent = (type, fields) => {
      logger?.log(type, this.body.timeMs, fields);
      if (type === 'contact_start') audio?.contact(0.4);
      if (type === 'contact_end') audio?.release(Math.min(1, (fields.metadata?.stretchDistance || 0) / 0.35));
    };
    this.tracker = new PointerTracker(this.outline, logger, { contacts: false });
    this.renderer = new SiliconeRenderer(canvas, this.body);
    this.renderer.opacity = this.ctx.visual?.membraneOpacity ?? 1;
    this.acc = 0;
  }

  update(dt) {
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_SUBSTEPS) { this.tracker.step(STEP); this.body.step(); this.acc -= STEP; steps++; }
    if (steps === MAX_SUBSTEPS) this.acc = 0;
  }

  handlePointerInput(input) { this.body.setInput(input); this.tracker.setInput(input); }
  render(pointer) { this.renderer.proximity = this.tracker.proximity; this.renderer.draw(pointer); }
  reset() { this.body.reset(); this.tracker.reset(); this.acc = 0; }
  resize() { this.renderer.resize(); }

  getParamSpec() { return SILICONE_PARAM_SPEC.map((s) => ({ ...s, value: this.body.params[s.key] })); }
  setParam(key, value) { if (key in this.body.params) this.body.params[key] = value; }

  hintSource() { return { proximity: this.tracker.proximity, totals: this.body.totals, grab: this.body.contact, stillMs: this.tracker.stillMs }; }
  audioSignals() { return this.body.signals(); }
  isGrabbing() { return !!this.body.contact; }
  clockMs() { return this.body.timeMs; }

  getResearchState() {
    const b = this.body;
    return {
      timeMs: b.timeMs, totals: b.totals, proximity: this.tracker.proximity, grabbing: !!b.contact,
      silicone: { maxDisp: b.maxDisp, maxStrain: b.maxStrain, settled: b.settled, recovering: !!b.recovery, inverted: b.invertedCount() },
    };
  }

  buildEncounterPayload({ condition, endReason, exportedAt }) {
    const b = this.body, t = b.totals, tr = this.tracker.totals;
    const tracker = { timeMs: b.timeMs, totals: { ...tr, contactMs: t.contactMs, contactEpisodes: t.contactEpisodes, dragDistance: t.dragDistance, revisits: t.revisits } };
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    return buildBasicPayload(tracker, this.ctx.logger, {
      condition, seed: this.seed, materialKey: this.key, endReason, exportedAt,
      materialStatus: 'silicone v1 (triangulated mass-spring membrane, stretch-stiffening, underdamped recovery)',
      parameters: { ...b.params },
      summaryExtra: {
        interiorContacts: t.interiorContacts,
        peakStretch: r4(t.peakStretch), peakDeformation: r4(t.peakDeformation), peakStrain: r4(t.peakStrain),
        peakReleaseVelocity: r4(t.peakReleaseVelocity), completedRecoveries: t.recoveries,
      },
      methodNote: 'Silicone condition: a programmed elastic membrane (mass-spring). Logged values describe observed pointer behaviour and simulated deformation only.',
    });
  }

  dispose() {
    if (this.disposed) return;
    if (this.body) this.body.onEvent = null;
    this.body = null; this.renderer = null; this.tracker = null;
    super.dispose();
  }
}
