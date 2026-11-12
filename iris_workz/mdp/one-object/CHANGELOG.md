# Changelog

All notable changes to ONE OBJECT / MANY ENCOUNTERS. Dates are 2026.

## 5.0.0-beta.1 — 12 Nov · Phase 06: integration, Plastic, Researcher Mode, participant testing

**All four conditions are now implemented.** Condition 01 is unchanged (its source files are untouched). Gel and Silicone are unchanged apart from tagging their researcher parameters with a panel group.

**Condition 03 — Plastic / Crease** (`physics/PlasticBody.js`, `rendering/PlasticRenderer.js`, `materials/PlasticMaterial.js`, replacing the placeholder). The sheet is a set of flat facets, each with an affine map, a 3D normal and a layer.

- **Yield:** the sheet resists until a drag passes a yield distance; a stress line previews the fold.
- **Classification**, made once per gesture:
  - *edge*: the flap folds over along the bisector and follows the pointer;
  - *ridge*: an interior press buckles into a raised band with two creases;
  - *resist*: an outward pull does nothing.
- **Release:** an overdamped *partial* spring-back to a residual angle, then baked in permanently. Creases accumulate; only RESET restores the sheet. No adaptation.
- **Researcher parameters:** stiffness (yield), spring-back speed, plasticity (permanent bend), fold limit.
- **Logging:**
  - new `fold` event (mode, direction, flap fraction, time to yield);
  - `contact_end` outcome, peak fold angle and fold distance;
  - `recovery` kind `springback` (residual angle, creases, facets, projected area, mean tilt).
- **Visual:** brightness matched to the other conditions (32.6, against 31.1–32.0).

**Researcher Mode** is reorganised into four collapsible sections:

- **Material properties**
- **Behaviour & memory**, with live metrics
- **Encounter conditions:** switch, order, shuffle, lock, seed, *reset current condition*, encounter list
- **Research data:** anonymous session ID, **participant notes**, **live interaction log**, **session timeline**, reflection status, export, **new participant session**

Material names appear only here. The panel is full-width on phones.

**Research logging** (export schema v4):

- `participant.anonymousSessionId`
- a session **`timeline`**: switches from → to, resets, order and lock changes, parameter changes, sound, language, notes, reflection and export, each with ISO time and ms since start
- `notes`
- a session-level `reflection` (with question wording and language)
- `parameterSettings` for every material
- `materials`
- an updated method note: logs describe pointer behaviour and simulated state only, and do not infer emotion or interpretation

**Reflection:** the five neutral Phase 06 questions, about *each object*, in English and Chinese. The privacy text now mentions the anonymous code.

**Tests:** 76 (12 Plastic, 5 integration, including one identical gesture applied to all four models). Browser QA has 56 checks:

- visual consistency;
- the identical gesture in all four conditions;
- switching and reset;
- participant text;
- Researcher Mode;
- reflection;
- language and sound;
- export;
- touch;
- five screen sizes.

A 3-minute extended-session performance run was also done.

**New documents and files:** `RESEARCH_PROTOCOL.md`, `examples/research-session-export-example.json`, and screenshots in `research/screenshots/plastic/` and `research/screenshots/phase06/`.

**Known:** in headless Chrome at 2× density, Gel runs at about 30 fps during interaction (needs checking on real hardware). Conditions do not keep state across switches (by design; documented).

## 5.0.0-alpha.4 — 12 Nov · Phase 05: Silicone / Elasticity (condition 04)

**Condition 04 is now a real material.** Conditions 01, 02 and 03 are unchanged: 01 and 02 pass their regression and Gel checks (52/52 and 21/21), and 03 remains a placeholder.

**Physics** (`physics/SiliconeBody.js`, pure, fixed step, deterministic): a triangulated mass-spring disk.

- **Mesh:** a centre plus 12 rings of 6k nodes. That is 469 nodes, 864 triangles and 1,332 springs, with at most 7 links per node. The outer ring lies on the shared outline.
- **Springs stiffen with strain:** `k·(1 + resistance·strain²)`, with a stability cap.
- **Oriented area constraint:** uses signed area, so it resists squeezing and unfolds any triangle that flips over.
- **Weak shape tether:** holds no history, so there is no memory or adaptation.
- **Grab:** a gaussian footprint pulled toward the pointer offset, soft-limited by `maxDeformation`.
- **Underdamped integration** in two sub-steps per physics step. A settled, untouched membrane is not simulated at all, so it stays exactly at rest.
- **Measured behaviour:**
  - the grab follows 56–66% of the pointer's travel, with resistance rising with stretch;
  - release overshoots about 30% with 2–3 crossings of rest and settles in about 1.8 s;
  - normal use folds zero triangles;
  - extreme flailing folds on average under 1% of triangles momentarily, then recovers fully.

**Rendering** (`rendering/SiliconeRenderer.js`): everything is driven by the mesh.

- Broad elastic bands mapped through the membrane. They thin and brighten where stretched, and align with the pull.
- Soft per-node thickness shading from triangle area: clearer where thinned, milkier where compressed. Sprites are used, so no mesh seams show.
- Two gentle overlapping sheets, a soft inner rim for thickness, and a satin highlight that lengthens under strain.
- No wireframe and no glare.

**Researcher parameters:** elastic stiffness, stretch resistance, damping, recovery speed and maximum deformation. Recovery speed scales both the pull home and the energy loss, so it genuinely shortens recovery; damping sets how bouncy the return is.

**Logging:**

- `contact_end`: stretch duration, `stretchDistance`, `peakDeformation`, `peakStrain`, `releaseDisplacement`.
- `recovery` (kind `settle`): duration, `releaseVelocity`, `overshoots` (crossings of rest) and `maxOvershoot`.
- The export summary adds `peakStretch`, `peakDeformation`, `peakStrain`, `peakReleaseVelocity` and `interiorContacts`.

**Tests:** 59 (11 new Silicone tests). Reference screenshots are in `research/screenshots/silicone/`. Version 5.0.0-alpha.4.

## 5.0.0-alpha.3 — 12 Nov · Gel refinement: volumetric interaction (condition 02)

The whole interior of the Gel is now interactive. Only Gel files and the minimum shared wiring changed; Condition 01 is untouched (52/52 regression checks).

**Interaction model** (`physics/GelBody.js`):

- The 80-node pressure boundary is kept and coupled both ways to a new **interior displacement grid** (31 × 31, about 750 cells inside the body).
- Cells are elastically coupled to their neighbours, so a disturbance propagates outward over time.
- Cells next to the edge take the boundary's displacement as their outside neighbour, and each boundary node is pulled toward the interior displacement just inside it.
- A press **anywhere** drives an indenter that pushes material away from the finger, leaving a cleared dimple inside a compressed ring.
  - The indentation registers immediately (35%), then deepens under a hold to a stable compressed state.
  - Near the edge, the existing edge dent also applies.
- **Interior pressure**, driven by the actual interior displacement, raises the body's target area after a delay. The contour swells about 0.15 s after the inside moves, and returns after release.
- **Dragging** carries nearby material with viscous lag.
- Two lagged copies of the field give the deeper layers their slower motion, and a decaying trail records recent pointer-driven flow.
- Everything settles to exact rest, with no autonomous motion.

**Rendering** (`rendering/GelRenderer.js`): the contour-like flow lines and nested layer rings are removed. In their place:

- A thick translucent volume with scattered light.
- A smooth density map computed from the field's compression (blurred: brighter where compressed, clearer under the dimple).
- Ten folded membranes warped through the field at three depths. Each has a dark trough and a specular ridge that brightens with local compression and flow.
- A Fresnel-style rim.
- Specular highlights that the field and interior pressure move and stretch.
- In-form brightness at rest is 32.1, against 31.3 for Condition 01.

**Logging:**

- `contact_start` gains `interior` and `depthFromEdge`.
- `contact_end` gains `localCompression`, `internalDisplacement` and `pressurePropagationMs`. `peakDeformation` is now the larger of the edge indent and the interior displacement.
- The export summary adds `interiorContacts`, `peakCompression` and `peakInternalDisplacement`.
- Researcher Mode shows internal displacement and compression. "Volume change" is relabelled "Area change", because a press now intentionally spreads the footprint by up to about 6%.

**Parameters:** the same four. `flow` now scales the interior response; `pressure` scales how far the contour spreads.

**Tests:** 48 (12 Gel tests rewritten for the new model, including an explicit center-press visibility test and an interior–boundary coherence test). Reference screenshots replaced (five states). Version 5.0.0-alpha.3.

## 5.0.0-alpha.2 — 12 Nov · Phase 03: Gel / Flow (condition 02)

**Condition 02 is now a real material** rather than a placeholder. Condition 01 is untouched: its files are unchanged and all 52 regression checks still pass.

**Physics** (`physics/GelBody.js`, pure, fixed step, deterministic): a pressure-based, approximately volume-conserving soft boundary of 80 nodes.

- The enclosed area's shortfall becomes an outward pressure along every normal. Pressing one side sinks it in and pushes the other regions out. Volume change stays under 0.2% for a normal press.
- Heavy, overdamped integration with viscous coupling between neighbouring nodes. Drag is slow and delayed: 63% of the response in about 0.27 s, versus 0.02 s for Structural, with no overshoot. Motion continues briefly after release, then dissipates.
- Weak shape memory and boundary smoothing return the form toward the circle. A final ease brings it to exact rest, with no autonomous motion afterwards.

**Interior** (simulated, so it can be tested):

- Three liquid layers lag the boundary at different rates, so they slide relative to one another.
- Flow lines are carried by a flow field interpolated from the boundary velocities, and relax back to rest.

**Rendering** (`rendering/GelRenderer.js`): a translucent icy body whose density centre follows the deformation; soft overlapping layers; flow lines; a thin rim highlight that brightens where the gel is compressed; one soft specular highlight that drifts against the deformation. No glow effects.

**Researcher-only parameters:** viscosity, pressure redistribution, recovery speed and internal flow intensity. They persist across encounters and are logged as `parameter_change` with scope `material`. Researcher Mode now shows a parameters section for whichever material provides one.

**Logging:**

- Contact location, duration and drag distance.
- At `contact_end`: `peakDeformation`, `redistribution` (peak mean outward expansion outside the contact footprint) and `peakVolumeChange`.
- `recovery` with kind `settle`: time from release until displacement falls below 0.01, or `completed: false` if a new press interrupted it.
- The export summary adds peak deformation, peak redistribution and completed recoveries.

**Also:** `PointerTracker` gains `{ contacts: false }`, and the exporter's basic payload accepts material parameters and extra summary fields. Version 5.0.0-alpha.2. Tests: 45 (9 new gel tests).

## 5.0.0-alpha.1 — 12 Nov · V5 "Same Form, Different Materialities": material framework (Phase 02)

**Four material conditions** behind one material interface (`src/materials/Material.js`):

| Condition | Name (researcher-only) | Status |
|---|---|---|
| 01 | Structural / Memory | Full V4.2 system |
| 02 | Gel / Flow | Placeholder |
| 03 | Plastic / Crease | Placeholder |
| 04 | Silicone / Elasticity | Placeholder |

- **Participants see only 01 / 02 / 03 / 04**, in a narrow selector on the far left. The selected condition has an ice-blue border, and the buttons are fixed-size, so switching never shifts the layout.
- **Condition 01 is unchanged.** It is the existing Simulation and FilamentRenderer wrapped in an adapter (`StructuralMaterial`). Its physics, adaptation, rendering and logging are identical (verified).
- **Conditions 02–04 are placeholders.** Each is its own lazily loaded module with a distinct, static internal texture:
  - 02: soft pools of light and flowing curves.
  - 03: straight creases with faceted tonal planes.
  - 04: curved, taut elastic bands with a satin sheen.

  They have no physics yet. Pointer events are still logged through `PointerTracker`.
- **Shared initial form** (`materials/sharedForm.js`): all four use Condition 01's exact outline, centre and diameter, and the same body fill and edge. The 01 renderer now takes its geometry from this module, using the same formula as before. Brightness inside the form measured 27.3–30.7 across the four.
- **Research sessions** (`research/ResearchSession.js`):
  - Switching, RESET, presets and seed changes now *close* the current encounter (its record is frozen and kept) and start a new one.
  - Each encounter records condition id, material, order position, start and end time, start and end reason, preset, previous condition, and its own events.
  - New `reset` event type.
  - Export schema v3 contains *all* encounters, each a schema-v2 session.
- **Fixed:** the participant RESET no longer erases the research log (the known issue since 5 Nov).
- **Researcher Mode:**
  - Shows real material names and a researcher override switch.
  - The condition order can be set, shuffled and locked. When locked, participants can choose only the current and the next condition. Order changes are logged.
  - Lists the encounters, with "Export research session" and "New research session" (with a confirmation).
  - Presets, seed and physics controls apply to 01 and are shown only while 01 is active.
- Version 5.0.0-alpha.1; the tab shows "· V5". Tests: 36 (7 new).
- **Known issues, deferred** (tracked as D1–D3 in PROJECT_HANDOFF.md):
  - rapid switching creates very short encounters;
  - locked conditions are visibly greyed out;
  - session data is lost if the tab closes before export.

## 4.2.0 — 12 Nov · canonical project (this folder)

This release is a consolidation only. **The interaction and visual behaviour are identical to the previous single-file build.** This was verified by the test suite and by a headless-Chrome run.

- **New canonical location:** `iris_workz/mdp/one-object/`, organised as ES modules (`src/`). The modules were recovered from the single-file build, and the 8 modules unchanged since 4.1 match the 4.1 source byte for byte.
- **Version bumped from 4.1.0 to 4.2.0** (tab title and `appVersion` in exports), so exported sessions from this build can be told apart from plain 4.1 sessions. This was a known issue in the handoff from 5 Nov.
- The "open through a web server" warning is restored, since module mode needs a server again.
- **Tests moved into the project:** 24 existing tests plus 5 Stage-1 tests, now in `tests/`. Previously the Stage-1 tests lived only in a temporary folder.
- The example export was regenerated and now includes a dwell episode.
- Added this changelog, a README and an updated PROJECT_HANDOFF.

## 4.1 + Stage 1 — 5 Nov · single-file build (`../one_object_three_encounters_v2.html`, archived)

- **Immediate Response system** (new `behavior/ImmediateResponse.js`):
  - **Proximity awareness:** lines within `interactionRadius` of the smoothed pointer ease away and brighten.
  - **Dwell response:** after about 2.2 s near one spot, lines are drawn in, brighten and shimmer finely. It fades when the pointer moves away, and pressing cancels it.
  - It writes no memory. `dwell` events are logged, and `dwells` and `totalDwellMs` are added to the export summary.
- Four new Researcher sliders: interaction radius, proximity response, dwell delay, dwell attraction.

## 4.1 consolidation — 5 Nov · single self-contained HTML

- The V4.1 modules were inlined into one HTML file, which works from `file://` and Live Server.
- The visible "V4.1" label was removed (the version stays in the tab title).
- The V2 "reveal a context / sensing organism" story was deliberately not restored.
- The original V2 file was committed to git first (`9a361d3`).

## 4.1 — 5 Nov · dark ice-blue visual correction (`../one-object-v4/`, archived)

- Near-black `#05070B` everywhere; text `#F4F9FF` / `#A8C0D4`.
- Material palette: `#182C40`, `#75BDE8`, `#C7E9FF`, `#F4F9FF`.
- Four seeded translucent fold sheets, clipped to the body; a more translucent body fill.

## 4.0 — 5 Nov · materiality and sound (`../one-object-v4.0/`, archived)

- The filament network replaced the topographic contours: about 600 drawn filaments in stable material coordinates, with a membrane layer, tension shown through edge strain, and memory shown through fibre alignment and dormant fibres.
- New sweep / brush gesture, with an excitation field that spreads along the surface.
- Procedural Web Audio (contact, stretch, friction, release, settle), off by default, with a limiter.
- Black exhibition interface; display-only researcher controls; automatic reduced-detail fallback.
- Export schema v2 (`visualParameters`, `sweep`, `sound_toggle`).

## 3.0 — 5 Nov · behavioural system (`../one-object-v3/`, archived)

- Damped spring soft body, behavioural memory, history-driven adaptation, one continuous gesture space.
- Minimal exhibition interface with progressive hints and an optional neutral reflection.
- Researcher Mode with presets A (stable) and B (adaptive), a seed and a heatmap; structured, throttled logging.
- Bilingual interface. Light theme with sage-green layered contours.

## 2.0 — original prototype (git `9a361d3`)

- Light sage theme, four mode buttons (touch, stretch, orbit, listen), a sidebar with sliders and an event log, a "sensing organism" context story, and a reflection form with JSON export. Sine-wave distortion rather than physics.
