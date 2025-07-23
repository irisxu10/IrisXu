class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const options = {
      friction: 0.5,
      restitution: 0.8
    };
    this.r = int(random(10, 30));
    this.body = Bodies.circle(x, y, this.r, options);
    this.c = random(colors);
    this.c = color(red(this.c), green(this.c), blue(this.c), 150);
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
    fill(this.c);
    translate(this.x, this.y);
    ellipse(0, 0, this.r * 2, this.r * 2);
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