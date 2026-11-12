// Researcher Mode: hidden during ordinary encounters. Builds its own DOM.
// Material names appear ONLY here (participants see 01–04).

import { RESEARCH_SLIDERS, RESEARCH_TOGGLES, VISUAL_SLIDERS } from '../config.js';
import { MATERIALS } from '../materials/registry.js';
import { parseOrder } from '../research/ResearchSession.js';
import { t } from './translations.js';

const UPDATE_INTERVAL = 200; // ms

export class ResearcherPanel {
  /**
   * cb: { getLang, onParam, onVisual, onPreset, onSeed, onReset, onExport,
   *       onSwitch(id), onOrder(order), onShuffle(), onLock(bool), onNewResearch() }
   */
  constructor(root, cb) {
    this.root = root;
    this.cb = cb;
    this.sinceUpdate = UPDATE_INTERVAL;
    this.state = null;
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

    // ---- material condition (all conditions) ----
    this.materialEl = el('strong', { id: 'r-material' });
    this.statusEl = el('p', { class: 'r-note', id: 'r-status' });
    this.condButtons = MATERIALS.map((m) => el('button', { type: 'button', 'data-condition': m.id, 'aria-pressed': 'false', title: this.L('materialNames.' + m.key), onclick: () => this.cb.onSwitch(m.id) }, m.id));
    this.orderInput = el('input', { type: 'text', id: 'r-order', inputmode: 'numeric', autocomplete: 'off' });
    this.orderWarn = el('p', { class: 'r-warn', hidden: '' }, this.L('orderInvalid'));
    this.lockInput = el('input', { type: 'checkbox', id: 'r-lock' });
    this.lockInput.addEventListener('change', () => this.cb.onLock(this.lockInput.checked));
    this.encCount = el('span', { id: 'r-enc-count' });
    this.encList = el('ol', { class: 'r-enc', id: 'r-enc-list' });
    r.append(el('section', {},
      el('h3', {}, this.L('materialTitle')),
      el('div', { class: 'r-row' }, this.materialEl),
      this.statusEl,
      el('label', {}, this.L('switchTo')),
      el('div', { class: 'r-conds' }, ...this.condButtons),
      el('label', { for: 'r-order' }, this.L('order')),
      el('div', { class: 'r-seed' }, this.orderInput,
        el('button', { type: 'button', id: 'r-order-apply', onclick: () => {
          const o = parseOrder(this.orderInput.value);
          this.orderWarn.hidden = !!o;
          if (o) this.cb.onOrder(o);
        } }, this.L('applyOrder')),
        el('button', { type: 'button', id: 'r-order-shuffle', onclick: () => { this.orderWarn.hidden = true; this.cb.onShuffle(); } }, this.L('shuffleOrder'))),
      this.orderWarn,
      el('label', { class: 'r-check', for: 'r-lock' }, this.lockInput, el('span', {}, this.L('lockOrder'))),
      el('div', { class: 'r-row' }, el('span', {}, this.L('encounters')), this.encCount),
      this.encList,
      el('div', { class: 'r-actions' },
        el('button', { type: 'button', class: 'primary', id: 'r-export', onclick: () => this.cb.onExport() }, this.L('export')),
        el('button', { type: 'button', id: 'r-new-research', onclick: () => { if (confirm(this.L('newResearchConfirm'))) this.cb.onNewResearch(); } }, this.L('newResearch')))));

    // ---- per-material parameters (conditions that expose getParamSpec) ----
    this.matParamsEl = el('section', { id: 'r-material-params', hidden: '' });
    this.matParamsFor = null;
    r.append(this.matParamsEl);

    // ---- condition 01 only: presets, seed, physics, display ----
    this.structuralEl = el('div', { id: 'r-structural' });
    this.condEl = el('strong', { id: 'r-condition' });
    this.structuralEl.append(el('section', {},
      el('p', { class: 'r-note' }, this.L('structuralOnly')),
      el('div', { class: 'r-row' }, el('span', {}, this.L('condition')), this.condEl),
      el('div', { class: 'r-presets' },
        el('button', { type: 'button', onclick: () => this.cb.onPreset('A') }, this.L('presetA')),
        el('button', { type: 'button', onclick: () => this.cb.onPreset('B') }, this.L('presetB'))),
      el('p', { class: 'r-note' }, this.L('presetNote'))));

    this.seedInput = el('input', { type: 'number', min: '0', step: '1', id: 'r-seed' });
    this.structuralEl.append(el('section', {}, el('label', { for: 'r-seed' }, this.L('seed')),
      el('div', { class: 'r-seed' }, this.seedInput,
        el('button', { type: 'button', onclick: () => {
          const v = Math.floor(Number(this.seedInput.value));
          if (Number.isFinite(v) && v >= 0) this.cb.onSeed(v >>> 0);
        } }, this.L('applySeed')))));

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
    this.structuralEl.append(sliders);

    this.visualInputs = {};
    const vis = el('section', {}, el('h3', {}, this.L('visualTitle')));
    for (const s of VISUAL_SLIDERS) {
      const id = 'r-v-' + s.key;
      const out = el('output', { for: id });
      const input = el('input', { type: 'range', id, min: s.min, max: s.max, step: s.step });
      input.addEventListener('input', () => { out.textContent = input.value; this.cb.onVisual(s.key, Number(input.value), false); });
      input.addEventListener('change', () => this.cb.onVisual(s.key, Number(input.value), true));
      this.visualInputs[s.key] = { input, out };
      vis.append(el('div', { class: 'r-slider' }, el('label', { for: id }, el('span', {}, this.L('params.' + s.key)), out), input));
    }
    const low = el('input', { type: 'checkbox', id: 'r-v-lowDetail' });
    low.addEventListener('change', () => this.cb.onVisual('lowDetail', low.checked, true));
    this.visualInputs.lowDetail = { input: low };
    vis.append(el('label', { class: 'r-check', for: 'r-v-lowDetail' }, low, el('span', {}, this.L('lowDetail'))));
    this.structuralEl.append(vis);

    this.heat = el('canvas', { width: '360', height: '360', class: 'r-heat', 'aria-hidden': 'true' });
    this.heatTitle = el('h3', {}, this.L('heatmap'));
    r.append(this.structuralEl);

    // ---- live state (all conditions) ----
    this.placeholderNote = el('p', { class: 'r-note', id: 'r-placeholder-note' }, this.L('placeholderNote'));
    this.stateEl = el('div', { class: 'r-state' });
    this.statsEl = el('dl', { class: 'r-stats' });
    r.append(el('section', {}, el('h3', {}, this.L('state')), this.placeholderNote, this.stateEl, this.statsEl, this.heatTitle, this.heat));

    r.append(el('section', { class: 'r-actions' },
      el('button', { type: 'button', id: 'r-reset', onclick: () => this.cb.onReset() }, this.L('reset'))));
  }

  /** Re-render labels after a language change, keeping values. */
  relabel() {
    const wasOpen = this.open;
    this.matParamsFor = null;
    this.build();
    if (this.state) this.sync(this.state);
    this.root.hidden = !wasOpen;
  }

  /**
   * state: { def, sim|null, presetLabel, params, seed, visual, research }
   */
  sync(state) {
    this.state = state;
    const { def, sim, presetLabel, params, seed, visual, research } = state;
    const structural = !!sim;
    this.materialEl.textContent = `${def.id} — ${this.L('materialNames.' + def.key)}`;
    this.statusEl.textContent = this.L('status.' + def.status);
    for (const b of this.condButtons) b.setAttribute('aria-pressed', String(b.dataset.condition === def.id));
    if (document.activeElement !== this.orderInput) this.orderInput.value = research.order.join(', ');
    this.lockInput.checked = research.locked;
    const all = [...research.encounters, ...(research.current ? [{ ...research.current, endReason: '…' }] : [])];
    this.encCount.textContent = String(all.length);
    this.encList.replaceChildren(...all.map((e) => this.el('li', {}, `${e.conditionId} · ${e.startReason} → ${e.endReason}`)));

    this.structuralEl.hidden = !structural;
    this.heat.hidden = this.heatTitle.hidden = !structural;
    this.placeholderNote.hidden = def.status !== 'placeholder';
    this.buildMaterialParams(state.material);
    for (const [key, { input, out }] of Object.entries(this.inputs)) {
      if (input.type === 'checkbox') input.checked = !!params[key];
      else { input.value = params[key]; out.textContent = params[key]; }
    }
    this.seedInput.value = seed;
    this.condEl.textContent = presetLabel;
    for (const [key, { input, out }] of Object.entries(this.visualInputs)) {
      if (input.type === 'checkbox') input.checked = !!visual[key];
      else { input.value = visual[key]; out.textContent = visual[key]; }
    }
  }

  /** Sliders for the active material's own parameters (rebuilt only when the material instance changes). */
  buildMaterialParams(material) {
    if (material === this.matParamsFor) return;
    this.matParamsFor = material;
    const spec = material?.getParamSpec?.();
    this.matParamsEl.replaceChildren();
    this.matParamsEl.hidden = !spec;
    if (!spec) return;
    const el = this.el;
    this.matParamsEl.append(el('h3', {}, this.L('materialParams')));
    for (const s of spec) {
      const id = 'r-m-' + s.key;
      const out = el('output', { for: id }, String(s.value));
      const input = el('input', { type: 'range', id, min: s.min, max: s.max, step: s.step });
      input.value = s.value;
      input.addEventListener('input', () => { out.textContent = input.value; });
      input.addEventListener('change', () => this.cb.onMaterialParam(s.key, Number(input.value)));
      this.matParamsEl.append(el('div', { class: 'r-slider' }, el('label', { for: id }, el('span', {}, this.L('params.' + s.label)), out), input));
    }
  }

  update(material, fps, dtMs, eventCount, extra = {}) {
    if (!this.open || !material) return;
    this.sinceUpdate += dtMs;
    if (this.sinceUpdate < UPDATE_INTERVAL) return;
    this.sinceUpdate = 0;
    const rs = material.getResearchState();
    const tot = rs.totals || {};
    let rows;
    if (rs.state) {
      const st = rs.state;
      this.stateEl.textContent = st.primary + '  ·  ' + Object.entries(st.flags).filter(([, v]) => v).map(([k]) => k).join(' + ');
      rows = [
        ['elapsed', (rs.timeMs / 1000).toFixed(1) + 's'],
        ['contacts', tot.contactEpisodes],
        ['revisits', tot.revisits],
        ['adapted', rs.adaptedRegions + ' / ' + rs.regionCount],
        ['sweeps', tot.sweeps],
        ['dwells', tot.dwells],
        ['maxMemory', rs.maxMemory.toFixed(2)],
      ];
    } else {
      const gel = rs.gel, sil = rs.silicone, live = gel || sil;
      this.stateEl.textContent = rs.grabbing ? 'CONTACT' : live?.recovering ? 'RECOVERY' : rs.proximity > 0.05 ? 'APPROACH' : live && !live.settled ? 'SETTLING' : 'IDLE';
      rows = [
        ['elapsed', (rs.timeMs / 1000).toFixed(1) + 's'],
        ['contacts', tot.contactEpisodes],
        ['revisits', tot.revisits],
      ];
      if (gel) {
        rows.push(['peakDeformation', (tot.peakDeformation ?? 0).toFixed(3)]);
        rows.push(['redistribution', (tot.peakRedistribution ?? 0).toFixed(3)]);
        rows.push(['internalDisplacement', gel.maxU.toFixed(3)]);
        rows.push(['compression', gel.compression.toFixed(3)]);
        rows.push(['volumeChange', (gel.volumeChange * 100).toFixed(2) + '%']);
      }
      if (sil) {
        rows.push(['stretch', (tot.peakStretch ?? 0).toFixed(3)]);
        rows.push(['strain', sil.maxStrain.toFixed(3)]);
        rows.push(['peakDeformation', sil.maxDisp.toFixed(3)]);
      }
    }
    rows.push(['events', eventCount]);
    rows.push(['fps', Math.round(fps) + (rs.detail < 1 ? ' · ' + this.L('detailAuto') + ' ' + rs.detail : '')]);
    if (extra.audioPeak !== undefined) rows.push(['audioPeak', extra.audioPeak]);
    this.statsEl.replaceChildren(...rows.flatMap(([k, v]) => [this.el('dt', {}, k === 'audioPeak' ? this.L('audioPeak') : this.L('stats.' + k)), this.el('dd', {}, String(v))]));
    if (material.sim) this.drawHeat(material.sim);
  }

  drawHeat(sim) {
    const c = this.heat, ctx = c.getContext('2d'), W = c.width, cx = W / 2;
    const ink = getComputedStyle(this.root).color;
    ctx.clearRect(0, 0, W, W);
    const n = sim.n, step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      const a0 = i * step - step / 2, a1 = a0 + step;
      ctx.beginPath(); ctx.arc(cx, cx, W * 0.44, a0, a1); ctx.arc(cx, cx, W * 0.32, a1, a0, true); ctx.closePath();
      ctx.fillStyle = `rgba(199,233,255,${0.06 + sim.memory.level[i] * 0.9})`; ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cx, W * 0.3, a0, a1); ctx.arc(cx, cx, W * 0.2, a1, a0, true); ctx.closePath();
      ctx.fillStyle = `rgba(117,189,232,${0.06 + sim.adapt.level[i] * 0.9})`; ctx.fill();
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
