// Central configuration. All spatial values are in "object units":
// the object's base radius is 1.0 and its centre is the origin.
// All per-step forces assume the fixed physics step below.

export const APP_VERSION = '3.0.0';
export const STEP = 1 / 60;          // fixed physics timestep (s)
export const MAX_SUBSTEPS = 5;       // cap on catch-up steps per frame
export const NODE_COUNT = 80;        // perimeter nodes
export const REGION_COUNT = 12;      // perimeter regions used for logging
export const DEFAULT_SEED = 20261105;

export const DEFAULT_PARAMS = Object.freeze({
  // --- material response ---
  responsiveness: 1.0,      // global gain on all external forces
  stiffness: 0.014,         // per-step spring toward rest shape
  damping: 0.95,             // per-step velocity retention
  tension: 0.22,            // neighbour coupling (spreads deformation)
  volume: 0.015,            // area preservation (press here, bulge there)
  maxDisplacement: 0.36,    // fraction of base radius
  contactRadius: 0.36,      // gaussian width of contact (≈18% of diameter)
  contactMargin: 0.3,       // how far outside the edge a press still grabs
  grip: 0.18,               // per-step pull toward the dragged target
  pressDepth: 0.05,         // small dent held under a press
  flingGain: 0.05,          // extra displacement from pointer speed (s)

  // --- proximity field ---
  proximityRadius: 0.8,     // influence distance beyond the edge
  proximityPush: 0.0012,
  proximitySpeedGain: 0.0012,
  proximityWake: 0.06,

  // --- behavioural memory ---
  memoryEnabled: true,
  learningRate: 0.35,       // memory gained per second of full contact
  decayRate: 0.05,          // exponential decay per second
  plasticity: 0.3,          // residual deformation retained by memory

  // --- adaptation ---
  adaptiveEnabled: true,
  adaptationStrength: 0.72, // how much sensitivity drops when adapted
  adaptationThreshold: 0.65,
  adaptationHysteresis: 0.2,
  adaptationTau: 1.2,       // seconds to ease into / out of adaptation
  adaptStiffen: 1.5,        // adapted regions become stiffer…
  adaptWiden: 0.8,          // …and spread contact over a wider area

  // --- ambient ---
  ambientAmplitude: 0.008,
});

export const PRESETS = Object.freeze({
  A: Object.freeze({ id: 'A_stable', memoryEnabled: false, adaptiveEnabled: false }),
  B: Object.freeze({ id: 'B_adaptive', memoryEnabled: true, adaptiveEnabled: true }),
});

// Parameters exposed as sliders in Researcher Mode.
export const RESEARCH_SLIDERS = Object.freeze([
  { key: 'responsiveness', min: 0, max: 2, step: 0.01 },
  { key: 'stiffness', min: 0.004, max: 0.12, step: 0.001 },
  { key: 'damping', min: 0.85, max: 0.99, step: 0.001 },
  { key: 'learningRate', min: 0, max: 1, step: 0.01 },
  { key: 'decayRate', min: 0, max: 0.3, step: 0.005 },
  { key: 'adaptationStrength', min: 0, max: 0.95, step: 0.01 },
  { key: 'adaptationThreshold', min: 0.2, max: 0.95, step: 0.01 },
]);
export const RESEARCH_TOGGLES = Object.freeze(['memoryEnabled', 'adaptiveEnabled']);
