// Entry point: wires simulation, renderer, input, sound, UI and research tools.

import { APP_VERSION, STEP, MAX_SUBSTEPS, DEFAULT_PARAMS, PRESETS, DEFAULT_VISUAL } from './config.js';
import { Simulation } from './simulation/Simulation.js';
import { FilamentRenderer } from './rendering/FilamentRenderer.js';
import { PointerController } from './interaction/PointerController.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { SessionLogger } from './research/SessionLogger.js';
import { buildPayload, downloadJSON } from './research/Exporter.js';
import { ExhibitionUI } from './ui/ExhibitionUI.js';
import { ResearcherPanel } from './ui/ResearcherPanel.js';

const canvas = document.getElementById('stage');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

const logger = new SessionLogger();
const sim = new Simulation({ logger, reducedMotion: motionQuery.matches });
const renderer = new FilamentRenderer(canvas, sim);
renderer.reducedMotion = motionQuery.matches;
const pointer = new PointerController(canvas, (x, y) => renderer.toObject(x, y));
const audio = new AudioEngine();
sim.hooks.contact = (s) => audio.contact(s);
sim.hooks.release = (t) => audio.release(t);

let lang = 'en';
const visual = renderer.visual;
const condition = { preset: 'B', custom: false };
const conditionId = () => PRESETS[condition.preset].id + (condition.custom ? '+custom' : '');

function startSession() {
  sim.reset(sim.seed);
  renderer.resetLag();
  logger.start({
    appVersion: APP_VERSION,
    condition: conditionId(),
    seed: sim.seed,
    parameters: { ...sim.params },
    visualParameters: { ...visual },
    reducedMotion: sim.reducedMotion,
    sound: audio.enabled,
  });
  ui.resetHints();
  ui.clearReflection();
}

function logParam(param, from, to, scope = 'behaviour') {
  logger.log('parameter_change', sim.timeMs, { metadata: { param, from, to, scope } });
}

const ui = new ExhibitionUI({
  lang,
  onLangChange: (l) => { lang = l; researcher.relabel(sim, conditionId(), visual); },
  onReset: () => startSession(),
  onReflection: (answers) => logger.setReflection(answers, sim.timeMs),
  onOpenResearcher: () => researcher.show(),
  onSound: async () => {
    if (audio.enabled) audio.disable();
    else if (!(await audio.enable())) { ui.setSound('unavailable'); return; }
    ui.setSound(audio.enabled ? 'on' : 'off');
    logger.log('sound_toggle', sim.timeMs, { metadata: { enabled: audio.enabled } });
  },
});
ui.setSound(audio.supported ? 'off' : 'unavailable');

const researcher = new ResearcherPanel(document.getElementById('researcher'), {
  getLang: () => lang,
  onParam: (key, value) => {
    const from = sim.params[key];
    if (from === value) return;
    sim.params[key] = value;
    condition.custom = true;
    logParam(key, from, value);
    researcher.sync(sim, conditionId(), visual);
  },
  // display-only: applied live while dragging a slider, logged on commit; never marks the condition custom
  onVisual: (key, value, commit) => {
    const from = visual[key];
    if (!commit) { renderer.setVisual(key, value); return; }
    if (visualCommitted[key] !== value) logParam(key, visualCommitted[key], value, 'visual');
    visualCommitted[key] = value;
    if (from !== value) renderer.setVisual(key, value);
  },
  onPreset: (id) => {
    const { id: _ignored, ...flags } = PRESETS[id];
    logParam('preset', conditionId(), PRESETS[id].id);
    Object.assign(sim.params, DEFAULT_PARAMS, flags);
    condition.preset = id; condition.custom = false;
    startSession();
    researcher.sync(sim, conditionId(), visual);
  },
  onSeed: (seed) => {
    logParam('seed', sim.seed, seed);
    sim.seed = seed;
    startSession();
    researcher.sync(sim, conditionId(), visual);
  },
  onReset: () => { startSession(); researcher.sync(sim, conditionId(), visual); },
  onExport: () => downloadJSON(buildPayload(sim, logger, { condition: conditionId(), visual })),
});
const visualCommitted = { ...DEFAULT_VISUAL };

startSession();
researcher.sync(sim, conditionId(), visual);

// ---------- global input ----------
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') { if (researcher.open) researcher.close(); else ui.closeAll(); }
  else if (!typing && e.shiftKey && (e.key === 'R' || e.key === 'r')) { e.preventDefault(); researcher.toggle(); }
});

new ResizeObserver(() => renderer.resize()).observe(canvas);
motionQuery.addEventListener?.('change', (e) => { sim.reducedMotion = e.matches; renderer.reducedMotion = e.matches; });

// ---------- loop ----------
let last = performance.now(), acc = 0, fps = 60, slowMs = 0;
document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden);
  if (!document.hidden) last = performance.now();
});

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  acc += dt;
  pointer.update(now);
  sim.setInput(pointer.state);
  let steps = 0;
  while (acc >= STEP && steps < MAX_SUBSTEPS) { sim.step(); acc -= STEP; steps++; }
  if (steps === MAX_SUBSTEPS) acc = 0; // drop backlog instead of spiralling

  // automatic reduced-detail fallback after sustained low frame rate
  slowMs = fps < 40 ? slowMs + dt * 1000 : 0;
  if (slowMs > 2500 && renderer.detail === 1) {
    renderer.detail = 0.6;
    logParam('autoDetail', 1, 0.6, 'visual');
  }

  renderer.draw(dt, pointer.state);
  audio.update(sim.signals, !!sim.grab);
  ui.update(sim, dt * 1000);
  researcher.update(sim, fps, dt * 1000, logger.events.length, {
    detail: renderer.detail,
    audioPeak: audio.enabled ? audio.peak.toFixed(3) : undefined,
  });
}
requestAnimationFrame(frame);

// exposed for manual inspection in the console (read-only use)
window.__oome = { sim, logger, renderer, audio, version: APP_VERSION };
window.__oomeReady = true;
document.getElementById('boot-warning')?.remove();
