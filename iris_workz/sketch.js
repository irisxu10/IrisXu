let canvasWidth = 1680;
let canvasHeight = 830;
let canvas;
let scaleX
let mx, my;
let debug = false;

let Engine = Matter.Engine,
  World = Matter.World,
  Bodies = Matter.Bodies,
  Body = Matter.Body;

let engine;
let world;
let balls = [];
let irisData = []
let irisAllRect;
let colors = [];
let menuData = []
let intervalId;
let timeoutId;

// --- Archive planet collider (H2.8.2) ---
// One invisible static circle, much larger than the Canvas, standing in
// for the CSS "rising planet" surface (.floating-archive::before in
// style.css) so ordinary balls physically land on and slide off of it
// instead of only appearing to via CSS layering. Re-created inside
// windowResized() alongside initBorder()'s other static bodies, since
// resetMatter() there throws away the whole Matter world (see
// resetMatter()/windowResized() below) — a single setup()-time creation
// would be wiped out on the very first resize.
let archivePlanetCollider = null;
const ARCHIVE_PLANET_RADIUS = canvasWidth * 1.25;
const ARCHIVE_PLANET_CATEGORY = 0x0004;
// H4.6: widened additively to also match IRIS letters (iris-letter.js,
// IRIS_LETTER_CATEGORY) — they previously only rested on initBorder()'s
// fixed, unsynced flat floor and never on this real CSS-tracked ground,
// which could visually sink them into the ground once the two diverged.
// Ordinary-ball matching (0x0002) is unchanged; letters loaded before this
// file (see index.html script order) so IRIS_LETTER_CATEGORY is already
// defined here.
const ARCHIVE_PLANET_MASK = 0x0002 | IRIS_LETTER_CATEGORY; // ordinary balls + IRIS letters
// World-space Y the collider is currently at; only ever moved a bounded
// step per frame toward the real target (see updateArchivePlanetCollider)
// so a large, sudden scroll jump can't teleport/tunnel resting balls.
let archivePlanetCurrentCenterY = null;
const ARCHIVE_PLANET_MAX_STEP = 40; // world units per frame
// H2.8.5R: tracks which ordinary balls have already received their one-time
// apex nudge (see nudgeStalledBallsFromArchiveApex below), keyed by Matter
// body id. Cleared in initPlanetCollider() so a fresh world (windowResized)
// starts with a clean slate rather than permanently exhausting nudges.
let archivePlanetNudgedBallIds = new Set();
// Cached once in setup() — real DOM elements, read every draw() frame
// instead of re-querying the DOM per frame.
let archivePlanetFloatingArchiveEl = null;
let archivePlanetCanvasHeroEl = null;

// --- Falling IRIS letters (experiment/falling-iris-letters) ---
let letters = [];
let letterAnchors = [];
let letterSpawnTimeouts = [];
let letterSettleCheckIntervalId = null;
let ballStartFallbackTimeoutId = null;
let ballsStarted = false;

const LETTER_CHARS = ['I', 'R', 'I', 'S'];
const LETTER_SPAWN_STAGGER_MS = 260;     // continuous-motion timing refinement
const LETTER_SETTLE_FALLBACK_MS = 4000;  // within the requested 3-5s range, measured from the last letter's spawn

// --- Sequencing refinement: small ball batch -> letters -> main ball rain ---
// Visual-direction pass: counts lowered (320/280 -> 200/160, main-rain cap
// 1000 -> 450 below) so the opening scene reads as an atmosphere of balls
// rather than a densely packed pit — physics/timing mechanics here are
// unchanged, only how many balls exist at once.
// H4.4: density/timing rebalance — the opening field read as too sparse
// and IRIS arrived a beat too early. Raising both targets (200->260,
// 160->210) keeps the same overlapping-batch architecture, just with a
// fuller field established before IRIS begins.
const PRE_LETTER_BALL_COUNT = 260;
const LETTER_START_BALL_COUNT = 210; // letters begin as soon as balls[] first reaches this, overlapping with the pre-letter batch
// H4.1S: the pre-letter batch was previously a flat 100/tick, unclamped —
// against the lowered 160/200 targets that jumped straight from 100 to 200
// in a single tick, collapsing the letter-start and Stage-A-complete beats
// into the same tick. A smaller, clamped batch restores the earlier
// multi-tick rhythm (ordinary balls establish first, then IRIS begins
// while Stage A is still finishing) without changing either target.
const PRE_LETTER_BATCH_SIZE = 60;
// H4.7: named so the tempo-acceleration pass can adjust Stage A's tick
// rate without touching the batch size or either target count above —
// previously a bare 1000 literal at the setInterval() call below.
const STAGE_A_INTERVAL_MS = 700;
let preLetterBallInterval = null;
let postLetterBallDelayTimer = null;
let preLetterLettersStarted = false; // guards spawnLetterSequence() from firing twice while preLetterBallInterval keeps running to PRE_LETTER_BALL_COUNT
let mainRainRequested = false;       // set when the post-S timer fires before preLetterBallInterval has naturally finished

// H4.3: Stage C previously spawned 50 Matter bodies at once every 575ms —
// smaller, more frequent batches keep roughly the same total duration
// while avoiding a 50-body allocation/collision spike in a single callback.
// H4.4: interval trimmed slightly (230ms -> 210ms) so the larger Stage C
// total (540 - 260 = 280 balls, up from 250) still finishes in a
// comparable overall time; batch size is unchanged.
// H4.7: tempo acceleration — interval trimmed further (210ms -> 160ms).
// Batch size (20) and FINAL_BALL_CAP (540) are unchanged, so this only
// shortens Stage C's total duration, not how many bodies any one
// callback creates.
const MAIN_RAIN_BATCH_SIZE = 20;
const MAIN_RAIN_INTERVAL_MS = 160;
// H4.2: a small one-time downward nudge applied at spawn (see
// spawnOneBall() below) so ordinary balls read as arriving/descending
// faster, without touching engine gravity or any body's continuous
// physical settings.
// H4.7: nudged further (1.8 -> 2.2) as part of the same tempo pass.
const ORDINARY_BALL_INITIAL_DROP_SPEED = 2.2;

// H4.5: named so the opacity-gradient progress calculation below can
// reference the real cap instead of duplicating the literal that
// initBall() already checks against.
const FINAL_BALL_CAP = 540;

// H4.5: spawn-order opacity gradient — earliest ordinary balls read as
// slightly deeper/more grounded, later ones progressively lighter, a
// continuous one-time-at-spawn effect (no per-frame recalculation, no
// y-position dependency). Values were 112 uniformly before this.
const EARLIEST_BALL_ALPHA = 144;
const LATEST_BALL_ALPHA = 80;

// H4.8A: named, overlapping horizontal regions (fractions of canvasWidth)
// used to weight ordinary-ball spawn-x — a flat random(canvasWidth) read
// as one even horizontal band once enough balls had settled. Deliberately
// overlapping (no hard column boundaries) so the resting field reads as
// one accumulated, contoured shape instead of separated piles. Only where
// a ball starts changes here — spawn-y, physics, and collision are
// untouched.
const SPAWN_DENSITY_REGIONS = [
  { lo: 0.02, hi: 0.25 }, // outer left
  { lo: 0.16, hi: 0.44 }, // left shoulder
  { lo: 0.37, hi: 0.63 }, // soft center, around IRIS
  { lo: 0.56, hi: 0.84 }, // right shoulder
  { lo: 0.75, hi: 0.98 }  // outer right
];
// Early spawns (Stage A): broad, near-even coverage — establishes support
// across the whole scene and keeps balls under/around IRIS from the start.
const SPAWN_PROFILE_EARLY = [0.9, 1.0, 1.0, 1.0, 0.9];
// Late spawns (Stage C): fuller shoulders, lighter center — builds the
// breathing room around IRIS. Center never reaches zero (no hard hole),
// and the small left/right imbalance (1.3 vs 1.35, 0.7 vs 0.75) keeps
// this from reading as two identical symmetrical piles.
const SPAWN_PROFILE_LATE = [0.7, 1.3, 0.35, 1.35, 0.75];

// H4.8A: reuses the same eased spawn-order progress spawnOneBall() already
// computes for the opacity gradient — no separate progress value, no
// per-frame work (called once per ball, at spawn), no new random source
// (still p5's own random()). Weights are interpolated continuously by
// easedProgress, so there is no hard phase boundary between Stage A and
// Stage C — the same smoothstep curve just also drives which region a
// ball is more likely to land in.
function getOrdinaryBallSpawnX(easedProgress) {
  let totalWeight = 0;
  const weights = SPAWN_DENSITY_REGIONS.map((region, i) => {
    const w = SPAWN_PROFILE_EARLY[i] + (SPAWN_PROFILE_LATE[i] - SPAWN_PROFILE_EARLY[i]) * easedProgress;
    totalWeight += w;
    return w;
  });

  let pick = random(totalWeight);
  let regionIndex = weights.length - 1;
  for (let i = 0; i < weights.length; i++) {
    if (pick < weights[i]) {
      regionIndex = i;
      break;
    }
    pick -= weights[i];
  }

  const region = SPAWN_DENSITY_REGIONS[regionIndex];
  return random(region.lo * canvasWidth, region.hi * canvasWidth);
}

// Small-screen / reduced-motion visitors get the readable HTML archive
// only — the p5/Matter simulation never initializes for them.
function shouldRunCanvasSimulation() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmallViewport = window.innerWidth <= 767;
  return !prefersReducedMotion && !isSmallViewport;
}

let simulationActive = shouldRunCanvasSimulation();

function preload() {
  if (!simulationActive) return;
  font = loadFont("assets/Poppins-Bold.ttf");
}

function setup() {
  if (!simulationActive) {
    noCanvas();
    noLoop();
    return;
  }

  canvas = createCanvas(canvasWidth, canvasHeight);

  const canvasStage = document.getElementById('canvas-stage');
  if (canvasStage) {
    canvas.parent(canvasStage);
  } else {
    console.warn('sketch.js: #canvas-stage not found; canvas was appended to the default location.');
  }

  colors = [
    color(255, 182, 193),
    color(255, 99, 71),
    color(255, 215, 0),
    color(34, 139, 34),
    color(0, 191, 255),
    color(139, 69, 19),
    color(210, 105, 30),
    color(160, 82, 45),
    color(255, 140, 0),
    color(165, 42, 42),
  ]

  textFont(font);

  engine = Engine.create({});
  world = engine.world;
  Engine.run(engine);

  // Cached once — real elements, read every frame in
  // updateArchivePlanetCollider() via getBoundingClientRect() rather
  // than re-queried each time.
  archivePlanetFloatingArchiveEl = document.getElementById('floating-archive');
  archivePlanetCanvasHeroEl = document.getElementById('canvas-hero');

  windowResized();
}

// One true circular Matter.js body standing in for the CSS Archive
// surface — see the H2.8.2 comment block above the variable
// declarations. isStatic so gravity/collisions never move it directly;
// only updateArchivePlanetCollider() (called each draw() frame) moves it,
// via Body.setPosition(). render.visible is false because the visible
// surface is entirely CSS (.floating-archive::before) — this body only
// ever needs to be felt by ordinary balls, never seen.
function initPlanetCollider() {
  archivePlanetCurrentCenterY = canvasHeight + ARCHIVE_PLANET_RADIUS + 200;
  archivePlanetNudgedBallIds.clear();

  archivePlanetCollider = Bodies.circle(
    canvasWidth / 2,
    archivePlanetCurrentCenterY,
    ARCHIVE_PLANET_RADIUS,
    {
      isStatic: true,
      label: "archive-planet-collider",
      friction: 0.005,
      frictionStatic: 0.005,
      restitution: 0.04,
      collisionFilter: {
        category: ARCHIVE_PLANET_CATEGORY,
        mask: ARCHIVE_PLANET_MASK
      },
      render: {
        visible: false
      }
    }
  );

  World.add(world, archivePlanetCollider);
}

// Reads the real, current CSS surface position and moves the collider
// to match — called once per draw() frame (see draw() below), before
// Matter's own internal engine tick (Engine.run() ticks the engine on
// its own schedule, independent of p5's draw() loop, so this only needs
// to keep the body's position current; it does not call Engine.update()
// itself). No new listener or animation loop is introduced — this reuses
// the draw() call that already runs every frame for balls/letters.
function updateArchivePlanetCollider() {
  if (!archivePlanetCollider || !archivePlanetFloatingArchiveEl || !archivePlanetCanvasHeroEl) {
    return;
  }

  // The world's own y=0 sits wherever #canvas-hero currently renders on
  // screen (its child #canvas-stage is inset:0 within it) — this is 0
  // while the Hero is actively stuck to the viewport top, and changes
  // once it un-sticks. Wrapped defensively: a direct #floating-archive
  // or #lower-orbit anchor load must never throw here.
  let heroScreenTop;
  let archiveScreenTop;
  try {
    heroScreenTop = archivePlanetCanvasHeroEl.getBoundingClientRect().top;
    archiveScreenTop = archivePlanetFloatingArchiveEl.getBoundingClientRect().top;
  } catch (err) {
    return;
  }

  // Preferred method: read the real, resolved (px, not "clamp(...)")
  // ::before top offset directly from the CSS that actually draws the
  // surface, so the collider always follows the true rendered curve
  // rather than a value duplicated/hand-kept in sync in two places.
  let surfaceTopOffset = 0;
  try {
    const pseudoStyle = getComputedStyle(archivePlanetFloatingArchiveEl, "::before");
    const parsed = parseFloat(pseudoStyle && pseudoStyle.top);
    if (!isNaN(parsed)) {
      surfaceTopOffset = parsed;
    }
  } catch (err) {
    // Fallback: treat the surface apex as flush with #floating-archive's
    // own top edge (surfaceTopOffset stays 0) — a conservative
    // approximation if getComputedStyle(el, "::before") is ever
    // unavailable, rather than throwing or leaving the collider stale.
  }

  const targetApexScreenY = archiveScreenTop + surfaceTopOffset;
  const targetApexWorldY = (targetApexScreenY - heroScreenTop) / scaleX;
  const targetCenterY = targetApexWorldY + ARCHIVE_PLANET_RADIUS;

  // Bounded one-step interpolation, not a hard jump: keeps rapid
  // scrolling (or a resize snapping the target far from the collider's
  // current position) from moving a static body a huge distance in a
  // single physics frame, which is what causes resting bodies to
  // explode/tunnel through a collider.
  if (archivePlanetCurrentCenterY === null) {
    archivePlanetCurrentCenterY = targetCenterY;
  } else {
    const delta = targetCenterY - archivePlanetCurrentCenterY;
    const step = Math.max(-ARCHIVE_PLANET_MAX_STEP, Math.min(ARCHIVE_PLANET_MAX_STEP, delta));
    archivePlanetCurrentCenterY += step;
  }

  Body.setPosition(archivePlanetCollider, {
    x: canvasWidth / 2,
    y: archivePlanetCurrentCenterY
  });
}

// H2.8.5R: because the Archive planet collider is so much larger than the
// canvas, the ground directly under its apex is nearly flat — an ordinary
// ball landing dead-center has almost no slope to roll down and can stall
// there indefinitely. This gives each such ball a single, small, one-time
// sideways nudge (never continuous, never random — direction is decided by
// which side of center the ball is already on) so it settles off-apex
// instead of visibly floating in place. Called once per draw() frame, right
// after updateArchivePlanetCollider() has positioned the collider for this
// frame. Only iterates `balls` (ordinary Ball instances) — `letters` (IRIS
// letters) are a separate array and are never touched here.
const ARCHIVE_PLANET_APEX_HALF_WIDTH = 30; // world units either side of center
const ARCHIVE_PLANET_STALL_SPEED = 0.05; // world units/frame, "at rest"
const ARCHIVE_PLANET_APEX_CONTACT_SLACK = 10; // world units of vertical tolerance
function nudgeStalledBallsFromArchiveApex() {
  if (!archivePlanetCollider || archivePlanetCurrentCenterY === null) {
    return;
  }

  const apexWorldY = archivePlanetCurrentCenterY - ARCHIVE_PLANET_RADIUS;
  const centerX = canvasWidth / 2;

  for (let i = 0; i < balls.length; i++) {
    const ball = balls[i];
    const body = ball.body;

    // removeBody() replaces a recycled ball's .body with a plain
    // {position} stub (no id/velocity/mass) — skip anything that isn't a
    // real Matter body still in the world.
    if (!body || typeof body.id === 'undefined' || !body.velocity) {
      continue;
    }

    if (archivePlanetNudgedBallIds.has(body.id)) {
      continue;
    }

    const dx = body.position.x - centerX;
    if (Math.abs(dx) > ARCHIVE_PLANET_APEX_HALF_WIDTH) {
      continue;
    }

    // Only balls actually resting on the surface near the apex — not
    // balls merely passing through this x-range mid-air.
    const contactY = body.position.y + ball.r;
    if (Math.abs(contactY - apexWorldY) > ARCHIVE_PLANET_APEX_CONTACT_SLACK) {
      continue;
    }

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed > ARCHIVE_PLANET_STALL_SPEED) {
      continue;
    }

    // Deterministic, not random: balls left-of-center (or exactly on
    // center) roll left, balls right-of-center roll right.
    const direction = dx > 0 ? 1 : -1;
    const forceMagnitude = body.mass * 0.000015;

    Body.applyForce(body, body.position, {
      x: direction * forceMagnitude,
      y: 0
    });

    archivePlanetNudgedBallIds.add(body.id);
  }
}

function initBorder() {
  // 左右下
  let ground = Bodies.rectangle(0, canvasHeight / 2, 10, canvasHeight, {
    isStatic: true
  });
  World.add(world, ground);
  ground = Bodies.rectangle(canvasWidth, canvasHeight / 2, 10, canvasHeight, {
    isStatic: true
  });
  World.add(world, ground);
  ground = Bodies.rectangle(canvasWidth / 2, canvasHeight, canvasWidth, 10, {
    isStatic: true
  });
  World.add(world, ground);
}

function initMenuData() {
  menuData = [];

  const items = window.SITE_NAVIGATION;
  if (!Array.isArray(items)) {
    console.error('sketch.js: window.SITE_NAVIGATION is missing or invalid. Expected an array from nav-data.js. Canvas menu will be empty.');
    return;
  }

  let menuTs = canvasHeight * 0.04;
  textSize(menuTs);

  // Three items distributed evenly across the centered middle 65% of the
  // canvas, each label centered within its own slot — computed from
  // canvasWidth rather than the old fixed per-item gap (tuned for five
  // items stacked left-to-right).
  let regionWidth = canvasWidth * 0.65;
  let regionStart = (canvasWidth - regionWidth) / 2;
  let slotWidth = regionWidth / items.length;

  for (let i = 0; i < items.length; i++) {
    let label = items[i].label;
    let labelWidth = textWidth(label);
    let slotCenterX = regionStart + slotWidth * (i + 0.5);
    menuData.push({
      text: label,
      path: items[i].path,
      w: labelWidth,
      h: menuTs,
      x: slotCenterX - labelWidth / 2,
      y: canvasHeight - 100,
      scale: 1,
    })
  }

  for (let i = 0; i < menuData.length; i++) {
    let item = menuData[i];
    World.add(world, Bodies.rectangle(item.x + item.w / 2, item.y + item.h / 2, item.w, item.h, {
      isStatic: true
    }));
  }
}

// UNUSED during the falling-iris-letters experiment: this function built
// the old permanently-fixed, invisible IRIS-shaped collision geometry.
// It is intentionally left in place for comparison but is no longer
// called from windowResized() — the falling IrisLetter bodies replace it.
function initIRISData() {
  let ts = canvasHeight / 3;
  textSize(ts);
  let tw = textWidth("I R I S");
  // IRIS
  irisData = [
    {
      type: 'rect',
      x: canvasWidth / 2 - tw * 0.475,
      y: canvasHeight * 0.4 - ts * 0.17,
      w: 46 / 691 * tw,
      h: 195 / 277 * ts
    },
    {
      type: 'rect',
      x: canvasWidth / 2 - tw * 0.27,
      y: canvasHeight * 0.4 - ts * 0.17,
      w: 46 / 691 * tw,
      h: 195 / 277 * ts
    },
    {
      type: 'ellipse',
      x: canvasWidth / 2 - tw * 0.15,
      y: canvasHeight * 0.41,
      w: 120 / 691 * tw,
      h: 120 / 691 * tw,
    },
    {
      type: 'rect',
      x: canvasWidth / 2 - tw * 0.15,
      y: canvasHeight * 0.4 + ts * 0.24,
      w: 46 / 691 * tw,
      h: 80 / 277 * ts
    },
    {
      type: 'rect',
      x: canvasWidth / 2 - tw * 0.1,
      y: canvasHeight * 0.4 + ts * 0.42,
      w: 30 / 691 * tw,
      h: 30 / 277 * ts
    },
    {
      type: 'rect',
      x: canvasWidth / 2 + tw * 0.08,
      y: canvasHeight * 0.4 - ts * 0.17,
      w: 46 / 691 * tw,
      h: 195 / 277 * ts
    },
    {
      type: 'ellipse',
      x: canvasWidth / 2 + tw * 0.37,
      y: canvasHeight * 0.41,
      w: 130 / 691 * tw,
      h: 130 / 691 * tw,
    },
    {
      type: 'ellipse',
      x: canvasWidth / 2 + tw * 0.37,
      y: canvasHeight * 0.41 + ts * 0.26,
      w: 130 / 691 * tw,
      h: 130 / 691 * tw,
    },
  ]

  irisAllRect = {
    x: canvasWidth / 2 - tw * 0.48,
    y: canvasHeight * 0.4 - ts * 0.18,
    w: 660 / 691 * tw,
    h: 195 / 277 * ts,
    scale: 1
  }

  for (let i = 0; i < irisData.length; i++) {
    let item = irisData[i];
    if (item.type === 'rect') {
      World.add(world, Bodies.rectangle(item.x + item.w / 2, item.y + item.h / 2, item.w, item.h, {
        isStatic: true
      }));
    } else if (item.type === 'ellipse') {
      World.add(world, Bodies.circle(item.x, item.y, item.w / 2, {
        isStatic: true
      }));
    }
  }
}

// Computes each letter's left-to-right horizontal anchor from the same
// text metrics the old fixed "I R I S" title used, so the falling
// letters read as the same word, just spaced out via textWidth instead
// of hand-tuned rectangles.
function initLetterAnchors() {
  let ts = canvasHeight / 3;
  textFont(font);
  textSize(ts);

  let fullWidth = textWidth(LETTER_CHARS.join(' '));
  let spaceWidth = textWidth(' ');
  let cursorX = canvasWidth / 2 - fullWidth / 2;

  letterAnchors = [];
  for (let i = 0; i < LETTER_CHARS.length; i++) {
    let ch = LETTER_CHARS[i];
    let charWidth = textWidth(ch);
    letterAnchors.push({
      char: ch,
      x: cursorX + charWidth / 2,
      y: canvasHeight * 0.4
    });
    cursorX += charWidth + spaceWidth;
  }
}

// Spawns I, R, I, S one after another (staggered). The main ball rain now
// resumes a short delay after the final letter enters (see
// postLetterBallDelayTimer below) rather than waiting on
// beginWaitingForLettersToSettle() — the letters still settle
// independently via their own update(), this only changes when the
// balls resume.
function spawnLetterSequence() {
  letters = [];
  ballsStarted = false;

  for (let i = 0; i < letterAnchors.length; i++) {
    let anchor = letterAnchors[i];
    let isLastLetter = i === letterAnchors.length - 1;
    let spawnTimeoutId = setTimeout(() => {
      letters.push(new IrisLetter(anchor.char, anchor.x, anchor.y, i));
      if (isLastLetter) {
        postLetterBallDelayTimer = setTimeout(() => {
          postLetterBallDelayTimer = null;
          // If the pre-letter batch is still topping up to 150, defer to
          // its own completion instead of starting a second concurrent
          // interval — startPreLetterBalls() will call initBall() itself
          // as soon as it clears.
          if (preLetterBallInterval) {
            mainRainRequested = true;
          } else {
            initBall();
          }
        }, 100);
      }
    }, i * LETTER_SPAWN_STAGGER_MS);
    letterSpawnTimeouts.push(spawnTimeoutId);
  }
}

// UNUSED in this sequencing refinement: settle-triggered ball start has
// been disconnected in favor of postLetterBallDelayTimer above. Left in
// place rather than deleted — the letters' own settle detection
// (IrisLetter.checkSettled()) is unrelated and still runs independently.
function beginWaitingForLettersToSettle() {
  ballStartFallbackTimeoutId = setTimeout(startBallRainOnce, LETTER_SETTLE_FALLBACK_MS);

  letterSettleCheckIntervalId = setInterval(() => {
    let allSettled = letters.length === letterAnchors.length && letters.every(letter => letter.isStatic);
    if (allSettled) {
      startBallRainOnce();
    }
  }, 200);
}

function startBallRainOnce() {
  if (ballsStarted) return;
  ballsStarted = true;

  if (letterSettleCheckIntervalId) {
    clearInterval(letterSettleCheckIntervalId);
    letterSettleCheckIntervalId = null;
  }
  if (ballStartFallbackTimeoutId) {
    clearTimeout(ballStartFallbackTimeoutId);
    ballStartFallbackTimeoutId = null;
  }

  initBall();
}

// Clears every letter-related timer so a reset can never leave a
// duplicate spawn/settle/fallback timer running behind the new cycle.
function clearLetterSequenceTimers() {
  letterSpawnTimeouts.forEach(id => clearTimeout(id));
  letterSpawnTimeouts = [];

  if (letterSettleCheckIntervalId) {
    clearInterval(letterSettleCheckIntervalId);
    letterSettleCheckIntervalId = null;
  }
  if (ballStartFallbackTimeoutId) {
    clearTimeout(ballStartFallbackTimeoutId);
    ballStartFallbackTimeoutId = null;
  }
  if (preLetterBallInterval) {
    clearInterval(preLetterBallInterval);
    preLetterBallInterval = null;
  }
  if (postLetterBallDelayTimer) {
    clearTimeout(postLetterBallDelayTimer);
    postLetterBallDelayTimer = null;
  }
}

// The one existing ball-creation expression, extracted so the pre-letter
// batch and the main rain both spawn balls the same way.
function spawnOneBall() {
  // H4.5: spawn order is the only input to the opacity gradient — balls.length
  // read here, before push(), is exactly this ball's 0-based spawn index
  // (spawnOneBall() is the sole ordinary-ball creation path, so it never
  // skips or double-counts). Calculated once; never touched again.
  const spawnIndex = balls.length;
  const denominator = Math.max(FINAL_BALL_CAP - 1, 1);
  const rawProgress = Math.min(Math.max(spawnIndex / denominator, 0), 1);
  const easedProgress = rawProgress * rawProgress * (3 - 2 * rawProgress);
  const ballAlpha = Math.round(
    EARLIEST_BALL_ALPHA + (LATEST_BALL_ALPHA - EARLIEST_BALL_ALPHA) * easedProgress
  );

  const ball = new Ball(getOrdinaryBallSpawnX(easedProgress), random(-canvasHeight, 0), ballAlpha);
  // H4.2: one-time initial velocity at spawn only — not applied per frame,
  // not applied to IRIS letters (spawnLetterSequence() creates those via
  // its own IrisLetter path, never through this function). x is preserved
  // (zero at this point) rather than overwritten.
  Body.setVelocity(ball.body, {
    x: ball.body.velocity.x,
    y: ORDINARY_BALL_INITIAL_DROP_SPEED
  });
  balls.push(ball);
}

// Spawns a small initial batch (same rate/colors/size as the main rain)
// into the existing balls[] array. Letters start as soon as the batch
// first reaches LETTER_START_BALL_COUNT, while this same interval keeps
// spawning until PRE_LETTER_BALL_COUNT — the pre-letter balls and the
// letter entrance overlap instead of happening as separate blocks. Does
// not reset the world, boundaries, menu bodies, or the balls spawned.
function startPreLetterBalls() {
  preLetterLettersStarted = false;
  mainRainRequested = false;

  preLetterBallInterval = setInterval(() => {
    if (balls.length < PRE_LETTER_BALL_COUNT) {
      const remaining = PRE_LETTER_BALL_COUNT - balls.length;
      const spawnAmount = Math.min(PRE_LETTER_BATCH_SIZE, remaining);
      for (let i = 0; i < spawnAmount; i++) {
        spawnOneBall();
      }
    }

    if (!preLetterLettersStarted && balls.length >= LETTER_START_BALL_COUNT) {
      preLetterLettersStarted = true;
      spawnLetterSequence();
    }

    if (balls.length >= PRE_LETTER_BALL_COUNT) {
      clearInterval(preLetterBallInterval);
      preLetterBallInterval = null;
      if (mainRainRequested) {
        mainRainRequested = false;
        initBall();
      }
    }
  }, STAGE_A_INTERVAL_MS);
}

function initBall() {
  if (intervalId) return;

  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  intervalId = setInterval(() => {
    if (balls.length >= FINAL_BALL_CAP) {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      timeoutId = setTimeout(() => {
        for (let i = balls.length - 1; i >= 0; i--) {
          balls[i].removeBody();
        }
        resetMatter();
      }, 5000);
    } else {
      const remaining = FINAL_BALL_CAP - balls.length;
      const spawnAmount = Math.min(MAIN_RAIN_BATCH_SIZE, remaining);
      for (let i = 0; i < spawnAmount; i++) {
        spawnOneBall();
      }
    }
  }, MAIN_RAIN_INTERVAL_MS);
}

function resetMatter() {
  // 重置 Matter 引擎和世界
  Engine.clear(engine);
  World.clear(world, false);
  engine = Engine.create({});
  world = engine.world;
  Engine.run(engine);
}

function windowResized() {
  if (!simulationActive) return;

  resizeCanvas(canvasWidth, canvasHeight);

  // Tear down any letters/timers from a previous cycle before rebuilding,
  // so a reset can never leave orphaned bodies or duplicate timers behind.
  clearLetterSequenceTimers();
  for (let i = letters.length - 1; i >= 0; i--) {
    letters[i].removeBody();
  }
  letters = [];

  resetMatter();
  initBorder();
  initPlanetCollider();
  initMenuData();
  // initIRISData() intentionally not called — see the comment above its
  // definition. The falling IrisLetter bodies replace the old fixed,
  // invisible IRIS collision geometry.
  initLetterAnchors();
  balls = [];
  startPreLetterBalls();
  // spawnLetterSequence() and initBall() are no longer called directly
  // here — startPreLetterBalls() spawns the small initial batch, then
  // calls spawnLetterSequence() itself once that batch is done.

  let canvasDom = canvas.elt;
  let miniWidth = max(windowWidth, 1280);
  scaleX = miniWidth / canvasWidth;
  canvasDom.style.transform = `scale(${scaleX})`;
}

// H4.8F: exactly two non-physical, Canvas-only ambient orbs — never added
// to balls[], never Matter.js bodies, never counted toward FINAL_BALL_CAP
// or the opacity spawn progression, never part of Stage A/B/C. Colors are
// existing palette entries (colors[1] coral, colors[4] sky blue) strongly
// softened toward the H4.8E warm background so they read as diffused air,
// not additional colored balls. All values fixed here at module load;
// drawAmbientOrbs() below only reads them plus millis() — no random(),
// no noise(), no per-frame allocation. Positions verified clear of the
// upper-left identity block (~x 0-0.32, y 0.04-0.30) and upper-right
// navigation (~x 0.85-1.0, y 0.04-0.15); drift amplitudes are only a few
// pixels, far too small to ever reach either region.
const AMBIENT_ORBS = [
  {
    // primary: warm coral family, right-of-center, upper-middle
    xRatio: 0.71,
    yRatio: 0.34,
    diameterRatio: 0.29,
    innerDiameterRatio: 0.65,
    r: 253, g: 220, b: 211,
    outerAlpha: 6,
    innerAlpha: 9,
    driftX: 9,
    driftY: 6,
    xPeriodMs: 19000,
    yPeriodMs: 23000,
    scaleAmplitude: 0.014,
    scalePeriodMs: 27000,
    phase: 0
  },
  {
    // secondary: cool pale-blue family, left-of-center, weaker than
    // primary throughout (lower alpha, smaller, gentler drift)
    xRatio: 0.30,
    yRatio: 0.46,
    diameterRatio: 0.22,
    innerDiameterRatio: 0.65,
    r: 202, g: 238, b: 248,
    outerAlpha: 4,
    innerAlpha: 6,
    driftX: 6,
    driftY: 5,
    xPeriodMs: 17000,
    yPeriodMs: 21000,
    scaleAmplitude: 0.012,
    scalePeriodMs: 24000,
    phase: 2.1
  }
];

// H4.8F: drawn once per frame, strictly between the H4.8E background fill
// and the physical ordinary-ball loops in draw() below, so both orbs
// always render behind every physical ball and every IRIS letter. Reads
// only millis()/canvasWidth/canvasHeight; never touches balls[],
// letters[], or any Matter.js state — purely two ellipses per orb, drawn
// at a slowly drifting/breathing offset from each orb's fixed base
// position (deterministic sine/cosine, not noise() or velocity).
function drawAmbientOrbs() {
  const t = millis();
  const minDimension = Math.min(canvasWidth, canvasHeight);

  push();
  noStroke();

  for (let i = 0; i < AMBIENT_ORBS.length; i++) {
    const orb = AMBIENT_ORBS[i];
    const offsetX = Math.sin((t / orb.xPeriodMs) * TWO_PI + orb.phase) * orb.driftX;
    const offsetY = Math.cos((t / orb.yPeriodMs) * TWO_PI + orb.phase) * orb.driftY;
    const scale = 1 + Math.sin((t / orb.scalePeriodMs) * TWO_PI + orb.phase) * orb.scaleAmplitude;

    const x = orb.xRatio * canvasWidth + offsetX;
    const y = orb.yRatio * canvasHeight + offsetY;
    const outerDiameter = orb.diameterRatio * minDimension * scale;
    const innerDiameter = outerDiameter * orb.innerDiameterRatio;

    fill(orb.r, orb.g, orb.b, orb.outerAlpha);
    ellipse(x, y, outerDiameter, outerDiameter);

    fill(orb.r, orb.g, orb.b, orb.innerAlpha);
    ellipse(x, y, innerDiameter, innerDiameter);
  }

  pop();
}

function draw() {
  if (!simulationActive) return;

  updateArchivePlanetCollider();
  nudgeStalledBallsFromArchiveApex();

  mx = mouseX / scaleX;
  my = mouseY / scaleX;

  // H4.8E: audited that the Canvas's own opaque per-frame repaint (this
  // call) exactly covers the region CSS backgrounds on .canvas-hero and
  // its ancestors would need to be visible behind — a CSS gradient there
  // is provably invisible everywhere it would matter. This single-value
  // change (plain white -> a barely-warm near-white) is the smallest
  // possible way to give the upper field a touch of the same warm
  // atmosphere as the rest of the page, directly at the one paint layer
  // that's actually visible, without adding a new draw call, gradient
  // construction, filter, or animation.
  background(253, 250, 246);

  // H4.8F: drawn immediately after the background fill and before every
  // physical ball/letter loop below, so the two ambient orbs always sit
  // behind the entire physical scene.
  drawAmbientOrbs();

  // H4.8C: update pass and render passes split so ordinary balls can be
  // drawn in stable depth order (background, then middle, then
  // foreground) without changing how many times each ball updates or
  // renders. depthLayer is fixed at construction (ball.js) — this only
  // compares it, no sorting, no per-frame array allocation, and every
  // ball still updates exactly once and renders exactly once. The whole
  // ordinary-ball field is still drawn in this exact same slot, strictly
  // before the letters loop below, so the ordinary-balls-vs-IRIS paint
  // order is unchanged.
  for (let i = 0; i < balls.length; i++) {
    balls[i].update();
  }
  for (let i = 0; i < balls.length; i++) {
    if (balls[i].depthLayer === BALL_DEPTH_BACKGROUND) balls[i].show();
  }
  for (let i = 0; i < balls.length; i++) {
    if (balls[i].depthLayer === BALL_DEPTH_MIDDLE) balls[i].show();
  }
  for (let i = 0; i < balls.length; i++) {
    if (balls[i].depthLayer === BALL_DEPTH_FOREGROUND) balls[i].show();
  }

  for (let i = 0; i < letters.length; i++) {
    letters[i].show();
    letters[i].update();
  }

  // Canvas-drawn Archive/About/Writings text rendering disabled (Phase
  // H1): real HTML navigation bubbles (home.js's renderPrimaryNavigation,
  // in the new .home-primary-bubbles layer) replace it — those are
  // keyboard-reachable, which this canvas text never was. initMenuData()
  // still runs in windowResized() and menuData[] is still populated, so
  // the static Matter bodies it creates keep occupying the same physics
  // space and ordinary-ball collision behavior is unchanged; only the
  // text drawing below is skipped.
  if (debug) {

    fill(25, 255, 5);
    for (let i = 0; i < irisData.length; i++) {
      let item = irisData[i];
      if (item.type === 'rect') {
        rect(item.x, item.y, item.w, item.h);
      } else if (item.type === 'ellipse') {
        ellipse(item.x, item.y, item.w, item.h);
      }
    }

    for (let i = 0; i < menuData.length; i++) {
      rect(menuData[i].x, menuData[i].y, menuData[i].w, menuData[i].h);
    }
  }

  // The old hover-to-enlarge interaction lived here, keyed off
  // irisAllRect from initIRISData() (unused in this experiment — see
  // above). It has no per-letter equivalent yet; not part of this
  // falling-letters prototype.

  // Canvas menu hover-scale/cursor-change disabled alongside the text
  // rendering above (Phase H1) — there is no more canvas-drawn menu text
  // for a hover state to apply to. cursor() is left at its default.
}

// Canvas menu click-to-navigate disabled (Phase H1): the real HTML
// navigation bubbles handle clicks/Enter natively now. menuData[] and its
// static Matter bodies are untouched, so this intentionally does nothing
// rather than being deleted outright — see the comment in draw().
function mousePressed() {
  if (!simulationActive) return;
}
