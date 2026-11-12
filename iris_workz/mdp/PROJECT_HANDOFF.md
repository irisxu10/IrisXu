# Project Handoff — ONE OBJECT / MANY ENCOUNTERS

*Status review as of 2026-11-05. Documentation only: no prototype code was changed to write this report.*

Every claim below is labelled:

- **Verified** means checked by an automated test or by driving the real page in headless Chrome.
- **Implemented, unverified** means the code exists but no human has tried it.
- **Not implemented** means it does not exist yet.

"Headless Chrome" means a scripted, windowless Chrome sending real mouse and touch events. It is not a human looking at a screen.

---

## 1. Project overview

| | |
|---|---|
| **Name** | ONE OBJECT / MANY ENCOUNTERS — interactive MFA thesis research prototype |
| **Version** | Internal **4.1 + "Stage 1" (proximity and dwell)**. The code still reports `APP_VERSION = '4.1.0'` and the tab title still says "· V4.1". **Exports therefore cannot tell 4.1 sessions from 4.1 + Stage 1 sessions** (see §5). |
| **Single source of truth** | `iris_workz/mdp/one_object_three_encounters_v2.html`. It is self-contained: about 2,640 lines and 120 KB, with all CSS and JS inline and no external dependencies. The filename says "v2", but the content is V4.1 + Stage 1. |
| **Repository** | `github.com/irisxu10/IrisXu` (the artist's portfolio site); branch `prototype/homepage-soft-glass-atmosphere` |
| **Launch** | VS Code Live Server serves the workspace root on port 5501: **`http://127.0.0.1:5501/iris_workz/mdp/one_object_three_encounters_v2.html`**. Opening the file directly from Finder (`file://`) also works (verified). |
| **What is running** | The URL above serves the current single file (verified 2026-11-05). Earlier, the artist's browser was showing the *original V2* at this same path, before consolidation. If the old light sage-green page ever appears, the browser is showing a cached copy: hard-reload. |

### Directory structure (`iris_workz/mdp/`)

```text
one_object_three_encounters_v2.html   ← THE project (edit only this)
PROJECT_HANDOFF.md                     ← this report
one-object-v3/      backup: V3 as ES modules + README + 14-test suite
one-object-v4.0/    backup: V4 before the ice-blue colour pass
one-object-v4/      backup: V4.1 as ES modules + README + 24-test suite + example JSON
                    (all three folders are untracked in git and awaiting deletion approval)
artquest.html, catletter.html, coffee.html, cono.html, exposure.html,
playground.html, thesis_research.html (empty)   ← unrelated portfolio pages
```

**Git state:**

- The **original V2** is committed (`9a361d3`).
- The **consolidated main file is modified but not committed.**
- The backup folders are untracked.
- `material.html` shows as deleted in the working tree. That deletion predates this work and is unrelated.

### Concept and intended experience

The work is a single abstract digital "material" in a dark space. Visitors approach, touch, stretch, brush across it, wait, and return. There is no goal, score or instruction beyond three progressive hints. Repeated contact leaves traces and gradually changes how that region responds.

The design principle: *"The object should not pretend to be alive. It should behave in ways that make us question why we perceive something as alive."*

The research question: *How do repeated sensory encounters shape expectations, interpretations, and ways of interacting with an unfamiliar object?*

The intended experience lasts about 3–5 minutes, followed by an optional reflection.

---

## 2. Current implementation

All code is in the main HTML. The script is organised as labelled sections named after their former source files, for example `/* ===== src/physics/SoftBody.js ===== */`. Each section is wrapped as `const M_<name> = (() => { … })();`.

| Section (line ≈) | Role |
|---|---|
| `src/config.js` (254) | All parameters, presets and slider definitions |
| `src/util/math.js` (366) | Seeded PRNG (mulberry32), smoothstep, ids |
| `src/physics/SoftBody.js` (400) | Soft-body physics |
| `src/behavior/MemorySystem.js` (517) | Behavioural memory |
| `src/behavior/AdaptationSystem.js` (579) | Adaptation from memory |
| `src/behavior/ImmediateResponse.js` (644) | **Stage 1**: proximity and dwell state |
| `src/simulation/Simulation.js` (695) | Orchestrates everything; gestures, logging hooks, state model |
| `src/rendering/FilamentNetwork.js` (1048) | Filament anchors and edges in material coordinates |
| `src/rendering/FilamentRenderer.js` (1291) | Canvas 2D drawing: membrane, folds, filaments |
| `src/interaction/PointerController.js` (1577) | Pointer Events → object coordinates and velocity |
| `src/audio/AudioEngine.js` (1652) | Procedural Web Audio |
| `src/research/SessionLogger.js` (1817) | Event log |
| `src/research/Exporter.js` (1885) | JSON payload and download |
| `src/ui/translations.js` (1954) | All English and Simplified Chinese strings |
| `src/ui/ExhibitionUI.js` (2132) | Hints, INFO, reflection, language, sound button |
| `src/ui/ResearcherPanel.js` (2296) | Researcher Mode |
| `src/main.js` (2480) | Wiring and the frame loop. It runs only when a `#stage` canvas exists, so tests can load the modules headlessly. |

**Units:** the object's base radius is 1 ("object units") and its centre is the origin. Physics runs at a fixed 1/60 s step, with at most 5 catch-up steps per frame. Rendering uses `requestAnimationFrame`.

### 2.1 Visual rendering system — **implemented, verified in headless Chrome**

The renderer is Canvas 2D, with no WebGL. It draws these layers:

- **A · Skeleton.** The soft body. Not drawn.
- **C · Membrane.**
  - A deep-blue body volume, filled with a radial gradient.
  - Four **seeded "fold" sheets**: the body outline reshaped by a low harmonic and slightly offset. They use additive blending, are clipped inside the body, and follow the body's deformation through live and lagged motion fields.
  - A pale outer edge.
- **B · Filament network.** About 530 seeded anchors in material coordinates (angle fraction u, radius fraction s, depth z):
  - a rim band of about 120 anchors,
  - 30 long strands (chords and arcs), drawn as smoothed curves,
  - 7–9 clusters,
  - sparse interior anchors with nearest-neighbour bridges.

  That gives about 860 visible edges plus about 160 "dormant" edges. The default density is 0.7, so **about 600 filaments are drawn**. The network is generated once per seed and never regenerated per frame.
- **D · Tension.** Each edge's strain (`length / rest length − 1`) is computed every frame. Stretched edges lose their curvature and brighten; compressed edges bow more.
- **E · Memory.** In high-memory regions, edges straighten ("align"), brighten slightly, and dormant edges fade in. All of this fades as memory decays.
- **Batching.** Edges are grouped into 3 depth groups × 12 brightness buckets, so a frame issues about 36 strokes. Arrays are preallocated, and the device pixel ratio is capped at 2.
- **Reduced detail.** If the frame rate stays below 40 fps for 2.5 s, drawn density drops to 0.6×.

**Limitation:** interior filaments do not carry physical force. They are a visual mapping of the perimeter soft body's displacement, interpolated and lagged by depth.

### 2.2 Soft-body physics — **implemented, verified (automated)**

- **Structure:** a ring of 80 perimeter nodes. Each stores its displacement from a seeded, slightly irregular rest shape: a base radius of 1 plus cosine harmonics 2, 3 and 5, each of amplitude about 0.6–3.5% of the radius.
- **Forces on each node:**
  - a spring pulling it back toward its rest position (`stiffness`, 0.014 per step),
  - coupling to its two neighbours (`tension`, 0.22), which makes deformation spread,
  - an area-preservation term (`volume`), so pressing one side bulges the other slightly,
  - pointer forces.
- **Integration:** semi-implicit Euler with velocity damping 0.95 per step. Displacement is clamped at 0.36 R.
- **Recovery:** about 1–2 s after release, with a slight elastic overshoot.
- **Ambient motion:** very small (amplitude 0.008), slow, using angular harmonics 2 or higher so there is no global "breathing".
- **Limitation:** the physics is purely 2D and works on the perimeter only. There is no interior mesh, no 3D, and no rotation.

### 2.3 Pointer and gesture interactions

All input uses **Pointer Events** (mouse, touch, pen) in one continuous gesture space, with no modes. The input module smooths pointer velocity.

| Gesture | Mechanism | Status |
|---|---|---|
| **Proximity (perimeter)** | A continuous distance field (`proximityRadius` 0.8) pushes nearby perimeter nodes away from the pointer. The push grows with pointer speed (capped at 3 R/s), plus a small "wake" along the direction of motion. | Implemented, verified (automated) |
| **Proximity (lines, Stage 1)** | Lines within `interactionRadius` 0.45 R of the smoothed pointer ease away (≤ 0.025 R) and brighten (+0.12). The offset is smoothed per anchor and frame-rate independent. Lines outside the radius do not move. | Implemented, verified (automated and headless). **Not yet tested by a human.** |
| **Dwell (Stage 1)** | The pointer stays within 0.12 R for 2.2 s, then the response eases in over 1.5 s: nearby lines are drawn toward the pointer (≤ 0.05 R), brighten (+0.3) and shimmer finely. It fades over 0.6 s after the pointer moves; pressing cancels it. Each dwell is logged when it ends. **Dwell writes no memory.** | Implemented, verified (automated and headless). **Not yet tested by a human.** |
| **Touch / press** | A press within 0.3 R of the edge grabs the nodes around the nearest edge point, weighted by a gaussian of width 0.36 R. A held dent of 0.07 R reads as compression. | Implemented, verified |
| **Stretch / drag** | Grabbed nodes are pulled toward the drag offset; the pull flattens out with `tanh`, giving resistance. Pointer speed adds extra displacement. Neighbouring nodes follow with a delay, and the interior with more delay. On release, stored velocity carries the motion on briefly. | Implemented, verified |
| **Sweep / brush** | Moving faster than 1.4 R/s over the surface without pressing applies a tangential friction force and a brief inward deflection. It also sets an "excitation" field that spreads along the surface and decays (about 0.5 s), driving a fine filament vibration. Logged as `sweep`; it is not a contact. It builds memory at 0.2× the rate of contact. | Implemented, verified |
| **Stillness / recovery** | Motion settles and memory decays (half-life about 14 s). After at least 3 s of stillness, a `recovery` event is logged once the visitor acts again (only if there has been contact before). | Implemented, verified |
| **Click ripple, directional drag traces, autonomous reorganisation** | Planned as Stages 2–4. | **Not implemented** |
| **Multi-touch** | Only the primary pointer is used. | Not implemented |

### 2.4 Behavioural memory and adaptation — **implemented, verified (automated)**

**Memory.** Each node has a level `m ∈ [0, 1]`:

```
m += contactIntensity · learningRate · dt
m *= exp(−decayRate · dt)
```

with `learningRate` 0.35/s and `decayRate` 0.05/s, plus light diffusion to neighbouring nodes. Contact intensity rises with grab weight and deformation; sweeps contribute weakly. Memory also leaves a small **residual shape**, `residual × m × plasticity`, capped at 0.06 R.

**Adaptation.** Each node has an adaptation level that eases toward `smoothstep(T − H, T + 0.1, m)` over a 1.2 s time constant, with threshold T = 0.65 and hysteresis H = 0.2. Then:

```
sensitivity = 1 − 0.72 · (0.3·m + 0.7·adaptLevel)
```

Adapted regions also become **stiffer** (×1 + 1.5·level) and spread contact over a **wider area**.

**Logging.** Region-level hysteresis flags across 12 sectors of 30° produce `adaptation_threshold` and `recovery (region_released)` events.

**Results** (headless Chrome, real drags on one spot, peak displacement):

| Drag | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Peak (R) | 0.243 | 0.234 | 0.196 | 0.175 | 0.162 | 0.143 | 0.127 | 0.112 | 0.099 |

The opposite, untouched region still responds at full strength.

**Limitations:**

- Memory exists only at the perimeter. A press deep in the interior acts on the nearest edge point.
- There is a single memory "type", with no distinction between gestures except the weaker weighting for sweeps.

### 2.5 Sound — **implemented, partially verified**

The engine uses only the Web Audio API.

**Continuous voices**, driven every frame by simulation signals, with all parameter changes smoothed:

- **Stretch:** band-passed noise, plus a very faint 62–92 Hz sine underneath.
- **Friction:** high band-passed noise driven by sweeps.
- **Settle:** low-passed noise, only while meaningful motion remains.

**One-shot sounds**, whose audio nodes are disconnected when they finish, with at most 6 at once:

- **Contact:** a soft, muted tap.
- **Release:** a short downward glide, scaled by stored tension.

**Safety and control:**

- The output passes through a compressor before the speakers.
- Sound is off by default and starts only on a click of SOUND.
- It suspends when the tab is hidden, and muting suspends it too.

**Verified (headless):** the audio context's on/off and suspend behaviour, and a peak output of 0.06 of full scale (no clipping).

**Unverified:** how it actually sounds, its loudness on real speakers, and iOS Safari's audio unlock.

### 2.6 Stable vs Adaptive conditions — **implemented, verified (automated)**

- **Preset A, `A_stable`:** memory and adaptation both off.
- **Preset B, `B_adaptive`:** both on. This is the default.

Applying a preset or a seed **starts a new session**. Changing a behaviour slider labels the condition `…+custom`. Visual-only sliders are logged with `scope: "visual"` and **do not** change the condition label.

The same seed and the same per-step input produce identical state; this is tested.

### 2.7 Researcher Mode — **implemented, verified (headless)**

Open it with **Shift + R**, or through **INFO → "Researcher mode"**. That INFO button is visible to participants (see §5).

It contains:

- Presets A and B, a seed field, and live state flags (`CONTACT / SWEEP / DWELL / ADAPTATION / RECOVERY / EXPLORATION / APPROACH / IDLE`).
- Statistics: elapsed time, contacts, revisits, adapted regions, sweeps, dwells, max memory, event count, fps and audio peak.
- A memory/adaptation **heatmap** ring.
- Reset experiment and export.

**Behaviour sliders:**

| Parameter | Default |
|---|---|
| responsiveness | 1 |
| stiffness | 0.014 |
| damping | 0.95 |
| learningRate | 0.35 |
| decayRate | 0.05 |
| adaptationStrength | 0.72 |
| adaptationThreshold | 0.65 |
| interactionRadius | 0.45 |
| proximityResponse | 0.025 |
| dwellDelay | 2.2 s |
| dwellAttraction | 0.05 |

The toggles are memoryEnabled and adaptiveEnabled.

**Visual sliders:**

| Parameter | Default |
|---|---|
| filamentDensity | 0.7 |
| membraneOpacity | 1 |
| structuralContrast | 1 |
| tensionHighlight | 1 |
| visualMemory | 1 |

Plus a lowDetail toggle.

Everything else is code-only, in the config section. That includes the sweep parameters, `proximityGlow`, `responseRate`, `dwellRadius`, `dwellRamp`, `dwellRelease`, `dwellGlow` and `dwellActivity`.

### 2.8 Session logging and JSON export — **implemented, verified**

Logging is in memory only. Nothing is written to `localStorage` and nothing is sent to a network.

**Event types:**

| Event | When it is logged |
|---|---|
| `session_start` | At the start of every session |
| `approach` | With hysteresis, at most once every 1.5 s |
| `contact_start` | On every press (records region, distance, speed, memory, and the position in object units) |
| `contact_end` | On release |
| `drag` | About every 400 ms during a drag |
| `region_revisit` | When a previously contacted region is touched again |
| `adaptation_threshold` | When a region becomes adapted |
| `recovery` | Either `stillness` or `region_released` |
| `parameter_change` | Researcher changes (behaviour or visual scope) |
| `reflection` | When the reflection is saved or skipped |
| `sweep` | When a sweep ends |
| `sound_toggle` | When sound is switched on or off |
| `dwell` | When a dwell ends |
| `session_end` | Added at export |

The timestamps use the **simulation clock**, which pauses while the tab is hidden.

**Export** (schema v2) is a JSON download triggered from Researcher Mode. It contains the session id, start and export times, duration, condition, seed, all behaviour and visual parameters, the events, the reflection answers, and a method note. The summary has totals for contact, interaction, episodes, drag distance, revisits, adaptation events and recoveries, stillness periods, sweeps, dwells, sound toggles, parameter changes, mean final memory and dropped events.

A 20-second continuous drag produces about 50 events, not 1,200.

### 2.9 Bilingual interface and reflection — **implemented, verified**

- **Languages:** English and Simplified Chinese, from one dictionary. Switching language keeps the object state and the session (verified).
- **Hints**, each shown once, conditionally, and faded out:
  - `MOVE CLOSER.` — at the start.
  - `TRY TOUCHING.` — after being near for 2.5 s without contact.
  - `WHAT HAPPENS IF YOU WAIT?` — after at least 3 contacts followed by 2 s of stillness.
- **FINISH** opens an optional reflection with SKIP and SAVE. It does **not** end the session or export.
- **Reflection questions** (neutral wording):
  1. What did you notice changing during the encounter?
  2. Did you begin to expect certain responses?
  3. Did anything respond differently than you expected?
  4. Did you change how you interacted with it? Why?
  5. How would you describe the object now?
- **INFO** contains the interaction description, an honest accessibility statement, a sound note, a local-recording disclosure, "The form is a programmed simulation", and the researcher entry button.

---

## 3. Current visual design

- **Background:** `#05070B`, across the page, panels and Researcher Mode.
- **Text:** `#F4F9FF` for primary text, `#A8C0D4` for secondary; system font stack (Inter if installed).
- **Material palette:** `#182C40` deep, `#75BDE8` main, `#C7E9FF` pale, `#F4F9FF` highlights.
- **Object:** about 45% of the viewport width on desktop, about 72% on phones, centred. A translucent deep-blue disc with pale folded sheets inside and about 600 fine pale-blue filaments.
- **Interface:** title top-left; SOUND, INFO and EN / 中文 top-right; one hint bottom-left; FINISH (dim) and RESET bottom-right. The interface fades in about 1.2 s after load.
- **Filament and membrane systems:** **both implemented** (§2.1).

**Intended versus actual.** The artist has twice referred to visual reference images, but **none have reached the implementing agent**. The look is built only from the text brief: *"fine white filaments, dense interconnected structures, translucent overlapping surfaces, organic folds, soft spatial depth, icy blue / translucent white, folded membrane floating in darkness."* The match to the actual references is unknown.

**Why it may still look flat, circular, or not material enough:**

1. **The outline is essentially a circle.** The rest shape varies by only about 2–3% of the radius, and at rest nothing breaks the silhouette.
2. **Everything is 2D.** There is no rotation, perspective or lighting. Depth is faked only by line width and alpha per depth group, plus a parallax of about 0.012 R. There is no shading by surface normal.
3. **The fold sheets are offset copies of the outline**, not real folds. They never overlap themselves or turn back.
4. **Interior structure is driven only by the perimeter**, so the inside moves like a scaled-down copy of the edge. There is no local crumpling or interior collapse.
5. **The body fill is uniform** (a radial gradient), which reads as a disc. A real translucent membrane would show thickness changes and brighter fold edges.
6. **The filament mix is heterogeneous but sparse.** It reads as "lines on a disc" rather than as a dense woven material in which lines carry the form.
7. **There is no motion at rest beyond 0.8% ambient.** A still object can read as a static image.

---

## 4. Interaction and research logic

```
human action ──▶ object response ──▶ behavioural memory ──▶ adaptation ──▶ (changed) object response ──▶ human response?
 (pointer)      (physics, lines,      (per-node m, decays)    (sensitivity ↓,        (observable:            (NOT measured
                 sound; immediate)                             stiffer, wider)        smaller/broader)        directly)
```

**What the code measures** (observed behaviour):

- Pointer events and derived kinematics: approaches, contacts with region, duration, drag distance and speed, revisits, sweeps, dwells, stillness periods.
- Parameter changes, sound toggles, and the timing of all of these.

**What the system simulates** (programmed behaviour):

- The physics, memory, adaptation and immediate responses described above.
- These are deterministic for a given seed and input sequence. **None of them are perceptions or intentions of the object.**

**What we hope to investigate** (design hypotheses, through observation and reflection):

- Whether participants form expectations.
- Whether they notice changed responses, and whether they change how they interact (for example moving to another region, slowing down, waiting).
- How they describe the object, and whether stable and adaptive conditions differ in these respects.

**What cannot be concluded from this data:**

- Expectation, attention, emotion, attachment or "reinterpretation". These are not measured.
- Causality between conditions without a proper design (randomisation, adequate sample size, control of order effects and confounds such as sound on or off).
- Any claim about biological realism or object agency.

Hesitation, revisits and dwells are behaviours, not evidence of uncertainty or curiosity. Reflection answers are self-reports, which can be shaped by the questions themselves.

---

## 5. Current problems and limitations

### Known bugs and risks (verified by reading the code)

1. **Participant RESET erases the research log.** The bottom-right RESET button calls `startSession()`, which clears all events and any saved reflection. If a participant presses it before the researcher exports, that data is lost. This is the highest-priority issue.
2. **Session data is lost on reload or close**, by design (privacy). There is no autosave. The researcher must export before closing the tab.
3. **Researcher Mode is reachable by participants** through the visible INFO → "Researcher mode" button. Shift + R is undocumented except in INFO.
4. **The version is not distinguishable.** `APP_VERSION` is still 4.1.0 after the Stage 1 changes, and export filenames say `encounter-v4-…`.
5. **The README is stale.** The detailed README (`one-object-v4/README.md`, in a backup folder) does not describe Stage 1.
6. **Tests live outside the main project.** The 24-test suite in `one-object-v4/` tests the *backup* module copy. The suite that tests the actual main file, including 5 Stage-1 tests, lives in a temporary scratch folder outside the repository.
7. **Hint overlap.** `TRY TOUCHING.` can appear while a visitor dwells, because no contact has happened yet. This is minor, but it may nudge participants away from waiting.

### Unfinished features

- Stage 2 (click ripple plus a persistent trace), Stage 3 (directional drag traces that persist), Stage 4 (autonomous reorganisation after about 5 s idle). None are implemented.
- Multi-touch, keyboard-accessible interaction, and a consent or onboarding screen.

### Visual weaknesses

See §3: circular silhouette, flat 2D look, sheet "folds" that are only offset copies, uniform disc fill, and an interior that moves only as a copy of the edge.

### Interaction weaknesses

- **Touch devices get no hover or dwell.** A finger is only "present" while pressing.
- **A sweep acts by angle**, so a sweep through the centre excites the sectors it crosses rather than the exact point.
- **Memory is perimeter-only and coarse** (80 nodes). Logging uses 12 regions.
- **The adaptation result is subtle.** Peak response drops by about 60% over 9 strong drags. Whether people *notice* this is untested.
- **Dwell and proximity effects are small by design** (offsets of 0.025–0.05 R). They may be too subtle on a projector.

### Performance concerns

- Measured only in headless Chrome on a MacBook: about 60 fps. The draw-time measurement (about 0.1 ms) is unreliable, because canvas drawing is deferred to the GPU.
- Not tested on low-end laptops, Windows, tablets or phones on real hardware. The auto-detail fallback has not been seen to trigger on a real device.

### Research-design limitations

- Sound on or off is chosen by the participant, which confounds condition comparisons.
- There is no counterbalancing or randomisation; conditions are chosen manually by the researcher.
- Pointer data is recorded only at events, not as a continuous stream, so it cannot be replayed exactly.
- The simulation clock pauses when the tab is hidden, so the recorded duration is not always wall-clock time.

### Needs manual testing

- Feel and tactility, the noticeability of memory, the Stage 1 hover and dwell feel, and sound quality and loudness.
- iOS Safari, Android, pen input, low-power devices, projector contrast, the OS reduced-motion setting, and screen readers.

---

## 6. Testing and verification

### Automated (Node test runner, re-run 2026-11-05)

| Suite | Code under test | Result |
|---|---|---|
| Harness on the **main HTML** (24 existing + 5 Stage-1 tests) | Inline script extracted from the main file | **29 of 29 pass** |
| `one-object-v4/` `npm test` | Backup module copy | 24 of 24 pass |

The tests cover:

- **First contact:** elasticity, delayed recovery, return to rest within about 3 s.
- **Repeated contact:** adapts, and gradually (no jump in sensitivity per step).
- **Untouched regions** keep their initial response within 10%.
- **Recovery** after rest.
- **Conditions:** stable is consistent within 3%; adaptive decreases.
- **Determinism, reset and export validity.**
- **Throttling:** logging is throttled.
- **Proximity** responds before contact.
- **Stability:** 5 minutes of aggressive input stays bounded.
- **Conditions:** no adaptation happens without contact.
- **Translations:** English/Chinese key parity.
- **Filaments:** they follow deformation, and the interior lags.
- **Sweeps:** distinct from drags; slow movement is not a sweep.
- **Visual memory:** appears only in the contacted region and fades; none in the stable preset.
- **Audio hooks:** bounded strength.
- **Export v2:** includes visual parameters and sweep totals.
- **Stage 1:**
  - proximity is local and smooth, with no memory written;
  - dwell starts at about 2–3 s, draws lines in, fades and is logged;
  - moving around never triggers dwell, and pressing cancels it;
  - Reset clears the state;
  - 10 minutes of hovering keeps fixed-size arrays and a compact log.

### Headless Chrome (real pointer and touch events), on the Live Server URL and on `file://`

- **Loading:** the page loads only the HTML file itself, with no other requests and **no console errors**. The background and text colours are as specified.
- **Participant view:** shows only the title, SOUND, INFO, EN / 中文, the hint, FINISH and RESET.
- **Drags:** real drags adapt (0.243 → 0.099), and the opposite region stays at 0.221. Sweeps are logged.
- **Sound:** the SOUND click starts audio; hide and mute both suspend it; peak 0.06.
- **Other features:** language switching keeps the session; a visual-only change keeps the condition `B_adaptive`; the export downloads valid schema-v2 JSON including the dwell fields; reset clears the state.
- **Dwell timeline:** 0 at 1.9 s, 0.43 at 2.9 s, 1.0 at 4.7 s, back to 0.05 1.5 s after moving away.
- **Frame rate:** about 60 fps.
- **Phone layout:** a 390 px touch viewport drags without page scroll, and the nav stays on one line in both languages.

### Not verified

Anything perceptual (look, feel, sound), any real device other than headless Chrome, and any human participant.

### Ready for a small classroom critique?

**Yes, as a demonstration**, on desktop Chrome with a mouse or trackpad:

1. Check the sound level beforehand.
2. Tell people not to press RESET, or accept that data may be lost.
3. If data matters, export from Researcher Mode before closing the tab.

**Not yet ready for data collection.** Issue 1 in §5, versioning, consent, and the condition and sound assignment need to be resolved first.

---

## 7. Next development priorities (ranked)

**1. Research-data integrity.**

- *Why:* research value is highest and effort is low. Without this, collected data can be silently lost or mislabelled.
- *What:*
  - Separate a participant "reset object" from "new session" (researcher only).
  - Optionally confirm before clearing data.
  - Hide the researcher entry from INFO, or move it behind a long-press or URL parameter.
  - Stamp a build id or version (for example 4.2.0) into exports.
  - Optionally offer an "export before closing" prompt in Researcher Mode.
- *Where:* `src/main.js` (`startSession`, `onReset`), `src/ui/ExhibitionUI.js`, `src/config.js` (`APP_VERSION`), `src/research/Exporter.js`, `src/ui/translations.js`, and the INFO markup in the HTML body.

**2. Stages 2–3: click ripple and directional drag traces that persist into memory.**

- *Why:* both research value and participant experience. This makes "the object remembers the encounter" visible and attributable to specific gestures, and gives a clear first-contact moment.
- *What:*
  - A propagating ripple through the filament network, using the existing excitation field idea extended to interior anchors.
  - A small persistent structural change at the click point.
  - Drag direction and speed recorded into per-anchor alignment memory, so traces show the direction of the drag.
- *Where:* `Simulation.js` (`tryGrab` and `release`, distinguishing click from drag), `MemorySystem.js` (directional component), `FilamentNetwork.js` (per-anchor persistent offsets and alignment), `FilamentRenderer.js`, `config.js`.

**3. Material depth and breaking the circle (visual).**

- *Why:* participant experience. This addresses the "flat disc" reading.
- *What:*
  - A more irregular, seeded silhouette.
  - True folds (self-overlapping sheet paths with brighter fold edges).
  - Lighting from a pseudo-normal, so thickness and brightness vary.
  - A slow drift of depth layers, or a small rotation of the anchor z-field.
  - Denser fine strands at lower alpha.
  - Optionally, an interior spring mesh so the inside deforms locally.
- *Where:* `SoftBody.js` (`init` rest shape; an interior mesh would be a new section), `FilamentNetwork.js`, `FilamentRenderer.js`.

**4. Stage 4: autonomy, as an explicit, logged experimental factor.**

- *Why:* it serves the design principle ("behaviour beyond direct control"), but it is a *new confound*. It must be switchable, logged, and ideally its own condition.
- *What:* after about 5 s idle, slow self-directed redistribution of memory and residual shape. This should be seeded and bounded, interruptible by input, and logged as its own events.
- *Where:* a new `src/behavior/Autonomy.js` section, plus `Simulation.js`, `config.js`, `ResearcherPanel.js` and `SessionLogger.js`.

**5. Verification infrastructure and real-device testing.**

- *What:* move the main-file test harness into `mdp/tests/`, update the README to cover Stage 1, and run sessions on the critique laptop, the projector, an iPad and a phone.
- *Where:* new `mdp/tests/`, and the README (move it into `mdp/` before the backups are deleted).

---

## 8. Questions for the creative director

1. **Reference images.** Can they be shared as files? What should be matched: silhouette, density, colour, sense of depth, motion?
2. **Silhouette.** Should the object stay roughly spherical (a "sphere" was mentioned) or become more irregular, folded, or asymmetric?
3. **Autonomy and research design.** Should autonomy be on in both conditions, only in the adaptive condition, or a third condition C? How autonomous may it look before it reads as "alive" in the sense the work wants to avoid?
4. **What memory should look like.** Is the intended trace *directional* (combed fibres), *densifying*, *thinning*, *displaced*, or a combination? Should click traces and drag traces be visually distinct?
5. **Click versus press.** Should a quick click be a separate gesture from press-and-hold or drag? (Currently a click is just a very short contact.)
6. **Subtlety threshold.** How noticeable should adaptation and dwell be? What counts as "discovered rather than announced" in practice?
7. **Sound in the study.** Should it be on for everyone, off for everyone, or assigned as a condition, rather than chosen by the participant? Is headphone use expected?
8. **Hints.** Keep all three? Should `TRY TOUCHING.` be suppressed while someone is dwelling?
9. **Protocol.** Who operates Researcher Mode? Is there a consent step? How are conditions assigned: random, alternating, or within-subject with order counterbalanced?
10. **Visible version and RESET.** Should participants have RESET at all, or only the researcher?
11. **Reflection timing.** Immediately after FINISH, or as a separate interview? Should the questions differ between conditions? (They are currently identical, which is good for comparison.)

---

## 9. Files to share

1. **`iris_workz/mdp/one_object_three_encounters_v2.html`**: the entire prototype. Key sections, in reading order:
   - `src/config.js` (all parameters),
   - `src/simulation/Simulation.js` (behavioural core),
   - `src/behavior/MemorySystem.js`, `AdaptationSystem.js` and `ImmediateResponse.js`,
   - `src/rendering/FilamentNetwork.js` and `FilamentRenderer.js`,
   - `src/research/SessionLogger.js` and `Exporter.js`,
   - `src/ui/translations.js` (all participant-facing text).
2. **`iris_workz/mdp/PROJECT_HANDOFF.md`**: this report.
3. **`iris_workz/mdp/one-object-v4/README.md`**: detailed V4 and V4.1 architecture, parameter tables and changelog. It does not cover Stage 1.
4. **`iris_workz/mdp/one-object-v4/examples/session-example.json`**: a real example export (schema v2; generated before Stage 1, so it has no dwell fields).
5. Optionally, **`iris_workz/mdp/one-object-v3/README.md`**: V3 rationale, the original physics and memory derivations, and the V2 → V3 changelog.

*The headless-Chrome screenshots referenced during development are in a temporary scratch folder and are not part of the repository. Fresh screenshots should be taken from the live URL if needed.*
