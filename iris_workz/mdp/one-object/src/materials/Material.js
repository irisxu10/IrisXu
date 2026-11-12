// Material contract. Every condition (01–04) implements this interface; the
// app only ever talks to the active material through it, so switching
// conditions can never leave a second simulation running.
//
//   initialize()               allocate state, take over the canvas
//   update(dt)                 advance by dt seconds (frame-rate independent)
//   render(pointer)            draw the current state to the shared canvas
//   handlePointerInput(input)  receive the shared pointer state (object units)
//   reset()                    return to this material's initial state
//   resize()                   canvas size changed
//   getResearchState()         live values for Researcher Mode (plain object)
//   hintSource()               { proximity, totals: { contactEpisodes }, grab, stillMs } for the hint system
//   audioSignals()             { tension, motion, sweep, kinetic } or null (no sound)
//   isGrabbing()               true while a contact is held
//   clockMs()                  this encounter's clock (ms)
//   buildEncounterPayload(o)   schema-v2 session object for export
//   dispose()                  release everything; the instance is unusable afterwards
//
// Materials must not add DOM event listeners: input arrives via handlePointerInput,
// and the app owns the canvas, pointer controller, audio engine and logger.

export class Material {
  static live = 0;               // number of initialized, undisposed materials (should be 0 or 1)

  /**
   * ctx: { canvas, logger, audio, seed, params, visual, reducedMotion }
   * def: { id, key } from the registry
   */
  constructor(def, ctx) {
    this.id = def.id;
    this.key = def.key;
    this.ctx = ctx;
    this.initialized = false;
    this.disposed = false;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    Material.live++;
  }

  update(_dt) {}
  render(_pointer) {}
  handlePointerInput(_input) {}
  reset() {}
  resize() {}
  setReducedMotion(_on) {}
  getResearchState() { return {}; }
  hintSource() { return { proximity: 0, totals: { contactEpisodes: 0 }, grab: null, stillMs: 0 }; }
  audioSignals() { return null; }
  isGrabbing() { return false; }
  clockMs() { return 0; }
  buildEncounterPayload(_opts) { return null; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.initialized) Material.live--;
    this.ctx = null;
  }
}
