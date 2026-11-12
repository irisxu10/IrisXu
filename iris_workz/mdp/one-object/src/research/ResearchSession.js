// A research session holds every encounter in order. Switching material,
// resetting, applying a preset or changing the seed ENDS the current
// encounter (its record is frozen and kept) and begins a new one — nothing is
// silently overwritten. Pure: no DOM.

import { APP_VERSION } from '../config.js';
import { randomId } from '../util/math.js';

export const DEFAULT_ORDER = Object.freeze(['01', '02', '03', '04']);

/** Is `order` a permutation of DEFAULT_ORDER? */
export function isValidOrder(order) {
  return Array.isArray(order) && order.length === DEFAULT_ORDER.length
    && [...order].sort().join() === [...DEFAULT_ORDER].sort().join();
}

/** Parse "03, 01 4 2" style input into ['03','01','04','02'] (or null if invalid). */
export function parseOrder(text) {
  const ids = String(text).split(/[^0-9]+/).filter(Boolean).map((s) => s.padStart(2, '0'));
  return isValidOrder(ids) ? ids : null;
}

export class ResearchSession {
  constructor({ idFactory = randomId, now = () => new Date(), rng = Math.random } = {}) {
    this.idFactory = idFactory;
    this.now = now;
    this.rng = rng;
    this.start();
  }

  start() {
    this.id = this.idFactory();
    this.startedAt = this.now().toISOString();
    this.order = [...DEFAULT_ORDER];
    this.locked = false;
    this.encounters = [];        // closed encounters: { ...meta, endedAt, endReason, payload }
    this.current = null;         // open encounter meta
    this.seq = 0;
    this.orderLog = [];          // { at, order, locked, by }
    this.timeline = [];          // session-level events: { at, tMs, type, ...fields } (switches, resets, notes, export…)
    this.notes = [];             // researcher notes: { at, tMs, encounterIndex, conditionId, text } — no identifying details
    this.reflection = null;      // optional participant reflection (after the experience): { at, answers, skipped }
    this.t0 = this.now().getTime();
    this.mark('session_start');
  }

  /** Record a session-level event (timestamped: ISO + ms since the session started). */
  mark(type, fields = {}) {
    const d = this.now();
    const e = { at: d.toISOString(), tMs: d.getTime() - this.t0, type, ...fields };
    this.timeline.push(e);
    return e;
  }

  /** Researcher note about this (anonymous) participant session. Empty notes are ignored. */
  addNote(text) {
    const t = String(text ?? '').trim().slice(0, 2000);
    if (!t) return null;
    const d = this.now();
    const n = { at: d.toISOString(), tMs: d.getTime() - this.t0, encounterIndex: this.current?.encounterIndex ?? null, conditionId: this.current?.conditionId ?? null, text: t };
    this.notes.push(n);
    this.mark('note', { encounterIndex: n.encounterIndex, conditionId: n.conditionId });
    return n;
  }

  /** Optional participant reflection (answers keyed q1…q5, or null when skipped). */
  setReflection(answers, questions = null) {
    const d = this.now();
    const answered = answers ? Object.values(answers).filter((v) => v && String(v).trim()).length : 0;
    this.reflection = { at: d.toISOString(), tMs: d.getTime() - this.t0, skipped: !answers, answered, questions, answers: answers || null };
    this.mark('reflection', { skipped: !answers, answered });
  }

  setOrder(order, by = 'researcher') {
    if (!isValidOrder(order)) return false;
    this.order = [...order];
    this.orderLog.push({ at: this.now().toISOString(), order: [...this.order], locked: this.locked, by });
    this.mark('order_change', { order: [...this.order], by });
    return true;
  }

  shuffleOrder() {
    const o = [...DEFAULT_ORDER];
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    this.setOrder(o, 'shuffle');
    return o;
  }

  setLocked(on) {
    this.locked = !!on;
    this.orderLog.push({ at: this.now().toISOString(), order: [...this.order], locked: this.locked, by: 'researcher' });
    this.mark('order_lock', { locked: this.locked });
  }

  /** Conditions the PARTICIPANT may select now. Unlocked: all. Locked: current + the next one in order. */
  allowedConditions() {
    if (!this.locked) return new Set(DEFAULT_ORDER);
    const cur = this.current?.conditionId;
    const i = cur ? this.order.indexOf(cur) : -1;
    const allowed = new Set();
    if (cur) allowed.add(cur);
    if (i + 1 < this.order.length) allowed.add(this.order[i + 1]);
    return allowed;
  }

  /** First condition for a new session: the first in the configured order. */
  firstCondition() { return this.order[0]; }

  beginEncounter({ conditionId, materialKey, materialName, startReason, preset }) {
    const prev = this.encounters.at(-1) || null;
    this.current = {
      encounterIndex: this.seq++,
      conditionId,
      materialKey,
      materialName,
      orderPosition: this.order.indexOf(conditionId) + 1,
      conditionOrder: [...this.order],
      orderLocked: this.locked,
      startReason,
      previousConditionId: prev?.conditionId ?? null,
      preset,
      startedAt: this.now().toISOString(),
    };
    const sw = /switch/.test(startReason) ? 'condition_switch' : /reset/.test(startReason) ? 'reset' : 'encounter_start';
    this.mark(sw, { encounterIndex: this.current.encounterIndex, conditionId, from: this.current.previousConditionId, reason: startReason });
    return this.current;
  }

  /** Close the open encounter, freezing its payload. */
  endEncounter(payload, endReason) {
    if (!this.current) return null;
    const rec = { ...this.current, endedAt: this.now().toISOString(), endReason, payload };
    this.encounters.push(rec);
    this.current = null;
    return rec;
  }

  /** Export every encounter, including a snapshot of the open one (which stays open). */
  buildExport(openPayload = null, exportedAt = this.now().toISOString(), { parameterSettings = null, materials = null } = {}) {
    const encounters = this.encounters.map((e) => ({ ...e }));
    if (this.current) encounters.push({ ...this.current, endedAt: null, endReason: 'open_at_export', payload: openPayload });
    return {
      schema: 'one-object-many-encounters/research-session',
      schemaVersion: 4,
      appVersion: APP_VERSION,
      researchSessionId: this.id,
      participant: { anonymousSessionId: this.id, identifyingData: 'none collected' },
      startedAt: this.startedAt,
      exportedAt,
      conditionOrder: [...this.order],
      orderLocked: this.locked,
      orderLog: this.orderLog.map((o) => ({ ...o })),
      encounterCount: encounters.length,
      conditionSequence: encounters.map((e) => e.conditionId),
      materials,
      parameterSettings,
      timeline: this.timeline.map((e) => ({ ...e })),
      notes: this.notes.map((n) => ({ ...n })),
      reflection: this.reflection ? { ...this.reflection } : null,
      encounters,
      privacy: 'Recorded only in this browser tab; nothing is sent anywhere. Anonymous random session id; no names, emails, IP addresses or device identifiers.',
      methodNote: 'Each encounter is a schema-v2 session with its own event log (timestamps on that encounter\'s clock). The session timeline uses wall-clock time since the session started. Condition names are researcher-facing only; participants saw 01–04. Logged values describe pointer behaviour and simulated material state; they do not measure or infer emotion, expectation or interpretation.',
    };
  }
}
