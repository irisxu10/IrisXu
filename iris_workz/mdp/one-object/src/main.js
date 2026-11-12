// Entry point: owns the shared canvas, pointer input, sound, UI and the
// research session, and keeps exactly ONE material condition active.
// Switching condition (or resetting, applying a preset or seed) closes the
// current encounter — its record is frozen and kept — and begins a new one.

import { APP_VERSION, DEFAULT_PARAMS, PRESETS, DEFAULT_VISUAL, DEFAULT_SEED, GEL_DEFAULTS, SILICONE_DEFAULTS, PLASTIC_DEFAULTS } from './config.js';
import { PointerController } from './interaction/PointerController.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { SessionLogger } from './research/SessionLogger.js';
import { ResearchSession } from './research/ResearchSession.js';
import { downloadJSON } from './research/Exporter.js';
import { ExhibitionUI } from './ui/ExhibitionUI.js';
import { ResearcherPanel } from './ui/ResearcherPanel.js';
import { materialById } from './materials/registry.js';
import { Material } from './materials/Material.js';
import { clientToObject } from './materials/sharedForm.js';

const canvas = document.getElementById('stage');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const audio = new AudioEngine();
const pointer = new PointerController(canvas, (x, y) => clientToObject(canvas, x, y));
const research = new ResearchSession();
const SILENT = Object.freeze({ tension: 0, motion: 0, sweep: 0, kinetic: 0 });

// researcher-controlled settings that persist across encounters
const params = { ...DEFAULT_PARAMS };          // behaviour (condition 01)
const visual = { ...DEFAULT_VISUAL };          // display (condition 01)
const visualCommitted = { ...DEFAULT_VISUAL };
const materialParams = { gel: { ...GEL_DEFAULTS }, plastic: { ...PLASTIC_DEFAULTS }, silicone: { ...SILICONE_DEFAULTS } };   // per-material researcher parameters (02–04)
const preset = { id: 'B', custom: false };
let seed = DEFAULT_SEED;
const presetLabel = () => PRESETS[preset.id].id + (preset.custom ? '+custom' : '');

let lang = 'en';
let material = null;       // the single active material
let def = null;            // its registry entry
let logger = null;         // its encounter log
let token = 0;             // guards against overlapping switches

const clock = () => (material ? material.clockMs() : 0);
const conditionLabel = (d) => (d.key === 'structural' ? presetLabel() : d.status === 'placeholder' ? 'placeholder' : d.key);
function logParam(param, from, to, scope = 'behaviour') {
  logger?.log('parameter_change', clock(), { metadata: { param, from, to, scope } });
}
function snapshot(endReason) {
  return material.buildEncounterPayload({ condition: conditionLabel(def), visual, endReason });
}

/**
 * Make `conditionId` the active material and begin a new encounter.
 * archive=false discards the open encounter (only used for "new research session").
 */
async function activate(conditionId, reason, { archive = true, event = null } = {}) {
  const d = materialById(conditionId);
  if (!d) return;
  const my = ++token;
  const mod = await d.load();                 // material-specific module, loaded on demand
  if (my !== token) return;                   // superseded by a newer switch

  if (material) {
    if (archive) research.endEncounter(snapshot(reason), reason);
    material.dispose();
    material = null;
  }
  def = d;
  logger = new SessionLogger();
  const enc = research.beginEncounter({ conditionId: d.id, materialKey: d.key, materialName: d.name, startReason: reason, preset: presetLabel() });
  const m = new mod.default(d, { canvas, logger, audio, seed, params: { ...params }, visual: { ...visual }, materialParams: structuredClone(materialParams), reducedMotion: motionQuery.matches });
  m.initialize();
  if ('onAutoDetail' in m) m.onAutoDetail = (from, to) => logParam('autoDetail', from, to, 'visual');
  material = m;
  logger.start({
    appVersion: APP_VERSION,
    researchSessionId: research.id,
    encounterIndex: enc.encounterIndex,
    conditionId: d.id,
    materialKey: d.key,
    orderPosition: enc.orderPosition,
    conditionOrder: enc.conditionOrder,
    orderLocked: enc.orderLocked,
    startReason: reason,
    previousConditionId: enc.previousConditionId,
    preset: presetLabel(),
    condition: conditionLabel(d),
    seed,
    parameters: d.key === 'structural' ? { ...params } : materialParams[d.key] ? { ...materialParams[d.key] } : null,
    visualParameters: d.key === 'structural' ? { ...visual } : null,
    reducedMotion: motionQuery.matches,
    sound: audio.enabled,
  });
  if (event) logger.log(event.type, 0, event.fields);
  ui.resetHints();
  ui.clearReflection();
  ui.closeAll();
  refresh();
}

function refresh() {
  if (!def) return;
  ui.setConditions(def.id, research.allowedConditions());
  researcher.sync({ def, material, sim: material?.sim || null, presetLabel: presetLabel(), params, seed, visual, research });
}

const ui = new ExhibitionUI({
  lang,
  onLangChange: (l) => { lang = l; researcher.relabel(); },
  onCondition: (id) => {
    if (!def || id === def.id || !research.allowedConditions().has(id)) return;
    activate(id, 'participant_switch');
  },
  onReset: () => {
    if (!def) return;
    const prev = research.current?.encounterIndex;
    activate(def.id, 'participant_reset', { event: { type: 'reset', fields: { metadata: { by: 'participant', previousEncounterIndex: prev } } } });
  },
  onReflection: (answers) => logger?.setReflection(answers, clock()),
  onOpenResearcher: () => researcher.show(),
  onSound: async () => {
    if (audio.enabled) audio.disable();
    else if (!(await audio.enable())) { ui.setSound('unavailable'); return; }
    ui.setSound(audio.enabled ? 'on' : 'off');
    logger?.log('sound_toggle', clock(), { metadata: { enabled: audio.enabled } });
  },
});
ui.setSound(audio.supported ? 'off' : 'unavailable');

const researcher = new ResearcherPanel(document.getElementById('researcher'), {
  getLang: () => lang,
  onSwitch: (id) => { if (def && id !== def.id) activate(id, 'researcher_switch'); },
  // per-material parameters (e.g. Gel viscosity); persist across encounters, logged with scope "material"
  onMaterialParam: (key, value) => {
    const store = materialParams[def.key];
    if (!store || store[key] === value) return;
    const from = store[key];
    store[key] = value;
    material?.setParam?.(key, value);
    logParam(`${def.key}.${key}`, from, value, 'material');
  },
  onParam: (key, value) => {
    const from = params[key];
    if (from === value) return;
    params[key] = value;
    if (material?.sim) material.sim.params[key] = value;
    preset.custom = true;
    logParam(key, from, value);
    refresh();
  },
  // display-only: applied live while dragging, logged on commit; never marks the condition custom
  onVisual: (key, value, commit) => {
    visual[key] = value;
    material?.setVisual?.(key, value);
    if (!commit) return;
    if (visualCommitted[key] !== value) logParam(key, visualCommitted[key], value, 'visual');
    visualCommitted[key] = value;
  },
  onPreset: (id) => {
    const { id: _ignored, ...flags } = PRESETS[id];
    logParam('preset', presetLabel(), PRESETS[id].id);
    Object.assign(params, DEFAULT_PARAMS, flags);
    preset.id = id; preset.custom = false;
    if (def?.key === 'structural') activate(def.id, 'preset');
    else refresh();
  },
  onSeed: (s) => { logParam('seed', seed, s); seed = s; if (def) activate(def.id, 'seed'); },
  onReset: () => {
    if (!def) return;
    const prev = research.current?.encounterIndex;
    activate(def.id, 'researcher_reset', { event: { type: 'reset', fields: { metadata: { by: 'researcher', previousEncounterIndex: prev } } } });
  },
  onOrder: (order) => {
    const from = research.order.join(',');
    if (research.setOrder(order)) logParam('conditionOrder', from, order.join(','), 'research');
    refresh();
  },
  onShuffle: () => {
    const from = research.order.join(',');
    const o = research.shuffleOrder();
    logParam('conditionOrder', from, o.join(','), 'research');
    refresh();
  },
  onLock: (on) => { research.setLocked(on); logParam('orderLocked', !on, on, 'research'); refresh(); },
  onExport: () => {
    if (!material) return;
    downloadJSON(research.buildExport(snapshot('export_snapshot')), `research-session-${research.id.slice(0, 8)}.json`);
  },
  onNewResearch: () => { research.start(); activate(research.firstCondition(), 'new_research_session', { archive: false }); },
});

// ---------- global input ----------
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') { if (researcher.open) researcher.close(); else ui.closeAll(); }
  else if (!typing && e.shiftKey && (e.key === 'R' || e.key === 'r')) { e.preventDefault(); researcher.toggle(); }
});

new ResizeObserver(() => material?.resize()).observe(canvas);
motionQuery.addEventListener?.('change', (e) => material?.setReducedMotion(e.matches));

// ---------- loop ----------
let last = performance.now(), fps = 60;
document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden);
  if (!document.hidden) last = performance.now();
});

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  pointer.update(now);
  if (!material) return;
  material.handlePointerInput(pointer.state);
  material.update(dt, fps);
  material.render(pointer.state);
  audio.update(material.audioSignals() || SILENT, material.isGrabbing());
  ui.update(material.hintSource(), dt * 1000);
  researcher.update(material, fps, dt * 1000, logger.events.length, {
    audioPeak: audio.enabled ? audio.peak.toFixed(3) : undefined,
  });
}
requestAnimationFrame(frame);

// exposed for manual inspection in the console (read-only use)
window.__oome = {
  get material() { return material; },
  get def() { return def; },
  get sim() { return material?.sim || null; },
  get renderer() { return material?.renderer || null; },
  get logger() { return logger; },
  research, audio, Material, version: APP_VERSION,
};

activate(research.firstCondition(), 'initial').then(() => {
  window.__oomeReady = true;
  document.getElementById('boot-warning')?.remove();
});
