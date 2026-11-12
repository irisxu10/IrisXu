# Research protocol — ONE OBJECT / MANY ENCOUNTERS (V5)

How to run a participant session with the prototype, what is recorded, and what the data can and cannot support. This covers version **5.0.0-beta.1**.

The prototype offers **four material conditions**. They share one initial form and differ in how they respond:

| ID | Researcher name | Primary behaviour |
|---|---|---|
| 01 | Structural / Memory | local adaptation and memory |
| 02 | Gel / Flow | viscous flow and pressure redistribution |
| 03 | Plastic / Crease | folding and persistent creases |
| 04 | Silicone / Elasticity | elastic stretching and recovery |

Participants see only the numbers **01–04**. Material names appear only in Researcher Mode and in the export.

---

## 1. Before the session

1. Serve the page over HTTP and open it in the browser the participant will use. See README → *Launch*.
2. Press **Shift + R** to open Researcher Mode. Under **Encounter conditions**:
   - **Condition order:** enter an order such as `03, 01, 04, 02`, or press **Shuffle**. Use a counterbalancing scheme that suits your design.
   - **Lock order for participants:** when checked, participants can choose only the current condition and the next one in the order.
   - **Seed:** leave it unchanged unless your design calls for it. The seed changes the shared outline for all four conditions.
3. Under **Research data**, press **New participant session**. This creates a fresh random anonymous ID and an empty timeline, notes and reflection. Write that ID on your paper consent records if you need to link them; never type identifying details into the page.
4. Check sound. It is off by default, and participants may turn it on with SOUND. Decide in advance whether you will mention it.
5. Close Researcher Mode (Esc). The first condition in the order is now active.

**Material parameters.** Use **Material properties** and **Behaviour & memory**. Keep them at their defaults unless a parameter manipulation is part of the design. Every change is logged with time, old value and new value, and appears in the export.

## 2. Neutral instructions to participants

Suggested script, kept deliberately neutral:

> "On the screen there is an object. You can explore it with the mouse (or your finger) in any way you like, for as long as you like. There is no task and no right or wrong way. The numbers on the left show different encounters; you can move between them [in the order shown]. When you are finished, press FINISH."

Avoid:

- **Naming the materials**, or saying "gel", "plastic", "elastic" and similar.
- **Explaining what the objects do or how they are simulated** before the interaction.
- **Describing the objects as alive, learning, feeling, remembering, intelligent or responsive "to you".** The interface text follows the same rule; an automated test checks it.

The on-screen hints ("MOVE CLOSER.", "TRY TOUCHING.", "WHAT HAPPENS IF YOU WAIT?") appear only when the participant has not yet approached or touched the object, and each appears once per encounter.

## 3. During the session

- **Order.** The participant moves between conditions with the number selector. If the order is locked, the conditions not yet allowed are greyed out.
- **RESET.** The participant (or you, from Researcher Mode → *Reset current condition*) can restart the active condition. Each reset is logged and starts a new encounter record. **Every encounter starts from the same initial form.** Conditions do not carry state across switches. For example, Plastic creases do not survive leaving 03 and coming back.
- **Notes.** In Researcher Mode → **Research data → Participant notes**, record observations of behaviour, such as "paused 10 s before first contact" or "returned to 03 twice". Notes are timestamped and tagged with the active condition. **Do not enter names, initials, ages or other identifying details.**
- **Live view.** Researcher Mode shows:
  - the current behavioural state;
  - live metrics (contacts, deformation, folds and creases, stretch);
  - the interaction log of the current encounter;
  - the session timeline.

  It is easiest to keep it closed while the participant interacts and check it afterwards.

## 4. After the experience: optional reflection

FINISH opens five optional questions. The participant may answer any of them or skip all of them.

1. What did you notice about each object?
2. Did you expect any of them to behave differently?
3. Did you change how you interacted with any object?
4. What did the objects remind you of?
5. Was there anything you found difficult to understand?

The questions are deliberately neutral. They do not ask about life, intelligence, agency or memory. Answers are stored once for the whole session, together with the question wording and the interface language. If you follow up verbally, keep to the same neutral framing.

## 5. Export (do not skip)

Data lives **only in this browser tab**. Before closing the tab or starting a new participant session, go to Researcher Mode → **Research data → Export research session (.json)**. The file is named `research-session-<first 8 characters of the anonymous ID>.json`.

### What the export contains

| Field | Content |
|---|---|
| `participant.anonymousSessionId` | random ID, also `researchSessionId` |
| `conditionOrder`, `orderLocked`, `orderLog` | configured order and every change to it |
| `conditionSequence` | the conditions in the order actually encountered |
| `timeline[]` | session-level events with ISO time and `tMs` since the session started: `session_start`, `encounter_start`, `condition_switch` (from → to), `reset`, `order_change`, `order_lock`, `parameter_change`, `sound_toggle`, `language_change`, `note`, `reflection`, `export` |
| `encounters[]` | one record per encounter: condition, material, order position, start and end reason, and a full schema-v2 payload |
| `encounters[].payload.events[]` | pointer gesture events with `timestampMs` on that encounter's clock: `approach`, `contact_start`, `drag`, `contact_end` (with `durationMs`), `region_revisit`, `recovery`, `fold`, `reset`, `parameter_change`, `sound_toggle`, … |
| `encounters[].payload.summary` | totals: contact time, contact episodes, drag distance, revisits. Each material adds its own deformation metrics (below). |
| `parameterSettings` | every researcher setting in force at export: seed, condition 01 preset, behaviour and display settings, and the Gel, Plastic and Silicone parameters |
| `materials` | the researcher-facing names of 01–04 |
| `notes[]`, `reflection` | researcher notes and the optional reflection |

### Deformation metrics per material

All metrics are derived directly from the simulation.

| Condition | Logged |
|---|---|
| 01 Structural | displacement, memory level, adaptation threshold events, region recoveries, sweeps, dwells |
| 02 Gel | interior position, local compression, internal displacement, pressure propagation, peak deformation and redistribution, recovery duration |
| 03 Plastic | `fold` (mode `edge` / `ridge`, drag direction, flap fraction, time to yield); `contact_end` outcome (`edge` / `ridge` / `resisted` / `no_yield`), peak fold angle, fold distance; spring-back duration, residual angle, crease count and length, projected area, mean tilt |
| 04 Silicone | stretch distance and duration, peak deformation, peak strain, release velocity, recovery duration, overshoot count |

## 6. Privacy and interpretation

- **Nothing identifying is collected:**
  - no names, emails, IP addresses or device identifiers;
  - no camera, microphone or location;
  - nothing is sent over the network.

  An automated test checks the export for identifying field names.
- **The logs describe pointer behaviour and simulated material state only.** They do not measure emotion, expectation, attention or interpretation.
- **Do not infer psychological states from the numbers.** For example, long contact time does not mean "engagement", and repeated return does not mean "attachment". Interpretation should come from the participant's own words (the reflection, interviews) read alongside the behaviour record.
- **The objects are programmed simulations.** Their behaviour is deterministic for a given seed and input, and Plastic and Structural keep only geometric or behavioural state, never anything about the person.

## 7. Pre-session checklist (manual)

- [ ] The page loads with the correct version in Researcher Mode export (`appVersion`).
- [ ] All four conditions respond on the actual device (mouse and/or touch).
- [ ] Sound is audible at a comfortable level if it will be used.
- [ ] The order is set and, if intended, locked.
- [ ] **New participant session** has been pressed, and the previous participant was exported.
- [ ] A test export opens and contains the expected encounters.
- [ ] The device's browser is not in private mode with downloads blocked.
