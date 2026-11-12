// The shared initial form. Every material condition starts from the SAME
// centre, diameter and outline, on the same black ground, with the same body
// fill and edge, so that conditions differ only in internal texture and
// behaviour — not in silhouette, size, position or overall brightness.

import { NODE_COUNT } from '../config.js';
import { mulberry32 } from '../util/math.js';
import { SoftBody } from '../physics/SoftBody.js';

/** Object scale in CSS px per object unit (object base radius = 1). */
export function stageScale(w, h) {
  // desktop: object diameter ≈ 45–55 % of viewport width; narrow: ≈ 72 %
  return w < 640 ? Math.min(w * 0.36, h * 0.3) : Math.min(w * 0.27, h * 0.36);
}

/** Object centre in CSS px. */
export function stageCentre(w, h) { return { cx: w / 2, cy: h * 0.5 }; }

/** Client (CSS px) → object units, independent of which material is active. */
export function clientToObject(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const { cx, cy } = stageCentre(r.width, r.height), s = stageScale(r.width, r.height);
  return { x: (clientX - r.left - cx) / s, y: (clientY - r.top - cy) / s };
}

/** Rest radius per perimeter node for a seed — identical to Condition 01's soft body. */
export function restOutline(seed) {
  const b = new SoftBody(NODE_COUNT);
  b.init(mulberry32(seed >>> 0));
  return Float32Array.from(b.baseRest);
}

/** Shared palette (icy blue / translucent white). */
export const FORM_PALETTE = Object.freeze({
  deep: [24, 44, 64],          // #182C40
  main: [117, 189, 232],       // #75BDE8
  pale: [199, 233, 255],       // #C7E9FF
  white: [244, 249, 255],      // #F4F9FF
});
export const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${(+a).toFixed(3)})`;

/** Closed smooth path through outline points (object units, current transform). */
export function pathOutline(ctx, xs, ys) {
  const n = xs.length;
  ctx.beginPath();
  ctx.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
  for (let i = 0; i < n; i++) {
    const j = i === n - 1 ? 0 : i + 1;
    ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
  }
  ctx.closePath();
}

/**
 * Body volume + outer edge exactly as Condition 01 draws them at rest
 * (FilamentRenderer membrane: same gradient stops and edge stroke).
 * Expects ctx already translated/scaled to object units; px = 1 CSS px in object units.
 */
export function drawBaseForm(ctx, xs, ys, px, opacity = 1) {
  const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1.1);
  g.addColorStop(0, rgba(FORM_PALETTE.deep, Math.min(1, 0.38 * opacity)));
  g.addColorStop(0.8, rgba(FORM_PALETTE.deep, Math.min(1, 0.26 * opacity)));
  g.addColorStop(1, rgba(FORM_PALETTE.main, 0.12 * opacity));
  pathOutline(ctx, xs, ys);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1 * px;
  ctx.strokeStyle = rgba(FORM_PALETTE.pale, 0.32 * Math.min(1.5, opacity));
  ctx.stroke();
}
