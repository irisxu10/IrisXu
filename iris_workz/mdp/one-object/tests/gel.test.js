// Phase 03 — Gel / Flow acceptance tests (GelBody physics + research metrics).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GelBody } from '../src/physics/GelBody.js';
import { restOutline } from '../src/materials/sharedForm.js';
import { Simulation } from '../src/simulation/Simulation.js';

const SEED = 20261105, SEC = 60;
const outline = restOutline(SEED);
function gel(params = {}) {
  const events = [];
  const b = new GelBody(outline, SEED, params);
  b.onEvent = (type, fields) => events.push({ type, ...fields, t: b.timeMs });
  return { b, events };
}
const run = (b, k, inp) => { for (let i = 0; i < k; i++) { if (inp) b.setInput(typeof inp === 'function' ? inp(i) : inp); b.step(); } };
const sector = (b, lo, hi) => { let s = 0, c = 0; for (let i = 0; i < b.n; i++) { const a = (i / b.n) * 360; if (a >= lo && a <= hi) { s += b.radial[i]; c++; } } return s / c; };
const PRESS = { present: true, x: 1.0, y: 0, vx: 0, vy: 0, down: true };
const UP = { present: false, down: false, vx: 0, vy: 0 };

test('At rest the gel is the shared, approximately circular outline (not moving)', () => {
  const { b } = gel();
  run(b, 2 * SEC, { present: false, down: false, x: 3, y: 0, vx: 0, vy: 0 });
  assert.equal(b.maxDisp, 0, 'no displacement at rest');
  assert.ok(b.settled);
  for (let i = 0; i < b.n; i++) assert.ok(Math.abs(Math.hypot(b.px[i], b.py[i]) - outline[i]) < 1e-6);
});

test('Pressure redistribution: pressing one side moves it in, other regions expand, volume ≈ conserved', () => {
  const { b } = gel();
  run(b, SEC, PRESS);
  const near = sector(b, -10, 10) || b.radial[0];
  const far = sector(b, 120, 240), sides = (sector(b, 60, 110) + sector(b, 250, 300)) / 2;
  assert.ok(b.radial[0] < -0.15, `contacted region moves inward (${b.radial[0].toFixed(3)})`);
  assert.ok(far > 0.02, `far side expands outward (${far.toFixed(3)})`);
  assert.ok(sides > 0.01, `other regions expand too (${sides.toFixed(3)})`);
  assert.ok(Math.abs(b.area / b.A0 - 1) < 0.01, `area conserved within 1% (${((b.area / b.A0 - 1) * 100).toFixed(2)}%)`);
  void near;
});

test('Not a simple elastic dent: with redistribution off, nothing else expands and volume is lost', () => {
  const on = gel().b, off = gel({ pressure: 0 }).b;
  run(on, SEC, PRESS); run(off, SEC, PRESS);
  assert.ok(sector(on, 120, 240) > 5 * Math.max(1e-4, sector(off, 120, 240)), 'expansion comes from the pressure term');
  assert.ok(Math.abs(off.area / off.A0 - 1) > 3 * Math.abs(on.area / on.A0 - 1), 'pressure term conserves volume');
});

test('Viscous drag: slower than Structural, delayed neighbours, no springy overshoot', () => {
  const resp = (kind) => {
    let step, disp;
    if (kind === 'gel') { const b = gel().b; step = (i) => { b.setInput(i); b.step(); }; disp = () => Math.hypot(b.px[0] - b.rx[0], b.py[0] - b.ry[0]); }
    else { const s = new Simulation({}); step = (i) => { s.setInput(i); s.step(); }; disp = () => Math.hypot(s.body.dx[0], s.body.dy[0]); }
    step(PRESS);
    const d = []; for (let i = 0; i < 3 * SEC; i++) { step({ x: 1, y: 0.3 }); d.push(disp()); }
    return { t63: d.findIndex((v) => v > 0.63 * d.at(-1)) / 60, overshoot: Math.max(...d) / d.at(-1) };
  };
  const g = resp('gel'), s = resp('structural');
  assert.ok(g.t63 > 5 * s.t63, `gel responds much more slowly (gel ${g.t63.toFixed(2)} s vs structural ${s.t63.toFixed(2)} s)`);
  assert.ok(g.overshoot < 1.02, `no overshoot (peak/final ${g.overshoot.toFixed(3)})`);
  // neighbours follow with a delay: a node 45° away lags the contact
  const { b } = gel();
  b.setInput(PRESS); b.step();
  const nearT = [], nbrT = [];
  for (let i = 0; i < 2 * SEC; i++) { b.setInput({ x: 1, y: 0.35 }); b.step(); nearT.push(Math.hypot(b.px[0] - b.rx[0], b.py[0] - b.ry[0])); nbrT.push(Math.hypot(b.px[10] - b.rx[10], b.py[10] - b.ry[10])); }
  const t = (a) => a.findIndex((v) => v > 0.5 * a.at(-1));
  assert.ok(t(nbrT) > t(nearT), `neighbour reaches half its motion later (${t(nbrT)} vs ${t(nearT)} steps)`);
});

test('Release: motion continues briefly, then dissipates; settles to exact rest with no autonomous motion', () => {
  const { b, events } = gel();
  run(b, SEC, PRESS);
  run(b, 6, UP);
  assert.ok(b.meanSpeed > 1e-4, 'still moving just after release');
  let overshoot = 0;
  for (let i = 0; i < 10 * SEC; i++) { b.step(); overshoot = Math.max(overshoot, b.radial[0]); }
  assert.ok(overshoot < 0.005, `contact region does not spring past rest (${overshoot.toFixed(4)})`);
  assert.ok(b.settled && b.maxDisp === 0, 'exactly at rest after settling');
  const snap = Float32Array.from(b.px);
  run(b, 3 * SEC);
  assert.deepEqual(Array.from(b.px), Array.from(snap), 'no autonomous movement after settling');
  const rec = events.find((e) => e.type === 'recovery' && e.metadata.kind === 'settle');
  assert.ok(rec && rec.metadata.completed && rec.durationMs > 1500 && rec.durationMs < 8000, `recovery duration logged (${rec?.durationMs} ms)`);
});

test('Internal layers and flow lines move coherently with the deformation (and lag it)', () => {
  const { b } = gel();
  const restL0 = Float32Array.from(b.layers[0].x), restIn = Float32Array.from(b.layers[2].x);
  const trRest = Float32Array.from(b.trX);
  run(b, 12, PRESS);
  const outer = b.layers[0].x[0] - restL0[0], inner = b.layers[2].x[0] - restIn[0];
  assert.ok(outer < 0 && inner < 0, 'layers near the press move inward too');
  assert.ok(Math.abs(inner) < Math.abs(outer), 'inner layer lags the outer layer (layers slide relative to each other)');
  run(b, SEC, PRESS);
  let moved = 0; for (let j = 0; j < b.trX.length; j++) moved = Math.max(moved, Math.abs(b.trX[j] - trRest[j]));
  assert.ok(moved > 0.01, `flow lines are carried by the flow (${moved.toFixed(3)})`);
});

test('Stability: 3 minutes of repeated pressing and dragging stays bounded and finite', () => {
  const { b } = gel({ viscosity: 0.1, pressure: 2, recovery: 1, flow: 1.5 });
  let maxArea = 0;
  for (let s = 0; s < 3 * 60 * SEC; s++) {
    const t = s / SEC, a = t * 1.3, down = Math.floor(t * 2.5) % 3 !== 2;
    b.setInput({ present: true, down, x: Math.cos(a) * (0.9 + 0.5 * Math.sin(t * 7)), y: Math.sin(a) * (0.9 + 0.5 * Math.cos(t * 5)), vx: 3, vy: -3 });
    b.step();
    maxArea = Math.max(maxArea, Math.abs(b.area / b.A0 - 1));
    if (!(Number.isFinite(b.px[0]) && Number.isFinite(b.trX[0]))) assert.fail('non-finite state at ' + t.toFixed(2) + ' s');
  }
  assert.ok(b.maxDisp <= 0.45 + 1e-6, 'displacement bounded');
  assert.ok(maxArea < 0.2, `area stays within 20% under abuse (${(maxArea * 100).toFixed(1)}%)`);
  run(b, 12 * SEC, UP);
  assert.ok(b.settled, 'returns to rest afterwards');
});

test('Research metrics: contact location, duration, drag, peak deformation, redistribution, revisit', () => {
  const { b, events } = gel();
  run(b, 30, PRESS);
  run(b, 30, (i) => ({ present: true, down: true, x: 1, y: 0.01 * i, vx: 0, vy: 0.6 }));
  run(b, 1, UP);
  run(b, 2 * SEC, UP);
  run(b, 10, PRESS); run(b, 1, UP);
  const start = events.find((e) => e.type === 'contact_start'), end = events.find((e) => e.type === 'contact_end');
  assert.equal(start.region, 0); assert.equal(start.metadata.x, 1);
  assert.ok(Math.abs(end.durationMs - 1000) < 40, `duration ${end.durationMs}`);
  assert.ok(end.distance > 0.25, 'drag distance recorded');
  assert.ok(end.metadata.peakDeformation > 0.1 && end.metadata.redistribution > 0.01, JSON.stringify(end.metadata));
  assert.ok(end.metadata.peakVolumeChange < 0.02);
  assert.ok(events.some((e) => e.type === 'region_revisit'));
  assert.ok(events.some((e) => e.type === 'recovery' && e.metadata.completed === false), 'interrupted recovery recorded as incomplete');
  assert.equal(b.totals.contactEpisodes, 2);
});

test('Parameters change behaviour as labelled; reset restores the initial state; deterministic', () => {
  const t63 = (params) => { const b = gel(params).b; b.setInput(PRESS); b.step(); const d = []; for (let i = 0; i < 2 * SEC; i++) { b.setInput({ x: 1, y: 0.3 }); b.step(); d.push(Math.hypot(b.px[0] - b.rx[0], b.py[0] - b.ry[0])); } return d.findIndex((v) => v > 0.63 * d.at(-1)); };
  assert.ok(t63({ viscosity: 1 }) > t63({ viscosity: 0 }), 'higher viscosity → slower');
  const settle = (recovery) => { const { b, events } = gel({ recovery }); run(b, SEC, PRESS); run(b, 15 * SEC, UP); return events.find((e) => e.type === 'recovery').durationMs; };
  assert.ok(settle(1) < settle(0), 'higher recovery speed → faster settling');
  const flowLines = (flow) => { const b = gel({ flow }).b; run(b, SEC, PRESS); let m = 0; for (let j = 0; j < b.trX.length; j++) m = Math.max(m, Math.abs(b.trOX[j]) + Math.abs(b.trOY[j])); return m; };
  assert.ok(flowLines(1.5) > flowLines(0.2), 'flow intensity scales internal flow');
  const a = gel().b, c = gel().b;
  for (const g of [a, c]) { run(g, SEC, PRESS); run(g, 20, UP); }
  assert.deepEqual(Array.from(a.px), Array.from(c.px), 'deterministic');
  a.reset();
  assert.equal(a.maxDisp, 0); assert.equal(a.totals.contactEpisodes, 0); assert.equal(a.timeMs, 0); assert.equal(a.contact, null);
});
