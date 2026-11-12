# ONE OBJECT / MANY ENCOUNTERS

An interactive MFA thesis research prototype. It shows one unfamiliar, translucent material that responds to approach, touch, stretching, brushing, waiting and return. Repeated contact leaves traces that gradually change how each region responds.

**This folder is the canonical project.** Edit files here. Everything else in `iris_workz/mdp/` that relates to this work is an archived earlier version (see [CHANGELOG.md](CHANGELOG.md)).

Current version: **4.2.0**. The tab title shows "· V4.2", and exports record `appVersion: "4.2.0"`.

---

## Launch

The page uses native ES modules, so it must be served over HTTP. If you open `index.html` directly from Finder (`file://`), it shows a warning instead of the object.

**Option A — VS Code Live Server** (the usual workflow). Open the repository folder in VS Code, click **Go Live**, then open:

```
http://127.0.0.1:5501/iris_workz/mdp/one-object/index.html
```

Live Server serves the repository root on port 5501. If that port is busy, it picks another, so check the port it reports.

**Option B — Python** (no VS Code needed):

```bash
cd iris_workz/mdp/one-object
python3 -m http.server 8000        # or: npm run serve
# open http://localhost:8000/
```

There is no build step and there are no dependencies.

**Researcher Mode:** press **Shift + R**, or use INFO → *Researcher mode*. Esc closes it.

## Tests

Tests need Node 18 or later:

```bash
cd iris_workz/mdp/one-object
npm test            # 29 tests: physics, memory, adaptation, sweep, filaments, Stage-1 proximity/dwell, logging, export
npm run example     # regenerates examples/session-example.json (deterministic)
```

The tests import the real modules in `src/`, so they test exactly the code the page runs.

## Structure

```text
one-object/
├── index.html                    page shell (markup only; links CSS + src/main.js)
├── src/
│   ├── main.js                   wiring + fixed-timestep frame loop
│   ├── config.js                 ALL parameters, presets, slider definitions, version
│   ├── util/math.js              seeded PRNG, smoothstep, ids
│   ├── physics/SoftBody.js       material behaviour: 80-node perimeter soft body
│   ├── behavior/
│   │   ├── MemorySystem.js       per-node behavioural memory (accumulates, decays, residual shape)
│   │   ├── AdaptationSystem.js   memory → reduced sensitivity, stiffer, wider contact
│   │   └── ImmediateResponse.js  temporary proximity + dwell response (writes no memory)
│   ├── simulation/Simulation.js  orchestrates physics, gestures, memory, adaptation, logging hooks
│   ├── rendering/
│   │   ├── FilamentNetwork.js    seeded filament anchors/edges mapped through the deformation
│   │   └── FilamentRenderer.js   Canvas 2D: membrane, folds, filaments, tension, memory traces
│   ├── interaction/PointerController.js   Pointer Events (mouse/touch/pen) → object units
│   ├── audio/AudioEngine.js      procedural Web Audio (off by default)
│   ├── research/
│   │   ├── SessionLogger.js      in-memory event log
│   │   └── Exporter.js           JSON export (schema v2)
│   ├── ui/
│   │   ├── translations.js       every interface string (English / 简体中文)
│   │   ├── ExhibitionUI.js       hints, INFO, reflection, language, sound button
│   │   └── ResearcherPanel.js    Researcher Mode
│   └── styles/main.css
├── tests/                        node:test suites + example generator
├── examples/session-example.json
├── package.json
├── README.md · CHANGELOG.md · PROJECT_HANDOFF.md
```

The code is split into **material behaviour** (physics, behaviour, simulation), **rendering**, **interaction input**, **interface** (ui, styles) and **research logging** (research). The simulation has no DOM access, so it can run headlessly in tests.

## What it does

| Gesture | Response |
|---|---|
| Approach | The nearby surface dents slightly. Nearby lines ease away and brighten. |
| Dwell (hold still near one spot for about 2.2 s) | Nearby lines are gradually drawn in, brighten and shimmer finely. It fades when you move away. |
| Press | Local compression. |
| Drag | Elastic stretch with resistance and inertia. The interior follows later. Fibres straighten under tension. |
| Sweep (move fast across the surface without pressing) | A friction-like deflection and a brief vibration. |
| Repeat contact on one region | That region gradually responds less (stiffer and broader), and its fibres change. Other regions keep their original behaviour. |
| Wait | Motion settles and memory decays, so the region recovers. |

**Conditions** (in Researcher Mode):

- **A — Stable material:** memory and adaptation off.
- **B — Adaptive material:** both on. This is the default.

Full architecture, parameters, limitations and research framing are in [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md).

## Key parameters

All live in `src/config.js`. ★ means the parameter is also a Researcher Mode slider.

| Group | Parameters |
|---|---|
| Material | `responsiveness`★, `stiffness`★, `damping`★, `tension`, `volume`, `maxDisplacement`, `contactRadius`, `grip`, `pressDepth` |
| Proximity / sweep | `proximityRadius`, `proximityPush`, `proximitySpeedGain`, `proximityWake`, `sweepSpeed`, `sweepGain`, `sweepDent`, `sweepMemory` |
| Immediate response | `interactionRadius`★, `proximityResponse`★, `proximityGlow`, `responseRate`, `dwellRadius`, `dwellDelay`★, `dwellRamp`, `dwellRelease`, `dwellAttraction`★, `dwellGlow`, `dwellActivity` |
| Memory / adaptation | `memoryEnabled`★, `learningRate`★, `decayRate`★, `plasticity`, `adaptiveEnabled`★, `adaptationStrength`★, `adaptationThreshold`★, `adaptationHysteresis`, `adaptationTau`, `adaptStiffen`, `adaptWiden` |
| Display only (never changes the condition) | `filamentDensity`★, `membraneOpacity`★, `structuralContrast`★, `tensionHighlight`★, `visualMemory`★, `lowDetail`★ |
