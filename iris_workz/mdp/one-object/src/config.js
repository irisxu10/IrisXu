// Central configuration. All spatial values are in "object units":
// the object's base radius is 1.0 and its centre is the origin.
// All per-step forces assume the fixed physics step below.

export const APP_VERSION = '5.0.0-beta.1';
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
  pressDepth: 0.07,         // dent held under a press (compression)
  flingGain: 0.05,          // extra displacement from pointer speed (s)

  // --- proximity field ---
  proximityRadius: 0.8,     // influence distance beyond the edge
  proximityPush: 0.0012,
  proximitySpeedGain: 0.0006,
  proximityWake: 0.035,

  // --- brush / sweep (fast movement across the surface without pressing) ---
  sweepSpeed: 1.4,          // object units / s needed to count as a sweep
  sweepGain: 0.035,          // tangential drag along the surface
  sweepDent: 0.004,         // brief inward deflection under the sweep
  sweepMemory: 0.2,         // sweeps build memory more weakly than contact

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

  // --- SYSTEM 1 · immediate response (temporary; never writes to memory) ---
  interactionRadius: 0.45,  // radius of the local line response around the pointer (object units)
  proximityResponse: 0.025, // how far nearby lines ease away from a hovering pointer
  proximityGlow: 0.12,      // brightness lift of nearby lines while hovering
  responseRate: 6,          // 1/s — smoothing of the local response (higher = quicker)
  dwellRadius: 0.12,        // pointer must stay within this distance to count as dwelling
  dwellDelay: 2.2,          // s of dwelling before the dwell response begins
  dwellRamp: 1.5,           // s from first response to full dwell response
  dwellRelease: 0.6,        // s for the dwell response to fade after moving away
  dwellAttraction: 0.05,    // how far nearby lines are drawn toward a dwelling pointer
  dwellGlow: 0.3,           // brightness lift of nearby lines while dwelling
  dwellActivity: 0.006,     // fine local shimmer of nearby lines while dwelling
});

// Condition 02 (Gel / Flow) researcher parameters — defaults
export const GEL_DEFAULTS = Object.freeze({
  viscosity: 0.6,     // 0..1   heavier, slower, more neighbour drag
  pressure: 1.0,      // 0..2   redistribution strength (0 = no volume conservation)
  recovery: 0.5,      // 0..1   speed of the return toward the circle
  flow: 0.7,          // 0..1.5 internal flow intensity (visual layers + flow lines)
});

// Condition 04 (Silicone / Elasticity) researcher parameters — defaults
export const SILICONE_DEFAULTS = Object.freeze({
  stiffness: 0.5,       // 0..1  elastic stiffness of the membrane springs
  resistance: 0.5,      // 0..1  stretch resistance (springs stiffen with strain)
  damping: 0.75,        // 0..1  more damping → less overshoot / oscillation
  recovery: 0.5,        // 0..1  pull back toward the rest form (recovery speed)
  maxDeformation: 0.45, // 0.15..0.8  how far a grabbed region can be pulled (object units)
});

// Condition 03 (Plastic / Crease) researcher parameters — defaults
export const PLASTIC_DEFAULTS = Object.freeze({
  stiffness: 0.5,     // 0..1  force needed before the sheet yields and folds (yield threshold)
  plasticity: 0.5,    // 0..1  how much of each fold remains after release (permanent bend)
  springBack: 0.5,    // 0..1  speed of the partial elastic spring-back after release
  foldLimit: 0.45,    // 0.2..0.6  largest fraction of the sheet one fold can lift
});

export const PRESETS = Object.freeze({
  A: Object.freeze({ id: 'A_stable', memoryEnabled: false, adaptiveEnabled: false }),
  B: Object.freeze({ id: 'B_adaptive', memoryEnabled: true, adaptiveEnabled: true }),
});

// Parameters exposed as sliders in Researcher Mode (group: Researcher Mode section —
// 'material' = Material properties, 'behaviour' = Behaviour & memory).
export const RESEARCH_SLIDERS = Object.freeze([
  { key: 'responsiveness', min: 0, max: 2, step: 0.01, group: 'material' },
  { key: 'stiffness', min: 0.004, max: 0.12, step: 0.001, group: 'material' },
  { key: 'damping', min: 0.85, max: 0.99, step: 0.001, group: 'material' },
  { key: 'learningRate', min: 0, max: 1, step: 0.01, group: 'behaviour' },
  { key: 'decayRate', min: 0, max: 0.3, step: 0.005, group: 'behaviour' },
  { key: 'adaptationStrength', min: 0, max: 0.95, step: 0.01, group: 'behaviour' },
  { key: 'adaptationThreshold', min: 0.2, max: 0.95, step: 0.01, group: 'behaviour' },
  { key: 'interactionRadius', min: 0.15, max: 0.9, step: 0.01, group: 'material' },
  { key: 'proximityResponse', min: 0, max: 0.08, step: 0.001, group: 'material' },
  { key: 'dwellDelay', min: 0.5, max: 5, step: 0.1, group: 'behaviour' },
  { key: 'dwellAttraction', min: 0, max: 0.12, step: 0.001, group: 'behaviour' },
]);
export const RESEARCH_TOGGLES = Object.freeze(['memoryEnabled', 'adaptiveEnabled']);

// Display-only settings (researcher). They never change the behavioural
// condition; changes are logged with scope "visual".
export const DEFAULT_VISUAL = Object.freeze({
  filamentDensity: 0.7,     // fraction of the filament network drawn (≈600 of ~860)
  membraneOpacity: 1.0,
  structuralContrast: 1.0,
  tensionHighlight: 1.0,
  visualMemory: 1.0,        // strength of memory-driven visual change
  lowDetail: false,         // manual reduced-detail mode
});
export const VISUAL_SLIDERS = Object.freeze([
  { key: 'filamentDensity', min: 0.2, max: 1, step: 0.01 },
  { key: 'membraneOpacity', min: 0, max: 2, step: 0.01 },
  { key: 'structuralContrast', min: 0.5, max: 2, step: 0.01 },
  { key: 'tensionHighlight', min: 0, max: 2, step: 0.01 },
  { key: 'visualMemory', min: 0, max: 2, step: 0.01 },
]);
