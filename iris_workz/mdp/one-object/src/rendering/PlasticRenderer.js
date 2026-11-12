// Condition 03 renderer (Canvas 2D) — a thin, stiff, translucent plastic sheet.
//
// Everything that changes is read from PlasticBody (no decorative animation).
// Each facet is drawn through its own affine map, so its texture folds, mirrors
// and foreshortens with it:
//   body      the shared body fill (same gradient as the other conditions),
//             accumulated where layers overlap (folded-over parts look denser)
//   sheen     flat-film reflections: one broad straight glint and two thin
//             parallel highlight lines — they stay straight on every facet, but
//             change angle and mirror where the sheet is folded
//   tilt      shading from the facet's 3D normal: lifted planes catch or lose
//             the light; the back of the film (folded over) is milkier
//   shadow    raised facets cast a faint shadow on what lies below
//   creases   crisp bright lines with a dark shadow line beside them — permanent
//   edge      the shared pale edge along the original outline
//   stress    before the sheet gives, a faint straight line shows where it will
//             fold (or a small tension mark when the pull is resisted)
// Shares centre / diameter / outline with the other conditions (sharedForm).

import { stageScale, stageCentre, rgba, FORM_PALETTE as P } from '../materials/sharedForm.js';
import { mulberry32 } from '../util/math.js';

const LIGHT = (() => { const v = [-0.35, -0.5, 0.79], m = Math.hypot(...v); return v.map((x) => x / m); })();

export class PlasticRenderer {
  constructor(canvas, body) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.body = body;
    this.opacity = 1;
    this.proximity = 0;
    const rng = mulberry32((body.seed ^ 0x91a) >>> 0);
    this.sheenAngle = -0.62 + (rng() - 0.5) * 0.3;     // flat-film reflection direction (rest space)
    this.sheenOffset = -0.28 + (rng() - 0.5) * 0.12;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    ({ cx: this.cx, cy: this.cy } = stageCentre(this.w, this.h));
    this.scale = stageScale(this.w, this.h);
  }

  restPath(g, f) {
    g.beginPath(); g.moveTo(f.x[0], f.y[0]);
    for (let i = 1; i < f.x.length; i++) g.lineTo(f.x[i], f.y[i]);
    g.closePath();
  }

  screenPath(g, f, ox = 0, oy = 0) {
    const M = f.M;
    g.beginPath();
    for (let i = 0; i < f.x.length; i++) {
      const x = M[0] * f.x[i] + M[2] * f.y[i] + M[4] + ox, y = M[1] * f.x[i] + M[3] * f.y[i] + M[5] + oy;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
  }

  /** Rest-space body + sheen for one facet (drawn under the facet's affine map). */
  facetTexture(g, f, mo, px) {
    const M = f.M;
    g.save();
    g.transform(M[0], M[1], M[2], M[3], M[4], M[5]);
    this.restPath(g, f);
    const body = g.createRadialGradient(0, 0, 0.05, 0, 0, 1.1);
    body.addColorStop(0, rgba(P.deep, 0.38 * mo));
    body.addColorStop(0.8, rgba(P.deep, 0.26 * mo));
    body.addColorStop(1, rgba(P.main, 0.12 * mo));
    g.fillStyle = body; g.fill();
    g.clip();
    // flat-film sheen: straight, parallel — reads as a stiff flat sheet
    const a = this.sheenAngle, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux, o = this.sheenOffset;
    // milky film: an even translucent layer (plastic is uniformly dense, unlike gel or silicone)
    g.fillStyle = rgba(P.main, 0.085 * mo); g.fillRect(-1.3, -1.3, 2.6, 2.6);
    // reflections: soft straight bands across the whole sheet, never crisp lines (crisp lines = creases only)
    for (const [d, wd, al] of [[o, 0.26, 0.13], [o + 0.42, 0.09, 0.08], [o - 0.62, 0.16, 0.05]]) {
      const gl = g.createLinearGradient(vx * (d - wd), vy * (d - wd), vx * (d + wd), vy * (d + wd));
      gl.addColorStop(0, rgba(P.pale, 0)); gl.addColorStop(0.5, rgba(P.pale, al * mo)); gl.addColorStop(1, rgba(P.pale, 0));
      g.fillStyle = gl; g.fillRect(-1.3, -1.3, 2.6, 2.6);
    }
    g.restore();
  }

  draw(pointer) {
    const g = this.g, b = this.body, px = 1 / this.scale, mo = this.opacity;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.save();
    g.translate(this.cx, this.cy);
    g.scale(this.scale, this.scale);
    const facets = [...b.view].sort((p, q) => p.layer - q.layer);
    const lum0 = LIGHT[2];

    for (const f of facets) {
      const N = f.N, raised = 1 - Math.abs(N[2]) > 1e-3 || f.layer > 0;
      // raised facets cast a faint shadow on what lies below
      if (raised && f.layer > 0) {
        const lift = 0.012 + 0.02 * (1 - Math.abs(N[2]));
        this.screenPath(g, f, lift * 0.6, lift);
        g.fillStyle = `rgba(0,0,0,${(0.28 * mo).toFixed(3)})`; g.fill();
      }
      this.facetTexture(g, f, mo, px);
      // tilt shading from the facet normal; the back of the film is milkier
      const lum = Math.abs(N[0] * LIGHT[0] + N[1] * LIGHT[1] + N[2] * LIGHT[2]), dl = lum - lum0, lift = 1 - Math.abs(N[2]);
      if (Math.abs(dl) > 0.01 || N[2] < 0 || lift > 0.01) {
        this.screenPath(g, f);
        // any lifted plane reads as lifted, whatever its direction: it turns milkier (seen at a grazing angle)
        if (lift > 0.01) { g.fillStyle = rgba(P.pale, Math.min(0.16, lift * 0.3) * mo); g.fill(); }
        if (dl > 0) { g.fillStyle = rgba(P.pale, Math.min(0.2, dl * 0.45) * mo); g.fill(); }
        else if (dl < 0) { g.fillStyle = `rgba(1,3,8,${Math.min(0.35, -dl * 0.6 * mo).toFixed(3)})`; g.fill(); }
        if (N[2] < 0) { g.fillStyle = rgba(P.main, 0.05 * mo); g.fill(); }
      }
      this.edges(g, f, px, mo);
    }

    // stress preview: where the sheet is about to give (before yielding)
    if (b.preview) {
      const { dx, dy, a, load } = b.preview, tx = -dy, ty = dx, half = Math.sqrt(Math.max(0, 1.02 - a * a));
      const x0 = dx * a - tx * half, y0 = dy * a - ty * half, x1 = dx * a + tx * half, y1 = dy * a + ty * half;
      const lg = g.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, rgba(P.white, 0)); lg.addColorStop(0.5, rgba(P.white, 0.3 * load * mo)); lg.addColorStop(1, rgba(P.white, 0));
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 1 * px; g.strokeStyle = lg; g.stroke();
    }
    if (b.contact?.phase === 'resist' && b.stress > 0.02) {
      const c = b.contact, L = 0.05 + 0.06 * b.stress;
      g.save(); g.translate(c.gx, c.gy); g.rotate(Math.atan2(c.dy, c.dx));
      const sg = g.createLinearGradient(-L, 0, L, 0);
      sg.addColorStop(0, rgba(P.white, 0)); sg.addColorStop(0.5, rgba(P.white, 0.3 * b.stress * mo)); sg.addColorStop(1, rgba(P.white, 0));
      g.fillStyle = sg; g.beginPath(); g.ellipse(0, 0, L, 0.008, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.restore();

    if (pointer?.present && pointer.type !== 'touch') {
      const sx = this.cx + pointer.x * this.scale, sy = this.cy + pointer.y * this.scale;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (b.contact) { g.beginPath(); g.arc(sx, sy, 2.5, 0, Math.PI * 2); g.fillStyle = 'rgba(244,249,255,0.6)'; g.fill(); }
      else if (this.proximity > 0.1) {
        g.beginPath(); g.arc(sx, sy, 6 + this.proximity * 5, 0, Math.PI * 2);
        g.lineWidth = 1; g.strokeStyle = `rgba(199,233,255,${(0.08 + this.proximity * 0.22).toFixed(3)})`; g.stroke();
      }
    }
  }

  /** Outline edges (shared pale edge) and crease edges (crisp line + shadow) of one facet. */
  edges(g, f, px, mo) {
    const M = f.M, n = f.x.length, b = this.body;
    const X = (i) => M[0] * f.x[i] + M[2] * f.y[i] + M[4], Y = (i) => M[1] * f.x[i] + M[3] * f.y[i] + M[5];
    // outline: contiguous runs as one path (no seams)
    g.beginPath();
    let open = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (f.k[i] === -1) { if (!open) { g.moveTo(X(i), Y(i)); open = true; } g.lineTo(X(j), Y(j)); }
      else open = false;
    }
    g.lineWidth = 1 * px; g.strokeStyle = rgba(P.pale, 0.32 * Math.min(1.5, mo)); g.stroke();
    // creases
    for (let i = 0; i < n; i++) {
      const id = f.k[i]; if (id <= 0) continue;
      const cr = b.creases[id - 1], s = cr ? Math.max(cr.strength, b.contact || b.spring ? 0.7 : 0.2) : 0.7;
      const j = (i + 1) % n, x0 = X(i), y0 = Y(i), x1 = X(j), y1 = Y(j);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
      g.lineWidth = 2.4 * px; g.strokeStyle = `rgba(1,3,8,${(0.32 * s * mo).toFixed(3)})`; g.stroke();
      g.lineWidth = 0.9 * px; g.strokeStyle = rgba(P.white, (0.22 + 0.4 * s) * mo); g.stroke();
    }
  }
}
