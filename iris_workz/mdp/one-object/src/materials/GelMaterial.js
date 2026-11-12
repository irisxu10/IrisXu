// Condition 02 — Gel / Flow (PLACEHOLDER: static texture only, no gel physics yet).
// Texture: soft rounded pools of light and a few slow, smooth flowing curves —
// no straight lines, no sharp edges.

import { PlaceholderMaterial, rgba, FORM_PALETTE as P } from './PlaceholderMaterial.js';

export default class GelMaterial extends PlaceholderMaterial {
  get textureSalt() { return 0x6e1; }

  drawTexture(c, rng, px) {
    // soft pools
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.62;
      const x = Math.cos(a) * r, y = Math.sin(a) * r, R = 0.22 + rng() * 0.3;
      const g = c.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgba(P.pale, 0.075 + rng() * 0.04));
      g.addColorStop(0.6, rgba(P.main, 0.03));
      g.addColorStop(1, rgba(P.main, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
    }
    // slow flowing curves (smooth, soft-edged)
    for (let i = 0; i < 13; i++) {
      const y0 = -0.9 + (i + rng() * 0.6) * (1.8 / 13), amp = 0.06 + rng() * 0.1, ph = rng() * Math.PI * 2, tilt = (rng() - 0.5) * 0.5;
      c.beginPath();
      for (let k = 0; k <= 40; k++) {
        const x = -1.1 + (2.2 * k) / 40;
        const y = y0 + tilt * x + amp * Math.sin(x * 2.2 + ph) + 0.03 * Math.sin(x * 5.1 + ph * 1.7);
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.lineCap = 'round';
      c.lineWidth = 5 * px; c.strokeStyle = rgba(P.main, 0.035); c.stroke();
      c.lineWidth = 1.3 * px; c.strokeStyle = rgba(P.pale, 0.16 + rng() * 0.08); c.stroke();
    }
  }
}
