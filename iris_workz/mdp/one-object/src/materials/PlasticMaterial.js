// Condition 03 — Plastic / Crease.
// A thin, stiff sheet (physics/PlasticBody.js: flat facets with affine maps,
// folded along straight lines) drawn by rendering/PlasticRenderer.js. It resists
// until a drag passes its yield distance, then gives and folds; on release it
// springs back only part of the way, and the bend and the crease lines stay.
// Creases accumulate across interactions; only RESET restores the flat sheet.
//
// Research logging (all values derived directly from the simulation):
//   contact_start   region, distance to the sheet, pointer speed, location (x, y),
//                   interior, depthFromEdge
//   fold            the moment the sheet yields: mode ('edge' flap or 'ridge'),
//                   drag direction (deg), flapFraction, atMs after contact start
//   drag            cumulative drag distance + phase and current fold angle (≈ every 400 ms)
//   contact_end     durationMs, drag distance, and metadata:
//                     outcome        'edge' | 'ridge' | 'resisted' | 'no_yield'
//                     peakFoldAngle  degrees (180 = folded flat over)
//                     foldDistance   peak drag distance while folding
//   recovery        kind 'springback': durationMs from release until the partial
//                   spring-back stops; metadata peakFoldAngle, residualAngle (the
//                   permanent bend), creases, facets, projectedArea, meanTilt;
//                   completed:false if a new contact interrupted it
//   region_revisit, approach, recovery (kind 'stillness') as in the other conditions

import { STEP, MAX_SUBSTEPS, DEFAULT_SEED } from '../config.js';
import { Material } from './Material.js';
import { PointerTracker } from './PointerTracker.js';
import { restOutline } from './sharedForm.js';
import { PlasticBody, PLASTIC_DEFAULTS } from '../physics/PlasticBody.js';
import { PlasticRenderer } from '../rendering/PlasticRenderer.js';
import { buildBasicPayload } from '../research/Exporter.js';

/** Researcher-only parameters (labels in translations: researcher.params.<label>). */
export const PLASTIC_PARAM_SPEC = Object.freeze([
  { key: 'stiffness', label: 'plasticStiffness', min: 0, max: 1, step: 0.01, group: 'material' },
  { key: 'springBack', label: 'plasticSpringBack', min: 0, max: 1, step: 0.01, group: 'material' },
  { key: 'plasticity', label: 'plasticPlasticity', min: 0, max: 1, step: 0.01, group: 'behaviour' },
  { key: 'foldLimit', label: 'plasticFoldLimit', min: 0.2, max: 0.6, step: 0.01, group: 'behaviour' },
]);

export default class PlasticMaterial extends Material {
  initialize() {
    super.initialize();
    const { canvas, logger, audio, seed, materialParams } = this.ctx;
    this.seed = (seed ?? DEFAULT_SEED) >>> 0;
    this.outline = restOutline(this.seed);
    this.body = new PlasticBody(this.outline, this.seed, { ...PLASTIC_DEFAULTS, ...(materialParams?.plastic || {}) });
    this.body.onEvent = (type, fields) => {
      logger?.log(type, this.body.timeMs, fields);
      if (type === 'contact_start') audio?.contact(0.45);
      if (type === 'fold') audio?.contact(0.7);
      if (type === 'contact_end') audio?.release(Math.min(1, (fields.metadata?.peakFoldAngle || 0) / 180));
    };
    this.tracker = new PointerTracker(this.outline, logger, { contacts: false });
    this.renderer = new PlasticRenderer(canvas, this.body);
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

  getParamSpec() { return PLASTIC_PARAM_SPEC.map((s) => ({ ...s, value: this.body.params[s.key] })); }
  setParam(key, value) { if (key in this.body.params) this.body.params[key] = value; }

  hintSource() { return { proximity: this.tracker.proximity, totals: this.body.totals, grab: this.body.contact, stillMs: this.tracker.stillMs }; }
  audioSignals() { return this.body.signals(); }
  isGrabbing() { return !!this.body.contact; }
  clockMs() { return this.body.timeMs; }

  getResearchState() {
    const b = this.body, m = b.metrics;
    return {
      timeMs: b.timeMs, totals: b.totals, proximity: this.tracker.proximity, grabbing: !!b.contact,
      plastic: {
        phase: b.contact?.phase || (b.spring ? 'springback' : 'idle'),
        foldAngle: (b.theta * 180) / Math.PI, creases: b.totals.creases, facets: m.facets, layers: m.layers,
        projectedArea: m.projectedArea, meanTilt: m.meanTilt, settled: b.settled, recovering: !!b.spring,
      },
    };
  }

  buildEncounterPayload({ condition, endReason, exportedAt }) {
    const b = this.body, t = b.totals, tr = this.tracker.totals, m = b.measure();
    const tracker = { timeMs: b.timeMs, totals: { ...tr, contactMs: t.contactMs, contactEpisodes: t.contactEpisodes, dragDistance: t.dragDistance, revisits: t.revisits } };
    const r4 = (v) => Math.round(v * 1e4) / 1e4;
    return buildBasicPayload(tracker, this.ctx.logger, {
      condition, seed: this.seed, materialKey: this.key, endReason, exportedAt,
      materialStatus: 'plastic v1 (faceted sheet: yield, fold along straight lines, partial spring-back, permanent creases)',
      parameters: { ...b.params },
      summaryExtra: {
        interiorContacts: t.interiorContacts,
        folds: t.folds, edgeFolds: t.edgeFolds, ridgeFolds: t.ridgeFolds, resistedPulls: t.resisted,
        creases: t.creases, totalCreaseLength: r4(t.creaseLength), peakFoldAngle: r4(t.peakFoldAngle),
        finalProjectedArea: m.projectedArea, finalMeanTilt: m.meanTilt, finalFacets: m.facets,
      },
      methodNote: 'Plastic condition: a programmed faceted sheet that folds and keeps its creases. Logged values describe observed pointer behaviour and simulated deformation only.',
    });
  }

  dispose() {
    if (this.disposed) return;
    if (this.body) this.body.onEvent = null;
    this.body = null; this.renderer = null; this.tracker = null;
    super.dispose();
  }
}
