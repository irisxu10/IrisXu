// Builds the session JSON (pure) and triggers a download (DOM).

import { APP_VERSION } from '../config.js';

export function buildPayload(sim, logger, { condition, exportedAt = new Date().toISOString() } = {}) {
  const t = sim.totals;
  const events = [...logger.events, {
    timestampMs: Math.round(sim.timeMs),
    type: 'session_end',
    metadata: { exported: true },
  }];
  return {
    schema: 'one-object-many-encounters/session',
    schemaVersion: 1,
    appVersion: APP_VERSION,
    sessionId: logger.sessionId,
    startedAt: logger.startedAt,
    exportedAt,
    durationMs: Math.round(sim.timeMs),
    clock: 'simulation milliseconds since session start (pauses while the tab is hidden)',
    condition,
    seed: sim.seed,
    parameters: { ...sim.params },
    summary: {
      totalContactMs: Math.round(t.contactMs),
      totalInteractionMs: Math.round(t.interactionMs),
      contactEpisodes: t.contactEpisodes,
      dragDistance: Math.round(t.dragDistance * 1000) / 1000,
      regionRevisits: t.revisits,
      adaptationEvents: t.adaptationEvents,
      regionRecoveries: t.regionReleases,
      stillnessPeriods: t.stillnessPeriods,
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

export function downloadJSON(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `encounter-v3-${payload.condition}-${payload.sessionId.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
