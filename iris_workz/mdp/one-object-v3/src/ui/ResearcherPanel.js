// Researcher Mode: hidden during ordinary encounters. Builds its own DOM.

import { RESEARCH_SLIDERS, RESEARCH_TOGGLES } from '../config.js';
import { t } from './translations.js';

const UPDATE_INTERVAL = 200; // ms

export class ResearcherPanel {
  constructor(root, { getLang, onParam, onPreset, onSeed, onReset, onExport, onTheme }) {
    this.root = root;
    this.cb = { getLang, onParam, onPreset, onSeed, onReset, onExport, onTheme };
    this.sinceUpdate = UPDATE_INTERVAL;
    this.build();
  }

  get open() { return !this.root.hidden; }

  toggle() { if (this.open) this.close(); else this.show(); }
  show() { this.root.hidden = false; this.sinceUpdate = UPDATE_INTERVAL; this.root.querySelector('button')?.focus(); }
  close() { this.root.hidden = true; }

  L(key) { return t(this.cb.getLang(), 'researcher.' + key); }

  build() {
    const r = this.root;
    r.innerHTML = '';
    const el = (tag, attrs = {}, ...kids) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
      }
      e.append(...kids);
      return e;
    };
    this.el = el;

    r.append(el('div', { class: 'r-head' },
      el('h2', { id: 'r-title' }, this.L('title')),
      el('button', { type: 'button', onclick: () => this.close(), 'aria-label': this.L('close') }, '×')));

    // condition + presets
    this.condEl = el('strong');
    r.append(el('section', {},
      el('div', { class: 'r-row' }, el('span', {}, this.L('condition')), this.condEl),
      el('div', { class: 'r-presets' },
        el('button', { type: 'button', onclick: () => this.cb.onPreset('A') }, this.L('presetA')),
        el('button', { type: 'button', onclick: () => this.cb.onPreset('B') }, this.L('presetB'))),
      el('p', { class: 'r-note' }, this.L('presetNote'))));

    // seed
    this.seedInput = el('input', { type: 'number', min: '0', step: '1', id: 'r-seed' });
    r.append(el('section', {}, el('label', { for: 'r-seed' }, this.L('seed')),
      el('div', { class: 'r-seed' }, this.seedInput,
        el('button', { type: 'button', onclick: () => {
          const v = Math.floor(Number(this.seedInput.value));
          if (Number.isFinite(v) && v >= 0) this.cb.onSeed(v >>> 0);
        } }, this.L('applySeed')))));

    // sliders
    this.inputs = {};
    const sliders = el('section', {});
    for (const s of RESEARCH_SLIDERS) {
      const id = 'r-' + s.key;
      const out = el('output', { for: id });
      const input = el('input', { type: 'range', id, min: s.min, max: s.max, step: s.step });
      input.addEventListener('input', () => { out.textContent = input.value; });
      input.addEventListener('change', () => this.cb.onParam(s.key, Number(input.value)));
      this.inputs[s.key] = { input, out };
      sliders.append(el('div', { class: 'r-slider' },
        el('label', { for: id }, el('span', {}, this.L('params.' + s.key)), out), input));
    }
    for (const key of RESEARCH_TOGGLES) {
      const id = 'r-' + key;
      const input = el('input', { type: 'checkbox', id });
      input.addEventListener('change', () => this.cb.onParam(key, input.checked));
      this.inputs[key] = { input };
      sliders.append(el('label', { class: 'r-check', for: id }, input, el('span', {}, this.L('params.' + key))));
    }
    this.themeInput = el('input', { type: 'checkbox', id: 'r-theme' });
    this.themeInput.addEventListener('change', () => this.cb.onTheme(this.themeInput.checked));
    sliders.append(el('label', { class: 'r-check', for: 'r-theme' }, this.themeInput, el('span', {}, this.L('theme'))));
    r.append(sliders);

    // live state
    this.stateEl = el('div', { class: 'r-state' });
    this.statsEl = el('dl', { class: 'r-stats' });
    this.heat = el('canvas', { width: '360', height: '360', class: 'r-heat', 'aria-hidden': 'true' });
    r.append(el('section', {}, el('h3', {}, this.L('state')), this.stateEl, this.statsEl,
      el('h3', {}, this.L('heatmap')), this.heat));

    r.append(el('section', { class: 'r-actions' },
      el('button', { type: 'button', onclick: () => this.cb.onReset() }, this.L('reset')),
      el('button', { type: 'button', class: 'primary', onclick: () => this.cb.onExport() }, this.L('export'))));
  }

  /** Re-render labels after a language change, keeping values. */
  relabel(sim, conditionId, theme) {
    const wasOpen = this.open;
    this.build();
    this.sync(sim, conditionId, theme);
    this.root.hidden = !wasOpen;
  }

  sync(sim, conditionId, theme) {
    for (const [key, { input, out }] of Object.entries(this.inputs)) {
      if (input.type === 'checkbox') input.checked = !!sim.params[key];
      else { input.value = sim.params[key]; out.textContent = sim.params[key]; }
    }
    this.seedInput.value = sim.seed;
    this.condEl.textContent = conditionId;
    this.themeInput.checked = theme === 'dark';
  }

  update(sim, fps, dtMs, eventCount) {
    if (!this.open) return;
    this.sinceUpdate += dtMs;
    if (this.sinceUpdate < UPDATE_INTERVAL) return;
    this.sinceUpdate = 0;
    const st = sim.getState();
    this.stateEl.textContent = st.primary + '  ·  ' + Object.entries(st.flags).filter(([, v]) => v).map(([k]) => k).join(' + ');
    const tot = sim.totals;
    const rows = [
      ['elapsed', (sim.timeMs / 1000).toFixed(1) + 's'],
      ['contacts', tot.contactEpisodes],
      ['revisits', tot.revisits],
      ['adapted', sim.adapt.adaptedRegions() + ' / ' + sim.regionCount],
      ['maxMemory', sim.memory.max().toFixed(2)],
      ['events', eventCount],
      ['fps', Math.round(fps)],
    ];
    this.statsEl.replaceChildren(...rows.flatMap(([k, v]) => [this.el('dt', {}, this.L('stats.' + k)), this.el('dd', {}, String(v))]));
    this.drawHeat(sim);
  }

  drawHeat(sim) {
    const c = this.heat, ctx = c.getContext('2d'), W = c.width, cx = W / 2;
    const ink = getComputedStyle(this.root).color;
    ctx.clearRect(0, 0, W, W);
    const n = sim.n, step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const a0 = i * step - step / 2, a1 = a0 + step;
      ctx.beginPath(); ctx.arc(cx, cx, W * 0.44, a0, a1); ctx.arc(cx, cx, W * 0.32, a1, a0, true); ctx.closePath();
      ctx.fillStyle = `rgba(150,96,60,${0.06 + sim.memory.level[i] * 0.9})`; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cx, W * 0.3, a0, a1); ctx.arc(cx, cx, W * 0.2, a1, a0, true); ctx.closePath();
      ctx.fillStyle = `rgba(70,96,120,${0.06 + sim.adapt.level[i] * 0.9})`; ctx.fill();
    }
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    for (let r = 0; r < sim.regionCount; r++) {
      const a = (r - 0.5) * (Math.PI * 2 / sim.regionCount);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * W * 0.2, cx + Math.sin(a) * W * 0.2);
      ctx.lineTo(cx + Math.cos(a) * W * 0.46, cx + Math.sin(a) * W * 0.46); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
