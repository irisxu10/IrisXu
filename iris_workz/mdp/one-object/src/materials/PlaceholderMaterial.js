// Base for Conditions 02–04 while their physics is not yet implemented
// (Phase 02 placeholders). Establishes:
//   - the shared initial form (same outline, centre, diameter, body fill, edge)
//   - a material-specific STATIC internal texture (subclass drawTexture)
//   - basic pointer research logging (PointerTracker), comparable to Condition 01
//   - clean reset and dispose
// No motion of its own: no breathing, no ambient animation.

import { DEFAULT_SEED } from '../config.js';
import { mulberry32 } from '../util/math.js';
import { Material } from './Material.js';
import { PointerTracker } from './PointerTracker.js';
import { stageScale, stageCentre, restOutline, drawBaseForm, pathOutline, rgba, FORM_PALETTE } from './sharedForm.js';
import { buildBasicPayload } from '../research/Exporter.js';

export class PlaceholderMaterial extends Material {
  /** Subclasses override: draw the internal texture in object units, already clipped to the outline. */
  drawTexture(_ctx, _rng, _px) {}

  initialize() {
    super.initialize();
    const { canvas, logger, seed } = this.ctx;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.seed = (seed ?? DEFAULT_SEED) >>> 0;
    this.outline = restOutline(this.seed);
    const n = this.outline.length;
    this.xs = new Float32Array(n); this.ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.xs[i] = Math.cos(a) * this.outline[i]; this.ys[i] = Math.sin(a) * this.outline[i];
    }
    this.tracker = new PointerTracker(this.outline, logger);
    this.cache = document.createElement('canvas');
    this.resize();
  }

  /** Resize the shared canvas and re-render the static form into an offscreen cache. */
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    ({ cx: this.cx, cy: this.cy } = stageCentre(this.w, this.h));
    this.scale = stageScale(this.w, this.h);
    // cache covers the object (radius ≤ ~1.06) with a small margin
    const half = Math.ceil(1.15 * this.scale * this.dpr);
    this.cache.width = this.cache.height = half * 2;
    this.cacheHalf = half;
    const c = this.cache.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, half * 2, half * 2);
    c.translate(half, half);
    c.scale(this.scale * this.dpr, this.scale * this.dpr);
    const px = 1 / this.scale;
    drawBaseForm(c, this.xs, this.ys, px, this.ctx.visual?.membraneOpacity ?? 1);
    c.save();
    pathOutline(c, this.xs, this.ys);
    c.clip();
    c.globalCompositeOperation = 'lighter';
    this.drawTexture(c, mulberry32((this.seed ^ this.textureSalt) >>> 0), px);
    c.restore();
    c.globalCompositeOperation = 'source-over';
  }

  update(dt) { this.tracker.step(dt); }
  handlePointerInput(input) { this.tracker.setInput(input); }
  reset() { this.tracker.reset(); }

  render(pointer) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.cache, Math.round(this.cx * this.dpr - this.cacheHalf), Math.round(this.cy * this.dpr - this.cacheHalf));
    // pointer mark — same as Condition 01 (faint ring near, dot while pressing; not for touch)
    if (pointer?.present && pointer.type !== 'touch') {
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const sx = this.cx + pointer.x * this.scale, sy = this.cy + pointer.y * this.scale, p = this.tracker.proximity;
      if (this.tracker.grab) {
        g.beginPath(); g.arc(sx, sy, 2.5, 0, Math.PI * 2); g.fillStyle = 'rgba(244,249,255,0.6)'; g.fill();
      } else if (p > 0.1) {
        g.beginPath(); g.arc(sx, sy, 6 + p * 5, 0, Math.PI * 2);
        g.lineWidth = 1; g.strokeStyle = `rgba(199,233,255,${(0.08 + p * 0.22).toFixed(3)})`; g.stroke();
      }
    }
  }

  hintSource() { return this.tracker; }
  isGrabbing() { return !!this.tracker.grab; }
  clockMs() { return this.tracker.timeMs; }
  getResearchState() {
    const t = this.tracker;
    return { placeholder: true, timeMs: t.timeMs, totals: t.totals, proximity: t.proximity, grabbing: !!t.grab };
  }

  buildEncounterPayload({ condition, endReason, exportedAt }) {
    return buildBasicPayload(this.tracker, this.ctx.logger, { condition, seed: this.seed, materialKey: this.key, endReason, exportedAt });
  }

  dispose() {
    if (this.disposed) return;
    if (this.cache) { this.cache.width = this.cache.height = 0; }
    this.cache = null; this.tracker = null; this.g = null; this.canvas = null;
    super.dispose();
  }
}

export { rgba, FORM_PALETTE };
