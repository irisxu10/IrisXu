// Phase 05 — Silicone / Elasticity (condition 04) acceptance tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SiliconeBody } from '../src/physics/SiliconeBody.js';
import { GelBody } from '../src/physics/GelBody.js';
import { restOutline } from '../src/materials/sharedForm.js';

const SEED = 20261105, SEC = 60;
const outline = restOutline(SEED);
function sil(params = {}) {
  const events = [];
  const b = new SiliconeBody(outline, SEED, params);
  b.onEvent = (type, fields) => events.push({ type, ...fields });
  return { b, events };
}
const run = (b, k, inp) => { for (let i = 0; i < k; i++) { if (inp) b.setInput(typeof inp === 'function' ? inp(i) : inp); b.step(); } };
const UP = { present: false, down: false, vx: 0, vy: 0 };
/** press at (x0,y0), drag by (dx,dy) over 0.5 s, hold 0.5 s */
function pull(b, x0, y0, dx, dy) {
  b.setInput({ present: true, x: x0, y: y0, vx: 0, vy: 0, down: true }); b.step();
  run(b, 30, (s) => ({ present: true, down: true, x: x0 + dx * (s + 1) / 30, y: y0 + dy * (s + 1) / 30, vx: dx * 2, vy: dy * 2 }));
  run(b, 30, { present: true, down: true, x: x0 + dx, y: y0 + dy, vx: 0, vy: 0 });
  return b.footprint();
}
const disp = (b, i) => Math.hypot(b.px[i] - b.rx[i], b.py[i] - b.ry[i]);
const nearestNode = (b, x, y) => { let best = 0, bd = 1e9; for (let i = 0; i < b.N; i++) { const d = Math.hypot(b.rx[i] - x, b.ry[i] - y); if (d < bd) { bd = d; best = i; } } return best; };

test('Mesh: valid triangulated disk on the shared outline; untouched it stays exactly at rest', () => {
  const { b } = sil();
  let area = 0; for (let c = 0; c < b.cellCount; c++) { assert.ok(b.cellArea0[c] > 0, 'all triangles positively oriented'); area += b.cellArea0[c]; }
  let poly = 0; const o = b.outer; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; poly += b.rx[p] * b.ry[q] - b.rx[q] * b.ry[p]; }
  assert.ok(Math.abs(area - poly / 2) < 1e-4, 'triangles tile the outline exactly');
  for (const i of b.outer) { const a = Math.atan2(b.ry[i], b.rx[i]); assert.ok(Math.abs(Math.hypot(b.rx[i], b.ry[i]) - b.outR(a)) < 1e-5); }
  assert.ok(b.maxDegree <= 8, 'no singular high-degree node');
  run(b, 20 * SEC);
  assert.ok(b.settled && b.maxDisp === 0, 'no drift at rest');
});

test('Local stretch: the grabbed region follows the pointer, far regions barely move, no rigid translation', () => {
  const { b } = sil();
  const f = pull(b, 1, 0, 0.35, 0);
  assert.ok(f.dx > 0.18, `grabbed region follows outward (${f.dx.toFixed(3)})`);
  const far = disp(b, nearestNode(b, -0.95, 0));
  assert.ok(far < 0.2 * f.dx, `opposite side barely moves (${far.toFixed(3)})`);
  let cx = 0; for (let i = 0; i < b.N; i++) cx += b.px[i] - b.rx[i];
  assert.ok(Math.abs(cx / b.N) < 0.25 * f.dx, 'not a rigid-body translation');
  assert.equal(b.invertedCount(), 0);
});

test('Neighbours deform progressively and with delay (coherent membrane)', () => {
  const { b } = sil();
  const pts = [[0.9, 0], [0.65, 0], [0.4, 0], [0.1, 0]].map(([x, y]) => nearestNode(b, x, y));
  b.setInput({ present: true, x: 1, y: 0, vx: 0, vy: 0, down: true }); b.step();
  const hist = pts.map(() => []);
  run(b, 60, (s) => { const x = 1 + 0.3 * Math.min(1, (s + 1) / 10); return { present: true, down: true, x, y: 0, vx: 1.8, vy: 0 }; });
  // re-run recording
  const { b: c } = sil(); c.setInput({ present: true, x: 1, y: 0, vx: 0, vy: 0, down: true }); c.step();
  for (let s = 0; s < 60; s++) { const x = 1 + 0.3 * Math.min(1, (s + 1) / 10); c.setInput({ present: true, down: true, x, y: 0, vx: 1.8, vy: 0 }); c.step(); pts.forEach((i, k) => hist[k].push(disp(c, i))); }
  const finals = hist.map((h) => h.at(-1));
  for (let k = 1; k < finals.length; k++) assert.ok(finals[k] < finals[k - 1], `displacement falls off with distance (${finals.map((v) => v.toFixed(3)).join(' > ')})`);
  const half = (h) => h.findIndex((v) => v > 0.5 * h.at(-1));
  assert.ok(half(hist[2]) > half(hist[0]), `inner neighbour responds later (${half(hist[0])} vs ${half(hist[2])} steps)`);
});

test('Resistance increases with stretch (stiffening) and the stretch is capped by maxDeformation', () => {
  const ratio = (d, params) => { const { b } = sil(params); return pull(b, 1, 0, d, 0).dx / d; };
  assert.ok(ratio(0.6) < 0.8 * ratio(0.15), `less follow per unit at larger pulls (${ratio(0.15).toFixed(2)} → ${ratio(0.6).toFixed(2)})`);
  const lo = sil({ resistance: 0 }).b, hi = sil({ resistance: 1 }).b;
  assert.ok(pull(hi, 1, 0, 0.6, 0).dx < pull(lo, 1, 0, 0.6, 0).dx, 'higher stretch resistance → less stretch');
  const { b } = sil({ maxDeformation: 0.25 });
  pull(b, 0.5, 0.3, 2, 1.5);
  assert.ok(b.maxDisp <= 0.25 * 1.15 + 1e-6, `never exceeds the (safety-margined) maximum deformation (${b.maxDisp.toFixed(3)})`);
});

test('Release: accelerates back, overshoots slightly, oscillates briefly, settles to the initial form', () => {
  const { b, events } = sil();
  const f = pull(b, 1, 0, 0.35, 0);
  run(b, 1, UP);
  let minProj = 0, peakSpeed = 0;
  for (let s = 0; s < 6 * SEC; s++) { b.step(); const g = b.footprint(); minProj = Math.min(minProj, g.dx); peakSpeed = Math.max(peakSpeed, Math.hypot(g.vx, g.vy)); }
  assert.ok(peakSpeed > 0.004, 'accelerates toward equilibrium');
  const over = -minProj / f.dx;
  assert.ok(over > 0.05 && over < 0.5, `visible but slight overshoot (${(over * 100).toFixed(0)}% of the stretch)`);
  const rec = events.find((e) => e.type === 'recovery');
  assert.ok(rec.metadata.completed && rec.metadata.overshoots >= 1 && rec.metadata.overshoots <= 4, `brief oscillation (${rec.metadata.overshoots} crossings)`);
  assert.ok(rec.durationMs < 4000, `recovers in ${rec.durationMs} ms`);
  assert.ok(b.settled && b.maxDisp === 0, 'returns exactly to the initial form');
});

test('Repeated stretching is consistent (no memory, no adaptation)', () => {
  const { b, events } = sil();
  const peaks = [];
  for (let k = 0; k < 10; k++) { peaks.push(pull(b, 1, 0, 0.35, 0).dx); run(b, 1, UP); run(b, 6 * SEC, UP); }
  const spread = (Math.max(...peaks) - Math.min(...peaks)) / peaks[0];
  assert.ok(spread < 0.01, `identical response every time (spread ${(spread * 100).toFixed(2)}%)`);
  assert.equal(events.filter((e) => e.type === 'region_revisit').length, 9);
});

test('Visibly different from Gel: Silicone springs back past rest, Gel does not', () => {
  const s = sil().b; pull(s, 1, 0, -0.25, 0); run(s, 1, UP);
  let sMax = 0; for (let i = 0; i < 4 * SEC; i++) { s.step(); sMax = Math.max(sMax, s.footprint().dx); }
  const g = new GelBody(outline, SEED);
  g.setInput({ present: true, x: 1, y: 0, vx: 0, vy: 0, down: true }); for (let i = 0; i < 60; i++) g.step();
  g.setInput(UP); let gMax = -1; for (let i = 0; i < 4 * SEC; i++) { g.step(); gMax = Math.max(gMax, g.radial[0]); }
  assert.ok(sMax > 0.02, `silicone pushed in springs back OUT past rest (${sMax.toFixed(3)})`);
  assert.ok(gMax < 0.005, `gel flows back without overshoot (${gMax.toFixed(4)})`);
});

test('Normal stretching never folds the membrane (zero inverted triangles)', () => {
  for (const [x0, y0, dx, dy] of [[1, 0, 0.4, 0], [0, 0, 0.35, 0.2], [0.5, 0.3, 0.8, 0.6], [1, 0, -0.6, 0.1], [-0.3, -0.6, -0.5, -0.4]]) {
    const { b } = sil(); let maxInv = 0;
    b.setInput({ present: true, x: x0, y: y0, vx: 0, vy: 0, down: true }); b.step();
    run(b, 60, (s) => { maxInv = Math.max(maxInv, b.invertedCount()); const k = Math.min(1, (s + 1) / 30); return { present: true, down: true, x: x0 + dx * k, y: y0 + dy * k, vx: dx * 2, vy: dy * 2 }; });
    run(b, 1, UP); for (let s = 0; s < 4 * SEC; s++) { b.step(); maxInv = Math.max(maxInv, b.invertedCount()); }
    assert.equal(maxInv, 0, `pull (${x0},${y0})+(${dx},${dy}) folds no triangle`);
  }
});

test('Extreme pointer movement: no explosions, bounded, only momentary folds, full recovery', () => {
  for (const params of [{}, { stiffness: 1, resistance: 0, damping: 0, recovery: 0, maxDeformation: 0.8 }]) {
    const { b } = sil(params);
    let sumInv = 0, n = 0;
    for (let s = 0; s < 3 * 60 * SEC; s++) {
      const t = s / SEC;
      b.setInput({ present: true, down: Math.floor(t * 2) % 3 !== 2, x: Math.sin(t * 13) * 3, y: Math.cos(t * 7) * 3, vx: 50, vy: -50 });
      b.step();
      if (s % 30 === 0) { sumInv += b.invertedCount(); n++; }
      if (!Number.isFinite(b.px[200])) assert.fail('non-finite at ' + t.toFixed(2) + ' s');
    }
    const maxD = params.maxDeformation ?? 0.45;
    assert.ok(b.maxDisp <= maxD * 1.15 + 1e-6, 'bounded');
    assert.ok(sumInv / n < 0.01 * b.cellCount, `folding is rare and momentary under abuse (mean ${(sumInv / n).toFixed(2)} of ${b.cellCount} triangles, < 1%)`);
    run(b, 1, UP); run(b, 25 * SEC, UP);
    assert.ok(b.settled && b.invertedCount() === 0 && b.maxDisp === 0, 'recovers completely to the initial form');
  }
});

test('Research metrics: stretch distance, duration, peak deformation, release velocity, recovery duration', () => {
  const { b, events } = sil();
  b.setInput({ present: true, x: 0.3, y: 0.2, vx: 0, vy: 0, down: true }); b.step();
  run(b, 40, (s) => ({ present: true, down: true, x: 0.3 + 0.01 * (s + 1), y: 0.2, vx: 0.6, vy: 0 }));
  run(b, 1, UP); run(b, 6 * SEC, UP);
  const start = events.find((e) => e.type === 'contact_start'), end = events.find((e) => e.type === 'contact_end'), rec = events.find((e) => e.type === 'recovery');
  assert.equal(start.metadata.interior, true);
  assert.ok(Math.abs(end.durationMs - 683) < 40, `stretch duration ${end.durationMs}`);
  for (const k of ['stretchDistance', 'peakDeformation', 'peakStrain', 'releaseDisplacement']) assert.ok(end.metadata[k] > 0, k);
  assert.ok(end.metadata.stretchDistance > 0.15);
  assert.ok(rec.metadata.releaseVelocity > 0 && typeof rec.metadata.overshoots === 'number' && rec.durationMs > 300);
});

test('Parameters act as labelled; reset restores; deterministic', () => {
  const crossings = (damping) => { const { b, events } = sil({ damping }); pull(b, 1, 0, 0.35, 0); run(b, 1, UP); run(b, 20 * SEC, UP); return events.find((e) => e.type === 'recovery').metadata.overshoots; };
  assert.ok(crossings(1) < crossings(0), 'more damping → fewer oscillations');
  const settleMs = (recovery) => { const { b, events } = sil({ recovery }); pull(b, 1, 0, 0.35, 0); run(b, 1, UP); run(b, 20 * SEC, UP); return events.find((e) => e.type === 'recovery').durationMs; };
  assert.ok(settleMs(1) < settleMs(0), 'higher recovery speed → faster return');
  const stiff = (stiffness) => {
    const { b } = sil({ stiffness }); const f = pull(b, 1, 0, 0.35, 0); run(b, 1, UP);
    let cross = null; for (let s = 0; s < 3 * SEC && cross === null; s++) { b.step(); if (b.footprint().dx <= 0) cross = s; }
    return { follow: f.dx, cross };
  };
  const soft = stiff(0), hard = stiff(1);
  assert.ok(hard.follow < 0.9 * soft.follow, `stiffer membrane resists the pull more (${soft.follow.toFixed(3)} → ${hard.follow.toFixed(3)})`);
  assert.ok(hard.cross < soft.cross, `stiffer membrane springs back faster (${soft.cross} → ${hard.cross} steps)`);
  const a = sil().b, c = sil().b;
  for (const g of [a, c]) { pull(g, 0.2, -0.4, 0.3, 0.2); run(g, 20, UP); }
  assert.deepEqual(Array.from(a.px), Array.from(c.px), 'deterministic');
  a.reset();
  assert.equal(a.maxDisp, 0); assert.equal(a.contact, null); assert.equal(a.totals.contactEpisodes, 0); assert.equal(a.timeMs, 0);
});
