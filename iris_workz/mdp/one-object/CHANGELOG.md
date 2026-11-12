# Changelog

All notable changes to ONE OBJECT / MANY ENCOUNTERS. Dates are 2026.

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
