# ONE OBJECT / MANY ENCOUNTERS — V4

**Materiality, sensory depth and embodied exploration.**

V4 continues V3. It keeps V3's soft-body physics, behavioural memory, adaptation, research conditions, logging, bilingual interface and Researcher Mode, and adds four things on top:

- A filament-based visual material.
- A brush/sweep gesture.
- Interaction-driven procedural sound.
- A black exhibition interface.

Earlier versions are kept unchanged as backups:

- **V4.0:** `../one-object-v4.0/` (the version before the V4.1 colour pass)
- **V3:** `../one-object-v3/`
- **V2:** `../one_object_three_encounters_v2.html`

### V4.1 — dark ice-blue visual correction

This pass changes appearance only. Physics, memory, conditions, logging and export are unchanged, and all 24 tests still pass.

- **Background:** `#05070B` on the html, body and canvas surroundings, the panels and Researcher Mode.
- **Text:** soft white `#F4F9FF` for primary text, blue-grey `#A8C0D4` for secondary text.
- **Material palette:** `#182C40` deep structure, `#75BDE8` main blue, `#C7E9FF` pale translucent blue, `#F4F9FF` fibre highlights.
- **Folded membrane:** four seeded, overlapping translucent sheets, each with a soft edge and additive blending. They are clipped to the body and follow its deformation, using both live and lagged motion.
- **Version label:** shown in the tab title (`… · V4.1`) and as a small `V4.1` next to the title.
- **From the VS Code Live Server:** `http://127.0.0.1:5501/iris_workz/mdp/one-object-v4/index.html`.

---

## 1. Run it

There is no build step and there are no dependencies. The page uses native ES modules, so serve it over HTTP. Opening the file directly shows a warning.

```bash
cd iris_workz/mdp/one-object-v4
python3 -m http.server 8000      # or: npm run serve
# open http://localhost:8000
```

Tests need Node 18 or later:

```bash
npm test            # 24 tests: 14 carried over from V3 + 10 for V4
npm run example     # regenerates examples/session-example.json
```

**Researcher Mode:** press **Shift + R**, or use INFO → *Researcher mode* (for touch devices). Esc closes it.

## 2. Rendering architecture

The renderer is Canvas 2D. WebGL was not needed. The measured draw cost is well under 1 ms per frame at about 600 filaments, and headless Chrome holds 60 fps during interaction. Staying on Canvas 2D keeps the code simple and inspectable.

| Layer | What it is | Where |
|---|---|---|
| **A · Skeleton** | The V3 soft body: 80 perimeter nodes, springs, neighbour coupling and area preservation. Not drawn. | `physics/SoftBody.js` |
| **B · Filament network** | About 530 seeded anchors in *material coordinates* (u = angle fraction, s = radius fraction, z = depth). About 860 visible edges, plus about 160 dormant ones. 0.7 density by default, so about 600 are drawn. | `rendering/FilamentNetwork.js` |
| **C · Membrane** | The outer surface, filled with a cached radial gradient, plus one lagging inner surface, both at very low alpha. | `rendering/FilamentRenderer.js` |
| **D · Tension** | Each edge's strain, `L / restLen − 1`, computed every frame from real positions. Stretched fibres lose their slack, straighten and brighten. Compressed fibres bow more and add density. | renderer |
| **E · Memory** | Per-anchor memory, interpolated from V3's per-node memory. High-memory fibres straighten and brighten slightly, and dormant short fibres appear there. All of it fades as memory decays. | renderer |

**How the network is built.** The network is generated once per seed and never regenerated during a session. Anchors map through the soft body every frame:

- Rim anchors follow the live surface.
- Deeper and inner anchors blend toward two lagged displacement fields (rates of 10/s and 2.5/s). Force therefore reaches the interior visibly later.
- The z value gives each filament a depth group (width, colour and alpha), plus a tiny pointer parallax.

The network has four kinds of structure:

1. **Rim band:** about 120 anchors near the surface, joined by circumferential fibres.
2. **Strands:** 30 long flowing fibres, either chords bowing through the interior or partial arcs. They are drawn as one continuous smoothed curve.
3. **Clusters:** 7–9 local knots of denser structure.
4. **Bridges:** sparse interior anchors linked by nearest-neighbour edges, plus a few long cross strands.

Edge curvature follows a smooth flow field, so neighbouring fibres bow coherently rather than in random directions.

**Performance:**

- Filaments are sorted into 3 depth groups × 12 brightness buckets, so a frame issues about 36 strokes, using additive (`lighter`) blending on black.
- All arrays are preallocated, and nothing is allocated per frame.
- Device pixel ratio is capped at 2 (1.5 in reduced-detail mode).
- If the frame rate stays below 40 fps for 2.5 s, drawn density drops to 0.6×. This is logged as a visual change.
- Reduced detail can also be switched on by hand.

Palette: background `#07080A`; filaments `#DCE5E8`, `#91A8B4`, `#34434C` and `#F0F5F5`.

## 3. Interactions

| Gesture | What the system does (programmed behaviour) |
|---|---|
| **Approach** | A continuous, distance-dependent field dents the nearby surface. Faster approaches add more (speed term capped at 3 R/s). Nearby filaments follow the surface. |
| **Touch (press)** | Grabs the nodes around the contact point. A held dent compresses the area, so local fibres bow and densify. The volume term bulges the rest slightly. Optional soft contact sound. |
| **Stretch (drag)** | Spring attachment to the pointer, which resists more the further it is pulled (`tanh`). Neighbours follow with a delay and the interior follows later. Fibres along the pull straighten and brighten. Release carries the motion on briefly, then it recovers in about 1–2 s. |
| **Brush / sweep** *(new)* | Moving faster than 1.4 R/s over the surface without pressing. A tangential friction force plus a brief inward deflection. The sweep also sets an excitation field that spreads along the surface and decays (about 0.5 s), driving a fine, quickly fading filament vibration and the friction sound. Logged as `sweep`; it is not a contact. It builds memory only weakly (0.2× contact). |
| **Repeated contact** | V3 memory and adaptation, unchanged: that region gradually responds less, stiffer and broader, and its structure changes as described in layer E. |
| **Stillness** | Motion settles, vibration decays, memory decays (half-life about 14 s), and the residual shape relaxes. Ambient motion is extremely small and non-rhythmic: no breathing or heartbeat. |
| **Return** | The response depends on that region's current memory. Untouched regions keep their original behaviour and structure. |

## 4. Sound

The sound engine is in `audio/AudioEngine.js` and uses only the Web Audio API.

**When it plays:**

- Sound is **off by default**. The SOUND control shows `SOUND OFF` / `SOUND ON` (`aria-pressed`), and the INFO panel explains it.
- The audio context is created only on an explicit click.
- Sound suspends when the page is hidden and resumes only if it was on.
- Muting fades out and then suspends.

**Continuous voices.** These are driven by simulation signals every frame, with all parameter changes smoothed (`setTargetAtTime`):

- **Stretch:** band-passed noise. Level follows tension × deformation motion, and pitch rises with tension. A very faint low sine partial sits underneath.
- **Friction:** high band-passed noise driven by the sweep excitation.
- **Settle:** low-passed noise, only while meaningful motion remains after release.

**One-shots.** Each creates its nodes and disconnects them when it ends, with at most 6 at once:

- **Contact:** a soft, muted tap (low-passed noise with a low decaying sine).
- **Release:** a short downward glide of band-passed noise, scaled by the tension stored at release.

The output chain is master gain (0.55) → soft compressor/limiter → analyser → speakers. Peak output during repeated hard stretches measured **0.06** (full scale is 1.0), so there is no clipping. This was measured in headless Chrome, so loudness on real speakers still needs a listening check.

## 5. Researcher controls

The V3 controls are unchanged: presets A (stable) and B (adaptive), seed, responsiveness, stiffness, damping, memory learning and decay rates, adaptation strength and threshold, the memory and adaptation toggles, live state, heatmap, reset and export.

New **display-only** controls never change the condition label. They are logged as `parameter_change` with `scope: "visual"`:

| Visual parameter | Default | Range |
|---|---|---|
| filamentDensity | 0.7 | 0.2–1 (fraction of the network drawn, in a stable order) |
| membraneOpacity | 1 | 0–2 |
| structuralContrast | 1 | 0.5–2 |
| tensionHighlight | 1 | 0–2 |
| visualMemory | 1 | 0–2 (strength of memory-driven alignment, density and brightness) |
| lowDetail | off | toggle |

New behaviour parameters live in `config.js` and are code-only:

| Parameter | Value |
|---|---|
| `sweepSpeed` | 1.4 |
| `sweepGain` | 0.035 |
| `sweepDent` | 0.004 |
| `sweepMemory` | 0.2 |
| `pressDepth` | 0.07 (V3: 0.05) |
| `proximityWake` | 0.035 (V3: 0.06) |
| `proximitySpeedGain` | 0.0006 (V3: 0.0012) |

The Researcher Mode readout adds sweep count, the auto-detail state and the audio peak.

## 6. Export (schema v2)

The V3 export is unchanged apart from these additions:

- `visualParameters`.
- New event types: `sweep` and `sound_toggle`.
- New summary fields: `sweeps`, `totalSweepMs` and `soundToggles`.

The full example is in [`examples/session-example.json`](examples/session-example.json). Excerpt:

```json
{ "timestampMs": 10383, "type": "adaptation_threshold", "region": 0, "memoryLevel": 0.652 },
{ "timestampMs": 17133, "type": "sweep", "region": 7, "durationMs": 317, "speed": 4.2, "memoryLevel": 0.016 }
```

## 7. Changelog from V3

**Visuals:**

- The topographic layered contours and hatching are replaced by the filament, membrane, tension and memory layers.
- Black exhibition background; the object now spans about 45% of the viewport width on desktop and about 72% on phones.
- Memory traces now live in the structure itself (alignment, density, brightness) instead of hatch marks.

**Interaction:**

- New brush/sweep gesture, sweep excitation field, and audio signals and hooks in the simulation.
- Contact dent deepened (0.05 → 0.07) so a press reads as compression.
- Proximity wake and speed term reduced and capped, so very fast flicks no longer slam the surface.

**Sound:** a procedural sound engine with a SOUND control, off by default.

**Interface:**

- The interface fades in after the object, about 1.2 s after load.
- FINISH is visually secondary.
- Reset no longer carries the ↺ icon.

**Researcher Mode:**

- New display-only visual controls; the light/dark theme toggle is removed, since V4 is designed for black.
- Automatic reduced-detail fallback.

## 8. Test results

**Automated (`npm test`): 24 of 24 pass.**

Every V3 acceptance test still passes: first contact, repeated contact, untouched regions, recovery, stable vs adaptive, determinism, reset, export, five-minute stability, throttling, and the translation check. The V4 tests cover:

- The network is deterministic per seed and sized for the target range.
- Filaments follow deformation: rim anchors near a pull move at least 0.08 R, the far side under 20% of that, and edge strain exceeds 0.15.
- The inner structure trails the rim.
- A sweep is distinct from a drag: no contact episode, a logged episode, excitation that travels and then decays.
- A slow movement over the surface is not a sweep.
- Repeated contact reveals dormant fibres only in that region, and they disappear after rest.
- The stable preset builds no visual memory.
- The audio hooks fire with bounded strength.
- Export v2 is valid.
- Five minutes of mixed dragging and sweeping stays bounded.

**Headless Chrome, with real mouse and touch input:**

- No console errors.
- The participant view shows only the title, SOUND OFF, INFO, EN / 中文, the hint, FINISH and RESET.
- Real drags on one region gave peak responses of 0.243 → 0.099 over 9 drags.
- A fast sweep was logged with tension 0.24, against 0.93 before the cap.
- The SOUND click starts the audio context. Hidden → suspended, visible → running, muted → suspended and stays that way.
- Switching language keeps the session.
- A visual-only change leaves the condition as `B_adaptive`.
- The export downloads a valid v2 file, and reset clears memory and excitation.
- 60 fps during dragging.
- On a 390 px phone screen, touch dragging works without page scroll, and the nav buttons stay on one line in both languages.

**Not validated, and needs human testing:**

- Whether the material looks and feels compelling.
- Whether the memory changes are "subtle but discoverable".
- How the sound actually feels and how loud it is on real speakers and headphones.
- iOS Safari audio unlock and gesture behaviour; Android; pen input.
- Lower-powered devices, where the auto-detail fallback is untested on real hardware.
- Reduced motion with the OS setting turned on.
- Screen readers.

## 9. Known limitations

- The reference images mentioned in the V4 brief were not available when this was built. The visual direction follows the written description only.
- The filament network is a visual mapping of the perimeter soft body, not an independent physical mesh. Interior fibres follow interpolated, lagged surface motion; they do not collide or carry their own forces.
- The sweep footprint is angular, so a sweep through the centre excites the sectors it crosses rather than a precise interior point.
- Only one pointer is tracked; there is no multi-touch squeeze.
- The primary interaction cannot be done by keyboard or screen reader. The INFO panel says so.
- Sound uses unseeded noise buffers (only the timbre varies). Simulation and visuals stay deterministic.

## 10. Suggested next research iterations

1. **Visual memory as its own condition.** Run with `visualMemory = 0` but behavioural memory on (and the reverse) to separate what participants *see* change from what *responds* differently. Display settings are already logged separately.
2. **Sound as a factor.** Assign participants to sound on or off at the start, rather than letting them choose. Today the toggle is logged but self-selected.
3. **Raw input-stream export,** for exact replays of sessions and for gesture analysis (for example, how sweep and drag ratios shift over time).
4. **An independent interior mesh,** if interior compression and folding need to carry force rather than just be shown.
5. **Mixed methods.** Pair the logs with video, think-aloud, or short follow-up interviews. The logs show what people did, not what they expected or how they interpreted the object.
