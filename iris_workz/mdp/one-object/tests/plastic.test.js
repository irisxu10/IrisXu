// Phase 06 — Plastic / Crease (condition 03) acceptance tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlasticBody, polyArea } from '../src/physics/PlasticBody.js';
import { SiliconeBody } from '../src/physics/SiliconeBody.js';
import { GelBody } from '../src/physics/GelBody.js';
import { restOutline } from '../src/materials/sharedForm.js';

const SEED = 20261105, SEC = 60;
const outline = restOutline(SEED);
function pl(params = {}) {
  const events = [];
  const b = new PlasticBody(outline, SEED, params);
  b.onEvent = (type, fields) => events.push({ type, ...fields });
  return { b, events };
}
const run = (b, k, inp) => { for (let i = 0; i < k; i++) { if (inp) b.setInput(typeof inp === 'function' ? inp(i) : inp); b.step(); } };
const UP = { present: false, down: false, vx: 0, vy: 0 };
/** press at (x0,y0), drag by (dx,dy) over 0.5 s, hold 0.4 s (returns without releasing) */
function press(b, x0, y0, dx, dy) {
  b.setInput({ present: true, x: x0, y: y0, vx: 0, vy: 0, down: true }); b.step();
  run(b, 30, (s) => ({ present: true, down: true, x: x0 + dx * (s + 1) / 30, y: y0 + dy * (s + 1) / 30, vx: dx * 2, vy: dy * 2 }));
  run(b, 24, { present: true, down: true, x: x0 + dx, y: y0 + dy, vx: 0, vy: 0 });
}
const release = (b, steps = 2 * SEC) => run(b, steps, UP);
const gesture = (b, x0, y0, dx, dy) => { press(b, x0, y0, dx, dy); release(b); };
/** Current position of a rest-space point (topmost facet containing it in rest space). */
function where(b, x, y) {
  let best = null;
  for (const f of b.facets) {
    const n = f.x.length; let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) if ((f.y[i] > y) !== (f.y[j] > y) && x < ((f.x[j] - f.x[i]) * (y - f.y[i])) / (f.y[j] - f.y[i]) + f.x[i]) c = !c;
    if (c && (!best || f.layer > best.layer)) best = f;
  }
  const M = best.M;
  return [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
}
const snap = (b) => JSON.stringify(b.facets.map((f) => [f.M.map((v) => +v.toFixed(9)), f.x.length, f.layer]));

test('Rest: one flat facet on the shared outline; untouched it never moves', () => {
  const { b } = pl();
  assert.equal(b.facets.length, 1);
  assert.ok(Math.abs(b.totalArea() - b.restArea) < 1e-9);
  const s0 = snap(b);
  run(b, 20 * SEC);
  assert.equal(snap(b), s0);
  assert.equal(b.metrics.projectedArea, 1);
});

test('Below the yield distance the sheet resists and returns exactly (elastic only)', () => {
  const { b, events } = pl();
  const s0 = snap(b);
  press(b, 0.95, 0, -0.05, 0);                 // 0.05 < yield (0.08 at default stiffness)
  assert.ok(b.preview && b.preview.load > 0.3, 'a stress line previews where it would fold');
  assert.equal(b.view.length, 1, 'no fold yet');
  release(b);
  assert.equal(snap(b), s0);
  assert.equal(events.find((e) => e.type === 'contact_end').metadata.outcome, 'no_yield');
  assert.equal(b.totals.folds, 0);
});

test('Edge fold: past yield the edge flap folds over; the pressed point lands under the pointer', () => {
  const { b, events } = pl();
  press(b, 0.95, 0, -0.5, 0);
  assert.ok(b.folding && b.theta > 3.1, `folded flat over (θ ${b.theta.toFixed(2)})`);
  const flap = b.view.filter((f) => f.N[2] < 0);
  assert.ok(flap.length >= 1, 'the back of the flap is showing');
  const f = flap[0], gx = 0.95, gy = 0;
  const qx = f.M[0] * gx + f.M[2] * gy + f.M[4];
  assert.ok(Math.abs(qx - 0.45) < 0.03, `pressed point follows the pointer (${qx.toFixed(3)} ≈ 0.45)`);
  const fold = events.find((e) => e.type === 'fold');
  assert.equal(fold.metadata.mode, 'edge');
  assert.ok(fold.metadata.atMs > 0, 'fold happens after a delay (yield), not on contact');
});

test('Release: partial spring-back to a permanent bend; crease persists indefinitely', () => {
  const { b, events } = pl();
  gesture(b, 0.95, 0, -0.5, 0);
  const rec = events.find((e) => e.type === 'recovery' && e.metadata.kind === 'springback');
  assert.ok(rec && rec.metadata.completed);
  assert.ok(rec.metadata.residualAngle > 20 && rec.metadata.residualAngle < 78, `residual bend ${rec.metadata.residualAngle}°`);
  assert.ok(rec.durationMs > 100 && rec.durationMs < 1500, `quick, overdamped spring-back (${rec.durationMs} ms)`);
  assert.equal(b.totals.creases, 1);
  assert.ok(b.metrics.projectedArea < 0.995, 'the flap stays lifted (foreshortened)');
  const s1 = snap(b);
  run(b, 30 * SEC);
  assert.equal(snap(b), s1, 'no recovery of the original form over time');
  // spring-back is monotone (no overshoot past the residual angle)
  const { b: c } = pl();
  press(c, 0.95, 0, -0.5, 0);
  c.setInput(UP); let prev = c.theta, mono = true;
  for (let i = 0; i < 90; i++) { c.step(); if (c.spring && c.theta > prev + 1e-9) mono = false; prev = c.spring ? c.theta : prev; }
  assert.ok(mono, 'no oscillation');
});

test('Creases accumulate across repeated folds and never disappear', () => {
  const { b } = pl();
  let last = 0;
  const pts = [[0.95, 0, -0.45, 0.05], [-0.95, 0.1, 0.4, 0], [0.1, 0.95, 0, -0.4], [0.05, -0.95, 0.05, 0.4], [0.6, 0.6, -0.3, -0.3]];
  for (const [x, y, dx, dy] of pts) {
    gesture(b, x, y, dx, dy);
    assert.ok(b.totals.creases > last, 'one more crease after each fold'); last = b.totals.creases;
  }
  assert.ok(b.facets.length >= 6);
  assert.ok(b.metrics.meanTilt > 5, `sheet keeps all bends (mean tilt ${b.metrics.meanTilt}°)`);
});

test('Interior press folds a ridge (two creases); pulling outward is resisted (no deformation)', () => {
  const { b, events } = pl();
  press(b, 0, 0, 0.3, 0);
  assert.equal(b.contact.mode, 'ridge');
  const g = where({ facets: b.view }, -0.4, 0);
  assert.ok(g[0] > -0.4 + 0.2, `material behind the finger moves with it (${g[0].toFixed(3)})`);
  const far = where({ facets: b.view }, 0.8, 0.1);
  assert.ok(Math.abs(far[0] - 0.8) < 1e-9, 'the far side stays put');
  release(b);
  assert.equal(b.totals.creases, 2, 'a ridge leaves two parallel creases');
  const { b: c, events: ce } = pl();
  const s0 = snap(c);
  gesture(c, 0, 0.98, 0, 0.4);
  assert.equal(ce.find((e) => e.type === 'contact_end').metadata.outcome, 'resisted');
  assert.equal(snap(c), s0, 'an outward pull leaves the sheet unchanged');
  assert.ok(events.length > 0);
});

test('No adaptation: identical gestures yield at the same point and fold identically', () => {
  const runOne = () => { const { b, events } = pl(); gesture(b, 0.95, 0, -0.5, 0); return { s: snap(b), at: events.find((e) => e.type === 'fold').metadata.atMs }; };
  const a = runOne(), c = runOne();
  assert.equal(a.s, c.s);
  const { b, events } = pl();
  for (let k = 0; k < 6; k++) gesture(b, Math.cos(k * 1.1) * 0.95, Math.sin(k * 1.1) * 0.95, -Math.cos(k * 1.1) * 0.3, -Math.sin(k * 1.1) * 0.3);
  const ats = events.filter((e) => e.type === 'fold').map((e) => e.metadata.atMs);
  assert.ok(ats.length >= 5 && Math.max(...ats) - Math.min(...ats) <= 34, `yield timing unchanged by experience (${ats.join(', ')} ms)`);
});

test('Distinct from Silicone and Gel: the same gesture leaves Plastic deformed, the others return to rest', () => {
  const { b } = pl();
  gesture(b, 0.95, 0, -0.4, 0); run(b, 5 * SEC);
  assert.ok(b.metrics.projectedArea < 0.995 && b.totals.creases === 1);
  const s = new SiliconeBody(outline, SEED);
  gesture(s, 0.95, 0, -0.4, 0); run(s, 5 * SEC);
  assert.ok(s.maxDisp < 0.01, 'silicone springs back fully');
  const g = new GelBody(outline, SEED);
  gesture(g, 0.95, 0, -0.4, 0); for (let i = 0; i < 12 * SEC; i++) g.step();
  assert.ok(g.maxDisp < 0.02, `gel recovers (${g.maxDisp.toFixed(3)})`);
});

test('Extreme input: violent flailing stays bounded, finite and invertible', () => {
  const { b } = pl();
  for (let r = 0; r < 25; r++) {
    b.setInput({ present: true, x: Math.sin(r) * 0.9, y: Math.cos(r * 1.7) * 0.9, vx: 0, vy: 0, down: true }); b.step();
    run(b, 40, (i) => ({ present: true, down: true, x: Math.sin(i * 1.3 + r) * 3, y: Math.cos(i * 0.7 + r) * 2, vx: 30, vy: -20 }));
    release(b, 40);
  }
  release(b);
  assert.ok(b.facets.length <= 2 * 360, `facet count bounded (${b.facets.length})`);
  for (const f of b.facets) {
    assert.ok(f.M.every(Number.isFinite) && f.N.every(Number.isFinite));
    assert.ok(Math.abs(f.M[0] * f.M[3] - f.M[1] * f.M[2]) > 0.15, 'no facet edge-on or degenerate');
    assert.ok(Math.abs(polyArea(f.x, f.y)) > 0);
  }
  for (const f of b.facets) for (let i = 0; i < f.x.length; i++) {
    const x = f.M[0] * f.x[i] + f.M[2] * f.y[i] + f.M[4], y = f.M[1] * f.x[i] + f.M[3] * f.y[i] + f.M[5];
    assert.ok(Math.hypot(x, y) < 3, 'sheet stays near the stage');
  }
});

test('Logging: fold, contact_end and spring-back fields', () => {
  const { b, events } = pl();
  gesture(b, 0.95, 0, -0.5, 0);
  const types = events.map((e) => e.type);
  for (const t of ['contact_start', 'fold', 'contact_end', 'recovery']) assert.ok(types.includes(t), t);
  const end = events.find((e) => e.type === 'contact_end');
  assert.ok(end.durationMs > 800 && end.distance > 0.45);
  assert.equal(end.metadata.outcome, 'edge');
  assert.equal(end.metadata.peakFoldAngle, 180);
  assert.ok(end.metadata.foldDistance > 0.45);
  const rec = events.find((e) => e.type === 'recovery').metadata;
  for (const k of ['peakFoldAngle', 'residualAngle', 'creases', 'facets', 'projectedArea', 'meanTilt']) assert.ok(k in rec, k);
  assert.ok(b.creases[0].length > 0.5, 'crease length recorded');
});

test('Parameters: stiffness delays yielding, plasticity sets the permanent bend, spring-back speed, fold limit', () => {
  const at = (p) => { const { b, events } = pl(p); gesture(b, 0.95, 0, -0.5, 0); return { at: events.find((e) => e.type === 'fold').metadata.atMs, rec: events.find((e) => e.type === 'recovery'), b }; };
  assert.ok(at({ stiffness: 1 }).at > at({ stiffness: 0 }).at, 'stiffer → yields later');
  assert.ok(at({ plasticity: 1 }).rec.metadata.residualAngle > at({ plasticity: 0 }).rec.metadata.residualAngle + 20, 'more plastic → more stays bent');
  assert.ok(at({ springBack: 1 }).rec.durationMs < at({ springBack: 0 }).rec.durationMs, 'faster spring-back');
  const small = pl({ foldLimit: 0.2 }); press(small.b, 0.95, 0, -2.6, 0);
  const large = pl({ foldLimit: 0.6 }); press(large.b, 0.95, 0, -2.6, 0);
  const lifted = (b) => b.fracBehind(b.contact.op.dx, b.contact.op.dy, b.contact.op.a);
  assert.ok(Math.abs(lifted(small.b) - 0.2) < 0.02 && Math.abs(lifted(large.b) - 0.6) < 0.02, `fold limit bounds how much one fold lifts (${lifted(small.b).toFixed(2)} / ${lifted(large.b).toFixed(2)})`);
});

test('Reset restores the flat sheet; behaviour is deterministic', () => {
  const { b } = pl();
  gesture(b, 0.95, 0, -0.5, 0); gesture(b, 0, 0, 0.2, 0.2);
  b.reset();
  assert.equal(b.facets.length, 1); assert.equal(b.totals.creases, 0); assert.equal(b.metrics.projectedArea, 1);
});
