// In-memory structured event log. Nothing is persisted or transmitted.
// Timestamps are milliseconds on the simulation clock since session start
// (the clock pauses while the tab is hidden).
//
// InteractionEvent = {
//   timestampMs, type, region?, durationMs?, distance?, speed?, memoryLevel?, metadata?
// }

import { randomId } from '../util/math.js';

export const EVENT_TYPES = Object.freeze([
  'session_start', 'approach', 'contact_start', 'contact_end', 'drag',
  'region_revisit', 'adaptation_threshold', 'recovery', 'parameter_change',
  'reflection', 'session_end',
  // V4
  'sweep', 'sound_toggle', 'dwell',
  // V5
  'reset', 'fold',
]);

const round = (v, d = 3) => (typeof v === 'number' ? Math.round(v * 10 ** d) / 10 ** d : v);

export class SessionLogger {
  constructor({ maxEvents = 5000, idFactory = randomId, now = () => new Date() } = {}) {
    this.maxEvents = maxEvents;
    this.idFactory = idFactory;
    this.now = now;
    this.events = [];
    this.dropped = 0;
    this.reflection = null;
    this.sessionId = null;
    this.startedAt = null;
    this.meta = {};
  }

  start(meta) {
    this.events = [];
    this.dropped = 0;
    this.reflection = null;
    this.sessionId = this.idFactory();
    this.startedAt = this.now().toISOString();
    this.meta = { ...meta };
    this.log('session_start', 0, { metadata: { ...meta } });
  }

  log(type, timestampMs, fields = {}) {
    if (!EVENT_TYPES.includes(type)) throw new Error('Unknown event type: ' + type);
    if (this.events.length >= this.maxEvents) { this.dropped++; return null; }
    const ev = { timestampMs: Math.round(timestampMs), type };
    for (const k of ['region', 'durationMs', 'distance', 'speed', 'memoryLevel']) {
      if (fields[k] !== undefined && fields[k] !== null) ev[k] = k === 'durationMs' || k === 'region' ? Math.round(fields[k]) : round(fields[k]);
    }
    if (fields.metadata) ev.metadata = fields.metadata;
    this.events.push(ev);
    return ev;
  }

  count(type) { let c = 0; for (const e of this.events) if (e.type === type) c++; return c; }

  setReflection(answers, timestampMs) {
    this.reflection = answers;
    const answered = answers ? Object.values(answers).filter((v) => v && String(v).trim()).length : 0;
    this.log('reflection', timestampMs, { metadata: { skipped: !answers, answered } });
  }
}
