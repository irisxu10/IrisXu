// Phase 06 — integration: research session data, participant text, behavioural distinction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ResearchSession } from '../src/research/ResearchSession.js';
import { translations } from '../src/ui/translations.js';
import { MATERIALS } from '../src/materials/registry.js';
import { RESEARCH_SLIDERS } from '../src/config.js';
import { SimulationBody } from './phase06-helpers.mjs';

test('Session export: anonymous id, order, timeline of switches / resets / notes / reflection, parameters', () => {
  let n = 0, t = Date.parse('2026-11-12T10:00:00Z');
  const rs = new ResearchSession({ idFactory: () => 'anon-' + (++n), now: () => new Date((t += 1000)) });
  rs.setOrder(['02', '01', '04', '03']); rs.setLocked(true);
  rs.beginEncounter({ conditionId: '02', materialKey: 'gel', startReason: 'initial' });
  rs.endEncounter({ p: 1 }, 'participant_switch');
  rs.beginEncounter({ conditionId: '01', materialKey: 'structural', startReason: 'participant_switch' });
  rs.endEncounter({ p: 2 }, 'participant_reset');
  rs.beginEncounter({ conditionId: '01', materialKey: 'structural', startReason: 'participant_reset' });
  rs.addNote('  hesitated before first contact  ');
  assert.equal(rs.addNote('   '), null, 'empty notes ignored');
  rs.setReflection({ q1: 'soft', q2: '', q3: 'yes', q4: '', q5: '' }, { lang: 'en' });
  rs.mark('export');
  const out = JSON.parse(JSON.stringify(rs.buildExport({ p: 3 }, undefined, { parameterSettings: { seed: 1, gel: { viscosity: 0.6 } }, materials: { '01': { key: 'structural' } } })));
  assert.equal(out.schemaVersion, 4);
  assert.equal(out.participant.anonymousSessionId, 'anon-1');
  assert.deepEqual(out.conditionOrder, ['02', '01', '04', '03']);
  assert.equal(out.orderLocked, true);
  assert.deepEqual(out.conditionSequence, ['02', '01', '01']);
  const types = out.timeline.map((e) => e.type);
  for (const ty of ['session_start', 'order_change', 'order_lock', 'encounter_start', 'condition_switch', 'reset', 'note', 'reflection', 'export']) assert.ok(types.includes(ty), ty);
  const sw = out.timeline.find((e) => e.type === 'condition_switch');
  assert.equal(sw.from, '02'); assert.equal(sw.conditionId, '01');
  assert.ok(out.timeline.every((e, i, a) => typeof e.tMs === 'number' && (i === 0 || e.tMs >= a[i - 1].tMs)), 'monotone timestamps');
  assert.equal(out.notes[0].text, 'hesitated before first contact');
  assert.equal(out.notes[0].conditionId, '01');
  assert.equal(out.reflection.answered, 2);
  assert.equal(out.parameterSettings.gel.viscosity, 0.6);
  assert.ok(/do not measure or infer emotion/.test(out.methodNote));
  // no personally identifying fields anywhere
  const keys = new Set(); const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.add(k.toLowerCase()); walk(v); } }; walk(out);
  for (const k of ['name', 'participantname', 'email', 'ip', 'useragent', 'birthdate', 'age', 'gender', 'address', 'location']) assert.ok(!keys.has(k), 'no field ' + k);
  // a new participant session starts clean
  rs.start();
  assert.equal(rs.id, 'anon-2'); assert.equal(rs.notes.length, 0); assert.equal(rs.reflection, null); assert.equal(rs.encounters.length, 0);
});

test('Reflection: the five neutral questions, in both languages, no leading terms', () => {
  const en = translations.en.questions;
  assert.deepEqual(en, [
    'What did you notice about each object?',
    'Did you expect any of them to behave differently?',
    'Did you change how you interacted with any object?',
    'What did the objects remind you of?',
    'Was there anything you found difficult to understand?',
  ]);
  assert.equal(translations.zh.questions.length, 5);
});

test('Participant-facing text: no material names, no claims of life, learning, feeling or memory', () => {
  const participant = (L) => { const { researcher, ...rest } = translations[L]; return JSON.stringify(rest).toLowerCase(); };
  const en = participant('en'), zh = participant('zh');
  for (const w of ['gel', 'plastic', 'silicone', 'structural', 'memory', 'alive', 'living', 'learn', 'feel', 'emotion', 'remember', 'intelligen', 'aware']) assert.ok(!new RegExp('\\b' + w).test(en), `EN participant text contains "${w}"`);
  for (const w of ['凝胶', '塑料', '硅胶', '结构', '记忆', '活', '学习', '感受', '情绪', '智能']) assert.ok(!zh.includes(w), `ZH participant text contains "${w}"`);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').toLowerCase();
  const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  for (const m of MATERIALS) for (const w of m.name.toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 3)) assert.ok(!visible.includes(w), `index.html shows "${w}"`);
});

test('Researcher parameters are grouped into Material properties / Behaviour & memory', async () => {
  for (const s of RESEARCH_SLIDERS) assert.ok(['material', 'behaviour'].includes(s.group), s.key);
  for (const m of MATERIALS.filter((x) => x.key !== 'structural')) {
    const mod = await import(`../src/materials/${m.key[0].toUpperCase() + m.key.slice(1)}Material.js`);
    const spec = Object.values(mod).find((v) => Array.isArray(v));
    assert.ok(spec && spec.length >= 4, m.key + ' exposes researcher parameters');
    assert.ok(spec.some((s) => s.group === 'material') && spec.some((s) => s.group === 'behaviour'), m.key + ' has both groups');
    for (const s of spec) assert.ok(translations.en.researcher.params[s.label] && translations.zh.researcher.params[s.label], s.label + ' translated');
  }
});

test('Behavioural distinction: one identical gesture, four different primary behaviours', () => {
  const r = SimulationBody.compareAll();
  // 01 Structural: returns to shape but keeps a local memory trace
  assert.ok(r['01'].afterDisp < 0.02 && r['01'].trace > 0.05, `01 memory trace ${r['01'].trace.toFixed(3)}`);
  // 02 Gel: slow, viscous — still deformed shortly after release, then recovers; area conserved
  assert.ok(r['02'].shortlyAfter > r['04'].shortlyAfter * 0.5 && r['02'].afterDisp < 0.02, `02 lag ${r['02'].shortlyAfter.toFixed(3)}`);
  // 03 Plastic: stays folded (persistent crease)
  assert.ok(r['03'].creases >= 1 && r['03'].projectedArea < 0.995, '03 keeps a crease');
  // 04 Silicone: overshoots past rest, then returns exactly
  assert.ok(r['04'].overshoots >= 1 && r['04'].afterDisp < 0.01, '04 springs back with overshoot');
});
