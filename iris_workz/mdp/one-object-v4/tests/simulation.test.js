import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSim, steps, dragCycle, snapshot } from './helpers.mjs';
import { buildPayload } from '../src/research/Exporter.js';
import { translations } from '../src/ui/translations.js';
import { EVENT_TYPES } from '../src/research/SessionLogger.js';

const SEC = 60;

test('A — first contact: immediate local response, elastic delayed recovery', () => {
  const { sim } = makeSim();
  const cx = 1, cy = 0;
  sim.setInput({ present: true, x: cx, y: cy, down: true, vx: 0, vy: 0 });
  steps(sim, 1);
  steps(sim, 20, (i) => ({ x: 1 + 0.3 * (i + 1) / 20, vx: 0.9 }));
  const near = sim.regionDisplacement(0), far = sim.regionDisplacement(6);
  assert.ok(near > 0.08, `near-contact region should deform (got ${near})`);
  assert.ok(far < near * 0.25, `opposite region should move much less (near ${near}, far ${far})`);
  sim.setInput({ down: false, present: false, vx: 0 });
  steps(sim, 6);
  assert.ok(sim.maxDisplacement() > 0.05, 'still visibly displaced 0.1 s after release (inertia)');
  steps(sim, 3 * SEC);
  assert.ok(sim.maxDisplacement() < 0.01, 'returns close to rest within ~3 s');
});

test('B/C — repeated contact adapts that region; an untouched region keeps its initial behaviour', () => {
  const { sim, logger } = makeSim();
  const first = dragCycle(sim, 0);
  let last = first;
  for (let i = 0; i < 9; i++) last = dragCycle(sim, 0);
  assert.ok(last < first * 0.8, `repeated region responds less (first ${first.toFixed(3)}, last ${last.toFixed(3)})`);
  assert.ok(sim.memory.regionLevel(0) > 0.6, 'memory accumulated in contacted region');
  assert.ok(logger.count('adaptation_threshold') >= 1, 'adaptation threshold logged');
  assert.ok(logger.count('region_revisit') >= 9, 'revisits logged');
  const other = dragCycle(sim, Math.PI);
  assert.ok(Math.abs(other - first) / first < 0.1, `untouched region ≈ first response (first ${first.toFixed(3)}, other ${other.toFixed(3)})`);
});

test('B — adaptation is gradual (no single-step jump in sensitivity)', () => {
  const { sim } = makeSim();
  let maxJump = 0, prev = sim.adapt.sensitivity[0];
  for (let c = 0; c < 10; c++) {
    sim.setInput({ present: true, x: 1, y: 0, down: true, vx: 0, vy: 0 });
    for (let s = 0; s < 90; s++) {
      sim.setInput({ x: 1.25 });
      sim.step();
      maxJump = Math.max(maxJump, Math.abs(sim.adapt.sensitivity[0] - prev));
      prev = sim.adapt.sensitivity[0];
    }
    sim.setInput({ down: false, present: false });
    for (let s = 0; s < 30; s++) {
      sim.step();
      maxJump = Math.max(maxJump, Math.abs(sim.adapt.sensitivity[0] - prev));
      prev = sim.adapt.sensitivity[0];
    }
  }
  assert.ok(sim.adapt.sensitivity[0] < 0.6, 'sensitivity decreased');
  assert.ok(maxJump < 0.02, `per-step change is small (max ${maxJump})`);
});

test('D — stillness: memory decays and sensitivity recovers', () => {
  const { sim, logger } = makeSim();
  for (let i = 0; i < 10; i++) dragCycle(sim, 0);
  const memBefore = sim.memory.regionLevel(0), sensBefore = sim.adapt.sensitivity[0];
  steps(sim, 30 * SEC);
  assert.ok(sim.memory.regionLevel(0) < memBefore * 0.4, 'memory decays');
  assert.ok(sim.adapt.sensitivity[0] > sensBefore + 0.2, 'responsiveness recovers');
  assert.ok(logger.events.some((e) => e.type === 'recovery' && e.metadata?.kind === 'region_released'), 'region recovery logged');
  steps(sim, 120 * SEC);
  assert.ok(sim.adapt.sensitivity[0] > 0.97, 'near-full recovery after long rest');
});

test('E — stable preset is consistent; adaptive preset changes with history (same seed + input)', () => {
  const run = (preset) => { const { sim } = makeSim({ preset, seed: 42 }); return Array.from({ length: 10 }, () => dragCycle(sim, 0)); };
  const stable = run('A'), adaptive = run('B');
  const spread = Math.max(...stable) - Math.min(...stable);
  assert.ok(spread / stable[0] < 0.03, `stable response varies < 3% (spread ${spread})`);
  assert.ok(adaptive[9] < adaptive[0] * 0.8, 'adaptive response decreases');
  assert.ok(Math.abs(stable[0] - adaptive[0]) / stable[0] < 0.05, 'first contact comparable across conditions');
});

test('Determinism — same seed and input sequence → identical state', () => {
  const a = makeSim({ seed: 7 }).sim, b = makeSim({ seed: 7 }).sim;
  for (const sim of [a, b]) { dragCycle(sim, 0.4); dragCycle(sim, 2.1, { dist: 0.2 }); steps(sim, 2 * SEC, (i) => ({ present: true, x: 1.3, y: -0.5 + i * 0.01, vx: 0, vy: 0.6 })); }
  assert.deepEqual(snapshot(a), snapshot(b));
  const c = makeSim({ seed: 8 }).sim;
  assert.notDeepEqual(Array.from(c.body.baseRest), Array.from(a.body.baseRest), 'different seed → different rest shape');
});

test('F — reset clears physics, memory, traces, timers', () => {
  const { sim } = makeSim({ seed: 99 });
  const rest0 = Array.from(sim.body.baseRest);
  for (let i = 0; i < 6; i++) dragCycle(sim, 0, { restSteps: 5 });
  sim.reset();
  assert.equal(sim.timeMs, 0);
  assert.equal(sim.maxDisplacement(), 0);
  assert.equal(sim.memory.max(), 0);
  assert.equal(sim.adapt.max(), 0);
  assert.equal(sim.totals.contactEpisodes, 0);
  assert.deepEqual(Array.from(sim.body.baseRest), rest0, 'same seed restores same initial shape');
  assert.ok(Array.from(sim.body.plastic).every((v) => v === 0), 'residual traces cleared');
});

test('G — export payload is valid JSON with condition, metadata, events, reflection', () => {
  const { sim, logger } = makeSim({ preset: 'A', seed: 3 });
  dragCycle(sim, 0);
  logger.setReflection({ q1: 'It stiffened.', q2: '' }, sim.timeMs);
  const payload = JSON.parse(JSON.stringify(buildPayload(sim, logger, { condition: 'A_stable', exportedAt: 'x' })));
  assert.equal(payload.condition, 'A_stable');
  assert.equal(payload.seed, 3);
  assert.ok(payload.sessionId);
  assert.equal(payload.events[0].type, 'session_start');
  assert.equal(payload.events.at(-1).type, 'session_end');
  assert.ok(payload.events.some((e) => e.type === 'contact_start'));
  assert.ok(payload.events.some((e) => e.type === 'contact_end' && e.durationMs > 900));
  assert.equal(payload.reflection.q1, 'It stiffened.');
  assert.equal(payload.summary.contactEpisodes, 1);
  for (const e of payload.events) assert.ok(EVENT_TYPES.includes(e.type));
});

test('Logging is throttled (no per-frame events)', () => {
  const { sim, logger } = makeSim();
  sim.setInput({ present: true, x: 1, y: 0, down: true, vx: 0, vy: 0 });
  steps(sim, 10 * SEC, (i) => ({ x: 1 + 0.2 * Math.sin(i / 10), vx: 1.2 * Math.cos(i / 10) }));
  sim.setInput({ down: false });
  steps(sim, 10 * SEC, (i) => ({ x: 1.2 + 0.5 * Math.sin(i / 30), y: 0.3, vx: 1 }));
  assert.ok(logger.events.length < 60, `events kept compact (got ${logger.events.length} for 1200 steps)`);
  assert.ok(logger.count('drag') >= 15 && logger.count('drag') <= 26, `drag sampled ~2.5 Hz (got ${logger.count('drag')})`);
});

test('Proximity responds before contact, scales with speed, no contact without press', () => {
  const slow = makeSim().sim, fast = makeSim().sim, far = makeSim().sim;
  steps(slow, 60, (i) => ({ present: true, x: 1.25, y: -0.3 + i * 0.01, vx: 0, vy: 0.6 }));
  steps(fast, 60, (i) => ({ present: true, x: 1.25, y: -0.3 + i * 0.01, vx: 0, vy: 4 }));
  steps(far, 60, () => ({ present: true, x: 3, y: 0, vx: 0, vy: 0 }));
  assert.ok(slow.maxDisplacement() > 0.01, 'responds before contact');
  assert.ok(fast.maxDisplacement() > slow.maxDisplacement() * 1.5, 'faster approach → stronger transient');
  assert.ok(far.maxDisplacement() < 0.001, 'no response from far away');
  assert.equal(slow.totals.contactEpisodes, 0);
  assert.equal(slow.memory.max(), 0, 'hovering alone does not build memory');
});

test('J — stability: 5 minutes of continuous varied interaction stays bounded and finite', () => {
  const { sim } = makeSim({ params: { responsiveness: 2 } });
  let maxD = 0;
  for (let s = 0; s < 5 * 60 * SEC; s++) {
    const t = s / SEC, down = Math.floor(t * 0.7) % 3 !== 2;
    const a = t * 0.9, r = 0.9 + 0.6 * Math.abs(Math.sin(t * 3.1));
    sim.setInput({ present: true, down, x: Math.cos(a) * r, y: Math.sin(a) * r, vx: -Math.sin(a) * 6, vy: Math.cos(a) * 6 });
    sim.step();
    maxD = Math.max(maxD, sim.maxDisplacement());
  }
  assert.ok(Number.isFinite(sim.body.energy));
  assert.ok(sim.body.dx.every(Number.isFinite) && sim.body.dy.every(Number.isFinite));
  assert.ok(maxD <= sim.params.maxDisplacement + 1e-6, `displacement bounded (${maxD})`);
  sim.setInput({ down: false, present: false, vx: 0, vy: 0 });
  steps(sim, 5 * SEC);
  assert.ok(sim.body.energy < 1e-6, 'settles after release');
});

test('Stillness between contacts is logged as a recovery period', () => {
  const { sim, logger } = makeSim();
  dragCycle(sim, 0, { restSteps: 10 });
  steps(sim, 5 * SEC, () => ({ present: true, x: 1.6, y: 0.4, vx: 0, vy: 0 }));
  dragCycle(sim, 0);
  const rec = logger.events.find((e) => e.type === 'recovery' && e.metadata?.kind === 'stillness');
  assert.ok(rec && rec.durationMs >= 5000, 'stillness recovery logged with duration');
  assert.equal(sim.totals.stillnessPeriods, 1);
});

test('No adaptation without contact (barely interacting never triggers change)', () => {
  const { sim, logger } = makeSim();
  steps(sim, 120 * SEC, (i) => ({ present: true, x: 1.4 * Math.cos(i / 200), y: 1.4 * Math.sin(i / 200), vx: 0.4, vy: 0.4 }));
  assert.equal(logger.count('adaptation_threshold'), 0);
  assert.ok(sim.adapt.max() < 0.01);
});

test('I — translations: en and zh dictionaries have identical key structure', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, p + k + '.') : [p + k + (Array.isArray(v) ? `[${v.length}]` : '')])).sort();
  assert.deepEqual(keys(translations.zh), keys(translations.en));
});
