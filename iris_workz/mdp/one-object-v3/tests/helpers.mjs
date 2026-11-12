// Scripted input helpers for headless simulation tests.
import { Simulation } from '../src/simulation/Simulation.js';
import { SessionLogger } from '../src/research/SessionLogger.js';
import { DEFAULT_PARAMS, PRESETS } from '../src/config.js';

let idCounter = 0;
export function makeSim({ preset = 'B', params = {}, seed } = {}) {
  const { id: _id, ...flags } = PRESETS[preset];
  const logger = new SessionLogger({ idFactory: () => 'test-' + (++idCounter), now: () => new Date('2026-11-05T10:00:00Z') });
  const sim = new Simulation({ params: { ...DEFAULT_PARAMS, ...flags, ...params }, seed, logger });
  logger.start({ condition: PRESETS[preset].id, seed: sim.seed });
  return { sim, logger };
}

export function steps(sim, count, input) {
  for (let i = 0; i < count; i++) { if (input) sim.setInput(input(i)); sim.step(); }
}

/** Press on the edge at `angle`, drag outward by `dist` over 0.5 s, hold 0.5 s, release, rest `restSteps`. Returns peak displacement. */
export function dragCycle(sim, angle = 0, { dist = 0.3, restSteps = 120 } = {}) {
  const cx = Math.cos(angle), cy = Math.sin(angle);
  const speed = (dist / 30) * 60;
  let peak = 0;
  sim.setInput({ present: true, x: cx, y: cy, vx: 0, vy: 0, down: true }); sim.step();
  for (let s = 1; s <= 30; s++) {
    const r = 1 + (dist * s) / 30;
    sim.setInput({ x: cx * r, y: cy * r, vx: cx * speed, vy: cy * speed });
    sim.step();
    peak = Math.max(peak, sim.maxDisplacement());
  }
  for (let s = 0; s < 30; s++) { sim.setInput({ vx: 0, vy: 0 }); sim.step(); peak = Math.max(peak, sim.maxDisplacement()); }
  sim.setInput({ down: false, present: false, vx: 0, vy: 0 });
  steps(sim, restSteps);
  return peak;
}

export function snapshot(sim) {
  return {
    dx: Array.from(sim.body.dx), dy: Array.from(sim.body.dy),
    mem: Array.from(sim.memory.level), adapt: Array.from(sim.adapt.level),
  };
}
