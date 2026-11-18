/* ==========================================================================
   SCENE 06 — THE BANKNOTE RESPONDS
   Four modes, one active at a time: TOUCH · TILT · LIGHT · FLIP
   Keyboard (while on this scene): 1–4 select a mode (press again to clear).
   Esc is reserved for "back to the beginning".
   ========================================================================== */

(function () {
  const scene = document.querySelector('.scene--respond');
  if (!scene) return;

  const { notes, assets, copy, config, featureLayout: FL } = AS;
  const C = copy.respond;
  const MODES = ['touch', 'tilt', 'light', 'flip'];
  const $ = (id) => document.getElementById(id);

  const noteEl   = $('note3d');
  const tiltEl   = $('note-tilt');
  const cardEl   = $('note-card');
  const caption  = $('mode-caption');
  const touchLayer = $('touch-layer');
  const ring     = $('touch-ring');
  const range    = $('light-range');

  let featured = notes.find((n) => n.id === config.featured) || notes[notes.length - 1];
  let mode = null;

  /* ------------------------------------------------------------------
     FEATURED NOTE ARTWORK
     ARTWORK: uses AS.notes[].front / .back from content.js
     ------------------------------------------------------------------ */
  function renderFeatured() {
    $('slot-front').replaceChildren(AS.image({
      src: featured.front,
      label: 'Featured banknote front',
      meta: `${featured.value} · ${featured.species} — ${featured.front}`,
      accent: featured.accent,
    }));
    $('slot-back').replaceChildren(AS.image({
      src: featured.back,
      label: 'Featured banknote back',
      meta: `${featured.value} · ${featured.species} — ${featured.back}`,
      accent: featured.accent,
    }));
    noteEl.style.setProperty('--accent', featured.accent);
    picker.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.id === featured.id)));
  }

  const picker = $('denom-picker');
  notes.forEach((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = n.id;
    b.textContent = n.value;
    b.title = `${n.species} — ${n.strategy}`;
    b.addEventListener('click', () => { featured = n; renderFeatured(); });
    picker.appendChild(b);
  });
  renderFeatured();

  /* ------------------------------------------------------------------
     FEATURE POSITIONS (from AS.featureLayout)
     ------------------------------------------------------------------ */
  const pos = (el, r) => {
    if (r.x != null) el.style.left = r.x + '%';
    if (r.y != null) el.style.top = r.y + '%';
    if (r.w != null) el.style.width = r.w + '%';
    if (r.h != null) el.style.height = r.h + '%';
  };

  /* ---------- TOUCH zones */
  FL.touchZones.forEach((z, i) => {
    const el = document.createElement('div');
    el.className = 'tzone';
    el.style.setProperty('--i', i);
    pos(el, z);
    el.innerHTML = `<span class="tzone__label">${String.fromCharCode(65 + i)} · ${z.label}</span>`;
    touchLayer.appendChild(el);
  });

  /* ---------- TILT thread: five discrete frames
     ARTWORK: AS.assets.thread[0..4] — transparent PNGs */
  const thread = $('thread');
  pos(thread, FL.thread);
  // the full-height thread motif passing through the note follows the same position
  scene.style.setProperty('--tx', FL.thread.x / 100);
  scene.style.setProperty('--tw', FL.thread.w / 100);
  const frames = assets.thread.map((src, i) => {
    const f = AS.image({
      src,
      label: `Anima frame 0${i + 1}`,
      meta: '',
      vertical: true,
      className: 'thread__frame',
    });
    f.style.setProperty('--f', i);
    thread.appendChild(f);
    return f;
  });
  const frameTicks = $('frames');
  assets.thread.forEach(() => frameTicks.appendChild(document.createElement('i')));
  let frameIndex = -1;
  function setFrame(i) {
    if (i === frameIndex) return;
    frameIndex = i;
    frames.forEach((f, j) => f.classList.toggle('is-current', j === i)); // instant swap — no morph
    [...frameTicks.children].forEach((t, j) => t.classList.toggle('is-current', j === i));
    $('frames-label').textContent = `${C.frameLabel} 0${i + 1}`;
  }
  setFrame(2);

  /* ---------- LIGHT: watermark + see-through register
     ARTWORK: AS.assets.watermark, registerFront, registerBack */
  const wm = $('wm-window');
  pos(wm, FL.watermark);
  wm.appendChild(AS.image({ src: assets.watermark, label: 'Watermark', meta: '', className: 'wm' }));

  pos($('register'), FL.register);
  const half = (side) =>
    `<svg viewBox="0 0 40 40" class="register__svg" aria-hidden="true">` +
    (side === 'a'
      ? '<path d="M20 2 A18 18 0 0 0 20 38 Z"/><path class="cut" d="M20 12 L12 20 L20 28 Z"/>'
      : '<path d="M20 2 A18 18 0 0 1 20 38 Z"/><path class="cut" d="M20 12 L28 20 L20 28 Z"/>') +
    `</svg>`;
  $('reg-a').appendChild(AS.image({ src: assets.registerFront, label: 'See-through register', fallback: half('a'), className: 'reg' }));
  $('reg-b').appendChild(AS.image({ src: assets.registerBack, label: 'See-through register', fallback: half('b'), className: 'reg' }));

  /* ------------------------------------------------------------------
     MODE SWITCHING
     ------------------------------------------------------------------ */
  const modesNav = $('modes');
  MODES.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mode';
    b.dataset.mode = m;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="mode__key">${i + 1}</span><span class="caps">${C.modes[m].label}</span>`;
    b.addEventListener('click', () => setMode(mode === m ? null : m));
    modesNav.appendChild(b);
  });

  function fillCaption(c) {
    $('mode-title').innerHTML = c.title;
    $('mode-sub').innerHTML = c.sub;
    $('mode-text').innerHTML = c.text;
  }
  fillCaption(C.idle);

  let captionTimer;
  function setMode(next) {
    // leave current mode cleanly
    if (mode === 'tilt') tiltEl.style.setProperty('--tilt', 0);
    if (mode === 'light') { holding = false; sliderValue = 0; range.value = 0; setLightTarget(0); }
    if (mode === 'flip') setFlipped(false);
    scene.classList.remove('has-flipped');

    mode = next;
    scene.dataset.mode = mode || '';
    modesNav.querySelectorAll('.mode').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));

    caption.classList.add('is-swapping');
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => {
      fillCaption(mode ? C.modes[mode] : C.idle);
      caption.classList.remove('is-swapping');
    }, 320);

    if (mode === 'flip') setTimeout(() => { if (mode === 'flip') setFlipped(true); }, 450);
  }

  /* ---------- TILT: map pointer X across the note to frames 1–5 */
  scene.addEventListener('pointermove', (e) => {
    if (mode === 'tilt') {
      const r = noteEl.getBoundingClientRect();
      const u = Math.min(0.9999, Math.max(0, (e.clientX - r.left) / r.width));
      setFrame(Math.floor(u * frames.length));
      tiltEl.style.setProperty('--tilt', ((u - 0.5) * 7).toFixed(2)); // subtle physical tilt, ±3.5°
    }
    if (mode === 'touch') {
      const r = touchLayer.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      ring.classList.toggle('is-on', inside);
      if (inside) ring.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
    }
  });

  /* ---------- LIGHT: hold the note, or drag the slider
     --light (0–1) on the scene drives every light effect in CSS. */
  let light = 0, target = 0, holding = false, sliderValue = 0, raf = 0;
  function setLightTarget(v) {
    target = v;
    if (!raf) raf = requestAnimationFrame(stepLight);
  }
  function stepLight() {
    light += (target - light) * 0.07;           // eased, no overshoot
    if (Math.abs(target - light) < 0.002) light = target;
    scene.style.setProperty('--light', light.toFixed(3));
    if (holding) range.value = Math.round(light * 100);
    raf = light === target ? 0 : requestAnimationFrame(stepLight);
  }
  noteEl.addEventListener('pointerdown', (e) => {
    if (mode !== 'light') return;
    e.preventDefault();
    holding = true;
    setLightTarget(1);
  });
  window.addEventListener('pointerup', () => {
    if (!holding) return;
    holding = false;
    range.value = Math.round(sliderValue * 100);
    setLightTarget(sliderValue);
  });
  range.addEventListener('input', () => {
    sliderValue = range.value / 100;
    setLightTarget(sliderValue);
  });

  /* ---------- FLIP */
  function setFlipped(on) {
    scene.classList.toggle('is-flipped', on);
  }
  noteEl.addEventListener('click', () => {
    if (mode === 'flip') setFlipped(!scene.classList.contains('is-flipped'));
  });
  cardEl.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform' && mode === 'flip') scene.classList.add('has-flipped');
  });

  /* ---------- Keyboard: 1–4 modes */
  document.addEventListener('keydown', (e) => {
    if (!scene.classList.contains('is-active') || e.metaKey || e.ctrlKey || e.altKey) return;
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i > -1) setMode(mode === MODES[i] ? null : MODES[i]);
  });

  /* ---------- Reset when leaving the scene */
  document.addEventListener('scene:leave', (e) => {
    if (e.detail.scene === scene) setMode(null);
  });
})();
