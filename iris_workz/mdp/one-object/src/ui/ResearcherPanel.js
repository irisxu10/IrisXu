// Researcher Mode: hidden during ordinary encounters. Builds its own DOM.
// Material names appear ONLY here (participants see 01–04).
//
// Four sections (collapsible):
//   1 Material properties   the active condition's material parameters
//                           (+ condition 01 physics and display settings)
//   2 Behaviour & memory    the active condition's behaviour parameters
//                           (+ condition 01 presets, memory / adaptation), live state
//   3 Encounter conditions  switch, order (apply / shuffle / lock), seed, reset
//                           the active condition, encounters so far
//   4 Research data         anonymous session id, participant notes, interaction
//                           log, session timeline, reflection status, export,
//                           new participant session

import { RESEARCH_SLIDERS, RESEARCH_TOGGLES, VISUAL_SLIDERS } from '../config.js';
import { MATERIALS } from '../materials/registry.js';
import { parseOrder } from '../research/ResearchSession.js';
import { t } from './translations.js';

const UPDATE_INTERVAL = 200;   // ms
const LOG_ROWS = 80, TIMELINE_ROWS = 40;

/** Compact one-line description of a logged event (researcher view only). */
function describeEvent(e) {
  const parts = [];
  if (e.region !== undefined) parts.push('r' + e.region);
  if (e.durationMs !== undefined) parts.push(e.durationMs + 'ms');
  if (e.distance !== undefined) parts.push('d ' + e.distance);
  const m = e.metadata || {};
  for (const k of ['by', 'kind', 'mode', 'outcome', 'param', 'from', 'to', 'peakFoldAngle', 'residualAngle', 'stretchDistance', 'peakDeformation', 'overshoots', 'enabled', 'answered']) {
    if (m[k] !== undefined && m[k] !== null && typeof m[k] !== 'object') parts.push(`${k} ${m[k]}`);
  }
  return parts.join(' · ');
}

export class ResearcherPanel {
  /**
   * cb: { getLang, onParam, onVisual, onPreset, onSeed, onReset, onExport, onMaterialParam,
   *       onSwitch(id), onOrder(order), onShuffle(), onLock(bool), onNewResearch(), onNote(text) }
   */
  constructor(root, cb) {
    this.root = root;
    this.cb = cb;
    this.sinceUpdate = UPDATE_INTERVAL;
    this.state = null;
    this.openSections = { material: true, behaviour: true, encounter: true, data: true };
    this.build();
  }

  get open() { return !this.root.hidden; }

  toggle() { if (this.open) this.close(); else this.show(); }
  show() { this.root.hidden = false; this.sinceUpdate = UPDATE_INTERVAL; this.root.querySelector('button')?.focus(); if (this.state) this.sync(this.state); }
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
    const section = (key, id) => {
      const d = el('details', { class: 'r-sec', id });
      d.open = this.openSections[key];
      d.addEventListener('toggle', () => { this.openSections[key] = d.open; });
      d.append(el('summary', {}, this.L('sec' + key[0].toUpperCase() + key.slice(1))));
      return d;
    };
    const slider = (id, label, s, onInput, onChange) => {
      const out = el('output', { for: id });
      const input = el('input', { type: 'range', id, min: s.min, max: s.max, step: s.step });
      input.addEventListener('input', () => { out.textContent = input.value; onInput?.(Number(input.value)); });
      input.addEventListener('change', () => onChange(Number(input.value)));
      return { input, out, row: el('div', { class: 'r-slider' }, el('label', { for: id }, el('span', {}, label), out), input) };
    };

    r.append(el('div', { class: 'r-head' },
      el('h2', { id: 'r-title' }, this.L('title')),
      el('button', { type: 'button', onclick: () => this.close(), 'aria-label': this.L('close') }, '×')));

    // ---- always visible: which condition is active ----
    this.materialEl = el('strong', { id: 'r-material' });
    this.statusEl = el('span', { class: 'r-note', id: 'r-status' });
    this.stateBadge = el('span', { class: 'r-badge', id: 'r-state-badge' });
    r.append(el('div', { class: 'r-current' }, this.materialEl, el('div', { class: 'r-row' }, this.statusEl, this.stateBadge)));

    // =========== 1 Material properties ===========
    const s1 = section('material', 'r-sec-material');
    this.matParams = { material: el('div', { id: 'r-material-params' }), behaviour: el('div', { id: 'r-behaviour-params' }) };
    this.matParamsFor = null;
    s1.append(this.matParams.material);
    this.inputs = {};
    this.structMaterial = el('div', { class: 'r-struct' }, el('p', { class: 'r-note' }, this.L('structuralOnly')));
    this.structBehaviour = el('div', { class: 'r-struct' });
    for (const s of RESEARCH_SLIDERS) {
      const sl = slider('r-' + s.key, this.L('params.' + s.key), s, null, (v) => this.cb.onParam(s.key, v));
      this.inputs[s.key] = sl;
      (s.group === 'behaviour' ? this.structBehaviour : this.structMaterial).append(sl.row);
    }
    this.visualInputs = {};
    const vis = el('div', { class: 'r-sub' }, el('h4', {}, this.L('visualTitle')));
    for (const s of VISUAL_SLIDERS) {
      const sl = slider('r-v-' + s.key, this.L('params.' + s.key), s, (v) => this.cb.onVisual(s.key, v, false), (v) => this.cb.onVisual(s.key, v, true));
      this.visualInputs[s.key] = sl; vis.append(sl.row);
    }
    const low = el('input', { type: 'checkbox', id: 'r-v-lowDetail' });
    low.addEventListener('change', () => this.cb.onVisual('lowDetail', low.checked, true));
    this.visualInputs.lowDetail = { input: low };
    vis.append(el('label', { class: 'r-check', for: 'r-v-lowDetail' }, low, el('span', {}, this.L('lowDetail'))));
    this.structMaterial.append(vis);
    s1.append(this.structMaterial);
    r.append(s1);

    // =========== 2 Behaviour & memory ===========
    const s2 = section('behaviour', 'r-sec-behaviour');
    s2.append(this.matParams.behaviour);
    this.condEl = el('strong', { id: 'r-condition' });
    this.structPresets = el('div', { class: 'r-struct' },
      el('div', { class: 'r-row' }, el('span', {}, this.L('condition')), this.condEl),
      el('div', { class: 'r-presets' },
        el('button', { type: 'button', onclick: () => this.cb.onPreset('A') }, this.L('presetA')),
        el('button', { type: 'button', onclick: () => this.cb.onPreset('B') }, this.L('presetB'))),
      el('p', { class: 'r-note' }, this.L('presetNote')));
    for (const key of RESEARCH_TOGGLES) {
      const input = el('input', { type: 'checkbox', id: 'r-' + key });
      input.addEventListener('change', () => this.cb.onParam(key, input.checked));
      this.inputs[key] = { input };
      this.structBehaviour.append(el('label', { class: 'r-check', for: 'r-' + key }, input, el('span', {}, this.L('params.' + key))));
    }
    s2.append(this.structPresets, this.structBehaviour);
    this.placeholderNote = el('p', { class: 'r-note', id: 'r-placeholder-note' }, this.L('placeholderNote'));
    this.stateEl = el('div', { class: 'r-state' });
    this.statsEl = el('dl', { class: 'r-stats' });
    this.heat = el('canvas', { width: '360', height: '360', class: 'r-heat', 'aria-hidden': 'true' });
    this.heatTitle = el('h4', {}, this.L('heatmap'));
    s2.append(el('div', { class: 'r-sub' }, el('h4', {}, this.L('liveState')), this.placeholderNote, this.stateEl, this.statsEl, this.heatTitle, this.heat));
    r.append(s2);

    // =========== 3 Encounter conditions ===========
    const s3 = section('encounter', 'r-sec-encounter');
    this.condButtons = MATERIALS.map((m) => el('button', { type: 'button', 'data-condition': m.id, 'aria-pressed': 'false', title: this.L('materialNames.' + m.key), onclick: () => this.cb.onSwitch(m.id) }, m.id));
    this.orderInput = el('input', { type: 'text', id: 'r-order', inputmode: 'numeric', autocomplete: 'off' });
    this.orderWarn = el('p', { class: 'r-warn', hidden: '' }, this.L('orderInvalid'));
    this.lockInput = el('input', { type: 'checkbox', id: 'r-lock' });
    this.lockInput.addEventListener('change', () => this.cb.onLock(this.lockInput.checked));
    this.seedInput = el('input', { type: 'number', min: '0', step: '1', id: 'r-seed' });
    this.encCount = el('span', { id: 'r-enc-count' });
    this.encList = el('ol', { class: 'r-enc', id: 'r-enc-list' });
    s3.append(
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
      el('label', { for: 'r-seed' }, this.L('seed')),
      el('div', { class: 'r-seed' }, this.seedInput,
        el('button', { type: 'button', id: 'r-seed-apply', onclick: () => {
          const v = Math.floor(Number(this.seedInput.value));
          if (Number.isFinite(v) && v >= 0) this.cb.onSeed(v >>> 0);
        } }, this.L('applySeed'))),
      el('div', { class: 'r-actions' }, el('button', { type: 'button', id: 'r-reset', onclick: () => this.cb.onReset() }, this.L('resetCondition'))),
      el('p', { class: 'r-note' }, this.L('resetNote')),
      el('div', { class: 'r-row' }, el('span', {}, this.L('encounters')), this.encCount),
      this.encList);
    r.append(s3);

    // =========== 4 Research data ===========
    const s4 = section('data', 'r-sec-data');
    this.sessionIdEl = el('code', { id: 'r-session-id' });
    this.sessionStartEl = el('span', { id: 'r-session-start' });
    this.reflectionEl = el('span', { id: 'r-reflection' });
    this.noteInput = el('textarea', { id: 'r-note', rows: '2', maxlength: '2000' });
    this.noteList = el('ul', { class: 'r-notes', id: 'r-note-list' });
    this.logList = el('ol', { class: 'r-log', id: 'r-log' });
    this.timelineList = el('ol', { class: 'r-log', id: 'r-timeline' });
    s4.append(
      el('div', { class: 'r-row' }, el('span', {}, this.L('sessionId')), this.sessionIdEl),
      el('div', { class: 'r-row' }, el('span', {}, this.L('sessionStarted')), this.sessionStartEl),
      el('div', { class: 'r-row' }, el('span', {}, this.L('reflection')), this.reflectionEl),
      el('label', { for: 'r-note' }, this.L('notes')),
      el('p', { class: 'r-note' }, this.L('notesHint')),
      this.noteInput,
      el('div', { class: 'r-actions' }, el('button', { type: 'button', id: 'r-note-add', onclick: () => {
        const v = this.noteInput.value;
        if (v.trim()) { this.cb.onNote?.(v); this.noteInput.value = ''; }
      } }, this.L('addNote'))),
      this.noteList,
      el('h4', {}, this.L('log')), this.logList,
      el('h4', {}, this.L('timeline')), this.timelineList,
      el('div', { class: 'r-actions' },
        el('button', { type: 'button', class: 'primary', id: 'r-export', onclick: () => this.cb.onExport() }, this.L('export')),
        el('button', { type: 'button', id: 'r-new-research', onclick: () => { if (confirm(this.L('newResearchConfirm'))) this.cb.onNewResearch(); } }, this.L('newResearch'))),
      el('p', { class: 'r-note' }, this.L('exportNote')));
    r.append(s4);
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
   * state: { def, material, sim|null, presetLabel, params, seed, visual, research }
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

    for (const n of [this.structMaterial, this.structBehaviour, this.structPresets]) n.hidden = !structural;
    this.heat.hidden = this.heatTitle.hidden = !structural;
    this.placeholderNote.hidden = def.status !== 'placeholder';
    this.buildMaterialParams(state.material, structural);
    for (const [key, { input, out }] of Object.entries(this.inputs)) {
      if (input.type === 'checkbox') input.checked = !!params[key];
      else { input.value = params[key]; out.textContent = params[key]; }
    }
    if (document.activeElement !== this.seedInput) this.seedInput.value = seed;
    this.condEl.textContent = presetLabel;
    for (const [key, { input, out }] of Object.entries(this.visualInputs)) {
      if (input.type === 'checkbox') input.checked = !!visual[key];
      else { input.value = visual[key]; out.textContent = visual[key]; }
    }
    // research data
    this.sessionIdEl.textContent = research.id;
    this.sessionStartEl.textContent = research.startedAt.replace('T', ' ').slice(0, 19);
    const rf = research.reflection;
    this.reflectionEl.textContent = !rf ? this.L('reflectionNone') : rf.skipped ? this.L('reflectionSkipped') : `${this.L('reflectionAnswered')} ${rf.answered}/5`;
    this.noteList.replaceChildren(...(research.notes.length
      ? research.notes.map((n) => this.el('li', {}, this.el('span', { class: 'r-meta' }, `${(n.tMs / 1000).toFixed(0)}s · ${n.conditionId ?? '—'}`), ' ', n.text))
      : [this.el('li', { class: 'r-note' }, this.L('noNotes'))]));
    this.renderTimeline(research);
  }

  renderTimeline(research) {
    const rows = research.timeline.slice(-TIMELINE_ROWS).reverse();
    this.timelineList.replaceChildren(...rows.map((e) => {
      const extra = [e.conditionId, e.from && !e.param ? 'from ' + e.from : '', e.reason, e.order?.join?.(','), e.locked !== undefined ? 'locked ' + e.locked : '', e.enabled !== undefined ? 'on ' + e.enabled : '', e.lang, e.param ? `${e.param} ${e.from} → ${e.to}` : ''].filter(Boolean).join(' · ');
      return this.el('li', {}, this.el('span', { class: 'r-meta' }, (e.tMs / 1000).toFixed(1) + 's'), ' ', this.el('b', {}, e.type), extra ? ' ' + extra : '');
    }));
  }

  /** Sliders for the active material's own parameters, split into the two groups (rebuilt only when the material instance changes). */
  buildMaterialParams(material, structural) {
    if (material === this.matParamsFor) return;
    this.matParamsFor = material;
    const spec = material?.getParamSpec?.() || [];
    const el = this.el;
    for (const group of ['material', 'behaviour']) {
      const box = this.matParams[group];
      box.replaceChildren();
      const items = spec.filter((s) => (s.group || 'material') === group);
      if (!items.length) { if (!structural) box.append(el('p', { class: 'r-note' }, this.L('noParams'))); continue; }
      for (const s of items) {
        const id = 'r-m-' + s.key;
        const out = el('output', { for: id }, String(s.value));
        const input = el('input', { type: 'range', id, min: s.min, max: s.max, step: s.step });
        input.value = s.value;
        input.addEventListener('input', () => { out.textContent = input.value; });
        input.addEventListener('change', () => this.cb.onMaterialParam(s.key, Number(input.value)));
        box.append(el('div', { class: 'r-slider' }, el('label', { for: id }, el('span', {}, this.L('params.' + s.label)), out), input));
      }
    }
  }

  update(material, fps, dtMs, logger, extra = {}) {
    if (!this.open || !material) return;
    this.sinceUpdate += dtMs;
    if (this.sinceUpdate < UPDATE_INTERVAL) return;
    this.sinceUpdate = 0;
    const rs = material.getResearchState();
    const tot = rs.totals || {};
    let rows, state;
    if (rs.state) {
      const st = rs.state;
      state = st.primary;
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
      const gel = rs.gel, sil = rs.silicone, pla = rs.plastic, live = gel || sil || pla;
      state = rs.grabbing ? (pla ? pla.phase.toUpperCase() : 'CONTACT') : live?.recovering ? 'RECOVERY' : rs.proximity > 0.05 ? 'APPROACH' : live && !live.settled ? 'SETTLING' : 'IDLE';
      this.stateEl.textContent = state;
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
      if (pla) {
        rows.push(['folds', tot.folds]);
        rows.push(['creases', pla.creases]);
        rows.push(['foldAngle', pla.foldAngle.toFixed(0) + '°']);
        rows.push(['tilt', pla.meanTilt.toFixed(1) + '°']);
        rows.push(['projectedArea', pla.projectedArea.toFixed(3)]);
      }
    }
    this.stateBadge.textContent = state;
    rows.push(['events', logger?.events.length ?? 0]);
    rows.push(['fps', Math.round(fps) + (rs.detail < 1 ? ' · ' + this.L('detailAuto') + ' ' + rs.detail : '')]);
    if (extra.audioPeak !== undefined) rows.push(['audioPeak', extra.audioPeak]);
    this.statsEl.replaceChildren(...rows.flatMap(([k, v]) => [this.el('dt', {}, k === 'audioPeak' ? this.L('audioPeak') : this.L('stats.' + k)), this.el('dd', {}, String(v))]));
    if (material.sim && !this.heat.hidden) this.drawHeat(material.sim);
    // interaction log (only while the data section is open)
    if (this.openSections.data && logger) {
      const n = logger.events.length;
      if (n !== this.logCount) {
        this.logCount = n;
        const evs = logger.events.slice(-LOG_ROWS).reverse();
        this.logList.replaceChildren(...evs.map((e) => this.el('li', {}, this.el('span', { class: 'r-meta' }, (e.timestampMs / 1000).toFixed(2) + 's'), ' ', this.el('b', {}, e.type), ' ', describeEvent(e))));
      }
    }
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
