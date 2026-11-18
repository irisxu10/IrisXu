/* ==========================================================================
   THE CAMERA — one continuous horizontal world
   --------------------------------------------------------------------------
   The viewport is a camera gliding across one long surface. `cam` is its
   position in screen widths. Every frame:

     track (foreground)   moves at 1×
     midground patterns   move at 0.85×
     curve field          drawn at 0.6×   (js/curves.js)
     paper grain          moves at 0.4×

   Input
     wheel / trackpad (vertical or horizontal) → glide; settles onto the
       nearest stop when scrolling stops close to one (AS.config.snapRange)
     → · Space · PageDown        next stop
     ← · PageUp                  previous stop
     Home · Esc · title click    back to the beginning (Esc first closes the
                                 focused banknote view if it is open)
     End                         last stop
     F                           full screen
     URL #n                      start at stop n (for rehearsal)

   Elements with data-reveal="ms" fade in when they come into view from the
   right (after that delay) and reset when they leave to the right again.
   Listeners in AS.cameraListeners receive (cam, now, vw) every frame.
   ========================================================================== */

AS.world = (function () {
  const W = AS.WORLD;
  const cfg = AS.config;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);

  const track = $('track');
  const mid = $('mid');
  const paper = $('paper');
  const bar = $('progress-bar');
  const chapterEl = $('chapter');
  const listeners = (AS.cameraListeners = AS.cameraListeners || []);

  const stops = W.stops.slice().sort((a, b) => a - b);
  const maxCam = stops[stops.length - 1];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- place the zones along the track */
  const frames = Object.entries(W.frames).map(([id, f]) => {
    const el = document.getElementById('z-' + id);
    el.style.setProperty('--x', f.x);
    el.style.setProperty('--w', f.w || 1);
    const extra = W.pin && W.pin.frame === id ? W.pin.length : 0;
    return { id, el, from: f.x - 0.55, to: f.x + (f.w || 1) - 0.45 + extra, active: false };
  });
  const pinEl = W.pin ? document.getElementById('z-' + W.pin.frame) : null;

  let vw = window.innerWidth;
  let cam = 0, target = 0;

  /* ---------- reveals */
  let reveals = [];
  function measure() {
    vw = window.innerWidth;
    track.style.transform = 'none';
    if (pinEl) pinEl.style.transform = 'none';
    reveals = Array.from(document.querySelectorAll('[data-reveal]')).map((el) => ({
      el,
      x: el.getBoundingClientRect().left,
      delay: +el.dataset.reveal || 0,
      on: el.classList.contains('is-in'),
    }));
    render(true);
  }
  function updateReveals() {
    const camPx = cam * vw;
    for (const r of reveals) {
      if (!r.on && r.x < camPx + vw * 0.82) {
        r.on = true;
        r.el.style.transitionDelay = (reduce ? 0 : r.delay) + 'ms';
        r.el.classList.add('is-in');
      } else if (r.on && r.x > camPx + vw * 1.02) {
        r.on = false;
        r.el.style.transitionDelay = '0ms';
        r.el.classList.remove('is-in');
      }
    }
  }

  /* ---------- zones: active state + enter/leave events (used by banknote.js) */
  function updateZones() {
    for (const f of frames) {
      const on = cam >= f.from && cam <= f.to;
      if (on === f.active) continue;
      f.active = on;
      f.el.classList.toggle('is-active', on);
      document.dispatchEvent(new CustomEvent(on ? 'scene:enter' : 'scene:leave', { detail: { scene: f.el } }));
    }
  }

  /* ---------- chapter label + progress line */
  let chapterKey = null, chapterTimer;
  function updateChapter() {
    let key = W.chapters[0][1];
    for (const [x, k] of W.chapters) if (cam >= x) key = k;
    if (key === chapterKey) return;
    chapterKey = key;
    chapterEl.classList.add('is-swapping');
    clearTimeout(chapterTimer);
    chapterTimer = setTimeout(() => {
      chapterEl.textContent = AS.chapters[key] || '';
      chapterEl.classList.remove('is-swapping');
    }, 350);
  }

  /* ---------- one frame */
  let lastRendered = -1;
  function render(force) {
    const moved = force || Math.abs(cam - lastRendered) > 1e-5;
    if (moved) {
      lastRendered = cam;
      const px = cam * vw;
      track.style.transform = `translate3d(${-px}px,0,0)`;
      mid.style.transform = `translate3d(${-px * 0.85}px,0,0)`;
      paper.style.backgroundPosition = `${-px * 0.4}px 0`;
      if (pinEl) {
        const held = clamp(cam - W.pin.start, 0, W.pin.length) * vw;
        pinEl.style.transform = `translate3d(${held}px,0,0)`;
      }
      bar.style.clipPath = `inset(0 ${((1 - cam / maxCam) * 100).toFixed(2)}% 0 0)`;
      document.body.classList.toggle('ui-quiet', cam > maxCam - 0.04);
      updateReveals();
      updateZones();
      updateChapter();
    }
  }

  function tick(now) {
    const ease = reduce ? 1 : cfg.glide;
    cam += (target - cam) * ease;
    if (Math.abs(target - cam) < 0.0004) cam = target;
    render(false);
    for (const fn of listeners) fn(cam, now, vw);
    requestAnimationFrame(tick);
  }

  /* ---------- navigation */
  function moveTo(x) { target = clamp(x, 0, maxCam); writeHash(); }
  function nearestStop(x) {
    return stops.reduce((best, s) => (Math.abs(s - x) < Math.abs(best - x) ? s : best), stops[0]);
  }
  function closeOverlay() {
    if (!document.body.classList.contains('focus-open')) return false;
    document.dispatchEvent(new CustomEvent('focus:close'));
    return true;
  }
  function next() {
    if (closeOverlay()) return;
    const s = stops.find((v) => v > target + 0.01);
    moveTo(s != null ? s : maxCam);
  }
  function prev() {
    if (closeOverlay()) return;
    const s = stops.slice().reverse().find((v) => v < target - 0.01);
    moveTo(s != null ? s : 0);
  }
  function home() { closeOverlay(); moveTo(0); }

  let hashTimer;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const i = stops.indexOf(nearestStop(target));
      try { history.replaceState(null, '', '#' + (i + 1)); } catch (_) { /* file:// */ }
    }, 400);
  }

  /* ---------- keyboard */
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(); break;
      case 'Escape': e.preventDefault(); if (!closeOverlay()) home(); break;
      case 'Home': e.preventDefault(); home(); break;
      case 'End': e.preventDefault(); moveTo(maxCam); break;
      case 'f': case 'F':
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
        break;
    }
  });

  /* ---------- buttons */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'next') next();
    if (btn.dataset.action === 'prev') prev();
    if (btn.dataset.action === 'home') home();
    btn.blur();
  });

  /* ---------- wheel / trackpad → horizontal travel, then settle */
  let settleTimer;
  function settleSoon() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      const s = nearestStop(target);
      if (Math.abs(s - target) <= cfg.snapRange) moveTo(s);
    }, 180);
  }
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (document.body.classList.contains('focus-open')) return;
    let d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (e.deltaMode === 1) d *= 32;          // lines → px
    if (e.deltaMode === 2) d *= window.innerHeight;
    target = clamp(target + (d / vw) * cfg.scrollSpeed, 0, maxCam);
    writeHash();
    settleSoon();
  }, { passive: false });

  /* ---------- touch drag (tablet rehearsal) */
  let tx0 = 0, t0 = 0;
  window.addEventListener('touchstart', (e) => { tx0 = e.touches[0].clientX; t0 = target; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    target = clamp(t0 - (e.touches[0].clientX - tx0) / vw * 1.4, 0, maxCam);
  }, { passive: true });
  window.addEventListener('touchend', settleSoon);

  /* ---------- start */
  window.addEventListener('resize', measure);
  const fromHash = parseInt(location.hash.slice(1), 10);
  if (Number.isFinite(fromHash)) cam = target = stops[clamp(fromHash - 1, 0, stops.length - 1)];
  measure();
  requestAnimationFrame(tick);

  return {
    next, prev, home, moveTo,
    get cam() { return cam; },
    get target() { return target; },
    stops,
  };
})();
