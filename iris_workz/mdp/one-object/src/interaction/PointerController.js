// Unified Pointer Events input (mouse, touch, pen). Converts to object units
// and keeps a smoothed velocity (object units / second). No modes.

export class PointerController {
  constructor(canvas, toObject) {
    this.canvas = canvas;
    this.toObject = toObject;
    this.state = { present: false, x: 0, y: 0, vx: 0, vy: 0, down: false, type: 'mouse' };
    this.lastT = 0;
    this.pointerId = null;
    this.handlers = {
      pointerdown: (e) => this.onDown(e),
      pointermove: (e) => this.onMove(e),
      pointerup: (e) => this.onUp(e),
      pointercancel: (e) => this.onUp(e),
      pointerleave: (e) => this.onLeave(e),
      contextmenu: (e) => e.preventDefault(),
    };
    for (const [k, fn] of Object.entries(this.handlers)) canvas.addEventListener(k, fn);
  }

  sample(e) {
    const p = this.toObject(e.clientX, e.clientY);
    const t = e.timeStamp || performance.now();
    const dt = Math.max(1, t - this.lastT) / 1000;
    if (this.state.present && dt < 0.2) {
      const a = 0.35;
      this.state.vx += ((p.x - this.state.x) / dt - this.state.vx) * a;
      this.state.vy += ((p.y - this.state.y) / dt - this.state.vy) * a;
    } else { this.state.vx = 0; this.state.vy = 0; }
    this.state.x = p.x; this.state.y = p.y;
    this.state.type = e.pointerType || 'mouse';
    this.state.present = true;
    this.lastT = t;
  }

  onDown(e) {
    if (!e.isPrimary) return;
    this.sample(e);
    this.state.down = true;
    this.pointerId = e.pointerId;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  }

  onMove(e) {
    if (!e.isPrimary) return;
    if (e.pointerType === 'touch' && !this.state.down) return;
    this.sample(e);
  }

  onUp(e) {
    if (!e.isPrimary) return;
    this.state.down = false;
    if (e.pointerType === 'touch') { this.state.present = false; this.state.vx = this.state.vy = 0; }
  }

  onLeave(e) {
    if (!e.isPrimary || this.state.down) return;
    this.state.present = false;
    this.state.vx = this.state.vy = 0;
  }

  /** Call once per frame: velocity decays when the pointer stops sending moves. */
  update(now) {
    if (now - this.lastT > 50) { this.state.vx *= 0.7; this.state.vy *= 0.7; }
  }

  destroy() { for (const [k, fn] of Object.entries(this.handlers)) this.canvas.removeEventListener(k, fn); }
}
