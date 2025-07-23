let particles = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  for (let i = 0; i < 100; i++) {
    particles.push(new Particle());
  }
}

function draw() {
  background(254, 254, 254, 40); // 淡淡拖尾

  for (let p of particles) {
    p.update();
    p.display();
  }
}

class Particle {
  constructor() {
    this.reset();
    this.size = random(4, 12);
    this.hue = random(360);
  }

  reset() {
    this.x = random(width);
    this.y = random(height);
    this.vx = random(-0.5, 0.5);
    this.vy = random(-0.5, 0.5);
  }

  update() {
    let dx = mouseX - this.x;
    let dy = mouseY - this.y;
    let d = sqrt(dx * dx + dy * dy);
    if (d < 100) {
      this.vx += dx * 0.001;
      this.vy += dy * 0.001;
    }

    this.x += this.vx;
    this.y += this.vy;

    // 边界处理
    if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
      this.reset();
    }

    // 减速
    this.vx *= 0.95;
    this.vy *= 0.95;
  }

  display() {
    noStroke();
    fill(color('hsla(' + this.hue + ', 80%, 70%, 0.6)'));
    ellipse(this.x, this.y, this.size);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
