/* ==========================================================================
   CONTINUOUS CURVE FIELD — one long piece of security-printed paper
   --------------------------------------------------------------------------
   Every curve is a function of WORLD position, not screen position, so the
   field never restarts: it is the same set of lines from the opening to the
   closing. Along the journey (KEYS below) the field breathes — density,
   amplitude, colour and quietness all change gradually. Some stretches are
   almost empty, others more active.

   Two families of fine guilloché lines drift against each other, plus a few
   translucent ribbons. Most lines are muted; colour comes from a few accents:
     · one cyan line group           (family A)
     · one lavender wave edge        (family B, outermost line)
     · small orange-gold dots        (riding on the cyan group)

   Text protection: any element with data-haze="strength" (default 1) cuts a
   soft hole into the field behind it, so the lines fade under text without
   any visible box. It follows the element as it travels and reveals.

   The field travels at 0.6× the camera (background).
   ========================================================================== */

(function () {
  const canvas = document.getElementById('curves');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PARALLAX = 0.6;
  const LINES = 22;        // lines per family (only part of them is visible at once)
  const STEP = 7;          // px between samples

  // Colours from the banknote system (RGB)
  const C = {
    cyan: [59, 152, 168], paleCyan: [126, 184, 200], aqua: [72, 172, 168], teal: [15, 85, 96],
    lavender: [150, 138, 196], violet: [93, 78, 140], gold: [176, 140, 74], amber: [204, 142, 66],
    blueGrey: [128, 146, 162],
  };
  const NEUTRAL = [132, 144, 154];                 // most lines lean toward this muted grey-blue

  /* Character of the surface along the journey.
     x = background position in screen widths (camera × 0.6). The screen centre
     for camera c is at 0.6·c + 0.5, so:
       opening 0.5 · concept 1.15 · question 1.6 · columns 2.2–4.55 (banknotes ≈ 3–3.8)
       security 5.35 · biology → security 6.15 · closing 6.95

     dens   share of the lines that are visible (0–1)
     quiet  how strongly the field keeps to a central band, fades at the edges
            and lets lines dissolve before they cross the screen (0–1)
     acc    strength of the colour accents (0–1)                              */
  const KEYS = {
    x:      [0,    0.5,  1.15, 1.6,  2.2,  3.0,  3.8,  4.55, 5.0,  5.35, 5.75, 6.15, 6.55, 6.95, 7.6],
    dens:   [0.46, 0.44, 0.5,  0.42,  0.52, 0.6,  0.6,  0.48, 0.58, 0.62, 0.46, 0.32, 0.38, 0.44, 0.44],
    quiet:  [0.5,  0.5,  0.55, 0.55,  0.5,  0.45, 0.5,  0.6,  0.5,  0.55, 0.6,  1,    0.85, 0.75, 0.75],
    acc:    [0.25, 0.25, 0.4,  0.45, 0.6,  0.8,  0.85, 0.7,  0.8,  0.9,  0.7,  0.5,  0.55, 0.65, 0.65],
    amp:    [0.04, 0.05, 0.07, 0.08, 0.09, 0.10, 0.08, 0.06, 0.07, 0.08, 0.08, 0.06, 0.06, 0.05, 0.05],
    spread: [0.26, 0.3,  0.36, 0.4,  0.44, 0.5,  0.44, 0.36, 0.4,  0.44, 0.44, 0.36, 0.33, 0.3,  0.3],
    detail: [3.0,  3.1,  3.4,  3.6,  4.2,  5.6,  5.0,  4.0,  5.5,  6.5,  6.5,  4.5,  3.8,  3.0,  3.0],   // fine guilloché frequency
    alpha:  [0.28, 0.28, 0.32, 0.32, 0.34, 0.36, 0.36, 0.32, 0.36, 0.38, 0.36, 0.3,  0.3,  0.3,  0.28],
    // colour families A and B: origin pale cyan → adaptation cyan/teal → banknotes stronger
    // → security cyan + lavender + gold → family balanced
    a: [C.paleCyan, C.paleCyan, C.cyan, C.teal, C.teal, C.cyan, C.violet, C.teal, C.cyan, C.cyan, C.teal, C.blueGrey, C.teal, C.teal, C.teal],
    b: [C.blueGrey, C.blueGrey, C.aqua, C.aqua, C.lavender, C.gold, C.lavender, C.gold, C.lavender, C.lavender, C.lavender, C.blueGrey, C.lavender, C.gold, C.gold],
  };

  // Accent lines (always among the visible ones)
  const ACCENT_A = [7, 8];      // the cyan line group
  const EDGE_B = LINES - 1;     // the lavender wave edge

  /* Visibility order: accents first, then a spread-out permutation, so a
     lower density removes lines evenly across the band. */
  function ranks(accents) {
    const order = accents.slice();
    for (let j = 0; j < LINES; j++) {
      const i = (j * 9 + 3) % LINES;
      if (!order.includes(i)) order.push(i);
    }
    const r = new Array(LINES);
    order.forEach((i, n) => { r[i] = n; });
    return r;
  }
  const RANK = [ranks(ACCENT_A), ranks([EDGE_B])];

  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  function sample(key, x) {
    const xs = KEYS.x, vs = KEYS[key];
    if (x <= xs[0]) return vs[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) {
        const t = smooth((x - xs[i - 1]) / (xs[i] - xs[i - 1]));
        const a = vs[i - 1], b = vs[i];
        return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * t) : a + (b - a) * t;
      }
    }
    return vs[vs.length - 1];
  }
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
  const mix = (c, d, t) => c.map((v, j) => v + (d[j] - v) * t);
  const hash = (n) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };

  let w = 0, h = 0, dpr = 1, cam = 0, lastCam = -1, time = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastCam = -1;
  }

  /* Horizontal gradient across the screen.
     colorFn(X) gives the colour at a world position; `life` is an optional
     per-line envelope [start, end] (screen units) so a line can dissolve. */
  function gradient(colorFn, x0, alphaScale, quiet, life) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const X = x0 + u;
      let a = sample('alpha', X) * alphaScale;
      if (life) {
        const fadeIn = clamp01((u - life[0]) / 0.22);
        const fadeOut = clamp01((life[1] - u) / 0.22);
        a *= 1 - quiet + quiet * fadeIn * fadeOut;
      }
      g.addColorStop(u, rgba(colorFn(X), a));
    }
    return g;
  }

  // One guilloché line: y on screen for world position X
  function lineY(X, k, s, t) {
    const amp = sample('amp', X), spread = sample('spread', X), detail = sample('detail', X);
    const env = 0.55 + 0.45 * Math.sin(X * 2.1 + k * 1.3);
    return h * (0.5 + 0.035 * Math.sin(X * 0.9))
      + (k - 0.5) * h * spread
      + s * Math.sin(X * Math.PI * 1.25 + k * 2.2 + t * s * 0.12) * h * amp * env
      + Math.sin(X * Math.PI * detail + k * 6 - t * 0.08) * h * 0.011;
  }

  /* Quiet masks: keep the field to a central band and fade every edge.
     destination-in only removes — it never adds colour. */
  function quietMask(q) {
    if (q < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const keep = (a) => `rgba(0,0,0,${(1 - q + q * a).toFixed(3)})`;
    const v = ctx.createLinearGradient(0, 0, 0, h);
    [[0, 0], [0.18, 0.1], [0.36, 0.85], [0.52, 1], [0.7, 0.85], [0.86, 0.1], [1, 0]]
      .forEach(([o, a]) => v.addColorStop(o, keep(a)));
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
    const hz = ctx.createLinearGradient(0, 0, w, 0);
    [[0, 0], [0.2, 0.2], [0.42, 0.85], [0.6, 1], [0.84, 0.6], [1, 0.05]]
      .forEach(([o, a]) => hz.addColorStop(o, keep(a)));
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /* Text protection — soft holes behind [data-haze] elements.
     A blurred shadow of an off-screen rectangle is drawn with destination-out,
     which gives a rounded, feathered shape with a fixed edge softness. */
  const hazes = Array.from(document.querySelectorAll('[data-haze]')).map((el) => ({
    el, k: parseFloat(el.dataset.haze) || 1, v: 0,
  }));
  const FAR = 100000;
  function haze() {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 56 * dpr;
    ctx.shadowOffsetX = FAR * dpr;
    for (const H of hazes) {
      const r = H.el.getBoundingClientRect();
      const visible = r.width > 0 && r.right > -80 && r.left < w + 80 &&
        (!H.el.hasAttribute('data-reveal') || H.el.classList.contains('is-in'));
      H.v = reduce ? +visible : H.v + ((visible ? 1 : 0) - H.v) * 0.05;
      if (H.v < 0.01) continue;
      ctx.shadowColor = `rgba(0,0,0,${(0.8 * H.k * H.v).toFixed(3)})`;
      ctx.fillRect(r.left - 20 - FAR, r.top - 12, r.width + 40, r.height + 24);
    }
    ctx.restore();
  }

  function draw() {
    const x0 = cam * PARALLAX;                     // background position at the left edge
    const t = time;
    const centre = x0 + 0.5;
    const quiet = sample('quiet', centre);
    const dens = sample('dens', centre);
    ctx.clearRect(0, 0, w, h);

    /* Ribbons — wide translucent bands, muted */
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      const top = [], bot = [];
      for (let x = -STEP; x <= w + STEP; x += STEP * 2) {
        const X = x0 + x / w;
        const mid = h * (0.5 + 0.2 * Math.sin(X * 1.7 + r * 2.1 + t * 0.03) + 0.06 * Math.sin(X * 4.1 - r));
        const thick = h * (0.05 + 0.035 * Math.sin(X * 2.3 + r * 1.3 + t * 0.02));
        top.push([x, mid - thick]); bot.push([x, mid + thick]);
      }
      ctx.moveTo(top[0][0], top[0][1]);
      top.forEach((p) => ctx.lineTo(p[0], p[1]));
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath();
      const key = r === 1 ? 'b' : 'a';
      ctx.fillStyle = gradient((X) => mix(sample(key, X), NEUTRAL, 0.3), x0, 0.11 * (1 - 0.4 * quiet), 0);
      ctx.fill();
    }

    /* Guilloché families */
    ctx.lineWidth = 0.6;
    const dots = [];
    for (let set = 0; set < 2; set++) {
      const s = set ? -1 : 1;
      const key = set ? 'b' : 'a';
      for (let i = 0; i < LINES; i++) {
        const k = i / (LINES - 1);
        const weight = clamp01((dens * LINES - RANK[set][i]) / 2);   // soft in and out as density changes
        if (weight < 0.02) continue;

        const isCyan = !set && ACCENT_A.includes(i);
        const isEdge = set && i === EDGE_B;
        let colorFn, scale = weight;
        if (isCyan) {
          colorFn = (X) => mix(C.cyan, C.aqua, 0.5 + 0.5 * Math.sin(X * 1.3));
          scale *= 0.9 + 1.5 * sample('acc', centre);
        } else if (isEdge) {
          colorFn = () => C.lavender;
          scale *= 0.8 + 1.3 * sample('acc', centre);
        } else {
          colorFn = (X) => mix(sample(key, X), NEUTRAL, 0.4);
        }

        const r1 = hash(i + set * 31), r2 = hash(i * 7 + set * 13 + 5);
        const life = isCyan || isEdge ? null
          : r1 < 0.4 ? [-1, 0.55 + 0.4 * r2] : r1 < 0.7 ? [0.1 + 0.3 * r2, 2] : [-1, 2];
        ctx.strokeStyle = gradient(colorFn, x0, scale, quiet, life);
        ctx.lineWidth = isCyan || isEdge ? 0.8 : 0.6;
        ctx.beginPath();
        for (let x = -STEP; x <= w + STEP; x += STEP) {
          const y = lineY(x0 + x / w, k, s, t);
          if (x === -STEP) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // orange-gold micro accents, fixed to the surface, riding the cyan group
        if (isCyan && i === ACCENT_A[0]) {
          const every = 0.37;                                  // world units between dots
          for (let n = Math.ceil(x0 / every); n * every < x0 + 1; n++) {
            const X = n * every;
            dots.push([(X - x0) * w, lineY(X, k, s, t), hash(n) > 0.55]);
          }
        }
      }
    }

    const acc = sample('acc', centre);
    dots.forEach(([x, y, gold]) => {
      ctx.beginPath();
      ctx.arc(x, y, gold ? 2.2 : 1.6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(gold ? C.amber : C.cyan, (gold ? 0.55 : 0.45) * acc);
      ctx.fill();
    });

    quietMask(quiet);
    haze();
  }

  // Called every frame by js/world.js with the camera position (screen widths)
  (AS.cameraListeners = AS.cameraListeners || []).push((c, now) => {
    cam = c;
    if (!reduce) time = now / 1000;
    if (reduce && Math.abs(cam - lastCam) < 1e-4) return;  // static when nothing moves
    lastCam = cam;
    draw();
  });

  window.addEventListener('resize', resize);
  resize();
})();
