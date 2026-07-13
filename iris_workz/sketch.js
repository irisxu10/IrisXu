let canvasWidth = 1680;
let canvasHeight = 830;
let canvas;
let scaleX
let mx, my;
let debug = false;

let Engine = Matter.Engine,
  World = Matter.World,
  Bodies = Matter.Bodies;

let engine;
let world;
let balls = [];
let irisData = []
let irisAllRect;
let colors = [];
let menuData = []
let intervalId;
let timeoutId;

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
const PRE_LETTER_BALL_COUNT = 320;
const LETTER_START_BALL_COUNT = 280; // letters begin as soon as balls[] first reaches this, overlapping with the pre-letter batch
let preLetterBallInterval = null;
let postLetterBallDelayTimer = null;
let preLetterLettersStarted = false; // guards spawnLetterSequence() from firing twice while preLetterBallInterval keeps running to PRE_LETTER_BALL_COUNT
let mainRainRequested = false;       // set when the post-S timer fires before preLetterBallInterval has naturally finished

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

  windowResized();
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
  balls.push(new Ball(random(canvasWidth), random(-canvasHeight, 0)));
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
      for (let i = 0; i < 100; i++) {
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
  }, 1000);
}

function initBall() {
  if (intervalId) return;

  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  intervalId = setInterval(() => {
    if (balls.length >= 1000) {
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
      for (let i = 0; i < 100; i++) {
        spawnOneBall();
      }
    }
  }, 1000);
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

function draw() {
  if (!simulationActive) return;

  mx = mouseX / scaleX;
  my = mouseY / scaleX;

  background(255);

  for (let i = 0; i < balls.length; i++) {
    balls[i].show();
    balls[i].update();
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
