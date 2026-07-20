// H4.8B: two same-color, same-alpha ellipses drawn concentrically
// approximate a soft radial falloff (lighter edge, denser center) far
// cheaper than a live Canvas gradient/blur.

// H4.8C: three shallow visual depth layers built entirely from stored,
// constructor-time values — no new ellipse passes, no per-frame work.
// Plain globals (this file loads before sketch.js in index.html), so
// sketch.js's draw() can reference these same identifiers directly, the
// same cross-file pattern IRIS_LETTER_CATEGORY already uses.
const BALL_DEPTH_BACKGROUND = 0;
const BALL_DEPTH_MIDDLE = 1;
const BALL_DEPTH_FOREGROUND = 2;

// Radius thresholds against the existing int(random(10,30)) range (20
// equally-likely integer values, 10-29): <=15 covers 6 of 20 (~30%),
// >=26 covers 4 of 20 (~20%), of which 60% roll into foreground (~12%
// overall) — no new radius call, no radius value changed.
const BALL_BACKGROUND_RADIUS_MAX = 15;
const BALL_FOREGROUND_RADIUS_MIN = 26;
const FOREGROUND_LARGE_BALL_PROBABILITY = 0.60;

// Depth-indexed lookups (index = BALL_DEPTH_* value) — avoids a switch in
// the constructor and keeps each depth's tuning in one readable place.
const DEPTH_ALPHA_MULTIPLIERS = [0.66, 1.00, 1.08]; // background, middle, foreground
const DEPTH_INNER_DIAMETER_RATIOS = [0.70, 0.78, 0.82];
const DEPTH_HIGHLIGHT_PROBABILITIES = [0.02, 0.16, 0.52];
const DEPTH_HIGHLIGHT_ALPHA_CAPS = [10, 26, 34];
const DEPTH_HIGHLIGHT_ALPHA_FACTORS = [0.09, 0.14, 0.17];

class Ball {
  constructor(x, y, ballAlpha = 112) {
    this.x = x;
    this.y = y;
    const options = {
      friction: 0.5,
      restitution: 0.8,
      // H2.8.2: category 0x0002 identifies ordinary balls so the new
      // Archive planet collider (sketch.js) can target them specifically
      // via its own mask, without ever matching IRIS letters or the
      // static boundary/menu bodies (all still the Matter.js default
      // category 0x0001). mask stays at the default 0xFFFFFFFF (match
      // everything) so every existing ball-to-ball, ball-to-letter, and
      // ball-to-wall collision is completely unaffected.
      collisionFilter: {
        category: 0x0002,
        mask: 0xFFFFFFFF
      }
    };
    this.r = int(random(10, 30));
    this.body = Bodies.circle(x, y, this.r, options);

    // H4.8C: depth assigned once, from the radius already generated above
    // (never a new/changed radius) — stable for the ball's lifetime, never
    // touched by update() or show(). At most one extra random() roll, only
    // for radius-eligible (>=26) balls.
    let depthLayer = BALL_DEPTH_MIDDLE;
    if (this.r <= BALL_BACKGROUND_RADIUS_MAX) {
      depthLayer = BALL_DEPTH_BACKGROUND;
    } else if (this.r >= BALL_FOREGROUND_RADIUS_MIN) {
      depthLayer = random() < FOREGROUND_LARGE_BALL_PROBABILITY
        ? BALL_DEPTH_FOREGROUND
        : BALL_DEPTH_MIDDLE;
    }
    this.depthLayer = depthLayer;

    // Visual-only softening pass: mix the base palette color toward
    // white before lowering alpha, rather than just lowering alpha on
    // the fully-saturated color. Alpha alone still reads as "a vivid
    // color with a hole in it"; blending first genuinely desaturates the
    // fill (a paler, atmospheric tint) the way frosted/hazy glass would,
    // rather than a tinted pane of stained glass. Physics (radius,
    // friction, restitution, collisionFilter) is unchanged above.
    const base = random(colors);
    const softenAmount = 0.32; // fraction blended toward white
    const softR = red(base) + (255 - red(base)) * softenAmount;
    const softG = green(base) + (255 - green(base)) * softenAmount;
    const softB = blue(base) + (255 - blue(base)) * softenAmount;
    // H4.5: alpha comes from the caller's spawn-order gradient (sketch.js)
    // — that input, and its constants/curve in sketch.js, are untouched.
    // H4.8C: depth derives one effectiveAlpha from it (background lighter,
    // foreground only slightly stronger) — the early-to-late spawn-order
    // gradient this ballAlpha already encodes is preserved inside every
    // depth layer, since the multiplier only scales it, never replaces it.
    const effectiveAlpha = Math.min(255, Math.max(0,
      Math.round(ballAlpha * DEPTH_ALPHA_MULTIPLIERS[depthLayer])
    ));

    // H4.8B: show() draws two concentric same-color layers instead of one
    // to read as a soft radial body rather than a flat disc. Two
    // same-alpha layers combine as a + a*(1-a) (standard Canvas "over"
    // compositing), so solving 2a - a^2 = effectiveAlpha for a is what
    // keeps the two-layer *center* opacity equal to effectiveAlpha, while
    // the outer ring (only the outer layer reaches it) stays lighter.
    // Computed once here; show() only ever reads this.c, never
    // recalculates it.
    const normalizedAlpha = Math.min(Math.max(effectiveAlpha / 255, 0), 1);
    const layerAlpha = Math.round(
      255 * Math.min(Math.max(1 - Math.sqrt(1 - normalizedAlpha), 0), 1)
    );
    this.c = color(softR, softG, softB, layerAlpha);
    // H4.8C: replaces the old flat BALL_INNER_LAYER_DIAMETER_RATIO — same
    // two-ellipse architecture, just a depth-indexed ratio.
    this.innerDiameterRatio = DEPTH_INNER_DIAMETER_RATIOS[depthLayer];

    // H4.8B: highlight presence/geometry decided once, at spawn, from the
    // same softened palette color — never re-rolled or recalculated in
    // show(). Left undefined on non-highlighted balls (the majority) so
    // show() only does the extra work for balls that need it.
    // H4.8C: probability and alpha cap/factor are now depth-indexed.
    this.hasHighlight = random() < DEPTH_HIGHLIGHT_PROBABILITIES[depthLayer];
    if (this.hasHighlight) {
      const diameter = this.r * 2;
      this.highlightW = random(0.32, 0.44) * diameter;
      this.highlightH = random(0.12, 0.18) * diameter;
      this.highlightOffsetX = random(-0.27, -0.20) * this.r;
      this.highlightOffsetY = random(-0.30, -0.22) * this.r;
      const highlightAlpha = Math.min(255, Math.max(0, Math.round(
        Math.min(
          DEPTH_HIGHLIGHT_ALPHA_CAPS[depthLayer],
          effectiveAlpha * DEPTH_HIGHLIGHT_ALPHA_FACTORS[depthLayer]
        )
      )));
      this.highlightColor = color(255, 255, 255, highlightAlpha);
    }

    World.add(world, this.body);

    this.isStatic = false;
    this.targetX = x;    // 目标X位置
    this.targetY = y;    // 目标Y位置
    this.speed = 0.05;   // 移动平滑系数
  }

  removeBody() {
    this.body = {
      position: {
        x: this.body.position.x,
        y: this.body.position.y,
      }
    }
  }

  show() {
    push();
    noStroke();
    translate(this.x, this.y);

    // Two concentric same-color layers (see this.innerDiameterRatio and the
    // layerAlpha comment in the constructor) — both reuse the one
    // color/alpha already computed at spawn, no per-frame color work.
    fill(this.c);
    ellipse(0, 0, this.r * 2, this.r * 2);
    ellipse(0, 0, this.r * 2 * this.innerDiameterRatio, this.r * 2 * this.innerDiameterRatio);

    if (this.hasHighlight) {
      fill(this.highlightColor);
      ellipse(this.highlightOffsetX, this.highlightOffsetY, this.highlightW, this.highlightH);
    }

    pop();
  }

  update() {
    if (mx > 0 && my > 0) {
      // 获取鼠标与小球的距离
      const dx = mx - this.x;
      const dy = my - this.y;
      const distance = sqrt(dx * dx + dy * dy);

      // 根据距离设置目标位置
      if (distance < 100) {
        // 鼠标靠近时，小球远离鼠标位置
        const dx = this.x - mx;
        const dy = this.y - my;
        const distance = sqrt(dx * dx + dy * dy);
        const directionX = dx / distance;
        const directionY = dy / distance;
        const repelDistance = 100 - distance; // 计算排斥距离
        this.targetX = this.x + directionX * repelDistance;
        this.targetY = this.y + directionY * repelDistance;
        // 使用线性插值实现平滑移动
        const newX = lerp(this.x, this.targetX, this.speed);
        const newY = lerp(this.y, this.targetY, this.speed);
        this.x = newX;
        this.y = newY;
      } else {
        this.x = this.body.position.x;
        this.y = this.body.position.y;
      }
    } else {
      this.x = this.body.position.x;
      this.y = this.body.position.y;
    }

    if (!this.isStatic) {
      // 初始化位置和时间戳
      if (!this.lastPosition) {
        this.lastPosition = { x: this.body.position.x, y: this.body.position.y };
        this.lastTimestamp = millis();
      }

      const currentTime = millis();
      const timeDiff = currentTime - this.lastTimestamp;

      if (timeDiff >= 1000) {
        const dx = this.body.position.x - this.lastPosition.x;
        const dy = this.body.position.y - this.lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= 10) {
          this.isStatic = true;
          this.body.isStatic = true;
        }

        // 更新最后位置和时间戳
        this.lastPosition = { x: this.body.position.x, y: this.body.position.y };
        this.lastTimestamp = currentTime;
      }
    }
  }
}