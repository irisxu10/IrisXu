# ONE OBJECT / MANY ENCOUNTERS — V3

An interactive thesis research prototype. It shows one unfamiliar form that responds to approach, touch and time. Repeated contact leaves traces in the form and gradually changes how it responds. There is no goal, score or correct interaction.

V2 is preserved unchanged at `../one_object_three_encounters_v2.html`.

---

## 1. Run it

There is no build step and there are no dependencies. The page uses native ES modules, so it must be served over HTTP. Opening `index.html` directly from the file system will not work; the page shows a warning if you try.

```bash
cd iris_workz/mdp/one-object-v3
python3 -m http.server 8000        # or: npm run serve
# open http://localhost:8000
```

On GitHub Pages it works as-is at `.../iris_workz/mdp/one-object-v3/`.

Tests need Node 18 or later, with no installs:

```bash
npm test             # 14 headless tests of physics, memory, adaptation, logging and export
npm run example      # regenerates examples/session-example.json
```

## 2. Using it

| Who | How |
|---|---|
| Participant | Approach, press and drag, release, wait. The only visible controls are INFO, EN / 中文, FINISH (opens the optional reflection) and RESET. |
| Researcher | Press **Shift + R**, or open INFO → *Researcher mode* (use this route on touch devices). Esc closes the panel. |

Applying a **preset** (A / B) or a **seed** starts a new session, so each export covers a single condition. Slider and toggle changes apply immediately and are logged as `parameter_change`. After such a change the condition is reported as `B_adaptive+custom`.

The dark exhibition theme is a researcher setting. It deliberately does not follow the participant's system theme, so that all participants in a study see the same presentation.

## 3. Structure

```text
one-object-v3/
├── index.html                 page shell, panels, boot warning
├── src/
│   ├── main.js                wiring + fixed-timestep loop
│   ├── config.js              all defaults, presets, researcher slider ranges
│   ├── util/math.js           seeded PRNG, smoothstep, ids
│   ├── simulation/Simulation.js   behavioural core (no DOM, testable)
│   ├── physics/SoftBody.js
│   ├── behavior/MemorySystem.js
│   ├── behavior/AdaptationSystem.js
│   ├── interaction/PointerController.js
│   ├── rendering/ObjectRenderer.js
│   ├── research/SessionLogger.js
│   ├── research/Exporter.js
│   ├── ui/ExhibitionUI.js     hints, info, reflection, language
│   ├── ui/ResearcherPanel.js
│   ├── ui/translations.js     every interface string (en / zh)
│   └── styles/main.css
├── tests/                     node:test suite + example generator
└── examples/session-example.json
```

## 4. How the systems work

All spatial values use **object units**: the base radius is 1 and the centre is the origin. Physics runs at a fixed 1/60 s step with at most 5 catch-up steps per frame. Rendering uses `requestAnimationFrame`.

**Soft body.** The form is a ring of 80 perimeter nodes. Each node stores its displacement *d* from a seeded, slightly irregular rest shape. On every step:

```
a = −k·d + tension·(d[i−1] + d[i+1] − 2d[i]) − volume·mean(radial d)·n̂ + external
v = (v + a)·damping ;  d += v ;  |d| ≤ maxDisplacement
```

- The neighbour term spreads a deformation, so nearby regions follow with a delay.
- The volume term keeps the area roughly constant: pressing one side makes the rest bulge slightly.
- Inner rendered layers trail the outer edge with increasing lag, which gives a sense of depth.

**Proximity.** Normalised proximity is `p = clamp(1 − distanceToEdge / 0.8, 0, 1)`, smoothed over time. Nearby nodes receive a smooth push away from the pointer, scaled up by pointer speed, plus a "wake" force along the pointer's velocity. A slow approach dents the surface slightly (about 0.02 R). A fast pass produces a larger transient deformation (about 0.14 R).

**Contact.** A press within 0.3 R of the edge grabs the nodes around the nearest edge point, weighted by a gaussian of width 0.36 R. Each grabbed node is pulled toward the drag offset, with a small dent under the press and a boost from pointer speed. The pull flattens out with `tanh`, so the form resists more the further it is stretched. On release, the stored velocity carries the motion on briefly before it settles. It returns to rest in roughly 1–2 s.

**Memory.** Each node has a level `m ∈ [0, 1]`:

- `m += contactIntensity · learningRate · dt`, then `m *= exp(−decayRate · dt)`.
- A light diffusion spreads memory to neighbouring nodes.
- Contact intensity grows with grab weight and with how far the node is deformed.
- Hovering alone never builds memory.
- The visible trace is a small residual deformation, `residual × m × plasticity`, plus fine inward hatching and a darker edge tone. Both fade as memory decays.

**Adaptation.** Each node has a level that eases toward `smoothstep(T−H, T+0.1, m)` with a time constant of 1.2 s. With the defaults (T = 0.65, H = 0.2) it starts at m = 0.45 and is full by 0.75. Sensitivity is:

```
sensitivity = 1 − strength · (0.3·m + 0.7·adaptLevel)      (minimum 0.08)
```

Adapted regions also become stiffer and spread contact over a wider area. They respond less, and differently: smaller, broader, quicker. They do not simply stop responding. A region logs `adaptation_threshold` when its mean memory crosses T, and logs `recovery (region_released)` when it falls below T − H. Nothing changes without contact, and nothing changes on a timer.

**State model.** Six conditions are computed continuously and can overlap: IDLE, APPROACH, CONTACT, EXPLORATION, ADAPTATION and RECOVERY. They are shown only in Researcher Mode. They are descriptions of system state, not stages the participant passes through.

**Hints.** Each hint appears once, only when its condition is met, and fades out:

1. `MOVE CLOSER.` appears at the start and fades when the pointer comes near.
2. `TRY TOUCHING.` appears after the pointer has been near for 2.5 s without contact.
3. `WHAT HAPPENS IF YOU WAIT?` appears after at least 3 contacts followed by 2 s of stillness.

## 5. Researcher-adjustable parameters

| Parameter | Default | Range | Effect |
|---|---|---|---|
| responsiveness | 1.0 | 0–2 | Gain on all pointer forces |
| stiffness | 0.014 | 0.004–0.12 | Pull back toward the rest shape, per step |
| damping | 0.95 | 0.85–0.99 | Velocity kept per step (lower = settles faster) |
| learningRate | 0.35 | 0–1 | Memory gained per second of full contact |
| decayRate | 0.05 | 0–0.3 | Memory decay per second (half-life ≈ 14 s) |
| adaptationStrength | 0.72 | 0–0.95 | How far sensitivity drops in adapted regions |
| adaptationThreshold | 0.65 | 0.2–0.95 | Memory level at which a region is logged as adapted |
| memoryEnabled | on | toggle | Off = no memory, traces or adaptation |
| adaptiveEnabled | on | toggle | Off = traces remain, but responsiveness never changes |
| seed | 20261105 | integer | Rest shape and ambient phases; applying it starts a new session |

The presets are **A — Stable material** (memory and adaptation both off) and **B — Adaptive material** (both on; the default). Everything else in `src/config.js` (tension, volume, contact radius, proximity gains, hysteresis, plasticity and so on) can only be changed in code.

> **Note on stiffness.** The spec suggested 0.12 as a starting value. In this per-step model, 0.12 snaps back in about 0.2 s, which feels rigid rather than elastic. 0.014 with 0.95 damping gives the target 1–3 s recovery. The slider still reaches 0.12.

## 6. Session export

A researcher exports the session from Researcher Mode with *Export session (.json)*. Data is held only in memory. It is never written to `localStorage` and never sent anywhere, and closing the page or pressing RESET discards it. No names, emails or IP addresses are collected. Pointer positions are recorded only at contact start, in object units.

Event types: `session_start`, `approach`, `contact_start`, `contact_end`, `drag`, `region_revisit`, `adaptation_threshold`, `recovery`, `parameter_change`, `reflection`, `session_end`.

Logging is throttled:

- `approach` uses hysteresis and is logged at most once every 1.5 s.
- `drag` is sampled about every 400 ms.
- `recovery (stillness)` is logged when a period of stillness of 3 s or more ends.

A 20-second continuous drag produces about 50 events, not 1,200.

The full deterministic example is in [`examples/session-example.json`](examples/session-example.json). An abridged version:

```json
{
  "schema": "one-object-many-encounters/session",
  "appVersion": "3.0.0",
  "sessionId": "…uuid…",
  "condition": "B_adaptive",
  "seed": 20261105,
  "durationMs": 34633,
  "parameters": { "stiffness": 0.014, "learningRate": 0.35, "…": "…" },
  "summary": {
    "totalContactMs": 8133, "contactEpisodes": 8, "regionRevisits": 6,
    "adaptationEvents": 1, "regionRecoveries": 1, "stillnessPeriods": 1
  },
  "events": [
    { "timestampMs": 0, "type": "session_start", "metadata": { "condition": "B_adaptive", "seed": 20261105 } },
    { "timestampMs": 1217, "type": "approach", "distance": 0.445, "speed": 0.66 },
    { "timestampMs": 1517, "type": "contact_start", "region": 0, "distance": 0.065, "speed": 0, "memoryLevel": 0, "metadata": { "x": 1, "y": 0 } },
    { "timestampMs": 10250, "type": "adaptation_threshold", "region": 0, "memoryLevel": 0.65 },
    { "timestampMs": 34633, "type": "session_end", "metadata": { "exported": true } }
  ],
  "reflection": { "q1": "One side became stiffer.", "q2": "…" }
}
```

Timestamps are on the simulation clock, which pauses while the tab is hidden. `startedAt` and `exportedAt` give wall-clock time.

## 7. Changelog from V2

**Removed from the participant view:**

- The four-mode selector (TOUCH / STRETCH / ORBIT / LISTEN). It is replaced by one continuous gesture space.
- The sidebar, the progress bar, the interaction counter and the event log.
- The permanent reflection form. Reflection now opens only from FINISH, and every question is optional and can be skipped.

**Moved to Researcher Mode:** the responsiveness and memory sliders.

**Removed and not replaced:** the "speculative sensing organism" context reveal. It framed the object as alive, which conflicts with the V3 principle that the object should never pretend to be alive. V2 still has it.

**Physics:**

- Sine-wave distortion is replaced by a damped spring soft body with neighbour coupling, area preservation and a fixed timestep.
- Behavioural memory is new. It is per-node, decays and diffuses, and leaves residual deformation and visible traces.
- Adaptation is new. It is driven by history, eased in and out, uses hysteresis, and works per region.
- Ambient motion is now very subtle, slow and non-rhythmic. It has no global pulse or breathing.
- Rendering is redone: lagged layers, strain-weighted structural lines, a clipped grain texture and memory hatching.

**Research tools:**

- Researcher Mode with presets A and B, a seed, a state readout and a memory/adaptation heatmap.
- Structured, throttled logging with summary metrics. The export schema is now versioned.

**Interface and code:**

- Language switching keeps the object state, session data and settings.
- Reduced-motion support, keyboard-reachable controls with visible focus, and high-DPI rendering.
- Seeded and deterministic: the same seed and the same input produce identical state, and this is tested.
- Reorganised from one inline script into modules with a test suite.

## 8. Verification

**Automated (`npm test`, 14 tests).** These cover acceptance tests A–G, I and J:

- First-contact elasticity and recovery.
- Repeated contact reduces the response. In the scripted test the peak went from 0.199 to below 0.16 over 10 drags.
- An untouched region stays within 10% of the first response.
- Memory decays and sensitivity recovers.
- Stable vs adaptive under the same seed.
- Determinism.
- Reset.
- Export validity.
- Log throttling.
- Proximity response before contact.
- 5 simulated minutes of aggressive input stays bounded and settles.
- No adaptation without contact.
- The en/zh translation keys match.

**Browser (headless Chrome, real pointer and touch events).**

- No console errors or exceptions.
- The participant view has no inputs and no debug text.
- The hint sequence works.
- Real drags on one region gave peaks of 0.223 → 0.093 over 9 drags, while the opposite region gave 0.221.
- Switching language kept the session ID, events and memory.
- Shift + R opens Researcher Mode, parameter changes are logged, and the export button downloads valid JSON.
- Preset A starts a fresh session.
- The reflection is stored, and reset clears everything.
- About 60 fps.
- On a 390 px touch viewport, a drag deforms the form without scrolling the page.

**Needs manual testing:**

- Whether the response *feels* tactile, and whether the adaptation is noticeable without being obvious. This is the main tuning question.
- Real phones and tablets, including iOS Safari gesture behaviour.
- Pen input.
- Lower-powered devices.
- The dark theme on an exhibition display.
- Reduced motion with the OS setting turned on.
- Screen-reader announcement of the hint and panels.

## 9. Known limitations and next iterations

- **Keyboard and screen readers.** The core interaction is pointer-only. The info panel says this honestly. A keyboard-driven "probe" would be a meaningful next step.
- **One pointer.** Only one pointer is tracked. Multi-touch pinching and squeezing is a natural next step.
- **One kind of memory effect.** Memory affects sensitivity, stiffness and contact spread. Alternatives the spec mentions (texture change, recovery speed) are left for comparison conditions.
- **No sound.** Sound is not implemented, so there is no SOUND control.
- **Region resolution.** Regions are 12 fixed 30° sectors, fine for logging but coarse for analysis. Consider exporting the per-node memory time series at a low rate.
- **Scripted replay.** Determinism holds for identical *per-step* input. Live sessions are not bit-for-bit replayable, because input timing depends on the frame rate. If replay matters, record the raw input stream.
- **Possible next condition:** a researcher-triggered global transition (spec §4E) as an explicit, logged experimental condition. It is not implemented.
- **Interpretation.** The logged data describes behaviour and system state. It is not evidence that a participant formed an expectation, felt attachment, or reinterpreted the object. Pair it with observation and the optional reflection.
