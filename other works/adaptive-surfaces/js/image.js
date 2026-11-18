/* ==========================================================================
   AS.image — the one reusable image component
   --------------------------------------------------------------------------
   AS.image({ src, label })  →  <figure class="as-image">

   • Tries to load `src`. If the file exists it fades in.
   • If the file is missing, a labelled placeholder stays in its place
     ("[ LABEL ]" + the expected file path) instead of a broken image.
   • To swap artwork, change the path in js/content.js — nothing else.

   Options
     src        path to the PNG (relative to index.html)
     label      text shown inside the placeholder, e.g. "Turtle · Banknote front"
     meta       second line in the placeholder (defaults to the file path)
     className  extra classes
     accent     colour for the placeholder's corner marks
     fit        object-fit for the loaded image ('contain' | 'cover')
     rotate     true → rotate a landscape image 90° to fill an upright frame
     vertical   true → placeholder label runs vertically (for tall, narrow slots)
     fallback   custom HTML for the placeholder instead of the default label
   ========================================================================== */

window.AS = window.AS || {};

AS.image = function image(opts) {
  const {
    src = '',
    label = 'Image',
    meta = src,
    className = '',
    accent = '',
    fit = 'contain',
    rotate = false,
    vertical = false,
    fallback = null,
  } = opts || {};

  const fig = document.createElement('figure');
  fig.className = ['as-image', 'is-placeholder',
    rotate ? 'as-image--rotate' : '',
    vertical ? 'as-image--vertical' : '',
    className].filter(Boolean).join(' ');
  if (accent) fig.style.setProperty('--accent', accent);
  fig.dataset.src = src;

  // Placeholder (visible until the real file loads)
  const ph = document.createElement('div');
  ph.className = 'as-image__ph';
  ph.innerHTML = fallback != null
    ? fallback
    : `<span class="as-image__label">[ ${label} ]</span>` +
      (meta ? `<span class="as-image__path">${meta}</span>` : '');
  fig.appendChild(ph);

  // Real artwork (silently removed if the file does not exist yet)
  if (src) {
    const img = document.createElement('img');
    img.className = 'as-image__img';
    img.alt = label;
    img.decoding = 'async';
    img.draggable = false;
    img.style.objectFit = fit;
    img.addEventListener('load', () => {
      fig.classList.remove('is-placeholder');
      fig.classList.add('is-loaded');
    });
    img.addEventListener('error', () => img.remove());
    img.src = src;
    fig.appendChild(img);
  }

  return fig;
};
