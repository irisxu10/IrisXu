// Condition 03 — Plastic / Crease (PLACEHOLDER: static texture only, no crease physics yet).
// Texture: straight crease lines crossing the form; overlapping half-plane
// tints produce flat, faceted tonal planes like folded sheet plastic.

import { PlaceholderMaterial, rgba, FORM_PALETTE as P } from './PlaceholderMaterial.js';

export default class PlasticMaterial extends PlaceholderMaterial {
  get textureSalt() { return 0x91a; }

  drawTexture(c, rng, px) {
    const creases = [];
    for (let i = 0; i < 9; i++) {
      const ang = rng() * Math.PI, off = (rng() - 0.5) * 1.3;   // line: n·p = off, n = (cos, sin)
      creases.push({ nx: Math.cos(ang), ny: Math.sin(ang), off });
    }
    // facets: tint one side of each crease (overlaps step the tone)
    for (const k of creases) {
      const tx = -k.ny, ty = k.nx, bx = k.nx * k.off, by = k.ny * k.off, L = 2.5;
      c.beginPath();
      c.moveTo(bx + tx * L, by + ty * L);
      c.lineTo(bx - tx * L, by - ty * L);
      c.lineTo(bx - tx * L + k.nx * L, by - ty * L + k.ny * L);
      c.lineTo(bx + tx * L + k.nx * L, by + ty * L + k.ny * L);
      c.closePath();
      c.fillStyle = rgba(P.main, 0.013 + rng() * 0.01);
      c.fill();
    }
    // crease lines: crisp, straight, with a faint parallel highlight
    for (const k of creases) {
      const tx = -k.ny, ty = k.nx, bx = k.nx * k.off, by = k.ny * k.off, L = 2.5;
      c.beginPath(); c.moveTo(bx + tx * L, by + ty * L); c.lineTo(bx - tx * L, by - ty * L);
      c.lineWidth = 0.9 * px; c.strokeStyle = rgba(P.white, 0.26 + rng() * 0.12); c.stroke();
      const o = 2.2 * px;
      c.beginPath(); c.moveTo(bx + tx * L + k.nx * o, by + ty * L + k.ny * o); c.lineTo(bx - tx * L + k.nx * o, by - ty * L + k.ny * o);
      c.lineWidth = 0.6 * px; c.strokeStyle = rgba(P.pale, 0.08); c.stroke();
    }
  }
}
