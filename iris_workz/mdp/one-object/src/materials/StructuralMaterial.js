// Condition 01 — Structural / Memory.
// An adapter: the existing V4 system (Simulation + FilamentRenderer) is used
// unchanged behind the Material interface. Physics, local adaptation,
// rendering and research logging are exactly those of v4.2.

import { STEP, MAX_SUBSTEPS } from '../config.js';
import { Simulation } from '../simulation/Simulation.js';
import { FilamentRenderer } from '../rendering/FilamentRenderer.js';
import { buildPayload } from '../research/Exporter.js';
import { Material } from './Material.js';

export default class StructuralMaterial extends Material {
  initialize() {
    super.initialize();
    const { canvas, logger, audio, seed, params, visual, reducedMotion } = this.ctx;
    this.sim = new Simulation({ params, seed, logger, reducedMotion });
    this.renderer = new FilamentRenderer(canvas, this.sim);
    this.renderer.reducedMotion = reducedMotion;
    for (const [k, v] of Object.entries(visual || {})) this.renderer.setVisual(k, v);
    this.sim.hooks.contact = (s) => audio?.contact(s);
    this.sim.hooks.release = (t) => audio?.release(t);
    this.acc = 0;
    this.slowMs = 0;
    this.onAutoDetail = null;   // optional callback (from, to) for logging
  }

  update(dt, fps = 60) {
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_SUBSTEPS) { this.sim.step(); this.acc -= STEP; steps++; }
    if (steps === MAX_SUBSTEPS) this.acc = 0; // drop backlog instead of spiralling
    // automatic reduced-detail fallback after sustained low frame rate
    this.slowMs = fps < 40 ? this.slowMs + dt * 1000 : 0;
    if (this.slowMs > 2500 && this.renderer.detail === 1) {
      this.renderer.detail = 0.6;
      this.onAutoDetail?.(1, 0.6);
    }
    this.lastDt = dt;
  }

  render(pointer) { this.renderer.draw(this.lastDt ?? 1 / 60, pointer); }
  handlePointerInput(input) { this.sim.setInput(input); }
  reset() { this.sim.reset(this.sim.seed); this.renderer.resetLag(); this.acc = 0; }
  resize() { this.renderer.resize(); }
  setReducedMotion(on) { this.sim.reducedMotion = on; this.renderer.reducedMotion = on; }
  setVisual(key, value) { this.renderer.setVisual(key, value); }

  hintSource() { return this.sim; }               // Simulation already exposes the hint fields
  audioSignals() { return this.sim.signals; }
  isGrabbing() { return !!this.sim.grab; }
  clockMs() { return this.sim.timeMs; }

  getResearchState() {
    const s = this.sim, st = s.getState();
    return {
      state: st, totals: s.totals, timeMs: s.timeMs,
      adaptedRegions: s.adapt.adaptedRegions(), regionCount: s.regionCount,
      maxMemory: s.memory.max(), detail: this.renderer.detail,
    };
  }

  buildEncounterPayload({ condition, visual, endReason, exportedAt }) {
    return buildPayload(this.sim, this.ctx.logger, { condition, visual, endReason, exportedAt });
  }

  dispose() {
    if (this.disposed) return;
    if (this.sim) { this.sim.hooks = {}; this.sim.logger = null; }
    this.sim = null;
    this.renderer = null;
    super.dispose();
  }
}
