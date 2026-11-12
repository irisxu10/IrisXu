// Phase 06 helper: the SAME scripted gesture applied to all four material models.
import { makeSim } from './helpers.mjs';
import { GelBody } from '../src/physics/GelBody.js';
import { PlasticBody } from '../src/physics/PlasticBody.js';
import { SiliconeBody } from '../src/physics/SiliconeBody.js';
import { restOutline } from '../src/materials/sharedForm.js';

const SEED = 20261105, SEC = 60;
/** Press at the right edge, drag 0.4 inward over 0.5 s, hold 0.5 s, release. */
export function gesture(body, onRelease) {
  body.setInput({ present: true, x: 0.95, y: 0, vx: 0, vy: 0, down: true }); body.step();
  for (let s = 1; s <= 30; s++) { body.setInput({ present: true, down: true, x: 0.95 - 0.4 * s / 30, y: 0, vx: -0.8, vy: 0 }); body.step(); }
  for (let s = 0; s < 30; s++) { body.setInput({ vx: 0, vy: 0 }); body.step(); }
  body.setInput({ present: false, down: false, vx: 0, vy: 0 });
  for (let s = 0; s < 15; s++) body.step();       // 0.25 s after release
  const shortly = onRelease();
  for (let s = 0; s < 15 * SEC; s++) body.step();  // 15 s later
  return shortly;
}

export const SimulationBody = {
  compareAll() {
    const out = {};
    const { sim } = makeSim({ seed: SEED });
    const s01 = gesture(sim, () => sim.maxDisplacement());
    out['01'] = { shortlyAfter: s01, afterDisp: sim.maxDisplacement(), trace: Math.max(...sim.memory.level) };
    const o = restOutline(SEED);
    const gel = new GelBody(o, SEED);
    out['02'] = { shortlyAfter: gesture(gel, () => gel.maxDisp), afterDisp: gel.maxDisp };
    const pl = new PlasticBody(o, SEED);
    gesture(pl, () => 0);
    out['03'] = { creases: pl.totals.creases, projectedArea: pl.metrics.projectedArea };
    const si = new SiliconeBody(o, SEED); const ev = []; si.onEvent = (t, f) => ev.push({ t, ...f });
    out['04'] = { shortlyAfter: gesture(si, () => si.maxDisp), afterDisp: si.maxDisp, overshoots: ev.find((e) => e.t === 'recovery')?.metadata.overshoots ?? 0 };
    return out;
  },
};
