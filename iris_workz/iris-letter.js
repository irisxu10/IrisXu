// IrisLetter — one falling, physically simulated glyph for the homepage
// canvas hero ("I R I S"). This file defines only the letter actor: its
// Matter.js body, its settle detection, and how it draws itself.
//
// It intentionally contains no homepage archive data/rendering (that's
// home.js / project-data.js) and no ball-specific behavior (that's
// ball.js). Spawn sequencing, timers, and the letters[] array live in
// sketch.js, which orchestrates this class the same way it orchestrates
// Ball.

const IRIS_LETTER_SETTLE_WINDOW_MS = 900;   // within the requested 700-1200ms range
const IRIS_LETTER_SETTLE_THRESHOLD_PX = 6;
const IRIS_LETTER_MAX_TILT_DEGREES = 10;    // within the requested 8-12 degree range
const IRIS_LETTER_LANE_MARGIN_FACTOR = 1.4; // how far a letter may drift before being nudged back

class IrisLetter {
  constructor(char, anchorX, anchorY, spawnIndex) {
    this.char = char;
    this.anchorX = anchorX;
    this.anchorY = anchorY;

    // Match the original fixed IRIS title's font and size so the falling
    // letters read as the same wordmark, just physically simulated now.
    this.textSizePx = canvasHeight / 3;
    textFont(font);
    textSize(this.textSizePx);

    // First-prototype collision shape: a simple axis-aligned rectangle
    // approximating this glyph's bounding box, not its true font outline.
    // textToPoints()/polygon decomposition is deliberately out of scope
    // for this prototype — the rectangle only needs to fall, stack, and
    // read in the correct order convincingly.
    this.w = textWidth(char) * 0.85;
    this.h = this.textSizePx * 0.7;

    const spawnX = anchorX + random(-10, 10);
    const spawnY = -this.h - random(40, 160) - spawnIndex * 30;
    const spawnAngleDeg = random(-6, 6);

    this.body = Bodies.rectangle(spawnX, spawnY, this.w, this.h, {
      friction: 0.6,
      frictionAir: 0.015,
      restitution: 0.35,
      angle: spawnAngleDeg * (Math.PI / 180)
    });
    World.add(world, this.body);

    this.x = spawnX;
    this.y = spawnY;
    this.angle = this.body.angle;

    this.isStatic = false;
    this.lastSettleCheckPosition = { x: spawnX, y: spawnY };
    this.lastSettleCheckTime = millis();
  }

  // Weak restoring nudge that keeps this letter from drifting past its
  // neighbors — not a rigid constraint, so natural bounce/settle motion
  // is preserved. Only engages once drift exceeds a comfortable lane
  // width around the letter's own anchor, so it never fights gravity or
  // collisions during the actual fall.
  applyOrderingForce() {
    const pos = this.body.position;
    const dx = this.anchorX - pos.x;
    const laneHalfWidth = this.w * IRIS_LETTER_LANE_MARGIN_FACTOR;
    if (Math.abs(dx) > laneHalfWidth) {
      const pull = Math.sign(dx) * 0.00035 * this.body.mass;
      Matter.Body.applyForce(this.body, pos, { x: pull, y: 0 });
    }
  }

  // Keeps letters from tipping past a small, readable tilt — clamped
  // rather than constrained, so rotation still feels physical and no
  // letter ever lands upside down.
  limitRotation() {
    const maxAngle = IRIS_LETTER_MAX_TILT_DEGREES * (Math.PI / 180);
    if (this.body.angle > maxAngle) {
      Matter.Body.setAngle(this.body, maxAngle);
      Matter.Body.setAngularVelocity(this.body, 0);
    } else if (this.body.angle < -maxAngle) {
      Matter.Body.setAngle(this.body, -maxAngle);
      Matter.Body.setAngularVelocity(this.body, 0);
    }
  }

  checkSettled() {
    const now = millis();
    const elapsed = now - this.lastSettleCheckTime;
    if (elapsed < IRIS_LETTER_SETTLE_WINDOW_MS) return;

    const dx = this.body.position.x - this.lastSettleCheckPosition.x;
    const dy = this.body.position.y - this.lastSettleCheckPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= IRIS_LETTER_SETTLE_THRESHOLD_PX) {
      // Freezing via isStatic preserves whatever position/angle the
      // letter actually landed at — no snapping to a preset layout.
      this.isStatic = true;
      this.body.isStatic = true;
    }

    this.lastSettleCheckPosition = { x: this.body.position.x, y: this.body.position.y };
    this.lastSettleCheckTime = now;
  }

  update() {
    if (this.isStatic) {
      // Settled letters stay put; skip force/rotation/settle work — the
      // static Matter body already stops responding to forces, this
      // just avoids doing the extra math every frame.
      this.x = this.body.position.x;
      this.y = this.body.position.y;
      this.angle = this.body.angle;
      return;
    }

    this.applyOrderingForce();
    this.limitRotation();
    this.checkSettled();

    this.x = this.body.position.x;
    this.y = this.body.position.y;
    this.angle = this.body.angle;
  }

  show() {
    push();
    textFont(font);
    textSize(this.textSizePx);
    textAlign(CENTER, CENTER);
    fill(colors[1]);
    translate(this.x, this.y);
    rotate(this.angle);
    text(this.char, 0, 0);
    pop();
  }

  removeBody() {
    if (this.body && world) {
      World.remove(world, this.body);
    }
    this.body = { position: { x: this.x, y: this.y }, angle: this.angle };
  }
}
