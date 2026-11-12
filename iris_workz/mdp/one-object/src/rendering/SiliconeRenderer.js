// Condition 04 renderer (Canvas 2D) — a smooth, translucent silicone membrane.
//
// Everything that changes is read from SiliconeBody (no decorative animation):
//   body        smooth contour of the outer ring; translucent body fill
//   thickness   soft per-node shading from triangle area ratios: stretched →
//               thinner (clearer), compressed → denser (milkier) — cached
//               blob sprites, so no mesh seams are visible
//   sheets      two gentle overlapping membrane layers mapped through the mesh
//   bands       broad, smooth elastic bands mapped through the mesh; each part
//               thins and brightens with its local stretch, and the bands align
//               with the pull because they move with the membrane
//   rim         a soft inner rim (membrane thickness) + the shared pale edge
//   sheen       a satin highlight mapped through the mesh; its streak
//               lengthens and brightens with the strain beneath it
// Shares centre / diameter / outline with the other conditions (sharedForm).

import { stageScale, stageCentre, pathOutline, rgba, FORM_PALETTE as P } from '../materials/sharedForm.js';
import { mulberry32 } from '../util/math.js';

const BANDS = 7, BAND_PTS = 36, SHEET_PTS = 64;

export class SiliconeRenderer {
  constructor(canvas, body) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.body = body;
    this.opacity = 1;
    this.proximity = 0;
    this.t = [0, 0];
    const b = body, n = b.outer.length;
    this.ox = new Float32Array(n); this.oy = new Float32Array(n);
    const inner = Array.from({ length: 6 * (b.R - 1) }, (_, j) => b.ringStart[b.R - 1] + j);
    this.innerRing = inner; this.ix = new Float32Array(inner.length); this.iy = new Float32Array(inner.length);
    this.nodeRatio = new Float32Array(b.N);
    this.nodeCount = new Uint8Array(b.N);
    for (let c = 0; c < b.cellCount; c++) for (let m = 0; m < 3; m++) this.nodeCount[b.tris[3 * c + m]]++;
    this.buildGeometry();
    this.sprites();
    this.resize();
  }

  /** Seeded rest-space geometry: elastic bands and two soft sheets. */
  buildGeometry() {
    const rng = mulberry32((this.body.seed ^ 0x5c1a) >>> 0);
    this.bands = [];
    for (let i = 0; i < BANDS; i++) {
      const a0 = rng() * Math.PI * 2, a1 = a0 + Math.PI * (0.6 + rng() * 0.6);
      const x0 = Math.cos(a0) * 0.97, y0 = Math.sin(a0) * 0.97, x1 = Math.cos(a1) * 0.97, y1 = Math.sin(a1) * 0.97;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, bend = (rng() < 0.5 ? -1 : 1) * (0.28 + rng() * 0.3);
      const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const rx = new Float32Array(BAND_PTS), ry = new Float32Array(BAND_PTS);
      for (let k = 0; k < BAND_PTS; k++) {
        const t = k / (BAND_PTS - 1), u = 1 - t;
        const cx = mx + nx * bend, cy = my + ny * bend;           // quadratic bezier control point
        let x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        const m = Math.hypot(x, y); if (m > 0.97) { x *= 0.97 / m; y *= 0.97 / m; }
        rx[k] = x; ry[k] = y;
      }
      this.bands.push({ rx, ry, x: new Float32Array(BAND_PTS), y: new Float32Array(BAND_PTS), width: 14 + rng() * 10, hi: 0.15 + rng() * 0.06 });
    }
    this.sheets = [0.8, 0.58].map((s) => {
      const m = 2 + Math.floor(rng() * 2), amp = 0.04 + rng() * 0.04, ph = rng() * Math.PI * 2, ox = (rng() - 0.5) * 0.12, oy = (rng() - 0.5) * 0.12;
      const rx = new Float32Array(SHEET_PTS), ry = new Float32Array(SHEET_PTS);
      for (let k = 0; k < SHEET_PTS; k++) {
        const a = (k / SHEET_PTS) * Math.PI * 2, r = this.body.outR(a) * (s + amp * Math.sin(m * a + ph));
        rx[k] = Math.cos(a) * r + ox; ry[k] = Math.sin(a) * r + oy;
      }
      return { rx, ry, x: new Float32Array(SHEET_PTS), y: new Float32Array(SHEET_PTS) };
    });
  }

  /** Cached soft blob sprites (pale for compression, dark for thinning). */
  sprites() {
    const mk = (c, a) => {
      const s = document.createElement('canvas'); s.width = s.height = 64;
      const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return s;
    };
    this.paleBlob = mk(P.pale, 1);
    this.darkBlob = mk([2, 5, 10], 1);
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

  mapAll(item) { const t = this.t; for (let k = 0; k < item.rx.length; k++) { this.body.map(item.rx[k], item.ry[k], t); item.x[k] = t[0]; item.y[k] = t[1]; } }

  draw(pointer) {
    const g = this.g, b = this.body, px = 1 / this.scale, mo = this.opacity, live = !b.settled;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.save();
    g.translate(this.cx, this.cy);
    g.scale(this.scale, this.scale);

    for (let j = 0; j < b.outer.length; j++) { const i = b.outer[j]; this.ox[j] = b.px[i]; this.oy[j] = b.py[i]; }
    for (let j = 0; j < this.innerRing.length; j++) { const i = this.innerRing[j]; this.ix[j] = b.px[i]; this.iy[j] = b.py[i]; }
    let mx = 0, my = 0;
    for (let i = 0; i < b.N; i++) { mx += b.px[i] - b.rx[i]; my += b.py[i] - b.ry[i]; }
    mx /= b.N; my /= b.N;

    // ---- body ----
    const body = g.createRadialGradient(mx - 0.1, my - 0.12, 0.05, mx, my, 1.1);
    body.addColorStop(0, rgba(P.deep, 0.4 * mo));
    body.addColorStop(0.8, rgba(P.deep, 0.28 * mo));
    body.addColorStop(1, rgba(P.main, 0.12 * mo));
    pathOutline(g, this.ox, this.oy);
    g.fillStyle = body; g.fill();

    g.save();
    pathOutline(g, this.ox, this.oy);
    g.clip();

    // ---- thickness: stretched nodes clearer (dark), compressed nodes milkier (pale) ----
    if (live) {
      const nr = this.nodeRatio; nr.fill(0);
      for (let c = 0; c < b.cellCount; c++) { const r = b.cellRatio[c]; nr[b.tris[3 * c]] += r; nr[b.tris[3 * c + 1]] += r; nr[b.tris[3 * c + 2]] += r; }
      const blob = 0.22;
      for (let i = 0; i < b.N; i++) {
        const r = nr[i] / this.nodeCount[i], d = r - 1;
        if (d > 0.04) { g.globalAlpha = Math.min(0.32, d * 0.4); g.drawImage(this.darkBlob, b.px[i] - blob, b.py[i] - blob, 2 * blob, 2 * blob); }
      }
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < b.N; i++) {
        const r = nr[i] / this.nodeCount[i], d = 1 - r;
        if (d > 0.03) { g.globalAlpha = Math.min(0.045, d * 0.18) * mo; g.drawImage(this.paleBlob, b.px[i] - blob, b.py[i] - blob, 2 * blob, 2 * blob); }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }

    g.globalCompositeOperation = 'lighter';
    // ---- satin volume ----
    const t = this.t;
    b.map(-0.3, -0.34, t);
    const sv = g.createRadialGradient(t[0], t[1], 0.02, t[0] + 0.25, t[1] + 0.3, 1.0);
    sv.addColorStop(0, rgba(P.pale, 0.09 * mo)); sv.addColorStop(0.6, rgba(P.main, 0.03 * mo)); sv.addColorStop(1, rgba(P.main, 0));
    g.fillStyle = sv; g.fillRect(-1.6, -1.6, 3.2, 3.2);

    // ---- two gentle overlapping sheets ----
    for (const s of this.sheets) {
      this.mapAll(s);
      pathOutline(g, s.x, s.y);
      g.fillStyle = rgba(P.main, 0.03 * mo); g.fill();
      g.lineWidth = 7 * px; g.strokeStyle = rgba(P.main, 0.03 * mo); g.stroke();
      g.lineWidth = 0.9 * px; g.strokeStyle = rgba(P.pale, 0.07 * mo); g.stroke();
    }

    // ---- elastic bands: thin and brighten where stretched ----
    g.lineCap = 'round'; g.lineJoin = 'round';
    const CH = 4, per = (BAND_PTS - 1) / CH;
    for (const band of this.bands) {
      this.mapAll(band);
      // whole-band stretch: the soft body of the band thins as a whole
      let Lt = 0, Lt0 = 0;
      for (let k = 0; k < BAND_PTS - 1; k++) { Lt += Math.hypot(band.x[k + 1] - band.x[k], band.y[k + 1] - band.y[k]); Lt0 += Math.hypot(band.rx[k + 1] - band.rx[k], band.ry[k + 1] - band.ry[k]); }
      const thinAll = 1 / Math.sqrt(Math.max(0.5, Lt / Lt0));
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(band.x[0], band.y[0]);
      for (let k = 1; k < BAND_PTS; k++) g.lineTo(band.x[k], band.y[k]);
      g.lineWidth = band.width * thinAll * px; g.strokeStyle = rgba(P.main, 0.045 * mo); g.stroke();
      g.lineWidth = 5 * thinAll * px; g.strokeStyle = rgba(P.pale, 0.06 * mo); g.stroke();
      // thin highlight: per chunk, so local tension brightens and thins it (butt caps: no overlaps)
      g.lineCap = 'butt';
      for (let c = 0; c < CH; c++) {
        const k0 = Math.round(c * per), k1 = Math.round((c + 1) * per);
        let L = 0, L0 = 0;
        for (let k = k0; k < k1; k++) { L += Math.hypot(band.x[k + 1] - band.x[k], band.y[k + 1] - band.y[k]); L0 += Math.hypot(band.rx[k + 1] - band.rx[k], band.ry[k + 1] - band.ry[k]); }
        const stretch = L / L0, thin = 1 / Math.sqrt(Math.max(0.5, stretch)), tens = Math.max(0, stretch - 1);
        g.beginPath(); g.moveTo(band.x[k0], band.y[k0]);
        for (let k = k0 + 1; k <= k1; k++) g.lineTo(band.x[k], band.y[k]);
        g.lineWidth = 1.1 * thin * px; g.strokeStyle = rgba(P.white, Math.min(0.7, band.hi + tens * 1.3) * mo); g.stroke();
      }
    }

    // ---- satin specular streak: lengthens and brightens with the strain beneath it ----
    let sx = 0, sy = 0; b.map(-0.52, -0.6, t); sx = t[0]; sy = t[1];
    const tension = Math.min(1, b.maxStrain * 1.5), len = 0.22 + tension * 0.18;
    g.save(); g.translate(sx, sy); g.rotate(-0.85);
    const st = g.createLinearGradient(-len, 0, len, 0);
    st.addColorStop(0, rgba(P.white, 0)); st.addColorStop(0.5, rgba(P.white, (0.22 + tension * 0.18) * mo)); st.addColorStop(1, rgba(P.white, 0));
    g.fillStyle = st; g.beginPath(); g.ellipse(0, 0, len, 0.022, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    // ---- membrane thickness: soft inner rim ----
    pathOutline(g, this.ix, this.iy);
    g.lineWidth = 8 * px; g.strokeStyle = rgba(P.main, 0.04 * mo); g.stroke();
    g.lineWidth = 0.8 * px; g.strokeStyle = rgba(P.pale, 0.09 * mo); g.stroke();
    g.restore();

    // ---- edge ----
    pathOutline(g, this.ox, this.oy);
    g.lineWidth = 1 * px;
    g.strokeStyle = rgba(P.pale, 0.32 * Math.min(1.5, mo));
    g.stroke();
    g.restore();

    if (pointer?.present && pointer.type !== 'touch') {
      const sx2 = this.cx + pointer.x * this.scale, sy2 = this.cy + pointer.y * this.scale;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (b.contact) { g.beginPath(); g.arc(sx2, sy2, 2.5, 0, Math.PI * 2); g.fillStyle = 'rgba(244,249,255,0.6)'; g.fill(); }
      else if (this.proximity > 0.1) {
        g.beginPath(); g.arc(sx2, sy2, 6 + this.proximity * 5, 0, Math.PI * 2);
        g.lineWidth = 1; g.strokeStyle = `rgba(199,233,255,${(0.08 + this.proximity * 0.22).toFixed(3)})`; g.stroke();
      }
    }
  }
}
