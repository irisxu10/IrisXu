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

// H4.6: letters previously had no explicit collisionFilter at all, so they
// used Matter's bare default (category 0x0001) — the Archive planet
// collider's mask (sketch.js, ARCHIVE_PLANET_MASK) was deliberately scoped
// to ordinary balls only (see ball.js's H2.8.2 comment) and never included
// this category, so letters only ever rested on initBorder()'s fixed,
// unsynced flat floor rather than the real CSS-tracked curved ground —
// causing them to visually sink into the ground once that floor no longer
// matched the ground's actual rendered position. mask stays 0xFFFFFFFF
// (match everything) so every existing letter-to-ball, letter-to-letter,
// and letter-to-wall collision is completely unaffected — only the
// Archive planet collider's mask (sketch.js) is widened to recognize this
// new category, additively.
const IRIS_LETTER_CATEGORY = 0x0008;

// H2.8.6V: query-controlled, development-only diagnostic mode — off for
// every normal visitor by default, on only when the URL explicitly asks
// for it (index.html?debugLetterColliders=1), so Iris can open it without
// touching DevTools. Read once at script-parse time (not stored in
// localStorage, no UI control), and never referenced by any physics code
// below — it only gates what show() draws.
const DEBUG_LETTER_COLLIDERS =
  new URLSearchParams(window.location.search).has("debugLetterColliders");

// H2.8.6: builds this letter's compound collision profile — a small
// number of convex Matter.js parts approximating the visible glyph's
// silhouette, replacing the old single oversized bounding-box rectangle.
// This is deliberately not a font-outline extraction: proportions below
// are hand-tuned approximations of Poppins Bold's I/R/S shapes, scaled
// from this letter's own real textWidth()/textSize()-derived w/h so the
// profile still tracks the font rather than using hardcoded pixel sizes.
// Parts are built directly at the intended spawn position (spawnX,
// spawnY) — the same point the old rectangle was centered on, and the
// same point show() draws the glyph at — so no separate offset bookkeeping
// is needed before Body.create computes the compound's vertices.
function buildLetterParts(char, spawnX, spawnY, w, h, partOptions) {
  const hw = w / 2;
  const hh = h / 2;

  switch (char) {
    case 'R': {
      // H2.8.7: three overlapping convex parts — stem, one solid
      // upper-body rectangle, and the rotated diagonal leg. The old
      // separate "bowl" + "connector" rectangles are replaced by one
      // wider, taller solid upper body: Iris does not want balls
      // entering the R counter, so this piece is intentionally sized to
      // fully cover the stem-to-outer-right-edge span (including the
      // visible white counter) with no hole — the counter stays visibly
      // white only because show()'s text() draw is unaffected; nothing
      // here paints anything. Marked with isCounterFill so debug mode
      // (H2.8.6V) can render it distinguishably from outer-contact parts.
      const stemW = w * 0.30;
      const upperBodyW = w * 0.72;
      const upperBodyH = h * 0.59;
      const legThick = w * 0.26;
      const legLen = h * 0.58;
      const legAngle = 32 * (Math.PI / 180);

      const stemX = spawnX - hw + stemW / 2;
      // Overlaps the stem by half the stem's width (avoids a crack) and
      // reaches to spawnX - hw + stemW*0.5 + upperBodyW — a wider right
      // extent than the old bowl, closing the gap toward the outer edge.
      const upperBodyX = spawnX - hw + stemW * 0.5 + upperBodyW / 2;
      const upperBodyY = spawnY - hh + upperBodyH / 2;
      // legY/legX unchanged from H2.8.6 — only the upper body's height
      // grew (0.50h -> 0.59h), which is what closes the ~2-world-unit
      // connector/leg seam the H2.8.6V audit measured, by extending the
      // solid mass down to overlap the leg's own top edge by ~8 units.
      const legX = spawnX - hw + stemW * 0.6 + upperBodyW * 0.30;
      const legY = spawnY + hh - legLen * 0.28;

      const upperBody = Bodies.rectangle(upperBodyX, upperBodyY, upperBodyW, upperBodyH, partOptions);
      upperBody.isCounterFill = true;

      return [
        Bodies.rectangle(stemX, spawnY, stemW, h, partOptions),
        upperBody,
        Bodies.rectangle(legX, legY, legThick, legLen, { ...partOptions, angle: legAngle })
      ];
    }

    case 'S': {
      // H2.8.7: same six-circle walking path as H2.8.6, tuned inward —
      // smaller radius (~15% less) and the top/bottom terminal circles
      // pulled down/up and toward the centerline so the outer envelope
      // (top cap, left/right extrema) sits closer to the visible coral
      // stroke. The two middle circles are spread slightly further apart
      // than before to reduce the excessive central overlap the H2.8.6V
      // audit flagged, while staying overlapped enough to read as one
      // continuous path.
      const r = h * 0.238;
      const points = [
        { dx: 0.50 * hw, dy: -0.75 * hh },
        { dx: -0.32 * hw, dy: -0.45 * hh },
        { dx: 0.16 * hw, dy: -0.15 * hh },
        { dx: -0.16 * hw, dy: 0.15 * hh },
        { dx: 0.32 * hw, dy: 0.45 * hh },
        { dx: -0.50 * hw, dy: 0.75 * hh }
      ];
      return points.map(p => Bodies.circle(spawnX + p.dx, spawnY + p.dy, r, partOptions));
    }

    case 'I':
    default: {
      // Poppins Bold's I has no serif caps — a single narrow vertical
      // stem (about half the old box's width) is enough.
      const stemW = w * 0.46;
      return [
        Bodies.rectangle(spawnX, spawnY, stemW, h, partOptions)
      ];
    }
  }
}

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

    // Reference bounding-box metrics — no longer the collision shape
    // itself (see buildLetterParts, H2.8.6), but kept as the sizing basis
    // every part is scaled from, and as the mass-matching reference below,
    // so the compound profile's overall scale still tracks
    // textWidth()/textSize() exactly the way the old single rectangle did.
    this.w = textWidth(char) * 0.85;
    this.h = this.textSizePx * 0.7;

    const spawnX = anchorX + random(-10, 10);
    const spawnY = -this.h - random(40, 160) - spawnIndex * 30;
    const spawnAngleDeg = random(-6, 6);

    const partOptions = {
      friction: 0.6,
      frictionAir: 0.015,
      restitution: 0.35
    };

    // H2.8.6: compound, glyph-shaped collision profile replaces the old
    // single oversized rectangle (see buildLetterParts above).
    const parts = buildLetterParts(char, spawnX, spawnY, this.w, this.h, partOptions);

    this.body = Matter.Body.create({
      parts,
      friction: 0.6,
      frictionAir: 0.015,
      restitution: 0.35,
      // H4.6: set explicitly on the top-level compound body — Matter's
      // broadphase collision filtering (Detector.canCollide) reads the
      // parent body's own collisionFilter, not each part's, for compound
      // bodies. mask stays 0xFFFFFFFF so nothing existing changes; this
      // only lets the Archive planet collider's mask (sketch.js) match it.
      collisionFilter: {
        category: IRIS_LETTER_CATEGORY,
        mask: 0xFFFFFFFF
      }
    });

    // An asymmetric compound (R's bowl+leg, S's circle chain) does not
    // necessarily land its automatic mass-centroid exactly on (spawnX,
    // spawnY) — the same point the old rectangle was centered on, and the
    // same point show() draws the glyph at below. Forcing the body back
    // onto that exact point keeps the visible glyph and its collider
    // aligned, instead of drifting toward whichever side has more area.
    Matter.Body.setPosition(this.body, { x: spawnX, y: spawnY });
    Matter.Body.setAngle(this.body, spawnAngleDeg * (Math.PI / 180));

    // Restore approximately the old single-rectangle's mass (Body.setMass
    // scales inertia proportionally along with it) — the new, smaller,
    // glyph-shaped parts would otherwise leave every letter noticeably
    // lighter than before, changing how it falls, stacks, and collides.
    const massReferenceBody = Bodies.rectangle(0, 0, this.w, this.h);
    Matter.Body.setMass(this.body, massReferenceBody.mass);

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
    translate(this.x, this.y);
    rotate(this.angle);

    // H4.9A-R: emergency reset. H4.9A's four-layer treatment (a manually
    // assigned drawingContext.fillStyle gradient, a native shadowBlur, and
    // a save()/clip()/restore()-masked highlight, all stacked together)
    // produced a black/poisoned result that couldn't be safely diagnosed
    // without a browser. Replaced with exactly three plain p5 fill()/
    // stroke()/text() passes only — no raw drawingContext mutation, no
    // gradient, no clip, no shadowBlur — so the render path stays simple
    // and predictable. Physics/collider/spawn/timing above are completely
    // untouched; only how the letter is drawn here changes.

    // Pass 1: subtle separation shadow — the same glyph, drawn once more
    // at a small fixed offset, underneath the main fill below (Pass 3
    // paints directly over most of it, leaving only a thin sliver visible
    // at the lower-right edge). A plain offset text() fill, not a Canvas
    // shadow/filter, so it can't leak state onto later passes.
    noStroke();
    fill(132, 70, 60, 28);
    text(this.char, 2.5, 4);

    // H4.9B: Pass 2 — one small upper-left edge reflection, a stroke-only
    // duplicate glyph offset by ~1px, drawn after the shadow and before
    // the main coral fill so Pass 3 covers all but a narrow sliver along
    // the upper-left edge. Deterministic (fixed offset, no time/velocity/
    // angle input, no randomness), same for every letter. Plain p5
    // stroke()/text() only — no gradient, no clip, no native shadow.
    noFill();
    stroke(255, 244, 238, 46);
    strokeWeight(1.4);
    text(this.char, -1.1, -1.35);
    noStroke();

    // Pass 3: main translucent coral body — the letter's one primary
    // fill, drawn once, plain color, no gradient.
    fill(239, 103, 84, 210);
    text(this.char, 0, 0);

    // Pass 4: thin pale glass edge — stroke only, on top of Pass 3.
    noFill();
    stroke(255, 236, 228, 82);
    strokeWeight(1.25);
    text(this.char, 0, 0);
    noStroke();

    // H2.8.6V dev-only diagnostics — drawn inside the same
    // translate()/rotate() as the glyph above, so they rotate and move
    // with the letter automatically. Purely visual: nothing here reads
    // from or writes to the Matter body, so it cannot affect physics.
    if (DEBUG_LETTER_COLLIDERS) {
      // D. Visual reference bounds — the old approximate bounding box
      // (textWidth(char)*0.85 x textSizePx*0.7) this letter's collider
      // used before H2.8.6, kept only as a diagnostic comparison rect.
      noFill();
      stroke(0, 200, 255, 200);
      strokeWeight(1);
      rectMode(CENTER);
      rect(0, 0, this.w, this.h);

      // C. Visual glyph origin — the local point text() is centered on.
      stroke(255, 220, 0);
      strokeWeight(2);
      line(-8, 0, 8, 0);
      line(0, -8, 0, 8);
    }
    pop();

    if (DEBUG_LETTER_COLLIDERS && this.body) {
      // A. Child collision parts — real Matter vertices, already in
      // world space (no extra transform needed). For a compound body
      // (parts.length > 1), parts[0] is Matter's own auto-generated
      // outer hull, not a real collidable shape — skip it and draw only
      // parts[1...]. A single-part body (I) has parts.length === 1; that
      // one entry *is* the real collision shape, so draw it directly.
      if (this.body.parts && this.body.parts.length) {
        push();
        strokeWeight(1);
        const collisionParts = this.body.parts.length > 1
          ? this.body.parts.slice(1)
          : this.body.parts;
        for (const part of collisionParts) {
          // H2.8.7: the R counter-closing upper body (see buildLetterParts)
          // is intentionally solid — flagged with isCounterFill so it
          // reads differently here than the other outer-contact parts,
          // making its extent obvious to Iris during visual review.
          if (part.isCounterFill) {
            fill(255, 0, 255, 40);
            stroke(255, 0, 255, 200);
          } else {
            noFill();
            stroke(255, 0, 0, 200);
          }
          beginShape();
          for (const v of part.vertices) {
            vertex(v.x, v.y);
          }
          endShape(CLOSE);
        }
        pop();
      }

      // B. Body center — distinguishable from the yellow glyph-origin
      // cross above so overlap (or lack of it) between the two is easy
      // to see once both are on screen at once.
      push();
      stroke(0, 255, 90);
      strokeWeight(4);
      point(this.body.position.x, this.body.position.y);
      pop();

      // Small letter identifier — debug mode only, not a permanent
      // on-screen label.
      push();
      noStroke();
      fill(255, 220, 0);
      textSize(12);
      textAlign(LEFT, BOTTOM);
      text(this.char, this.body.position.x + 10, this.body.position.y - 10);
      pop();
    }
  }

  removeBody() {
    if (this.body && world) {
      World.remove(world, this.body);
    }
    this.body = { position: { x: this.x, y: this.y }, angle: this.angle };
  }
}
