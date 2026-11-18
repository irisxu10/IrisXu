/* ==========================================================================
   REPTILE SURFACE MICRO-PATTERNS
   --------------------------------------------------------------------------
   Five abstract surface structures, drawn like banknote micro-printing
   (single-weight strokes, no fills). Each is an SVG <pattern> tile, so a
   whole field is one element, not thousands.

     turtle     shell scute geometry
     thorny     spike structures + branching water channels
     chameleon  bead-like cellular scale fields
     gecko      hexagonal microstructure + toe-pad lamellae
     snake      overlapping scale lattice

   AS.patterns.svg(id) → an <svg> filled with that pattern (used in the strips).
   The midground layer (#mid) is also built here: the patterns emerge from
   the curves along the journey and dissolve back into them, together with
   the recurring security-thread motif.
   ========================================================================== */

window.AS = window.AS || {};

AS.patterns = (function () {
  let uid = 0;

  // Classic hexagon lattice tile (56 × 100)
  const HEX = 'M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100M28 0L28 -34';

  const TILES = {
    turtle: [
      { w: 56, h: 100, scale: 1.9, d: HEX },
      { w: 56, h: 100, scale: 1.9, d: 'M28 56L9 45L9 21L28 10L47 21L47 45Z', opacity: 0.55 },  // inner growth ring
    ],
    thorny: [
      { w: 140, h: 140, scale: 1.2, d:
        'M0 70C30 64 45 44 70 40S112 60 140 70' +
        'M70 0C66 14 74 28 70 40M70 40C78 70 62 104 70 140' +
        'M0 120C24 118 46 112 66 98M140 20C120 24 104 32 92 50' +
        'M28 22l4 -9l4 9M104 84l4 -9l4 9M38 96l4 -9l4 9M116 126l4 -9l4 9M10 44l3 -7l3 7' },
    ],
    chameleon: [
      { w: 14, h: 24, scale: 1.1, d:
        'M12.6 6a5.6 5.6 0 1 1 -11.2 0a5.6 5.6 0 1 1 11.2 0' +
        'M5.6 18a5.6 5.6 0 1 1 -11.2 0a5.6 5.6 0 1 1 11.2 0' +
        'M19.6 18a5.6 5.6 0 1 1 -11.2 0a5.6 5.6 0 1 1 11.2 0' },
    ],
    gecko: [
      { w: 56, h: 100, scale: 0.5, d: HEX, opacity: 0.7 },
      { w: 90, h: 14, scale: 1, d: 'M0 12Q45 2 90 12' },
    ],
    snake: [
      { w: 24, h: 16, scale: 1.5, d: 'M0 16Q12 2 24 16M-12 8Q0 -6 12 8M12 8Q24 -6 36 8' },
    ],
  };

  function svg(id) {
    const layers = TILES[id] || [];
    let defs = '', rects = '';
    layers.forEach((L) => {
      const pid = `asp-${id}-${++uid}`;
      defs +=
        `<pattern id="${pid}" width="${L.w}" height="${L.h}" patternUnits="userSpaceOnUse"` +
        ` patternTransform="scale(${L.scale})"><path d="${L.d}"/></pattern>`;
      rects += `<rect width="100%" height="100%" fill="url(#${pid})"${L.opacity ? ` opacity="${L.opacity}"` : ''}/>`;
    });
    return `<svg class="pattern-svg" width="100%" height="100%" aria-hidden="true"><defs>${defs}</defs>${rects}</svg>`;
  }

  return { svg };
})();

/* --------------------------------------------------------------------------
   MIDGROUND — patterns + thread motifs placed along the journey.
   The midground travels at 0.85× the camera, so a pattern that should sit
   centre-screen when the camera is at position c lives at 0.85·c + 0.5.
   -------------------------------------------------------------------------- */
(function () {
  const mid = document.getElementById('mid');
  if (!mid || !AS.WORLD) return;
  const { pin, transform: T, threads } = AS.WORLD;
  const MID = 0.85;
  const at = (cam, screen) => MID * cam + screen;

  AS.notes.forEach((n, i) => {
    // centred on screen while its strip is mid-transformation
    const cam = pin.start + T.start + i * T.every + T.span / 2;
    const width = 1.35;
    const el = document.createElement('div');
    el.className = `mid-pattern mid-pattern--${n.id}`;
    el.style.setProperty('--x', (at(cam, 0.5) - width / 2).toFixed(3));
    el.style.setProperty('--w', width);
    el.style.setProperty('--accent', n.accent);
    el.innerHTML = AS.patterns.svg(n.id);
    mid.appendChild(el);
  });

  (threads || []).forEach((t, i) => {
    const [cam, opacity] = Array.isArray(t) ? t : [t];
    const el = document.createElement('span');
    el.className = 'mid-thread';
    el.style.setProperty('--x', at(cam, 0.5).toFixed(3));
    if (opacity != null) el.style.opacity = opacity;
    el.style.setProperty('--d', `${-i * 3.1}s`);
    mid.appendChild(el);
  });
})();
