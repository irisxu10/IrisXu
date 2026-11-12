// Condition 02 — Gel / Flow.
// A viscous, volume-conserving contained fluid (physics/GelBody.js) drawn by
// rendering/GelRenderer.js. Pressing one side pushes the rest outward; dragging
// is heavy and delayed; after release the material flows back and settles.
//
// Research logging (all values derived directly from the simulation):
//   contact_start   region, distance to the surface, pointer speed, location (x, y)
//   drag            cumulative drag distance (≈ every 400 ms while dragging)
//   contact_end     durationMs, drag distance, and metadata:
//                     peakDeformation    deepest inward radial displacement in the footprint (object units)
//                     redistribution     peak mean outward displacement of material outside the footprint
//                     peakVolumeChange   peak |area / restArea − 1| during the contact
//   recovery        kind 'settle': durationMs from release until max displacement < 0.01
//                   (completed: false if a new press interrupted it)
//   region_revisit, approach, recovery (kind 'stillness') as in the other conditions

import { STEP, MAX_SUBSTEPS, DEFAULT_SEED } from '../config.js';
import { Material } from './Material.js';
import { PointerTracker } from './PointerTracker.js';
import { restOutline } from './sharedForm.js';
import { GelBody, GEL_DEFAULTS } from '../physics/GelBody.js';
import { GelRenderer } from '../rendering/GelRenderer.js';
import { buildBasicPayload } from '../research/Exporter.js';

/** Researcher-only parameters (labels in translations: researcher.params.<key>). */
export const GEL_PARAM_SPEC = Object.freeze([
  { key: 'viscosity', label: 'gelViscosity', min: 0, max: 1, step: 0.01 },
  { key: 'pressure', label: 'gelPressure', min: 0, max: 2, step: 0.01 },
  { key: 'recovery', label: 'gelRecovery', min: 0, max: 1, step: 0.01 },
  { key: 'flow', label: 'gelFlow', min: 0, max: 1.5, step: 0.01 },
]);

export default class GelMaterial extends Material {
  initialize() {
    super.initialize();
    const { canvas, logger, audio, seed, materialParams } = this.ctx;
    this.seed = (seed ?? DEFAULT_SEED) >>> 0;
    this.outline = restOutline(this.seed);
    this.body = new GelBody(this.outline, this.seed, { ...GEL_DEFAULTS, ...(materialParams?.gel || {}) });
    this.body.onEvent = (type, fields) => {
      logger?.log(type, this.body.timeMs, fields);
      if (type === 'contact_start') audio?.contact(0.45);
      if (type === 'contact_end') audio?.release(Math.min(1, (fields.metadata?.peakDeformation || 0) / 0.3));
    };
    this.tracker = new PointerTracker(this.outline, logger, { contacts: false });
    this.renderer = new GelRenderer(canvas, this.body);
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

  getParamSpec() { return GEL_PARAM_SPEC.map((s) => ({ ...s, value: this.body.params[s.key] })); }
  setParam(key, value) { if (key in this.body.params) this.body.params[key] = value; }

  hintSource() {
    const b = this.body, t = this.tracker;
    return { proximity: t.proximity, totals: b.totals, grab: b.contact, stillMs: t.stillMs };
  }
  audioSignals() { return this.body.signals(); }
  isGrabbing() { return !!this.body.contact; }
  clockMs() { return this.body.timeMs; }

  getResearchState() {
    const b = this.body;
    return {
      timeMs: b.timeMs, totals: b.totals, proximity: this.tracker.proximity, grabbing: !!b.contact,
      gel: { maxDisp: b.maxDisp, volumeChange: b.area / b.A0 - 1, settled: b.settled, recovering: !!b.recovery },
    };
  }

  buildEncounterPayload({ condition, endReason, exportedAt }) {
    const b = this.body, t = b.totals, tr = this.tracker.totals;
    // PointerTracker supplies interaction time and stillness; contact totals come from the gel itself
    const tracker = { timeMs: b.timeMs, totals: { ...tr, contactMs: t.contactMs, contactEpisodes: t.contactEpisodes, dragDistance: t.dragDistance, revisits: t.revisits } };
    return buildBasicPayload(tracker, this.ctx.logger, {
      condition, seed: this.seed, materialKey: this.key, endReason, exportedAt,
      materialStatus: 'gel v1 (pressure-redistribution soft boundary + viscous flow)',
      parameters: { ...b.params },
      summaryExtra: {
        peakDeformation: Math.round(t.peakDeformation * 1e4) / 1e4,
        peakRedistribution: Math.round(t.peakRedistribution * 1e4) / 1e4,
        completedRecoveries: t.recoveries,
      },
      methodNote: 'Gel condition: a programmed viscous, approximately volume-conserving soft boundary. Logged values describe observed pointer behaviour and simulated deformation only.',
    });
  }

  dispose() {
    if (this.disposed) return;
    if (this.body) this.body.onEvent = null;
    this.body = null; this.renderer = null; this.tracker = null;
    super.dispose();
  }
}
