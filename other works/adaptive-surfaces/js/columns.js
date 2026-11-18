/* ==========================================================================
   FIVE ANIMALS → FIVE BANKNOTES → ONE FAMILY   (zone 03–05)
   --------------------------------------------------------------------------
   The frame is held in place (pinned, see js/world.js) while the camera keeps
   travelling, so moving forward drives everything here — scrubbing back and
   forth plays it in reverse. Timing comes from AS.WORLD.transform / .release.

   Each strip transforms as its own progress t goes 0 → 1:
     photo zooms toward n.focus and fades
     → the reptile micro-pattern surfaces
     → the strategy word and fine guilloché lines pass through
     → the banknote opens from the centre
   Then the release f (0 → 1) turns the upright notes and spreads them into
   the family composition (FAMILY below).

   Clicking a strip once it is a banknote opens the optional focused view.
   ========================================================================== */

(function () {
  const frame = document.querySelector('.scene--columns');
  if (!frame) return;

  const { notes, WORLD } = AS;
  const h = AS.h;
  const P = WORLD.pin, T = WORLD.transform, R = WORLD.release;
  const strips = document.getElementById('strips');
  const labels = document.getElementById('family-labels');

  /* The released family: centre (vw, vh), note width (vw), rotation (deg).
     Two calm rows: 1 · 10 · 100 above, 5 · 20 below. */
  const FAMILY = [
    { x: 22, y: 33, w: 24, r: -1.5 },
    { x: 36, y: 65, w: 24, r: 1 },
    { x: 50, y: 33, w: 24, r: -0.5 },
    { x: 64, y: 65, w: 24, r: 1.5 },
    { x: 78, y: 33, w: 24, r: -1 },
  ];

  /* Fine guilloché that passes through during the transformation */
  function guilloche() {
    let d = '';
    for (let k = 0; k < 22; k++) {
      d += 'M';
      for (let y = -4; y <= 214; y += 6) {
        const x = 2 + k * 4.6
          + 5 * Math.sin((y / 210) * Math.PI * 3 + k * 0.45)
          + 2 * Math.sin((y / 210) * Math.PI * 9 - k * 0.8);
        d += `${x.toFixed(2)} ${y} `;
      }
    }
    return `<svg viewBox="0 0 100 210" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  const shifts = [0, -1.2, 0.6, -0.8, 1];   // vh — exhibition-wall rhythm

  const items = notes.map((n, i) => {
    const el = h('article', 'strip');
    el.style.setProperty('--accent', n.accent);
    el.style.setProperty('--focus', n.focus);
    el.style.setProperty('--shift', shifts[i] + 'vh');
    el.dataset.reveal = 120 + i * 140;
    el.innerHTML =
      `<div class="strip__move">` +
        `<div class="strip__media">` +
          `<div class="strip__photo"></div>` +
          `<div class="strip__pattern">${AS.patterns.svg(n.id)}</div>` +
          `<div class="strip__note"></div>` +
          `<div class="strip__lines">${guilloche()}</div>` +
          `<span class="caps strip__word">${n.strategy}</span>` +
        `</div>` +
      `</div>` +
      `<div class="strip__meta">` +
        `<span class="strip__value">${n.value}</span>` +
        `<span class="strip__name">${n.species}</span>` +
        `<span class="caps strip__strategy">${n.strategy}</span>` +
        `<p class="quote strip__line">${n.line}</p>` +
      `</div>`;

    // ARTWORK: AS.notes[i].photo — cropped to fill the strip
    el.querySelector('.strip__photo').appendChild(AS.image({
      src: n.photo, label: `${n.species} photo`, accent: n.accent, fit: 'cover', className: 'as-image--photo',
    }));
    // ARTWORK: AS.notes[i].front — landscape note turned upright to fill the strip
    el.querySelector('.strip__note').appendChild(AS.image({
      src: n.front, label: `${n.species} banknote`, meta: '', accent: n.accent, rotate: true, vertical: true,
    }));
    strips.appendChild(el);

    const label = h('span', 'caps family-label', `<b>${n.value}</b> — ${n.strategy}`);
    label.style.left = `calc(${FAMILY[i].x - FAMILY[i].w / 2}vw)`;
    label.style.top = `calc(${FAMILY[i].y}vh + ${FAMILY[i].w / 2.1 / 2}vw + 16px)`;
    labels.appendChild(label);

    const item = { el, move: el.querySelector('.strip__move'), media: el.querySelector('.strip__media'), label, geo: null, last: {} };
    el.addEventListener('click', () => { if (el.classList.contains('is-note')) openFocus(i); });
    return item;
  });

  /* ---------- geometry for the release
     Layout offsets (not screen rects), so reveal offsets and transforms
     in progress never distort the measurement. */
  function measure() {
    const vw = window.innerWidth, vh = window.innerHeight;
    items.forEach((it, i) => {
      // .strip__move sits at the top-left of its strip; strips are laid out inside .strips
      const cx = strips.offsetLeft + it.el.offsetLeft + it.move.offsetWidth / 2;
      const cy = strips.offsetTop + it.el.offsetTop + it.move.offsetHeight / 2 + (shifts[i] / 100) * vh;
      const F = FAMILY[i];
      it.geo = {
        dx: (F.x / 100) * vw - cx,
        dy: (F.y / 100) * vh - cy,
        s: ((F.w / 100) * vw) / it.move.offsetHeight,   // upright long side → horizontal width
        rot: -90 + F.r,
      };
      it.last.f = null;
    });
  }

  /* ---------- per-frame update from the camera */
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (v) => v * v * (3 - 2 * v);
  const bell = (t, c, r) => Math.max(0, 1 - Math.abs(t - c) / r);
  function setVar(it, name, v) {
    const s = v.toFixed(3);
    if (it.last[name] === s) return;
    it.last[name] = s;
    it.el.style.setProperty(name, s);
  }

  let lastCam = -1;
  (AS.cameraListeners = AS.cameraListeners || []).push((cam) => {
    if (Math.abs(cam - lastCam) < 1e-5) return;
    lastCam = cam;
    if (!items[0].geo) measure();
    const p = cam - P.start;                      // travel since the frame was pinned

    let allNotes = true, anyNote = false, maxF = 0;
    items.forEach((it, i) => {
      const t = clamp01((p - (T.start + i * T.every)) / T.span);
      const f = smooth(clamp01((p - R.start - i * 0.07) / (R.span - 0.28)));
      maxF = Math.max(maxF, f);

      setVar(it, '--photo-s', 1 + 0.75 * smooth(t));
      setVar(it, '--photo-o', 1 - smooth(clamp01((t - 0.12) / 0.4)));
      setVar(it, '--pattern', bell(t, 0.34, 0.26));
      setVar(it, '--word', bell(t, 0.45, 0.3));
      setVar(it, '--lines', bell(t, 0.6, 0.22));
      setVar(it, '--note', smooth(clamp01((t - 0.5) / 0.45)));
      setVar(it, '--meta', 1 - clamp01(f * 2.5));
      setVar(it, '--label', clamp01((f - 0.8) / 0.2));

      it.el.classList.toggle('is-note', t > 0.95);
      if (t < 1) allNotes = false;
      if (t > 0) anyNote = true;

      const g = it.geo;
      const key = f.toFixed(4);
      if (it.last.f !== key) {
        it.last.f = key;
        it.move.style.transform = f > 0
          ? `translate(${(g.dx * f).toFixed(1)}px, ${(g.dy * f).toFixed(1)}px) rotate(${(g.rot * f).toFixed(2)}deg) scale(${(1 + (g.s - 1) * f).toFixed(4)})`
          : '';
        it.label.style.opacity = clamp01((f - 0.8) / 0.2);
      }
    });

    frame.classList.toggle('is-notes', anyNote && maxF < 0.5);
    frame.classList.toggle('is-family', maxF >= 0.5);
    frame.classList.toggle('is-releasing', maxF > 0);
    frame.classList.toggle('is-complete', allNotes && maxF < 0.02);
    frame.style.setProperty('--release', maxF.toFixed(3));
  });

  window.addEventListener('resize', () => { items.forEach((it) => { it.geo = null; }); lastCam = -1; });

  /* ------------------------------------------------------------------
     FOCUSED VIEW (optional detail)
     ------------------------------------------------------------------ */
  const focus = document.getElementById('focus');
  let current = -1;

  function openFocus(i) {
    const n = notes[i];
    current = i;
    focus.style.setProperty('--accent', n.accent);
    // ARTWORK: AS.notes[i].front / .back
    document.getElementById('focus-front').replaceChildren(AS.image({
      src: n.front, label: `${n.species} · banknote front`, accent: n.accent,
    }));
    document.getElementById('focus-back').replaceChildren(AS.image({
      src: n.back, label: `${n.species} · banknote back`, accent: n.accent,
    }));
    document.getElementById('focus-value').textContent = n.value;
    document.getElementById('focus-names').innerHTML =
      `<span>${n.species}</span><span class="sep"></span><span class="focus__strategy">${n.strategy}</span>`;
    focus.classList.remove('is-flipped');
    focus.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-open');
    focus.classList.add('is-open');
  }

  function closeFocus() {
    if (current < 0) return;
    current = -1;
    focus.classList.remove('is-open');
    focus.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('focus-open');
  }

  document.getElementById('focus-flip').addEventListener('click', () => focus.classList.toggle('is-flipped'));
  document.getElementById('focus-card').addEventListener('click', () => focus.classList.toggle('is-flipped'));
  focus.querySelectorAll('[data-focus-close]').forEach((b) => b.addEventListener('click', closeFocus));
  document.addEventListener('focus:close', closeFocus);
})();
