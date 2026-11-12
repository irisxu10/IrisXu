// Stage 1 — Immediate Response (proximity awareness + dwell response).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSim } from './helpers.mjs';
import { FilamentNetwork } from '../src/rendering/FilamentNetwork.js';

const SEC = 60, DT = 1 / 60;

function rig() {
  const { sim, logger } = makeSim();
  const net = new FilamentNetwork(sim.n).build(sim.seed, sim.body.baseRest);
  net.update(sim, { dt: DT, t: 0, reducedMotion: false });
  const base = { x: Float32Array.from(net.x), y: Float32Array.from(net.y) };
  const tick = (input, frames = 1) => {
    for (let i = 0; i < frames; i++) {
      if (input) sim.setInput(input);
      sim.step();
      net.update(sim, { dt: DT, t: sim.timeMs / 1000, reducedMotion: false });
    }
  };
  const nearFar = (px, py, R) => {
    let near = 0, nc = 0, far = 0;
    for (let k = 0; k < net.count; k++) {
      const d = Math.hypot(base.x[k] - px, base.y[k] - py), off = Math.hypot(net.respX[k], net.respY[k]);
      if (d < R * 0.5) { near += off; nc++; } else if (d > R * 1.05) far = Math.max(far, off);
    }
    return { near: near / Math.max(1, nc), far };
  };
  return { sim, logger, net, base, tick, nearFar };
}
const HOVER = { present: true, down: false, x: 0.55, y: 0.2, vx: 0, vy: 0 };

test('A — proximity: nearby lines respond locally and smoothly; geometry and memory untouched', () => {
  const { sim, net, tick, nearFar } = rig();
  let prev = 0, maxJump = 0;
  for (let i = 0; i < 60; i++) { tick(HOVER); maxJump = Math.max(maxJump, sim.immediate.level - prev); prev = sim.immediate.level; }
  assert.ok(sim.immediate.level > 0.95, 'level eases up while hovering');
  assert.ok(maxJump < 0.12, `no abrupt jump (max per-step ${maxJump.toFixed(3)})`);
  const { near, far } = nearFar(HOVER.x, HOVER.y, sim.params.interactionRadius);
  assert.ok(near > 0.004, `nearby lines move (${near.toFixed(4)})`);
  assert.ok(far < 1e-6, 'lines outside the interaction radius do not move — sphere does not follow cursor');
  assert.ok(Math.max(...Array.from(net.respX).map(Math.abs)) <= sim.params.proximityResponse + 1e-6, 'offset bounded by proximityResponse');
  assert.equal(sim.memory.max(), 0, 'immediate response writes no memory');
  assert.ok(sim.immediate.dwell < 0.01, 'no dwell yet after 1 s');
});

test('B — dwell: begins after ~2–3 s, draws lines in and brightens, fades when moving away, is logged', () => {
  const { sim, logger, net, base, tick } = rig();
  tick(HOVER, 1.5 * SEC);
  assert.ok(sim.immediate.dwell < 0.02, `quiet before the delay (${sim.immediate.dwell.toFixed(3)})`);
  tick(HOVER, 1.2 * SEC);
  const mid = sim.immediate.dwell;
  assert.ok(mid > 0.02 && mid < 0.8, `ramping gradually around 2.2–3.7 s (${mid.toFixed(2)})`);
  tick(HOVER, 2 * SEC);
  assert.ok(sim.immediate.dwell > 0.9, 'full dwell response');
  let toward = 0, c = 0, glow = 0;
  for (let k = 0; k < net.count; k++) {
    const dx = base.x[k] - HOVER.x, dy = base.y[k] - HOVER.y, d = Math.hypot(dx, dy);
    if (d > 0.05 && d < 0.2) { toward += -(net.respX[k] * dx + net.respY[k] * dy) / d; c++; glow = Math.max(glow, net.resp[k]); }
  }
  assert.ok(toward / c > 0.01, `lines drawn in (${(toward / c).toFixed(4)})`);
  assert.ok(glow > 0.2, 'nearby lines brighter');
  assert.ok(sim.getState().flags.dwell, 'state flag');
  tick({ ...HOVER, x: 2.5, y: 0 }, 2 * SEC);
  assert.ok(sim.immediate.dwell < 0.05 && sim.immediate.level < 0.05, 'fades after moving away');
  assert.ok(Math.max(...Array.from(net.resp)) < 0.01, 'glow gone');
  const ev = logger.events.find((e) => e.type === 'dwell');
  assert.ok(ev && ev.durationMs > 1500, 'dwell episode logged with duration');
  assert.equal(sim.memory.max(), 0, 'still no memory written');
});

test('B — moving around (beyond dwell radius) never triggers dwell; pressing cancels it', () => {
  const { sim, tick } = rig();
  for (let i = 0; i < 6 * SEC; i++) tick({ present: true, down: false, x: 0.5 + 0.3 * Math.sin(i / 25), y: 0.3 * Math.cos(i / 25), vx: 0.5, vy: 0.5 });
  assert.ok(sim.immediate.dwell < 0.01);
  tick(HOVER, 4.5 * SEC);
  assert.ok(sim.immediate.dwell > 0.8);
  tick({ ...HOVER, down: true }, 1 * SEC);
  assert.ok(sim.immediate.dwell < 0.3, 'press interrupts the dwell response');
});

test('Reset clears the immediate-response state', () => {
  const { sim, tick } = rig();
  tick(HOVER, 5 * SEC);
  sim.reset();
  assert.equal(sim.immediate.level, 0);
  assert.equal(sim.immediate.dwell, 0);
  assert.equal(sim.immediate.dwellMs, 0);
  assert.equal(sim.totals.dwells, 0);
});

test('Bounded state: 10 min of hovering/dwelling keeps fixed-size arrays and finite values', () => {
  const { net, tick, logger } = rig();
  const sizes = [net.respX.length, net.resp.length];
  for (let i = 0; i < 10 * 60 * SEC; i += 30) tick({ present: true, down: false, x: 0.6 * Math.cos(i / 4000), y: 0.6 * Math.sin(i / 4000), vx: 0, vy: 0 }, 30);
  assert.deepEqual([net.respX.length, net.resp.length], sizes);
  assert.ok(net.x.every(Number.isFinite) && net.resp.every(Number.isFinite));
  assert.ok(logger.events.length < 400, `log stays compact (${logger.events.length})`);
});
