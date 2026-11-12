# Project Handoff — ONE OBJECT / MANY ENCOUNTERS

*Current as of 2026-11-12, version 5.0.0-alpha.4 (Gel and Silicone implemented; Plastic still a placeholder).* This document supersedes `../PROJECT_HANDOFF.md` (5 Nov), which describes the earlier single-file build.

Every claim below is labelled:

- **Verified** means checked by an automated test or by driving the real page in headless Chrome. Headless Chrome is a scripted, windowless Chrome sending real mouse and touch events; it is not a human looking at a screen.
- **Implemented, unverified** means the code exists but no human has tried it.
- **Not implemented** means it does not exist yet.

---

## 1. Overview

| | |
|---|---|
| **Canonical project** | `iris_workz/mdp/one-object/` (ES modules, no build step, no dependencies) |
| **Launch** | VS Code Live Server → `http://127.0.0.1:5501/iris_workz/mdp/one-object/index.html`. Or `cd one-object && python3 -m http.server 8000` → `http://localhost:8000/`. **`file://` does not work** (modules need a server); the page shows a warning. |
| **Version** | `APP_VERSION = '5.0.0-alpha.4'` in `src/config.js`. The tab title shows "· V5". |
| **Repository** | `github.com/irisxu10/IrisXu` (the artist's portfolio site); branch `prototype/homepage-soft-glass-atmosphere` |
| **Archived, not edited** | `../one_object_three_encounters_v2.html` (4.1 + Stage 1, single file), `../one-object-v4/` (4.1), `../one-object-v4.0/` (4.0), `../one-object-v3/` (3.0). Original V2 is in git `9a361d3`. A tarball of all of these is at `~/Desktop/IrisXu/one-object-backups/one-object-pre-consolidation-2026-11-12.tar.gz` (outside the repository). |

**Concept.** The work is a single abstract digital "material" in a dark space. Visitors approach, touch, stretch, brush across it, wait, and return. There is no goal or score, and three progressive hints. Repeated contact leaves traces and gradually changes how that region responds.

The design principle: *"The object should not pretend to be alive. It should behave in ways that make us question why we perceive something as alive."*

The research question: *How do repeated sensory encounters shape expectations, interpretations, and ways of interacting with an unfamiliar object?*

## 2. Architecture

### V5 material framework (Phase 02)

`main.js` owns the canvas, pointer, audio, UI and a `ResearchSession`, and keeps **exactly one** active material.

- **Material interface** (`materials/Material.js`): `initialize`, `update(dt)`, `render(pointer)`, `handlePointerInput`, `reset`, `resize`, `getResearchState`, `hintSource`, `audioSignals`, `isGrabbing`, `clockMs`, `buildEncounterPayload`, `dispose`.
- **No DOM listeners in materials.** Materials never add their own event listeners. `Material.live` counts live instances and should always be 1.
- **Lazy loading.** `materials/registry.js` lists the four conditions; each module loads on demand through `import()`. A switch token discards superseded switches.
- **Condition 01** = `StructuralMaterial`, an adapter around the unchanged `Simulation` and `FilamentRenderer`.
- **Conditions 02–04** = `PlaceholderMaterial` subclasses:
  - the shared form (outline, centre, diameter, fill, edge from `sharedForm.js`),
  - a static, seeded texture cached offscreen,
  - pointer logging through `PointerTracker`,
  - no motion.
- **Switching** (participant selector, researcher override, RESET, preset, seed): the current encounter's payload is frozen into the research session, then the material is disposed, then a new material and logger are created. Hints and reflection are reset.

**Export schema v3** contains: `researchSessionId`, `conditionOrder`, `orderLocked`, `orderLog`, `conditionSequence`, and `encounters[]`. Each encounter has:

- `encounterIndex`, `conditionId`, `materialKey`, `materialName`
- `orderPosition`, `conditionOrder`
- `startReason`, `endReason`, `previousConditionId`
- `preset`, `startedAt`, `endedAt`
- `payload`, a schema-v2 session with its own events

### Module layers


| Layer | Files | Notes |
|---|---|---|
| Configuration | `src/config.js` | Every tunable parameter, presets A/B, slider definitions, version |
| Material behaviour | `src/physics/SoftBody.js`, `src/behavior/MemorySystem.js`, `src/behavior/AdaptationSystem.js`, `src/behavior/ImmediateResponse.js`, `src/simulation/Simulation.js` | No DOM; deterministic for a given seed and per-step input; fixed 1/60 s step |
| Rendering | `src/rendering/FilamentNetwork.js`, `src/rendering/FilamentRenderer.js` | Canvas 2D; reads simulation state, never writes it |
| Interaction input | `src/interaction/PointerController.js` | Pointer Events (mouse, touch, pen), primary pointer only |
| Sound | `src/audio/AudioEngine.js` | Web Audio, off by default |
| Interface | `src/ui/ExhibitionUI.js`, `src/ui/ResearcherPanel.js`, `src/ui/translations.js`, `src/styles/main.css`, `index.html` | All strings in `translations.js` |
| Research logging | `src/research/SessionLogger.js`, `src/research/Exporter.js` | In memory only; JSON export |
| Wiring | `src/main.js` | Frame loop: input → physics steps (at most 5 per frame) → render → sound → UI |

**Units:** the base radius is 1 ("object units") and the centre is the origin.

## 3. What is implemented

| Feature | How it works | Status |
|---|---|---|
| **Soft-body physics** | 80 perimeter nodes. Each is pulled back toward its rest position (`stiffness` 0.014), coupled to its neighbours (`tension` 0.22), and subject to area preservation (press one side, the other bulges slightly). Damping 0.95 per step; displacement clamped at 0.36 R; recovery about 1–2 s. Ambient motion is non-rhythmic and amplitude 0.008. | Implemented, verified (automated) |
| **Proximity (surface)** | A distance field pushes the nearby surface away from the pointer; faster pointers push harder (capped at 3 R/s). | Implemented, verified |
| **Proximity (lines)** | Lines within `interactionRadius` 0.45 R ease away (≤ 0.025 R) and brighten. | Implemented, verified (automated and headless). Not yet tested by a human. |
| **Dwell** | The pointer stays within 0.12 R for 2.2 s, then over 1.5 s lines are drawn in (≤ 0.05 R), brighten and shimmer finely. It fades in 0.6 s, and pressing cancels it. Writes no memory; each dwell is logged. | Implemented, verified (automated and headless). Not yet tested by a human. |
| **Press / stretch** | The press grabs the nodes around the nearest edge point (gaussian width 0.36 R, with a 0.07 R dent). Dragging pulls them with `tanh` resistance plus a speed boost. Neighbours follow with a delay, the interior with more; motion carries on briefly after release. | Implemented, verified |
| **Sweep / brush** | Moving faster than 1.4 R/s over the surface without pressing applies tangential friction and a brief dent. An excitation field spreads along the surface and causes a fine vibration. Logged as `sweep`. | Implemented, verified |
| **Memory** | Each node has a level `m ∈ [0, 1]` that rises with contact intensity (`learningRate` 0.35/s), decays (`decayRate` 0.05/s, half-life about 14 s) and diffuses to neighbours. A residual shape ≤ 0.06 R follows memory. | Implemented, verified |
| **Adaptation** | A smoothstep over the threshold (0.65) with hysteresis (0.2) and a 1.2 s ease. Sensitivity = 1 − 0.72·(0.3m + 0.7·level). Adapted regions also become stiffer and spread contact wider. Events are logged per 30° region. | Implemented, verified: peaks of 0.247 → 0.110 over 9 drags; untouched region 0.247 |
| **Rendering** | Deep-blue translucent body, 4 seeded fold sheets, and about 600 drawn filaments (of about 860 visible plus about 160 dormant). Edge strain drives straightening and brightening; memory drives fibre alignment and reveals dormant fibres. Bucketed into about 36 strokes per frame; device pixel ratio ≤ 2; automatic reduced-detail fallback. | Implemented, verified (headless) |
| **Sound** | Stretch, friction and settle voices driven by simulation signals; contact and release one-shot sounds; a limiter. Off by default; suspends when hidden or muted. | Implemented. Context states and peak 0.06 verified; **how it actually sounds is unverified** |
| **Conditions** | A `A_stable` (memory and adaptation off) and B `B_adaptive` (default). Applying a preset or seed starts a new session; behaviour sliders mark `+custom`; visual sliders never change the condition. | Implemented, verified |
| **Researcher Mode** | Opens with Shift + R or INFO → Researcher mode. Presets, seed, 11 behaviour sliders, 2 toggles, 5 visual sliders plus low-detail, state flags, statistics, heatmap, reset, export. | Implemented, verified |
| **Logging / export** | Events: `session_start`, `approach`, `contact_start/end`, `drag`, `region_revisit`, `adaptation_threshold`, `recovery`, `parameter_change`, `reflection`, `sweep`, `sound_toggle`, `dwell`, `session_end`. Throttled, timed on the simulation clock. JSON schema v2 with a summary. | Implemented, verified |
| **Bilingual interface and reflection** | English and Simplified Chinese; switching keeps the session. Three hints. FINISH opens five optional neutral questions. | Implemented, verified |
| **Material framework (V5 Phase 02)** | Four conditions behind one interface. Selector shows only 01–04. Research session keeps every encounter. Order can be configured and locked. | Implemented, verified (52 browser checks, 36 tests) |
| **Gel / Flow (02)** | **Boundary:** an 80-node pressure boundary with a delayed target-area rise driven by interior displacement, so the footprint spreads under a press. **Interior:** a 31 × 31 displacement grid, coupled both ways to the boundary (Dirichlet edge values; boundary pulled toward the interior just inside it). An indenter anywhere inside pushes material away (dimple plus compressed ring), deepening under a hold; drag carries material with viscous lag; two lag fields give deeper layers; a decaying flow trail; exact rest afterwards. **`GelRenderer`:** volume glow, blurred compression density map, 10 field-warped folded membranes (trough plus compression-lit ridge), Fresnel rim, field-driven speculars. | Implemented, verified (12 node tests, 21 browser checks with pixel-change measurements). **Not yet tested by a human.** |
| **Silicone / Elasticity (04)** | `SiliconeBody`: a triangulated mass-spring disk (469 nodes, 864 triangles). Strain-stiffening springs, an oriented area constraint (resists squeezing, unfolds flips), a weak shape tether, and a soft-limited gaussian grab. Underdamped, with 2 sub-steps; no simulation while settled. `SiliconeRenderer`: mapped elastic bands (thin and brighten with stretch), area-driven thickness shading, two sheets, inner rim, strain-lengthened satin highlight. | Implemented, verified (11 node tests, 20 browser checks). **Not yet tested by a human.** |
| **Plastic (03) behaviour** | Placeholder only: static texture plus pointer logging. | **Physics not implemented** (Phase 04 not done) |
| **Click ripple, directional drag traces, autonomy (Stages 2–4)** | — | **Not implemented** |

## 4. Visual design

- **Background:** `#05070B`.
- **Text:** `#F4F9FF` primary, `#A8C0D4` secondary.
- **Material palette:** `#182C40`, `#75BDE8`, `#C7E9FF`, `#F4F9FF`.
- **Object:** about 45% of the viewport width on desktop, about 72% on phones.
- **Interface:** title top-left; SOUND, INFO and EN / 中文 top-right; one hint bottom-left; FINISH and RESET bottom-right.

**Why it can still look flat or circular:**

1. The rest outline varies by only about 2–3% from a circle.
2. Everything is 2D: no rotation or lighting; depth is only line width and alpha plus a tiny parallax.
3. The fold sheets are offset copies of the outline, not true self-overlapping folds.
4. The interior is driven only by the perimeter.
5. The body fill is a uniform radial gradient.
6. The filaments are sparse relative to a "dense woven" ideal.
7. At rest, nothing moves beyond 0.8% ambient motion.

**Visual references** mentioned by the artist have not been received by the implementing agent. The look is built from text descriptions only.

## 5. Research logic

`human action → object response → memory → adaptation → changed response → human response`

- **Measured:** pointer events and derived kinematics (approach, contact, region, duration, drag distance and speed, revisits, sweeps, dwells, stillness), parameter changes, sound toggles, reflection answers.
- **Simulated:** physics, memory, adaptation and immediate response. These are deterministic and programmed; they are not perceptions or intentions of the object.
- **Hoped to investigate** (design hypotheses): whether participants form expectations, notice changed responses, and change how they interact, and how they describe the object under the stable and adaptive conditions.
- **Cannot be concluded:** expectation, attention, emotion, attachment or reinterpretation (none are measured); causal differences between conditions without a proper study design; any biological realism or agency. Dwells and revisits are behaviours, not evidence of curiosity.

## 6. Known problems and limitations

**Bugs and risks:**

1. ~~Participant RESET erases the research log~~ — **fixed in 5.0.0-alpha.1**: RESET now closes the encounter (kept) and starts a new one with a `reset` event.
2. Session data is lost on reload or close (no persistence, by design). Export before closing.
3. Researcher Mode is reachable by participants through the INFO panel.
4. `TRY TOUCHING.` can appear while a visitor is dwelling.

**Interaction:**

- On touch devices there is no hover or dwell (a finger is only present while pressing).
- A sweep acts by angle, not by the exact point.
- Memory is perimeter-only (80 nodes; 12 logged regions).
- Effects are subtle by design; whether people notice them is untested.

**Research design:**

- Sound on or off is chosen by the participant, which is a confound.
- There is no condition randomisation or consent screen.
- Pointer data is recorded per event, not as a stream that could be replayed.
- The simulation clock pauses while the tab is hidden.

**Performance:**

- Headless measurements are relative only. On 12 Nov, under a system load average of about 14, a long scripted run measured about 35 fps during a drag. A fresh side-by-side measurement gave identical results for this build and the previous single-file build (about 60 fps idle).
- The project has not been tested on real low-end hardware, tablets, phones or projectors.

**V5-specific:**

- Conditions 02–04 do not deform. Participants touching them get no material response yet, only the pointer mark.
- Three further issues are tracked as deferred items **D1–D3** below.

### Deferred issues (logged 2026-11-12, to address in a later phase)

| ID | Issue | Impact | Possible fix (not yet decided) | Files |
|---|---|---|---|---|
| **D1** | **Rapid switching creates very short encounters.** Each click on the selector closes the current encounter and opens a new one, so clicking through quickly leaves several encounters lasting under a second. | Inflates encounter counts and adds noise to per-condition analysis. The data itself is accurate (each record is real). | Analysis-side minimum-duration filter; or a short cool-down or settle time before a switch is committed; or flag encounters under N seconds in the export. | `src/main.js` (`activate`), `src/research/ResearchSession.js` |
| **D2** | **Locked conditions are visually greyed out.** When the researcher locks the order, unavailable condition numbers are dimmed (`disabled`). | The greying itself tells participants that an order exists and which condition comes next, which may influence behaviour. | Hide unavailable buttons instead (keeping a fixed layout); or show all at equal weight and silently ignore disallowed clicks; or let the researcher advance conditions. | `src/ui/ExhibitionUI.js` (`setConditions`), `src/styles/main.css` (`.conditions button:disabled`) |
| **D3** | **Session data is lost if the tab closes without exporting.** Encounters live only in memory, by design (privacy), so a reload, close or crash discards everything not yet exported. | Data loss during studies if the researcher forgets to export. | A `beforeunload` warning when unexported encounters exist; an "unsaved encounters" counter in Researcher Mode; or opt-in, researcher-enabled `sessionStorage` autosave (a privacy decision for the researcher). | `src/main.js`, `src/ui/ResearcherPanel.js`, `src/ui/translations.js` |

**Needs manual testing:** look and feel, the noticeability of memory and dwell, sound quality and loudness, iOS Safari audio unlock, Android, pen input, the OS reduced-motion setting, and screen readers.

## 7. Verification

### Phase 05 — Silicone (12 Nov 2026, 5.0.0-alpha.4)

- **`npm test`:** 59 of 59 pass. The 11 Silicone tests cover:
  - a valid mesh with no drift at rest;
  - local stretch with no rigid translation;
  - progressive, delayed neighbour response;
  - resistance increasing with stretch, and the maxDeformation cap;
  - release overshoot of 5–50% with 1–4 crossings, recovery under 4 s, and an exact return;
  - 10 repeated stretches identical within 1%;
  - a direct difference from Gel (Silicone springs back past rest, Gel does not);
  - normal stretching folding zero triangles;
  - extreme flailing staying bounded, with momentary folds under 1% and full recovery;
  - all logged metrics;
  - parameters, reset and determinism.
- **Browser:** 20 of 20 Silicone checks pass, with no console errors.
  - Rest brightness 32.9 (01: 31.3), static.
  - Edge stretch follows 65 px (strain 0.33, no folds).
  - Release overshoots about 15 px past rest and returns to a pixel-identical rest.
  - Centre stretch follows 58 px.
  - 5 repeated stretches: 52 px each.
  - Extreme mouse movement stays bounded and recovers.
  - Researcher controls are logged, export fields are present, and RESET and switching work.
- **Regression:** 52 of 52 (Condition 01 unchanged) and Gel 21 of 21.
- **Engineering notes (bugs found and fixed during development):**
  - The first polar-quad mesh had a 48-link centre node that was numerically unstable. It was replaced by the 6k triangulated disk.
  - Edge-length springs alone let triangles fold over. An oriented, signed-area constraint fixed that.
  - An area constraint whose stiffness was normalized by 1/√A0 pumped energy into small triangles. Its stiffness is now size-independent, and integration runs in 2 sub-steps.
  - The stiffness slider was initially masked by the spring cap and a strong finger coupling. They were rebalanced so stiffness measurably changes resistance and spring-back speed.

### Gel refinement — volumetric interior (12 Nov 2026, 5.0.0-alpha.3)

- **`npm test`:** 48 of 48 pass. The 12 Gel tests cover:
  - rest;
  - a center press producing a meaningful visible deformation (perceptible within 0.1 s; outward push of more than 0.04 R on all sides at r = 0.22; interior displacement over 18 px; a compressed ring; no translation);
  - the center press reaching the contour with a delay (interior first, contour later; propagation 100–800 ms);
  - interior–boundary coherence (correlation above 0.8 for center and edge presses; an edge dent pushes interior material);
  - off-center and edge presses;
  - center drag (lag, carried material, deep layer lagging the surface, trail, no translation);
  - slow versus fast drag;
  - a long hold reaching a stable state;
  - release to exact rest with no later motion;
  - repeated pressing and abuse;
  - all logged metrics;
  - parameters, determinism and reset.
- **Browser:** 21 of 21 Gel checks pass, with no console errors.
  - Rest brightness 32.1 (01: 31.3).
  - Center press: 61% of in-form pixels change within 0.1 s and 51% at full press (interior about 25 px, contour +6.8 px). Recovery returns to a pixel-identical rest.
  - Center drag: lag about 12 px, flow trace, 57% of pixels changed.
  - Edge press: dent about 33 px, far side about +8 px.
  - The long hold is stable, 30 rapid taps stay stable, RESET and switching work, Researcher readouts are shown, and the export carries the new fields.
- **Regression:** 52 of 52 pass. Condition 01 is unchanged (adaptation 0.233 → 0.096; dwell works).
- **Screenshots:** five states in `research/screenshots/gel/`.

### V5 Phase 03 — Gel (12 Nov 2026)

- **`npm test`:** 45 of 45 pass.
- **Gel tests (node):**
  - At rest it is exactly the shared outline, with no motion.
  - A 1 s press sinks the contact region by more than 0.15 while the far side and the flanks expand, and the area stays within 1%.
  - With `pressure = 0`, nothing else expands and volume is lost. This is the control showing redistribution is a separate effect from denting.
  - Drag reaches 63% of its response more than 5× slower than Structural, with peak/final under 1.02 (no overshoot), and neighbours lag.
  - After release, motion continues, there is no overshoot past rest, it reaches exact rest, and there is then zero motion for 3 s. Recovery duration is logged.
  - Layers and flow lines move with the deformation, and the inner layer lags.
  - 3 minutes of extreme parameters and pressing stays bounded.
  - All logged metrics are correct, including revisits and interrupted recovery.
  - The parameters act as labelled; deterministic; reset works.
- **Browser (headless Chrome):** 19 of 19 gel checks pass, with no console errors.
  - At rest: brightness 28.4 (01: 30.0), exact circle, static.
  - Held press: contact −0.235, far side +0.042, volume −0.06%.
  - During drag the layers slide (outer 0.43 vs inner 0.30); motion continues after release; it settles fully (recovery about 5 s after a large drag).
  - Logged: duration, drag, peak deformation 0.36, redistribution 0.061, volume change 0.13%.
  - 25 rapid presses stay stable.
  - Researcher sliders work and are logged; parameters persist across encounters; switching away and back resets the gel.
- **Regression:** all 52 Phase 02 checks still pass. Condition 01 adapts from 0.237 to 0.097, its untouched region responds at 0.234, and dwell works.
- **Not verified:** whether the gel *feels* viscous and liquid to a person (it needs human testing); touch devices; low-end hardware. The flow-line kernel runs about 19k evaluations per step, which is fine at 60 fps on this machine but has not been profiled on slow hardware.

### V5 Phase 02 (12 Nov 2026)

- **`npm test`:** 36 of 36 pass.
- **Headless Chrome:** 52 of 52 checks pass, with no console errors. The checks cover:
  - **Switching:** switching to each condition; exactly one live material after every switch; the old 01 simulation frozen and detached after switching away.
  - **Leaks:** window, document and canvas listeners stay at 8 → 8 after 15+ switches. Rapid switching settles correctly.
  - **Initial state:** each condition starts from its initial state.
  - **Shared form:** same diameter (1135–1140 px), same centre (±1 px), similar brightness (27.3–30.7), icy-blue palette in all four. Placeholders are static.
  - **Layout:** the UI does not move or resize between conditions, and the selector does not overlap the object on a 390 px phone.
  - **Condition 01 unchanged:** adaptation 0.232 → 0.098, untouched region 0.231, dwell works.
  - **Research data:** RESET keeps the previous encounter and logs `reset`; language switching keeps the encounter.
  - **Researcher Mode:** names shown in Researcher Mode only, and nowhere in the participant view; order lock enables only current + next; order changes logged; presets recorded.
  - **Export:** the v3 export contains every encounter, with reasons, positions and events.

### V4.2 (12 Nov 2026)

**Automated:** `npm test` passes **29 of 29**, against the real `src/` modules.

**Headless Chrome on the canonical URL:** 30 of 31 checks pass, with **no console errors or exceptions**. The checks cover:

- **Loading and identity:** ES modules load; every request stays inside `one-object/`; version 4.2.0.
- **Appearance:** `#05070B` background; icy-blue palette active; object visible and blue-dominant at rest; minimal participant interface with no visible sliders.
- **Gestures:** proximity and dwell (0.99 after about 4 s); drag deformation and adaptation (0.247 → 0.110); untouched region unchanged (0.247); sweep logged.
- **Interface:** language switch keeps the session; sound on and off (context running and suspended).
- **Researcher Mode:** opens; a visual change is logged without changing the condition.
- **Export:** valid v2 JSON with appVersion 4.2.0 and dwells/sweeps.
- **Conditions:** Stable preset consistent (0.253 ± 0.002); Adaptive preset restores.
- **Reflection and reset:** FINISH opens the reflection and saves; RESET clears object, memory and dwell.
- **Touch:** a touch drag works without page scroll.

The one failure was frame rate under heavy system load (see §6).

## 8. Next priorities (ranked by research value, then experience, then feasibility)

1. **Remaining data integrity:** RESET no longer loses data (fixed in 5.0.0-alpha.1). Still to do: hide the researcher entry from participants, and add an "export before leaving" prompt. Files: `main.js`, `ExhibitionUI.js`, `translations.js`, `index.html`.
2. **Stages 2–3:** a click ripple with a persistent trace, and directional drag traces stored in memory. Files: `Simulation.js`, `MemorySystem.js`, `FilamentNetwork.js`, `FilamentRenderer.js`, `config.js`.
3. **Material depth:** a less circular silhouette, true folds, pseudo-lighting, denser fine strands, and optionally an interior mesh. Files: `SoftBody.js`, `FilamentNetwork.js`, `FilamentRenderer.js`.
4. **Stage 4 autonomy** as an explicit, logged, switchable factor. Files: a new `behavior/Autonomy.js`, plus `Simulation.js`, `config.js` and `ResearcherPanel.js`.
5. **Real behaviour for 03 (Plastic / Crease) and 04 (Silicone / Elasticity)**, following the Gel pattern: a pure physics module (`physics/*Body.js`), a renderer, a `Material` subclass exposing `getParamSpec`/`setParam`, and research events that are derivable from the simulation.

## 9. Open questions for the creative director

1. Reference images: can they be shared as files, and what should be matched?
2. Silhouette: keep it roughly spherical, or become irregular or folded?
3. Autonomy: on in both conditions, adaptive only, or a third condition? How autonomous before it reads as "alive"?
4. What memory should look like: directional, densifying, thinning, displaced? Should click and drag traces differ?
5. Is a quick click a separate gesture from press or drag?
6. How noticeable should adaptation and dwell be?
7. Sound: on for everyone, off for everyone, or assigned as a condition?
8. Hints: keep all three? Suppress `TRY TOUCHING.` during a dwell?
9. Protocol: who runs Researcher Mode, is there a consent step, and how are conditions assigned?
10. Should participants have RESET at all?
11. Reflection: immediately after FINISH, or as an interview?
12. Locked order: should unavailable conditions be hidden instead of greyed out, to avoid signalling an order? Should the participant be able to return to an earlier condition?
13. Should very short encounters (for example under 2 s, from rapid clicking) be excluded at analysis time, or prevented in the interface?

## 10. Files to share

`src/config.js`, `src/simulation/Simulation.js`, `src/behavior/*.js`, `src/rendering/*.js`, `src/research/*.js`, `src/ui/translations.js`, this document, `README.md`, `CHANGELOG.md`, and `examples/session-example.json` (schema v2, version 4.2.0, including a dwell).
