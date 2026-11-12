// Condition 02 renderer (Canvas 2D). Draws a GelBody:
//   body       deformed contour, translucent icy-blue fill whose density centre
//              shifts with the deformation (smooth gradient of density)
//   layers     3 soft overlapping liquid layers (low alpha, additive) that lag
//              the boundary and slide relative to each other
//   flow       soft flow lines carried by the internal flow field
//   refraction a thin inner-rim highlight that brightens where the gel is
//              compressed, and one soft specular highlight drifting against the
//              deformation (a refraction cue) — no glow, no bloom
//   edge       the same pale edge as every condition
// Shares centre / diameter / outline with the other conditions (sharedForm).

import { stageScale, stageCentre, pathOutline, rgba, FORM_PALETTE as P } from '../materials/sharedForm.js';

export class GelRenderer {
  constructor(canvas, body) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.body = body;
    this.opacity = 1;
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

  draw(pointer) {
    const g = this.g, b = this.body, n = b.n, px = 1 / this.scale, mo = this.opacity;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.save();
    g.translate(this.cx, this.cy);
    g.scale(this.scale, this.scale);

    // displacement centroid → where the gel's density has shifted
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += b.px[i] - b.rx[i]; my += b.py[i] - b.ry[i]; }
    mx /= n; my /= n;

    // body volume (same stops as the shared form, centre follows the density shift)
    const body = g.createRadialGradient(mx * 1.5, my * 1.5, 0.05, mx, my, 1.1);
    body.addColorStop(0, rgba(P.deep, 0.4 * mo));
    body.addColorStop(0.8, rgba(P.deep, 0.27 * mo));
    body.addColorStop(1, rgba(P.main, 0.12 * mo));
    pathOutline(g, b.px, b.py);
    g.fillStyle = body; g.fill();

    g.save();
    pathOutline(g, b.px, b.py);
    g.clip();
    g.globalCompositeOperation = 'lighter';

    // overlapping liquid layers
    for (const L of b.layers) {
      let lx = 0, ly = 0;
      for (let i = 0; i < n; i++) { lx += L.x[i]; ly += L.y[i]; }
      lx /= n; ly /= n;
      const lg = g.createRadialGradient(lx, ly, 0.02, lx, ly, L.s * 1.05);
      lg.addColorStop(0, rgba(P.pale, 0.05 * mo));
      lg.addColorStop(0.7, rgba(P.main, 0.035 * mo));
      lg.addColorStop(1, rgba(P.main, 0.012 * mo));
      pathOutline(g, L.x, L.y);
      g.fillStyle = lg; g.fill();
      // soft layer edges only — density, not contour lines
      g.lineWidth = 9 * px; g.strokeStyle = rgba(P.main, 0.028 * mo); g.stroke();
      g.lineWidth = 0.8 * px; g.strokeStyle = rgba(P.pale, 0.055 * mo); g.stroke();
    }

    // flow lines
    g.lineCap = 'round'; g.lineJoin = 'round';
    const T = b.tracerCount, M = b.tracerPoints;
    for (let c = 0; c < T; c++) {
      g.beginPath();
      const o = c * M;
      g.moveTo(b.trX[o], b.trY[o]);
      for (let k = 1; k < M - 1; k++) {
        const j = o + k;
        g.quadraticCurveTo(b.trX[j], b.trY[j], (b.trX[j] + b.trX[j + 1]) / 2, (b.trY[j] + b.trY[j + 1]) / 2);
      }
      g.lineTo(b.trX[o + M - 1], b.trY[o + M - 1]);
      g.lineWidth = 4.5 * px; g.strokeStyle = rgba(P.main, 0.04 * mo); g.stroke();
      g.lineWidth = 1.1 * px; g.strokeStyle = rgba(P.pale, 0.17 * mo); g.stroke();
    }

    // specular highlight, drifting against the deformation (refraction cue)
    const sx = -0.32 - mx * 1.6, sy = -0.36 - my * 1.6;
    const sp = g.createRadialGradient(sx, sy, 0, sx, sy, 0.42);
    sp.addColorStop(0, rgba(P.white, 0.06 * mo));
    sp.addColorStop(1, rgba(P.white, 0));
    g.fillStyle = sp; g.fillRect(-1.5, -1.5, 3, 3);

    // inner-rim highlight: brighter where compressed (inward displacement), in 3 alpha bands
    const ix = this.ix || (this.ix = new Float32Array(n)), iy = this.iy || (this.iy = new Float32Array(n));
    for (let i = 0; i < n; i++) { ix[i] = b.px[i] * 0.965; iy[i] = b.py[i] * 0.965; }
    for (let band = 0; band < 3; band++) {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, comp = -(b.radial[i] + b.radial[j]) / 2;
        const lvl = comp > 0.12 ? 2 : comp > 0.04 ? 1 : 0;
        if (lvl !== band) continue;
        g.moveTo(ix[i], iy[i]); g.lineTo(ix[j], iy[j]);
      }
      g.lineWidth = (0.8 + band * 0.5) * px;
      g.strokeStyle = rgba(P.pale, (0.09 + band * 0.12) * mo);
      g.stroke();
    }
    g.restore();

    // edge — identical treatment to the shared form
    pathOutline(g, b.px, b.py);
    g.lineWidth = 1 * px;
    g.strokeStyle = rgba(P.pale, 0.32 * Math.min(1.5, mo));
    g.stroke();
    g.restore();

    // pointer mark (as in every condition)
    if (pointer?.present && pointer.type !== 'touch') {
      const sxp = this.cx + pointer.x * this.scale, syp = this.cy + pointer.y * this.scale;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (b.contact) {
        g.beginPath(); g.arc(sxp, syp, 2.5, 0, Math.PI * 2); g.fillStyle = 'rgba(244,249,255,0.6)'; g.fill();
      } else if (this.proximity > 0.1) {
        g.beginPath(); g.arc(sxp, syp, 6 + this.proximity * 5, 0, Math.PI * 2);
        g.lineWidth = 1; g.strokeStyle = `rgba(199,233,255,${(0.08 + this.proximity * 0.22).toFixed(3)})`; g.stroke();
      }
    }
  }
}
