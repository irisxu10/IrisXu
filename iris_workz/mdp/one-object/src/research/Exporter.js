// Builds the session JSON (pure) and triggers a download (DOM).

import { APP_VERSION } from '../config.js';

export function buildPayload(sim, logger, { condition, visual = null, endReason = 'export', exportedAt = new Date().toISOString() } = {}) {
  const t = sim.totals;
  const events = [...logger.events, {
    timestampMs: Math.round(sim.timeMs),
    type: 'session_end',
    metadata: { exported: true, reason: endReason },
  }];
  return {
    schema: 'one-object-many-encounters/session',
    schemaVersion: 2,
    appVersion: APP_VERSION,
    sessionId: logger.sessionId,
    startedAt: logger.startedAt,
    exportedAt,
    durationMs: Math.round(sim.timeMs),
    clock: 'simulation milliseconds since session start (pauses while the tab is hidden)',
    condition,
    seed: sim.seed,
    parameters: { ...sim.params },
    visualParameters: visual ? { ...visual } : null,
    summary: {
      totalContactMs: Math.round(t.contactMs),
      totalInteractionMs: Math.round(t.interactionMs),
      contactEpisodes: t.contactEpisodes,
      dragDistance: Math.round(t.dragDistance * 1000) / 1000,
      regionRevisits: t.revisits,
      adaptationEvents: t.adaptationEvents,
      regionRecoveries: t.regionReleases,
      stillnessPeriods: t.stillnessPeriods,
      sweeps: t.sweeps,
      totalSweepMs: Math.round(t.sweepMs),
      dwells: t.dwells,
      totalDwellMs: Math.round(t.dwellMs),
      soundToggles: logger.count('sound_toggle'),
      parameterChanges: logger.count('parameter_change'),
      finalMeanMemory: Math.round(sim.memory.mean() * 1000) / 1000,
      droppedEvents: logger.dropped,
    },
    units: {
      distance: 'object units (base radius = 1)',
      speed: 'object units per second',
      coordinates: 'object units relative to the object centre',
      region: '12 perimeter regions; region r is centred at r × 30°, 0° = right, clockwise on screen',
    },
    events,
    reflection: logger.reflection,
    methodNote: 'Programmed generative simulation. Logged values describe observed pointer behaviour and system state; they do not establish participant expectation, interpretation, or object agency.',
  };
}

/**
 * Encounter payload for materials without the full simulation (placeholders).
 * Same schema and field meanings as buildPayload; behaviour-specific totals are absent.
 */
export function buildBasicPayload(tracker, logger, { condition, seed, materialKey, endReason = 'export', exportedAt = new Date().toISOString() } = {}) {
  const t = tracker.totals;
  return {
    schema: 'one-object-many-encounters/session',
    schemaVersion: 2,
    appVersion: APP_VERSION,
    sessionId: logger.sessionId,
    startedAt: logger.startedAt,
    exportedAt,
    durationMs: Math.round(tracker.timeMs),
    clock: 'material clock: milliseconds since encounter start (pauses while the tab is hidden)',
    condition,
    seed,
    materialKey,
    materialStatus: 'placeholder (static texture, no material physics yet)',
    parameters: null,
    visualParameters: null,
    summary: {
      totalContactMs: Math.round(t.contactMs),
      totalInteractionMs: Math.round(t.interactionMs),
      contactEpisodes: t.contactEpisodes,
      dragDistance: Math.round(t.dragDistance * 1000) / 1000,
      regionRevisits: t.revisits,
      stillnessPeriods: t.stillnessPeriods,
      soundToggles: logger.count('sound_toggle'),
      parameterChanges: logger.count('parameter_change'),
      droppedEvents: logger.dropped,
    },
    units: {
      distance: 'object units (base radius = 1)',
      speed: 'object units per second',
      coordinates: 'object units relative to the object centre',
      region: '12 perimeter regions; region r is centred at r × 30°, 0° = right, clockwise on screen',
    },
    events: [...logger.events, { timestampMs: Math.round(tracker.timeMs), type: 'session_end', metadata: { exported: true, reason: endReason } }],
    reflection: logger.reflection,
    methodNote: 'Placeholder condition: the form does not deform. Logged values describe observed pointer behaviour only.',
  };
}

export function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || `encounter-${payload.condition}-${String(payload.sessionId).slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
