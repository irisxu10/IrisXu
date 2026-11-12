// Procedural, interaction-driven sound (Web Audio API). No music, no samples.
//
//   continuous voices (always connected while enabled, gains driven by simulation):
//     stretch  — band-passed noise; level ∝ tension × deformation motion, pitch ∝ tension
//     friction — high band-passed noise; level ∝ sweep excitation
//     settle   — low-passed noise; level ∝ residual motion after release
//   one-shots (created per event, disconnected when finished):
//     contact  — soft muted tap (low-passed noise burst + low sine)
//     release  — short downward-gliding band-passed noise, scaled by stored tension
//
// Signal chain: voices → master gain → compressor (soft safety limiter) → analyser → out.
// The context is created only on an explicit user gesture and suspended when hidden.

const SMOOTH = 0.06;        // s, time constant for all parameter changes
const MASTER = 0.55;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.voices = null;
    this.activeOneShots = 0;
    this.peak = 0;
  }

  get supported() { return typeof (globalThis.AudioContext || globalThis.webkitAudioContext) === 'function'; }

  /** Must be called from a user gesture handler. */
  async enable() {
    if (!this.supported) return false;
    if (!this.ctx) this.init();
    await this.ctx.resume();
    this.enabled = true;
    this.master.gain.setTargetAtTime(MASTER, this.ctx.currentTime, 0.15); // gentle fade-in
    return true;
  }

  disable() {
    this.enabled = false;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.05);
    for (const v of Object.values(this.voices)) v.gain.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => { if (!this.enabled && this.ctx?.state === 'running') this.ctx.suspend(); }, 400);
  }

  /** Page hidden → suspend; visible → resume only if the participant had sound on. */
  setHidden(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend();
    else if (this.enabled) this.ctx.resume();
  }

  init() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.noise = this.makeNoise(2);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6;
    comp.attack.value = 0.005; comp.release.value = 0.2;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.scope = new Float32Array(this.analyser.fftSize);
    this.master.connect(comp).connect(this.analyser).connect(ctx.destination);

    const voice = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      src.loopStart = 0; src.loopEnd = this.noise.duration;
      const filter = ctx.createBiquadFilter();
      filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master);
      src.start(0, Math.random() * this.noise.duration);
      return { src, filter, gain };
    };
    this.voices = {
      stretch: voice('bandpass', 500, 6),
      friction: voice('bandpass', 3200, 1.4),
      settle: voice('lowpass', 260, 0.7),
    };
    // a faint resonant partial under the stretch texture
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 68;
    const og = ctx.createGain(); og.gain.value = 0;
    osc.connect(og).connect(this.master); osc.start();
    this.voices.tone = { src: osc, filter: null, gain: og };
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 3; } // slightly darkened white noise
    return buf;
  }

  /** Per frame. signals: { tension, motion, sweep, kinetic }, grabbing: bool */
  update(signals, grabbing) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime, v = this.voices;
    const tension = signals.tension, motion = signals.motion;
    const stretch = grabbing ? Math.min(1, tension * (0.25 + motion * 1.6)) : 0;
    v.stretch.gain.gain.setTargetAtTime(stretch * 0.32, t, SMOOTH);
    v.stretch.filter.frequency.setTargetAtTime(380 + tension * 1300 + motion * 400, t, SMOOTH);
    v.tone.gain.gain.setTargetAtTime(grabbing ? tension * 0.05 : 0, t, 0.12);
    v.tone.src.frequency.setTargetAtTime(62 + tension * 30, t, 0.12);
    v.friction.gain.gain.setTargetAtTime(Math.min(1, signals.sweep) * 0.22, t, 0.04);
    v.friction.filter.frequency.setTargetAtTime(2400 + signals.sweep * 2200, t, SMOOTH);
    const settle = !grabbing && motion > 0.04 ? Math.min(1, (motion - 0.04) * 1.5) : 0;
    v.settle.gain.gain.setTargetAtTime(settle * 0.2, t, 0.15);
    // peak meter (for researcher readout / clipping checks)
    this.analyser.getFloatTimeDomainData(this.scope);
    let pk = 0;
    for (let i = 0; i < this.scope.length; i++) { const a = Math.abs(this.scope[i]); if (a > pk) pk = a; }
    this.peak = Math.max(pk, this.peak * 0.95);
  }

  oneShot(build, duration) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running' || this.activeOneShots > 6) return;
    this.activeOneShots++;
    const nodes = build(this.ctx, this.ctx.currentTime);
    const first = nodes[0];
    first.onended = () => { for (const n of nodes) n.disconnect(); this.activeOneShots--; };
    first.stop(this.ctx.currentTime + duration);
  }

  contact(strength = 0.5) {
    this.oneShot((ctx, t) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + strength * 500; lp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * strength, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.12);
      const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.08 * strength, t + 0.008); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      src.connect(lp).connect(g).connect(this.master);
      osc.connect(og).connect(this.master);
      src.start(t, Math.random() * 1.5); osc.start(t); osc.stop(t + 0.2);
      return [src, lp, g, osc, og];
    }, 0.2);
  }

  release(tension = 0.5) {
    if (tension < 0.08) return;
    const dur = 0.18 + tension * 0.35;
    this.oneShot((ctx, t) => {
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 4;
      bp.frequency.setValueAtTime(600 + tension * 1400, t); bp.frequency.exponentialRampToValueAtTime(180, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28 * tension, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      src.connect(bp).connect(g).connect(this.master);
      src.start(t, Math.random() * 1.2);
      return [src, bp, g];
    }, dur + 0.05);
  }
}
