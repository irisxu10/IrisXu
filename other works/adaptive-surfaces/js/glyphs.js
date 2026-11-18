/* ==========================================================================
   Line glyphs — abstract surface structures, one per strategy.
   Drawn as single-weight strokes so they can "draw in" (stroke-dashoffset).
   Not illustrations of the animals: they describe the surface logic.
   ========================================================================== */

window.AS = window.AS || {};

AS.glyphs = (function () {
  const P = 'pathLength="1"';
  const svg = (inner) =>
    `<svg class="glyph" viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
  const f = (n) => n.toFixed(2);

  // PROTECT — nested scutes
  function hex(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 2;
      d += (i ? 'L' : 'M') + f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
    }
    return d + 'Z';
  }
  const turtle = svg([27, 18, 9].map((r) => `<path ${P} d="${hex(32, 32, r)}"/>`).join(''));

  // COLLECT — channels converging to a centre
  let thornyInner = `<circle ${P} cx="32" cy="32" r="3"/>`;
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 / 14) * i;
    thornyInner += `<path ${P} d="M${f(32 + 27 * Math.cos(a))} ${f(32 + 27 * Math.sin(a))}L${f(32 + 7 * Math.cos(a))} ${f(32 + 7 * Math.sin(a))}"/>`;
  }
  const thorny = svg(thornyInner);

  // CAMOUFLAGE — overlapping fields
  const chameleon = svg(
    `<circle ${P} cx="25" cy="27" r="15"/>` +
    `<circle ${P} cx="39" cy="27" r="15"/>` +
    `<circle ${P} cx="32" cy="39" r="15"/>`
  );

  // GRIP — lamellae
  let geckoInner = '';
  for (let i = 0; i < 8; i++) {
    const y = 14 + i * 5.4;
    geckoInner += `<path ${P} d="M12 ${f(y + 4)}Q32 ${f(y - 4)} 52 ${f(y + 4)}"/>`;
  }
  const gecko = svg(geckoInner);

  // TRANSFORM — two waves exchanging position
  function wave(sign, shift) {
    let d = '';
    for (let x = 6; x <= 58; x += 2) {
      const y = 32 + sign * 13 * Math.sin((x - 6) / 52 * Math.PI * 2 + shift);
      d += (x === 6 ? 'M' : 'L') + x + ' ' + f(y);
    }
    return `<path ${P} d="${d}"/>`;
  }
  const snake = svg(wave(1, 0) + wave(-1, 0) + wave(1, Math.PI / 2));

  return { turtle, thorny, chameleon, gecko, snake };
})();
