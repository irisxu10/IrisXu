// Condition 04 — Silicone / Elasticity (PLACEHOLDER: static texture only, no elastic physics yet).
// Texture: a few broad, smooth, taut elastic bands with soft edges and a
// satin sheen — smooth and continuous, neither fibrous (01), pooled (02)
// nor creased (03). Deliberately not nested contours (avoids a topographic look).

import { PlaceholderMaterial, rgba, FORM_PALETTE as P } from './PlaceholderMaterial.js';

export default class SiliconeMaterial extends PlaceholderMaterial {
  get textureSalt() { return 0x5c1; }

  drawTexture(c, rng, px) {
    // satin sheen: one broad soft highlight
    const sa = rng() * Math.PI * 2, sx = Math.cos(sa) * 0.35, sy = Math.sin(sa) * 0.35;
    const sheen = c.createRadialGradient(sx, sy, 0, sx, sy, 0.9);
    sheen.addColorStop(0, rgba(P.pale, 0.09));
    sheen.addColorStop(1, rgba(P.pale, 0));
    c.fillStyle = sheen; c.fillRect(-1.2, -1.2, 2.4, 2.4);
    // taut elastic bands: smooth gentle arcs edge to edge, broad and soft
    for (let i = 0; i < 8; i++) {
      const a0 = rng() * Math.PI * 2, a1 = a0 + Math.PI * (0.6 + rng() * 0.6);
      const x0 = Math.cos(a0) * 1.05, y0 = Math.sin(a0) * 1.05, x1 = Math.cos(a1) * 1.05, y1 = Math.sin(a1) * 1.05;
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, bend = (rng() - 0.5) * 0.35;
      const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx + nx * bend, my + ny * bend, x1, y1);
      c.lineCap = 'round';
      c.lineWidth = (14 + rng() * 10) * px; c.strokeStyle = rgba(P.main, 0.03); c.stroke();
      c.lineWidth = 5 * px; c.strokeStyle = rgba(P.pale, 0.045); c.stroke();
      c.lineWidth = 1 * px; c.strokeStyle = rgba(P.white, 0.15 + rng() * 0.06); c.stroke();
    }
  }
}
