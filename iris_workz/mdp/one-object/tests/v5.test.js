// V5 framework: shared form, registry, research session, placeholder pointer logging.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeSim } from './helpers.mjs';
import { stageScale, stageCentre, restOutline } from '../src/materials/sharedForm.js';
import { MATERIALS, CONDITION_IDS, materialById } from '../src/materials/registry.js';
import { ResearchSession, parseOrder, isValidOrder } from '../src/research/ResearchSession.js';
import { PointerTracker } from '../src/materials/PointerTracker.js';
import { SessionLogger } from '../src/research/SessionLogger.js';
import { buildPayload } from '../src/research/Exporter.js';

test('Shared form: every condition uses Condition 01’s exact outline, centre and diameter', () => {
  const { sim } = makeSim({ seed: 20261105 });
  assert.deepEqual(Array.from(restOutline(20261105)), Array.from(sim.body.baseRest), 'same rest outline as the soft body');
  for (const [w, h] of [[1280, 800], [1920, 1080], [390, 844], [800, 1280]]) {
    const expected = w < 640 ? Math.min(w * 0.36, h * 0.3) : Math.min(w * 0.27, h * 0.36);
    assert.equal(stageScale(w, h), expected, `scale at ${w}×${h} matches the V4 renderer formula`);
    assert.deepEqual(stageCentre(w, h), { cx: w / 2, cy: h / 2 });
  }
  const src = fs.readFileSync(new URL('../src/rendering/FilamentRenderer.js', import.meta.url), 'utf8');
  assert.match(src, /stageScale\(this\.w, this\.h\)/, 'Condition 01 renderer uses the shared scale');
});

test('Registry: four conditions 01–04, each with its own module and researcher-only name', () => {
  assert.deepEqual(CONDITION_IDS, ['01', '02', '03', '04']);
  assert.deepEqual(MATERIALS.map((m) => m.key), ['structural', 'gel', 'plastic', 'silicone']);
  assert.equal(materialById('01').status, 'full');
  assert.equal(materialById('02').status, 'full', 'Gel implemented in Phase 03');
  assert.equal(materialById('03').status, 'full', 'Plastic implemented in Phase 06');
  assert.equal(materialById('04').status, 'full', 'Silicone implemented in Phase 05');
  const loaders = MATERIALS.map((m) => m.load.toString());
  assert.equal(new Set(loaders).size, 4, 'distinct module per material');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of MATERIALS) assert.ok(!html.includes(m.name), `participant markup never contains "${m.name}"`);
});

test('Order parsing and validation', () => {
  assert.deepEqual(parseOrder('03, 01 4 2'), ['03', '01', '04', '02']);
  assert.equal(parseOrder('01,01,02,03'), null);
  assert.equal(parseOrder('01,02,03'), null);
  assert.ok(isValidOrder(['04', '03', '02', '01']));
});

test('Research session: encounters are archived in order, never overwritten', () => {
  let n = 0; const rs = new ResearchSession({ idFactory: () => 'rs-' + (++n), now: () => new Date('2026-11-12T10:00:00Z') });
  const e0 = rs.beginEncounter({ conditionId: '01', materialKey: 'structural', startReason: 'initial', preset: 'B_adaptive' });
  assert.equal(e0.encounterIndex, 0); assert.equal(e0.orderPosition, 1);
  rs.endEncounter({ marker: 'first' }, 'participant_switch');
  rs.beginEncounter({ conditionId: '03', materialKey: 'plastic', startReason: 'participant_switch', preset: 'B_adaptive' });
  rs.endEncounter({ marker: 'second' }, 'participant_reset');
  rs.beginEncounter({ conditionId: '03', materialKey: 'plastic', startReason: 'participant_reset', preset: 'B_adaptive' });
  const out = JSON.parse(JSON.stringify(rs.buildExport({ marker: 'open' })));
  assert.equal(out.schemaVersion, 3);
  assert.equal(out.encounterCount, 3);
  assert.deepEqual(out.conditionSequence, ['01', '03', '03']);
  assert.deepEqual(out.encounters.map((e) => e.payload.marker), ['first', 'second', 'open']);
  assert.deepEqual(out.encounters.map((e) => e.endReason), ['participant_switch', 'participant_reset', 'open_at_export']);
  assert.equal(out.encounters[1].previousConditionId, '01');
  assert.ok(rs.current, 'export does not close the open encounter');
});

test('Research session: locked order only allows the current and the next condition', () => {
  const rs = new ResearchSession({ rng: () => 0.42 });
  assert.equal(rs.allowedConditions().size, 4, 'unlocked: all allowed');
  rs.setOrder(['03', '01', '04', '02']);
  rs.setLocked(true);
  assert.equal(rs.firstCondition(), '03');
  rs.beginEncounter({ conditionId: '03', materialKey: 'plastic', startReason: 'initial' });
  assert.deepEqual([...rs.allowedConditions()].sort(), ['01', '03']);
  rs.endEncounter({}, 'participant_switch');
  rs.beginEncounter({ conditionId: '01', materialKey: 'structural', startReason: 'participant_switch' });
  assert.deepEqual([...rs.allowedConditions()].sort(), ['01', '04']);
  assert.equal(rs.current.orderPosition, 2);
  const shuffled = rs.shuffleOrder();
  assert.ok(isValidOrder(shuffled));
  assert.ok(rs.orderLog.length >= 3, 'order and lock changes are recorded');
  assert.equal(rs.setOrder(['01', '02']), false, 'invalid order rejected');
});

test('Placeholder pointer tracker logs comparable contact events against the shared outline', () => {
  const logger = new SessionLogger({ idFactory: () => 'x', now: () => new Date(0) });
  logger.start({ conditionId: '02' });
  const tr = new PointerTracker(restOutline(20261105), logger);
  const step = (inp, k = 1) => { for (let i = 0; i < k; i++) { tr.setInput(inp); tr.step(1 / 60); } };
  step({ present: true, x: 2, y: 0, vx: 0, vy: 0, down: false }, 10);
  step({ present: true, x: 1.25, y: 0, vx: -1, vy: 0, down: false }, 40);     // approach
  step({ present: true, x: 1.0, y: 0, vx: 0, vy: 0, down: true }, 30);        // press on the edge
  step({ present: true, x: 1.2, y: 0.1, vx: 0.5, vy: 0, down: true }, 30);    // drag
  step({ present: true, x: 1.2, y: 0.1, vx: 0, vy: 0, down: false }, 5);      // release
  step({ present: true, x: 1.0, y: 0, vx: 0, vy: 0, down: true }, 5);         // revisit
  step({ present: true, x: 1.0, y: 0, vx: 0, vy: 0, down: false }, 5);
  const types = logger.events.map((e) => e.type);
  for (const t of ['approach', 'contact_start', 'contact_end', 'region_revisit']) assert.ok(types.includes(t), t);
  assert.equal(tr.totals.contactEpisodes, 2);
  assert.equal(logger.events.find((e) => e.type === 'contact_start').region, 0);
  step({ present: true, x: 4, y: 4, vx: 0, vy: 0, down: true }, 3);           // press far away: not a contact
  assert.equal(tr.totals.contactEpisodes, 2);
  tr.reset();
  assert.equal(tr.totals.contactEpisodes, 0); assert.equal(tr.timeMs, 0);
});

test('Encounter payload records why it ended', () => {
  const { sim, logger } = makeSim();
  const p = buildPayload(sim, logger, { condition: 'B_adaptive', endReason: 'participant_switch' });
  assert.equal(p.events.at(-1).type, 'session_end');
  assert.equal(p.events.at(-1).metadata.reason, 'participant_switch');
  logger.log('reset', 0, { metadata: { by: 'participant' } });   // new event type accepted
});
