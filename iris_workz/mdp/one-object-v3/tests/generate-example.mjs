// Generates examples/session-example.json from a scripted, deterministic session.
import fs from 'node:fs';
import { makeSim, steps, dragCycle } from './helpers.mjs';
import { buildPayload } from '../src/research/Exporter.js';

const { sim, logger } = makeSim({ preset: 'B', seed: 20261105 });
steps(sim, 90, (i) => ({ present: true, x: 2.2 - i * 0.011, y: 0.1, vx: -0.66, vy: 0 }));   // approach
for (let k = 0; k < 6; k++) dragCycle(sim, 0, { restSteps: 60 });                          // repeated contact, same region
dragCycle(sim, Math.PI * 0.75);                                                             // a different region
steps(sim, 60 * 15, () => ({ present: true, x: 1.6, y: 0.4, vx: 0, vy: 0 }));               // stillness nearby
dragCycle(sim, 0);                                                                          // return
logger.setReflection({ q1: 'One side became stiffer.', q2: 'Yes, that it would stretch.', q3: '', q4: 'I moved to the other side.', q5: '' }, sim.timeMs);
const payload = buildPayload(sim, logger, { condition: 'B_adaptive', exportedAt: '2026-11-05T10:03:00.000Z' });
fs.mkdirSync(new URL('../examples/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../examples/session-example.json', import.meta.url), JSON.stringify(payload, null, 2) + '\n');
console.log('events:', payload.events.length, 'summary:', JSON.stringify(payload.summary));
