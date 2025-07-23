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

function preload() {
  font = loadFont("assets/Poppins-Bold.ttf");
}

function setup() {
  canvas = createCanvas(canvasWidth, canvasHeight);

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
  menuData = []
  let menuTexts = ['About Me', 'MDP Works', '	Writings', 'Projects', 'Artworks'];
  let menuTs = canvasHeight * 0.03;
  textSize(menuTs);
  let menuWidth = 0;
  let space = 88;
  for (let i = 0; i < menuTexts.length; i++) {
    let menuTw = textWidth(menuTexts[i]);
    menuWidth += menuTw + space;
  }

  let startX = canvasWidth / 2 - menuWidth / 2 + space / 2;
  for (let i = 0; i < menuTexts.length; i++) {
    let menuTw = textWidth(menuTexts[i]);
    if (i == 0) {
      menuData.push({
        text: menuTexts[i],
        w: menuTw,
        h: menuTs,
        x: startX,
        y: canvasHeight - 100,
        scale: 1,
      })
    } else {
      menuData.push({
        text: menuTexts[i],
        w: menuTw,
        h: menuTs,
        x: menuData[i - 1].x + menuData[i - 1].w + space,
        y: canvasHeight - 100,
        scale: 1,
      })
    }
  }

  for (let i = 0; i < menuData.length; i++) {
    let item = menuData[i];
    World.add(world, Bodies.rectangle(item.x + item.w / 2, item.y + item.h / 2, item.w, item.h, {
      isStatic: true
    }));
  }
}

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

function initBall() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  balls = []
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
        balls.push(new Ball(random(canvasWidth), random(-canvasHeight, 0)));
        // balls.push(new Ball(random(canvasWidth / 2 - 300, canvasWidth / 2 + 300), random(-300, 100)));
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
  resizeCanvas(canvasWidth, canvasHeight);

  resetMatter();
  initBorder();
  initIRISData();
  initMenuData();
  initBall();

  let canvasDom = canvas.elt;
  let miniWidth = max(windowWidth, 1280);
  scaleX = miniWidth / canvasWidth;
  canvasDom.style.transform = `scale(${scaleX})`;
}

function draw() {
  mx = mouseX / scaleX;
  my = mouseY / scaleX;

  background(255);

  for (let i = 0; i < balls.length; i++) {
    balls[i].show();
    balls[i].update();
  }

  textAlign(CENTER, CENTER);
  fill(colors[1]);
  let ts = canvasHeight / 3;
  textSize(ts);
  push();
  translate(canvasWidth / 2, canvasHeight * 0.4);
  scale(irisAllRect.scale);
  text("I R I S", 0, 0);
  pop();

  let menuTs = canvasHeight * 0.03;
  textSize(menuTs);
  textAlign(LEFT, TOP);
  for (let i = 0; i < menuData.length; i++) {
    push();
    translate(menuData[i].x + menuData[i].w / 2, menuData[i].y + menuData[i].h / 2);
    scale(menuData[i].scale);
    text(menuData[i].text, -menuData[i].w / 2, -menuData[i].h / 2);
    pop();
  }

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

  if (mx > irisAllRect.x && mx < irisAllRect.x + irisAllRect.w && my > irisAllRect.y && my < irisAllRect.y + irisAllRect.h) {
    irisAllRect.scale = lerp(irisAllRect.scale, 1.1, 0.1);
  } else {
    irisAllRect.scale = lerp(irisAllRect.scale, 1, 0.1);
  }

  for (let i = 0; i < menuData.length; i++) {
    let menu = menuData[i];
    if (mx > menu.x && mx < menu.x + menu.w && my > menu.y && my < menu.y + menu.h) {
      menu.scale = lerp(menu.scale, 1.2, 0.1);
      cursor(HAND);
      break;
    } else {
      menu.scale = lerp(menu.scale, 1, 0.1);
      cursor(ARROW);
    }
  }
}

function mousePressed() {
  let htmls = [
    'about.html',
    'mdp.html',
    'writings.html',
    'projects.html',
    'artworks.html',
  ]
  for (let i = 0; i < menuData.length; i++) {
    let menu = menuData[i];
    if (mx > menu.x && mx < menu.x + menu.w && my > menu.y && my < menu.y + menu.h) {
      window.location.href = htmls[i];
      break;
    } 
  }
}
