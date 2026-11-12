// Entry point: wires simulation, renderer, input, UI and research tools.

import { APP_VERSION, STEP, MAX_SUBSTEPS, DEFAULT_PARAMS, PRESETS } from './config.js';
import { Simulation } from './simulation/Simulation.js';
import { ObjectRenderer } from './rendering/ObjectRenderer.js';
import { PointerController } from './interaction/PointerController.js';
import { SessionLogger } from './research/SessionLogger.js';
import { buildPayload, downloadJSON } from './research/Exporter.js';
import { ExhibitionUI } from './ui/ExhibitionUI.js';
import { ResearcherPanel } from './ui/ResearcherPanel.js';

const canvas = document.getElementById('stage');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

const logger = new SessionLogger();
const sim = new Simulation({ logger, reducedMotion: motionQuery.matches });
const renderer = new ObjectRenderer(canvas, sim);
const pointer = new PointerController(canvas, (x, y) => renderer.toObject(x, y));

let lang = 'en';
let theme = 'light';
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
    reducedMotion: sim.reducedMotion,
    theme,
  });
  ui.resetHints();
  ui.clearReflection();
}

function logParam(param, from, to) {
  logger.log('parameter_change', sim.timeMs, { metadata: { param, from, to } });
}

const ui = new ExhibitionUI({
  lang,
  onLangChange: (l) => { lang = l; researcher.relabel(sim, conditionId(), theme); },
  onReset: () => startSession(),
  onReflection: (answers) => logger.setReflection(answers, sim.timeMs),
  onOpenResearcher: () => researcher.show(),
});

const researcher = new ResearcherPanel(document.getElementById('researcher'), {
  getLang: () => lang,
  onParam: (key, value) => {
    const from = sim.params[key];
    if (from === value) return;
    sim.params[key] = value;
    condition.custom = true;
    logParam(key, from, value);
    researcher.sync(sim, conditionId(), theme);
  },
  onPreset: (id) => {
    const { id: _ignored, ...flags } = PRESETS[id];
    logParam('preset', conditionId(), PRESETS[id].id);
    Object.assign(sim.params, DEFAULT_PARAMS, flags);
    condition.preset = id; condition.custom = false;
    startSession();
    researcher.sync(sim, conditionId(), theme);
  },
  onSeed: (seed) => {
    logParam('seed', sim.seed, seed);
    sim.seed = seed;
    startSession();
    researcher.sync(sim, conditionId(), theme);
  },
  onReset: () => { startSession(); researcher.sync(sim, conditionId(), theme); },
  onExport: () => downloadJSON(buildPayload(sim, logger, { condition: conditionId() })),
  onTheme: (dark) => {
    const next = dark ? 'dark' : 'light';
    logParam('theme', theme, next);
    theme = next;
    document.documentElement.dataset.theme = theme;
    renderer.setTheme(theme);
  },
});

startSession();
researcher.sync(sim, conditionId(), theme);

// ---------- global input ----------
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (e.key === 'Escape') { if (researcher.open) researcher.close(); else ui.closeAll(); }
  else if (!typing && e.shiftKey && (e.key === 'R' || e.key === 'r')) { e.preventDefault(); researcher.toggle(); }
});

new ResizeObserver(() => renderer.resize()).observe(canvas);
motionQuery.addEventListener?.('change', (e) => { sim.reducedMotion = e.matches; });

// ---------- loop ----------
let last = performance.now(), acc = 0, fps = 60;
document.addEventListener('visibilitychange', () => { if (!document.hidden) last = performance.now(); });

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
  renderer.draw(dt, pointer.state);
  ui.update(sim, dt * 1000);
  researcher.update(sim, fps, dt * 1000, logger.events.length);
}
requestAnimationFrame(frame);

// expose for manual inspection in the console (read-only use)
window.__oome = { sim, logger, version: APP_VERSION };
window.__oomeReady = true;
document.getElementById('boot-warning')?.remove();
