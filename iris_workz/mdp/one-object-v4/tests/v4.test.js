import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, steps, dragCycle } from './helpers.mjs';
import { FilamentNetwork } from '../src/rendering/FilamentNetwork.js';
import { buildPayload } from '../src/research/Exporter.js';

const SEC = 60;
const OPTS = { dt: 1 / 60, t: 0, reducedMotion: true };

function netFor(sim) {
  const net = new FilamentNetwork(sim.n).build(sim.seed, sim.body.baseRest);
  net.update(sim, OPTS);
  return net;
}

/** Sweep across the surface near angle 0 without pressing. */
function sweep(sim, { speed = 4, steps: k = 20 } = {}) {
  const dy = (speed / 60);
  for (let i = 0; i < k; i++) { sim.setInput({ present: true, down: false, x: 0.95, y: -0.4 + i * dy, vx: 0, vy: speed }); sim.step(); }
  sim.setInput({ present: false, vx: 0, vy: 0 });
}

test('Network: deterministic per seed, sized for the target range', () => {
  const a = netFor(makeSim({ seed: 11 }).sim), b = netFor(makeSim({ seed: 11 }).sim), c = netFor(makeSim({ seed: 12 }).sim);
  assert.deepEqual(Array.from(a.ea), Array.from(b.ea));
  assert.deepEqual(Array.from(a.x), Array.from(b.x));
  assert.notDeepEqual(Array.from(a.u), Array.from(c.u));
  const visible = Array.from(a.dormant).filter((d) => d < 0).length;
  assert.ok(visible >= 250 && visible <= 900, `visible edges ${visible}`);
  assert.ok(a.edgeCount - visible > 40, 'has dormant (memory-revealed) fibres');
});

test('Network: filaments follow deformation (attached, not an overlay)', () => {
  const { sim } = makeSim();
  const net = new FilamentNetwork(sim.n).build(sim.seed, sim.body.baseRest);
  net.update(sim, OPTS);
  const restX = Float32Array.from(net.x), restY = Float32Array.from(net.y);
  sim.setInput({ present: true, x: 1, y: 0, down: true, vx: 0, vy: 0 }); sim.step();
  for (let s = 1; s <= 30; s++) { sim.setInput({ x: 1 + 0.3 * s / 30, vx: 0.6 }); sim.step(); net.update(sim, OPTS); }
  let nearMove = 0, nearC = 0, farMove = 0, farC = 0;
  for (let k = 0; k < net.count; k++) {
    const d = Math.hypot(net.x[k] - restX[k], net.y[k] - restY[k]);
    const ang = Math.abs(Math.atan2(restY[k], restX[k]));
    if (ang < 0.25 && net.s[k] > 0.8) { nearMove += d; nearC++; }
    if (ang > 2.6 && net.s[k] > 0.8) { farMove += d; farC++; }
  }
  nearMove /= nearC; farMove /= farC;
  assert.ok(nearMove > 0.08, `rim filaments near the pull move with it (${nearMove.toFixed(3)})`);
  assert.ok(farMove < nearMove * 0.2, `far side barely moves (${farMove.toFixed(3)})`);
  // stretched fibres near the pull carry positive strain
  let maxStrain = 0;
  for (let e = 0; e < net.edgeCount; e++) maxStrain = Math.max(maxStrain, net.strain[e]);
  assert.ok(maxStrain > 0.15, `tension visible in edge strain (${maxStrain.toFixed(2)})`);
});

test('Network: inner structure trails the rim (delayed propagation)', () => {
  const { sim } = makeSim();
  const net = new FilamentNetwork(sim.n).build(sim.seed, sim.body.baseRest);
  net.update(sim, OPTS);
  const pick = (lo, hi) => Array.from({ length: net.count }, (_, k) => k).filter((k) => net.s[k] >= lo && net.s[k] <= hi && Math.abs(Math.atan2(net.restY[k], net.restX[k])) < 0.4);
  const rim = pick(0.85, 1.1), inner = pick(0.4, 0.7);
  const base = Array.from({ length: net.count }, (_, k) => [net.x[k], net.y[k]]);
  sim.setInput({ present: true, x: 1, y: 0, down: true }); sim.step();
  for (let s = 0; s < 6; s++) { sim.setInput({ x: 1.3, vx: 3 }); sim.step(); net.update(sim, OPTS); }
  const mv = (ids) => ids.reduce((acc, k) => acc + Math.hypot(net.x[k] - base[k][0], net.y[k] - base[k][1]), 0) / ids.length;
  const early = mv(inner) / (mv(rim) + 1e-9);
  for (let s = 0; s < 120; s++) { sim.setInput({ x: 1.3, vx: 0 }); sim.step(); net.update(sim, OPTS); }
  const late = mv(inner) / (mv(rim) + 1e-9);
  assert.ok(early < late * 0.75, `inner structure catches up only later (early ${early.toFixed(2)}, held ${late.toFixed(2)})`);
});

test('Sweep: distinct from drag — no contact, logged episode, travelling excitation', () => {
  const { sim, logger } = makeSim();
  sweep(sim);
  steps(sim, 15);
  assert.equal(sim.totals.contactEpisodes, 0, 'a sweep is not a contact');
  assert.equal(logger.count('sweep'), 1);
  const ev = logger.events.find((e) => e.type === 'sweep');
  assert.ok(ev.speed >= 3.9 && ev.durationMs > 100, 'episode has speed and duration');
  // excitation spreads to neighbours after the sweep
  const n = sim.n, idx = Math.round(n * 0.12);
  assert.ok(sim.excite[idx] > 0.01, `excitation travels along the surface (${sim.excite[idx]})`);
  assert.ok(sim.maxDisplacement() > 0.01, 'sweep deflects the surface');
  steps(sim, 4 * SEC);
  assert.ok(Math.max(...sim.excite) < 0.001, 'vibration decays when left alone');
});

test('Sweep: slow movement over the surface is not a sweep; speed matters', () => {
  const slow = makeSim(), fast = makeSim();
  sweep(slow.sim, { speed: 0.8, steps: 60 });
  sweep(fast.sim, { speed: 5 });
  assert.equal(slow.logger.count('sweep'), 0);
  assert.ok(fast.sim.signals.sweep > 0.05);
  assert.ok(slow.sim.signals.sweep < 0.001);
});

test('Visual memory: repeated contact reveals dormant fibres and aligns them only in that region', () => {
  const { sim } = makeSim();
  const net = new FilamentNetwork(sim.n).build(sim.seed, sim.body.baseRest);
  for (let i = 0; i < 10; i++) dragCycle(sim, 0);
  net.update(sim, OPTS);
  let hot = 0, cold = 0;
  for (let e = 0; e < net.edgeCount; e++) {
    if (net.dormant[e] < 0 || net.edgeMem[e] <= net.dormant[e]) continue;
    const a = net.ea[e];
    const ang = Math.abs(Math.atan2(net.restY[a], net.restX[a]));
    if (ang < 0.6) hot++; else if (ang > 2.2) cold++;
  }
  assert.ok(hot >= 3, `dormant fibres revealed near the contacted region (${hot})`);
  assert.equal(cold, 0, 'untouched region keeps its original structure');
  steps(sim, 120 * SEC);
  net.update(sim, OPTS);
  const revealed = Array.from({ length: net.edgeCount }, (_, e) => e).filter((e) => net.dormant[e] >= 0 && net.edgeMem[e] > net.dormant[e]).length;
  assert.equal(revealed, 0, 'traces fade with rest');
});

test('Stable preset: no visual memory accumulates', () => {
  const { sim } = makeSim({ preset: 'A' });
  const net = new FilamentNetwork(sim.n).build(sim.seed, sim.body.baseRest);
  for (let i = 0; i < 10; i++) dragCycle(sim, 0);
  sweep(sim);
  net.update(sim, OPTS);
  assert.equal(Math.max(...net.edgeMem), 0);
});

test('Hooks: contact and release fire with bounded strength', () => {
  const { sim } = makeSim();
  const calls = [];
  sim.hooks.contact = (s) => calls.push(['contact', s]);
  sim.hooks.release = (t) => calls.push(['release', t]);
  dragCycle(sim, 0);
  assert.deepEqual(calls.map((c) => c[0]), ['contact', 'release']);
  for (const [, v] of calls) assert.ok(v >= 0 && v <= 1);
  assert.ok(calls[1][1] > 0.3, 'release reports stored tension');
});

test('Export v2 includes visual parameters and sweep summary', () => {
  const { sim, logger } = makeSim();
  sweep(sim); steps(sim, 20);
  const p = JSON.parse(JSON.stringify(buildPayload(sim, logger, { condition: 'B_adaptive', visual: { filamentDensity: 0.8 } })));
  assert.equal(p.schemaVersion, 2);
  assert.equal(p.visualParameters.filamentDensity, 0.8);
  assert.equal(p.summary.sweeps, 1);
});

test('Stability: 5 min of mixed drag + sweep stays bounded', () => {
  const { sim } = makeSim({ params: { responsiveness: 2 } });
  const net = new FilamentNetwork(sim.n).build(sim.seed, sim.body.baseRest);
  for (let s = 0; s < 5 * 60 * SEC; s++) {
    const t = s / SEC, phase = Math.floor(t / 2) % 3;
    const a = t * 1.7, r = phase === 2 ? 0.7 : 0.95 + 0.4 * Math.abs(Math.sin(t * 2.3));
    sim.setInput({ present: true, down: phase === 0, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: -Math.sin(a) * r * 6, vy: Math.cos(a) * r * 6 });
    sim.step();
    if (s % 30 === 0) net.update(sim, { ...OPTS, reducedMotion: false, t });
  }
  assert.ok(sim.body.dx.every(Number.isFinite) && net.x.every(Number.isFinite));
  assert.ok(sim.maxDisplacement() <= sim.params.maxDisplacement + 1e-6);
  assert.ok(sim.totals.sweeps > 10);
});
