// Condition 02 renderer (Canvas 2D) — a thick, translucent hydrogel.
//
// Everything drawn is driven by GelBody state (no decorative animation):
//   body        deformed contour; dark translucent volume whose density centre
//               shifts with the displacement field
//   density     a smooth map computed from the interior grid: compression
//               (−div u) brightens, rarefaction under an indentation clears/darkens,
//               recent flow (trail) adds a faint sheen
//   folds       soft folded membranes (swirling crescents, seeded) whose points are
//               warped through the displacement field at three depths (surface,
//               lag 1, lag 2) — layers move at different rates; each fold has a
//               dark trough and a specular ridge whose brightness follows the local
//               compression and flow under it
//   rim         a thick Fresnel-style inner rim (light gathers where the surface
//               turns away), following the deformed contour
//   speculars   two sharp highlights near the upper-left rim; the displacement
//               field and interior pressure move and stretch them (refraction cue)
//   edge        the same pale edge as every condition
// Shares centre / diameter / outline with the other conditions (sharedForm).

import { stageScale, stageCentre, pathOutline, rgba, FORM_PALETTE as P } from '../materials/sharedForm.js';
import { mulberry32 } from '../util/math.js';
import { EXTENT } from '../physics/GelBody.js';

const FOLDS = 10, FOLD_PTS = 34;
const DEPTH_GAIN = [1, 0.95, 0.85];

export class GelRenderer {
  constructor(canvas, body) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.body = body;
    this.opacity = 1;
    this.proximity = 0;
    this.buildFolds();
    // low-res density maps (one cell = one pixel), scaled up smoothly
    const G = body.G;
    this.bright = document.createElement('canvas'); this.bright.width = this.bright.height = G;
    this.dark = document.createElement('canvas'); this.dark.width = this.dark.height = G;
    this.brightImg = this.bright.getContext('2d').createImageData(G, G);
    this.darkImg = this.dark.getContext('2d').createImageData(G, G);
    this.tmp = [0, 0];
    this.resize();
  }

  /** Seeded swirling fold membranes in rest coordinates (outer edge, inner edge). */
  buildFolds() {
    const rng = mulberry32((this.body.seed ^ 0x9e1f0d) >>> 0);
    this.folds = [];
    for (let f = 0; f < FOLDS; f++) {
      const depth = f % 3, ocx = (rng() - 0.5) * 0.5, ocy = (rng() - 0.5) * 0.5;
      const R = 0.18 + rng() * 0.58, a0 = rng() * Math.PI * 2, span = (1.3 + rng() * 1.6) * (rng() < 0.5 ? -1 : 1);
      const th = 0.07 + rng() * 0.1, wob = rng() * Math.PI * 2, wobA = 0.03 + rng() * 0.05;
      const ox = new Float32Array(FOLD_PTS), oy = new Float32Array(FOLD_PTS), ix = new Float32Array(FOLD_PTS), iy = new Float32Array(FOLD_PTS);
      for (let k = 0; k < FOLD_PTS; k++) {
        const t = k / (FOLD_PTS - 1), a = a0 + span * t, rr = R * (1 + 0.18 * t) + wobA * Math.sin(t * 5 + wob);
        let x = ocx + Math.cos(a) * rr, y = ocy + Math.sin(a) * rr;
        const lim = 0.93, m = Math.hypot(x, y); if (m > lim) { x *= lim / m; y *= lim / m; }
        const nx = Math.cos(a), ny = Math.sin(a), w = th * Math.sin(Math.PI * t) ** 0.8;   // tapered ends
        ox[k] = x + nx * w; oy[k] = y + ny * w; ix[k] = x - nx * w * 0.6; iy[k] = y - ny * w * 0.6;
      }
      this.folds.push({ depth, ox, oy, ix, iy, wox: new Float32Array(FOLD_PTS), woy: new Float32Array(FOLD_PTS), wix: new Float32Array(FOLD_PTS), wiy: new Float32Array(FOLD_PTS) });
    }
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

  warp(fold) {
    const b = this.body, t = this.tmp, d = fold.depth, gain = DEPTH_GAIN[d];
    const fx = d === 0 ? b.ux : d === 1 ? b.l1x : b.l2x, fy = d === 0 ? b.uy : d === 1 ? b.l1y : b.l2y;
    let comp = 0, trail = 0;
    for (let k = 0; k < FOLD_PTS; k++) {
      b.sample(fold.ox[k], fold.oy[k], fx, fy, t); fold.wox[k] = fold.ox[k] + t[0] * gain; fold.woy[k] = fold.oy[k] + t[1] * gain;
      b.sample(fold.ix[k], fold.iy[k], fx, fy, t); fold.wix[k] = fold.ix[k] + t[0] * gain; fold.wiy[k] = fold.iy[k] + t[1] * gain;
      if (k % 4 === 0) { comp += b.sampleScalar(fold.ox[k], fold.oy[k], b.div); trail += b.sampleScalar(fold.ox[k], fold.oy[k], b.trail); }
    }
    const nS = Math.ceil(FOLD_PTS / 4);
    fold.comp = comp / nS; fold.trail = trail / nS;
  }

  /** 3×3 box blur of an interior field (outside cells excluded) — removes grid blockiness. */
  blur(src, dst) {
    const b = this.body, G = b.G;
    for (let q = 0; q < b.insideList.length; q++) {
      const j = b.insideList[q];
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = j + dy * G + dx; if (b.inside[k]) { s += src[k]; c++; } }
      dst[j] = s / c;
    }
  }

  updateDensity() {
    const b = this.body, G = b.G, bi = this.brightImg.data, di = this.darkImg.data;
    if (!this.cBlur) { this.cBlur = new Float32Array(G * G); this.tBlur = new Float32Array(G * G); this.tmpBlur = new Float32Array(G * G); }
    this.blur(b.div, this.tmpBlur); this.blur(this.tmpBlur, this.cBlur);       // two passes ≈ gaussian
    this.blur(b.trail, this.tmpBlur); this.blur(this.tmpBlur, this.tBlur);
    for (let j = 0; j < G * G; j++) {
      const o = j * 4;
      if (!b.inside[j]) { bi[o + 3] = 0; di[o + 3] = 0; continue; }
      const c = this.cBlur[j], tr = this.tBlur[j];
      const ab = Math.min(0.42, Math.max(0, c) * 2.0 + tr * 0.06), ad = Math.min(0.45, Math.max(0, -c) * 2.6);
      bi[o] = P.pale[0]; bi[o + 1] = P.pale[1]; bi[o + 2] = P.pale[2]; bi[o + 3] = Math.round(ab * 255 * this.opacity);
      di[o] = 2; di[o + 1] = 5; di[o + 2] = 10; di[o + 3] = Math.round(ad * 255);
    }
    this.bright.getContext('2d').putImageData(this.brightImg, 0, 0);
    this.dark.getContext('2d').putImageData(this.darkImg, 0, 0);
  }

  draw(pointer) {
    const g = this.g, b = this.body, n = b.n, px = 1 / this.scale, mo = this.opacity;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.save();
    g.translate(this.cx, this.cy);
    g.scale(this.scale, this.scale);

    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += b.px[i] - b.rx[i]; my += b.py[i] - b.ry[i]; }
    mx /= n; my /= n;

    // ---- body volume ----
    const body = g.createRadialGradient(mx * 1.5 - 0.12, my * 1.5 - 0.15, 0.05, mx, my, 1.1);
    body.addColorStop(0, rgba(P.deep, 0.44 * mo));
    body.addColorStop(0.75, rgba(P.deep, 0.3 * mo));
    body.addColorStop(1, rgba(P.main, 0.1 * mo));
    pathOutline(g, b.px, b.py);
    g.fillStyle = body; g.fill();

    g.save();
    pathOutline(g, b.px, b.py);
    g.clip();

    // ---- volume: light scattered inside a thick translucent body (shifts with the material) ----
    g.globalCompositeOperation = 'lighter';
    const vol = g.createRadialGradient(-0.18 + mx * 2, -0.22 + my * 2, 0.05, 0.05 + mx, 0.08 + my, 1.05);
    vol.addColorStop(0, rgba(P.main, 0.11 * mo));
    vol.addColorStop(0.55, rgba(P.main, 0.05 * mo));
    vol.addColorStop(1, rgba(P.main, 0.015 * mo));
    g.fillStyle = vol; g.fillRect(-1.5, -1.5, 3, 3);
    g.globalCompositeOperation = 'source-over';

    // ---- density (driven by the interior field) ----
    const live = !b.settled || b.maxCompression > 0;
    if (live) this.updateDensity();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    const E = EXTENT, h2 = b.h / 2;
    if (live) g.drawImage(this.dark, -E - h2, -E - h2, 2 * E + 2 * h2, 2 * E + 2 * h2);

    // ---- folds: troughs (shadow) ----
    for (const f of this.folds) this.warp(f);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const f of this.folds) {
      this.polyline(f.wix, f.wiy);
      g.lineWidth = (6 + f.depth * 2) * px; g.strokeStyle = `rgba(3,7,13,${(0.22 * mo).toFixed(3)})`; g.stroke();
    }

    g.globalCompositeOperation = 'lighter';
    if (live) g.drawImage(this.bright, -E - h2, -E - h2, 2 * E + 2 * h2, 2 * E + 2 * h2);

    // ---- folds: membrane bodies + specular ridges ----
    for (const f of this.folds) {
      const dk = 1 - f.depth * 0.25;
      g.beginPath();
      g.moveTo(f.wox[0], f.woy[0]);
      for (let k = 1; k < FOLD_PTS; k++) g.lineTo(f.wox[k], f.woy[k]);
      for (let k = FOLD_PTS - 1; k >= 0; k--) g.lineTo(f.wix[k], f.wiy[k]);
      g.closePath();
      g.fillStyle = rgba(P.main, (0.075 * dk) * mo); g.fill();
      const ridge = Math.min(0.7, 0.18 * dk + Math.max(0, f.comp) * 2.6 + f.trail * 0.2);
      this.polyline(f.wox, f.woy);
      g.lineWidth = 10 * px; g.strokeStyle = rgba(P.main, (0.035 + ridge * 0.05) * mo); g.stroke();
      g.lineWidth = 4 * px; g.strokeStyle = rgba(P.pale, ridge * 0.16 * mo); g.stroke();
      g.lineWidth = (1 + f.depth * 0.2) * px; g.strokeStyle = rgba(P.white, ridge * 0.85 * mo); g.stroke();
    }

    // ---- thick Fresnel-style rim ----
    pathOutline(g, b.px, b.py);
    g.lineWidth = 34 * px; g.strokeStyle = rgba(P.main, 0.045 * mo); g.stroke();
    g.lineWidth = 14 * px; g.strokeStyle = rgba(P.pale, 0.05 * mo); g.stroke();
    g.lineWidth = 4 * px; g.strokeStyle = rgba(P.pale, 0.08 * mo); g.stroke();

    // ---- speculars: moved and stretched by the field and the interior pressure ----
    this.specular(-2.35 - b.pInt * 0.12, 0.84, 0.55, 0.026, 0.42, px);
    this.specular(-2.0 + b.pInt * 0.08, 0.72, 0.22, 0.014, 0.28, px);
    this.specular(0.75, 0.86, 0.35, 0.012, 0.1, px);
    g.restore();

    // ---- edge ----
    pathOutline(g, b.px, b.py);
    g.lineWidth = 1 * px;
    g.strokeStyle = rgba(P.pale, 0.32 * Math.min(1.5, mo));
    g.stroke();
    g.restore();

    // pointer mark (as in every condition)
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

  polyline(xs, ys) {
    const g = this.g;
    g.beginPath(); g.moveTo(xs[0], ys[0]);
    for (let k = 1; k < xs.length - 1; k++) g.quadraticCurveTo(xs[k], ys[k], (xs[k] + xs[k + 1]) / 2, (ys[k] + ys[k + 1]) / 2);
    g.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
  }

  /** A crescent highlight along an arc (angle a, radius r, span, width), displaced by the field. */
  specular(a, r, span, width, alpha, px) {
    const g = this.g, b = this.body, t = this.tmp, K = 14;
    g.beginPath();
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k <= K; k++) {
        const kk = pass ? K - k : k, s = kk / K, ang = a - span / 2 + span * s, prof = Math.sin(Math.PI * s);
        const rr = r + (pass ? -1 : 1) * width * prof * (1 + b.maxCompression * 2);
        const x0 = Math.cos(ang) * r, y0 = Math.sin(ang) * r;
        b.sample(x0, y0, b.ux, b.uy, t);
        const x = Math.cos(ang) * rr + t[0] * 1.6, y = Math.sin(ang) * rr + t[1] * 1.6;
        if (k === 0 && pass === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    }
    g.closePath();
    g.fillStyle = rgba(P.white, alpha * this.opacity);
    g.fill();
    void px;
  }
}
