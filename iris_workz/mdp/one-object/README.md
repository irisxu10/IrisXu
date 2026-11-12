# ONE OBJECT / MANY ENCOUNTERS

An interactive MFA thesis research prototype. It shows one unfamiliar, translucent material that responds to approach, touch, stretching, brushing, waiting and return. Repeated contact leaves traces that gradually change how each region responds.

**This folder is the canonical project.** Edit files here. Everything else in `iris_workz/mdp/` that relates to this work is an archived earlier version (see [CHANGELOG.md](CHANGELOG.md)).

Current version: **5.0.0-alpha.2** ("V5 — Same Form, Different Materialities"; Phase 03: Gel). The tab title shows "· V5".

**Four conditions** share the same initial form. Participants see only **01 / 02 / 03 / 04**, in a narrow selector on the left:

| ID | Name (researchers only) | Status |
|---|---|---|
| 01 | Structural / Memory | Full system (V4.2 physics, memory, adaptation, filaments, sound) |
| 02 | Gel / Flow | Full: viscous, volume-conserving contained fluid (pressure redistribution, slow drag, flow layers) |
| 03 | Plastic / Crease | Placeholder |
| 04 | Silicone / Elasticity | Placeholder |

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
npm test            # 45 tests (incl. 9 Gel acceptance tests): physics, memory, adaptation, sweep, filaments, proximity/dwell, shared form, research session, logging, export
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
│   ├── physics/SoftBody.js       material behaviour (01): 80-node perimeter soft body
│   ├── physics/GelBody.js        material behaviour (02): pressure-redistribution viscous boundary + interior flow
│   ├── behavior/
│   │   ├── MemorySystem.js       per-node behavioural memory (accumulates, decays, residual shape)
│   │   ├── AdaptationSystem.js   memory → reduced sensitivity, stiffer, wider contact
│   │   └── ImmediateResponse.js  temporary proximity + dwell response (writes no memory)
│   ├── simulation/Simulation.js  orchestrates physics, gestures, memory, adaptation, logging hooks
│   ├── materials/
│   │   ├── Material.js           the material interface every condition implements
│   │   ├── registry.js           conditions 01–04 (researcher-only names, lazy module loaders)
│   │   ├── sharedForm.js         shared outline, centre, diameter, body fill (identical for all four)
│   │   ├── StructuralMaterial.js 01 — adapter around Simulation + FilamentRenderer (unchanged)
│   │   ├── PlaceholderMaterial.js  base for 02–04: shared form + static texture + pointer logging
│   │   ├── GelMaterial.js        02 — wires GelBody + GelRenderer, research logging, parameters
│   │   ├── PlasticMaterial.js · SiliconeMaterial.js   03 / 04 placeholder textures
│   │   └── PointerTracker.js     pointer event logging for materials without their own physics
│   ├── rendering/
│   │   ├── FilamentNetwork.js    seeded filament anchors/edges mapped through the deformation
│   │   ├── FilamentRenderer.js   Canvas 2D (01): membrane, folds, filaments, tension, memory traces
│   │   └── GelRenderer.js        Canvas 2D (02): translucent body, liquid layers, flow lines, rim highlights
│   ├── interaction/PointerController.js   Pointer Events (mouse/touch/pen) → object units
│   ├── audio/AudioEngine.js      procedural Web Audio (off by default)
│   ├── research/
│   │   ├── SessionLogger.js      in-memory event log (one per encounter)
│   │   ├── ResearchSession.js    every encounter in order, condition order and lock, export (schema v3)
│   │   └── Exporter.js           encounter payloads (schema v2) + download
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

**Encounters and export.** A *research session* holds every encounter in order. Switching condition, RESET, applying a preset, or changing the seed closes the current encounter (its record is kept) and starts a new one. Use **Researcher Mode → Export research session** to download all of them in one JSON file. Data lives only in the tab, so export before closing.

**Condition order.** In Researcher Mode, set an order such as `03, 01, 04, 02`, or shuffle it. Then optionally lock it: participants can then choose only the current condition and the next one in the order.

**Behaviour presets for condition 01** (in Researcher Mode):

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
| Gel (02, researcher-only) | `viscosity` (0.6), `pressure` redistribution (1.0), `recovery` speed (0.5), `flow` intensity (0.7) — defaults in `config.js` `GEL_DEFAULTS` |
| Display only (never changes the condition) | `filamentDensity`★, `membraneOpacity`★, `structuralContrast`★, `tensionHighlight`★, `visualMemory`★, `lowDetail`★ |
