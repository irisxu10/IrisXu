// Gel / Flow (condition 02) — volumetric interaction model: acceptance tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GelBody } from '../src/physics/GelBody.js';
import { restOutline, stageScale } from '../src/materials/sharedForm.js';

const SEED = 20261105, SEC = 60;
const outline = restOutline(SEED);
const PX = stageScale(1280, 800);      // CSS px per object unit on a 1280×800 screen
function gel(params = {}) {
  const events = [];
  const b = new GelBody(outline, SEED, params);
  b.onEvent = (type, fields) => events.push({ type, ...fields, t: b.timeMs });
  return { b, events };
}
const run = (b, k, inp) => { for (let i = 0; i < k; i++) { if (inp) b.setInput(typeof inp === 'function' ? inp(i) : inp); b.step(); } };
const press = (x, y) => ({ present: true, x, y, vx: 0, vy: 0, down: true });
const UP = { present: false, down: false, vx: 0, vy: 0 };
const meanOut = (b) => { let s = 0; for (let i = 0; i < b.n; i++) s += b.radial[i]; return s / b.n; };
const centroid = (b) => { let x = 0, y = 0; for (let i = 0; i < b.n; i++) { x += b.px[i] - b.rx[i]; y += b.py[i] - b.ry[i]; } return Math.hypot(x / b.n, y / b.n); };
const uAt = (b, x, y) => Math.hypot(...b.sample(x, y));

test('At rest: exact shared circular outline, interior at zero, nothing moves', () => {
  const { b } = gel();
  run(b, 2 * SEC, { present: true, down: false, x: 3, y: 0, vx: 0, vy: 0 });
  assert.equal(b.maxDisp, 0); assert.equal(b.maxU, 0); assert.ok(b.settled);
  for (let i = 0; i < b.n; i++) assert.ok(Math.abs(Math.hypot(b.px[i], b.py[i]) - outline[i]) < 1e-6);
});

test('CENTER PRESS produces a meaningful, visible deformation of the interior', () => {
  const { b } = gel();
  run(b, 6, press(0, 0));
  assert.ok(b.maxU * PX > 3, `perceptible within 0.1 s (${(b.maxU * PX).toFixed(1)} px)`);
  run(b, SEC, press(0, 0));
  // material around the finger is pushed radially outward
  const ring = [0, 1, 2, 3, 4, 5].map((k) => { const a = k * Math.PI / 3, x = Math.cos(a) * 0.22, y = Math.sin(a) * 0.22; const u = b.sample(x, y); return (u[0] * x + u[1] * y) / 0.22; });
  assert.ok(Math.min(...ring) > 0.04, `ring at r=0.22 pushed outward on all sides (min ${Math.min(...ring).toFixed(3)} = ${(Math.min(...ring) * PX).toFixed(0)} px)`);
  assert.ok(b.maxU * PX > 18, `interior displacement clearly visible (${(b.maxU * PX).toFixed(0)} px at 1280×800)`);
  assert.ok(b.maxCompression > 0.05, `compressed ring forms (−div u = ${b.maxCompression.toFixed(3)})`);
  assert.ok(centroid(b) < 0.005, 'no rigid-body translation');
});

test('Center press propagates to the contour with a delay (interior first, boundary later)', () => {
  const { b, events } = gel();
  run(b, 6, press(0, 0));
  const early = { u: b.maxU, out: meanOut(b) };
  run(b, 1.5 * SEC, press(0, 0));
  assert.ok(early.out < 0.004 && early.u > 0.01, `at 0.1 s the inside moves first (u ${early.u.toFixed(3)}, contour ${early.out.toFixed(4)})`);
  assert.ok(meanOut(b) > 0.02, `contour then swells outward (${meanOut(b).toFixed(3)} = ${(meanOut(b) * PX).toFixed(0)} px)`);
  run(b, 1, UP);
  const end = events.find((e) => e.type === 'contact_end');
  assert.ok(end.metadata.interior === true);
  assert.ok(end.metadata.pressurePropagationMs > 100 && end.metadata.pressurePropagationMs < 800, `propagation ${end.metadata.pressurePropagationMs} ms`);
});

test('Interior and boundary respond coherently (coupled, not independent)', () => {
  for (const [label, inp] of [['center', press(0, 0)], ['edge', press(1, 0)]]) {
    const { b } = gel();
    run(b, 1.2 * SEC, inp);
    let dot = 0, nb = 0, ni = 0;
    for (let i = 0; i < b.n; i++) {
      const [ux, uy] = b.sample(b.rx[i] * 0.88, b.ry[i] * 0.88), dx = b.px[i] - b.rx[i], dy = b.py[i] - b.ry[i];
      dot += ux * dx + uy * dy; nb += dx * dx + dy * dy; ni += ux * ux + uy * uy;
    }
    const corr = dot / Math.sqrt(nb * ni);
    assert.ok(corr > 0.8, `${label}: interior just inside the edge moves with the boundary (correlation ${corr.toFixed(2)})`);
  }
  // and the boundary can push the interior: an edge dent displaces interior material inward
  const { b } = gel();
  run(b, 1.2 * SEC, press(1, 0));
  const [ux] = b.sample(0.7, 0);
  assert.ok(ux < -0.02, `edge dent pushes interior material inward (${ux.toFixed(3)})`);
});

test('Off-center and edge presses: response is local to the press; edge press still redistributes', () => {
  const { b } = gel();
  run(b, SEC, press(0.45, -0.2));
  assert.ok(uAt(b, 0.45 + 0.2, -0.2) > 3 * uAt(b, -0.55, 0.3), 'displacement concentrated around the press point');
  assert.ok(centroid(b) < 0.01, 'no rigid translation');
  const e = gel().b;
  run(e, SEC, press(1, 0));
  let far = 0, c = 0; for (let i = 0; i < e.n; i++) { const a = (i / e.n) * 360; if (a > 120 && a < 240) { far += e.radial[i]; c++; } }
  assert.ok(e.radial[0] < -0.08, `edge press dents the contour (${e.radial[0].toFixed(3)})`);
  assert.ok(far / c > 0.01, `far side expands (${(far / c).toFixed(3)})`);
  assert.ok(Math.abs(e.area / e.A0 - 1) < 0.04, `area change stays small (${((e.area / e.A0 - 1) * 100).toFixed(1)}%)`);
});

test('Center drag: material follows with viscous lag, layers move at different rates, short flow history', () => {
  const { b } = gel();
  b.setInput(press(0, 0)); b.step();
  run(b, SEC, (i) => ({ present: true, down: true, x: 0.007 * i, y: 0.004 * i, vx: 0.42, vy: 0.24 }));
  const ptr = [0.42, 0.24], c = b.contact;
  assert.ok(Math.hypot(ptr[0] - c.ix, ptr[1] - c.iy) > 0.02, 'indenter lags behind the pointer (viscous)');
  const [ux, uy] = b.sample(0.15, 0.08);
  assert.ok(ux > 0.05 && uy > 0.02, `material near the path is carried in the drag direction (${ux.toFixed(3)}, ${uy.toFixed(3)})`);
  const surf = uAt(b, c.ix, c.iy), deep = Math.hypot(...b.sample(c.ix, c.iy, b.l2x, b.l2y));
  assert.ok(deep < surf * 0.7, `deep layer lags the surface layer (${deep.toFixed(3)} vs ${surf.toFixed(3)})`);
  assert.ok(b.trailMax() > 0.2, 'flow history along the path');
  assert.ok(centroid(b) < 0.01, 'no accidental rigid-body translation');
  run(b, 1, UP); run(b, 2 * SEC, UP);
  assert.ok(b.trailMax() < 0.2, 'flow history fades after release');
});

test('Slow vs fast drag: faster movement leaves a larger lag and a stronger transient disturbance', () => {
  const drag = (speed) => {
    const { b } = gel(); b.setInput(press(-0.3, 0)); run(b, 20, press(-0.3, 0));
    const steps = Math.round(0.6 / (speed / 60));
    let peakSpeed = 0;
    run(b, steps, (i) => { const x = -0.3 + (speed / 60) * i; return { present: true, down: true, x, y: 0, vx: speed, vy: 0 }; });
    const lag = Math.hypot(b.input.x - b.contact.ix, b.input.y - b.contact.iy);
    run(b, 1, UP); for (let i = 0; i < 30; i++) { b.step(); peakSpeed = Math.max(peakSpeed, b.meanUSpeed); }
    return { lag, peakSpeed };
  };
  const slow = drag(0.3), fast = drag(2.4);
  assert.ok(fast.lag > 2 * slow.lag, `lag grows with speed (${slow.lag.toFixed(3)} → ${fast.lag.toFixed(3)})`);
  assert.ok(fast.peakSpeed > slow.peakSpeed, `fast drag leaves more motion after release (${slow.peakSpeed.toExponential(1)} → ${fast.peakSpeed.toExponential(1)})`);
});

test('Long hold reaches a stable compressed state (no endless motion while held)', () => {
  const { b } = gel();
  run(b, 3 * SEC, press(0.1, 0.1));
  const u3 = b.maxU, out3 = meanOut(b);
  run(b, 2 * SEC, press(0.1, 0.1));
  assert.ok(Math.abs(b.maxU - u3) / u3 < 0.02 && Math.abs(meanOut(b) - out3) < 0.002, 'state stops changing under a sustained hold');
  assert.ok(b.meanUSpeed < 2e-5 && b.meanSpeed < 2e-5, 'material is at rest under the finger');
});

test('Release: pressure relaxes, deformation dissipates, motion stops completely', () => {
  const { b, events } = gel();
  run(b, 1.5 * SEC, press(0, 0));
  run(b, 6, UP);
  assert.ok(b.meanUSpeed > 1e-4, 'still moving just after release');
  run(b, 8 * SEC, UP);
  assert.ok(b.settled && b.maxDisp === 0 && b.maxU === 0 && b.pInt === 0, 'exact rest');
  const snap = Float32Array.from(b.ux);
  run(b, 2 * SEC, UP);
  assert.deepEqual(Array.from(b.ux), Array.from(snap), 'no autonomous motion afterwards');
  const rec = events.find((e) => e.type === 'recovery');
  assert.ok(rec.metadata.completed && rec.durationMs > 300 && rec.durationMs < 6000, `recovery ${rec.durationMs} ms`);
});

test('Repeated pressing anywhere stays stable and bounded', () => {
  const { b } = gel({ viscosity: 0, pressure: 2, recovery: 1, flow: 1.5 });
  for (let k = 0; k < 120; k++) {
    const a = k * 2.399, r = 0.95 * Math.sqrt((k % 10) / 10);
    run(b, 8, press(Math.cos(a) * r, Math.sin(a) * r)); run(b, 4, UP);
  }
  for (let s = 0; s < 3 * 60 * SEC; s++) { const t = s / SEC; b.setInput({ present: true, down: Math.floor(t * 3) % 4 !== 3, x: Math.cos(t * 1.7) * 0.8 * Math.sin(t), y: Math.sin(t * 1.7) * 0.9, vx: 4, vy: -4 }); b.step(); }
  assert.ok(b.px.every(Number.isFinite) && b.ux.every(Number.isFinite), 'finite');
  assert.ok(b.maxDisp <= 0.45 + 1e-6 && b.maxU <= 0.4 + 1e-6, 'bounded');
  run(b, 12 * SEC, UP);
  assert.ok(b.settled, 'returns to rest afterwards');
});

test('Research metrics: interior position, local compression, internal displacement, propagation, recovery', () => {
  const { b, events } = gel();
  run(b, 40, press(0.2, 0.1));
  run(b, 30, (i) => ({ present: true, down: true, x: 0.2 + 0.01 * i, y: 0.1, vx: 0.6, vy: 0 }));
  run(b, 1, UP); run(b, 3 * SEC, UP);
  run(b, 8, press(0.2, 0.12)); run(b, 1, UP);   // same region again → revisit
  const start = events.find((e) => e.type === 'contact_start'), end = events.find((e) => e.type === 'contact_end');
  assert.equal(start.metadata.interior, true); assert.equal(start.metadata.x, 0.2);
  assert.ok(start.metadata.depthFromEdge > 0.7);
  for (const k of ['peakDeformation', 'localCompression', 'internalDisplacement', 'redistribution', 'pressurePropagationMs', 'peakVolumeChange']) assert.ok(k in end.metadata, k);
  assert.ok(end.metadata.localCompression > 0.03 && end.metadata.internalDisplacement > 0.05, JSON.stringify(end.metadata));
  assert.ok(end.distance > 0.25 && Math.abs(end.durationMs - 1167) < 40);
  assert.ok(events.some((e) => e.type === 'recovery' && e.metadata.completed));
  assert.ok(events.some((e) => e.type === 'region_revisit'));
  assert.equal(b.totals.interiorContacts, 2);
});

test('Parameters act as labelled; reset restores the initial state; deterministic', () => {
  const lag = (viscosity) => { const { b } = gel({ viscosity }); b.setInput(press(-0.3, 0)); b.step(); run(b, 20, (i) => ({ present: true, down: true, x: -0.3 + 0.03 * i, y: 0, vx: 1.8, vy: 0 })); return Math.hypot(b.input.x - b.contact.ix, b.input.y - b.contact.iy); };
  assert.ok(lag(1) > lag(0), 'higher viscosity → more lag');
  const spread = (pressure) => { const { b } = gel({ pressure }); run(b, 1.5 * SEC, press(0, 0)); return meanOut(b); };
  assert.ok(spread(1) > 2 * spread(0.2), 'pressure redistribution scales how far the contour spreads');
  const settle = (recovery) => { const { b, events } = gel({ recovery }); run(b, SEC, press(1, 0)); run(b, 15 * SEC, UP); return events.find((e) => e.type === 'recovery').durationMs; };
  assert.ok(settle(1) < settle(0), 'higher recovery speed → faster recovery');
  const inner = (flow) => { const { b } = gel({ flow }); run(b, SEC, press(0, 0)); return b.maxU; };
  assert.ok(inner(1.5) > inner(0.2), 'flow intensity scales the interior response');
  const a = gel().b, c = gel().b;
  for (const g of [a, c]) { run(g, SEC, press(0.3, 0.2)); run(g, 20, UP); }
  assert.deepEqual(Array.from(a.ux), Array.from(c.ux), 'deterministic');
  a.reset();
  assert.equal(a.maxU, 0); assert.equal(a.pInt, 0); assert.equal(a.totals.contactEpisodes, 0); assert.equal(a.contact, null);
});
