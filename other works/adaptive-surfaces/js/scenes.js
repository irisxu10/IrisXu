/* ==========================================================================
   SCENE BUILDERS
   Fills [data-copy] text and builds the repeated elements of each scene from
   AS.notes. Timings (data-reveal, in ms) are set here for generated items.
   The five-column animal → banknote → family zone lives in js/columns.js.
   ========================================================================== */

window.AS = window.AS || {};

AS.h = function (tag, cls, html) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html != null) el.innerHTML = html;
  return el;
};

(function () {
  const { copy, notes } = AS;
  const h = AS.h;

  /* ---------- 1. Text: <el data-copy="idea.statement"> ← AS.copy.idea.statement */
  document.querySelectorAll('[data-copy]').forEach((el) => {
    const value = el.dataset.copy.split('.').reduce((o, k) => (o ? o[k] : undefined), copy);
    if (value != null) el.innerHTML = value;
  });

  /* ---------- 2. Concept — five strategies */
  const words = document.getElementById('idea-words');
  notes.forEach((n, i) => {
    const li = h('li', 'idea__word');
    li.style.setProperty('--accent', n.accent);
    li.dataset.reveal = 900 + i * 450;
    li.innerHTML =
      `<span class="idea__glyph">${AS.glyphs[n.id]}</span>` +
      `<span class="caps idea__verb">${n.strategy}</span>`;
    words.appendChild(li);
  });

  /* ---------- 3. Biology → security rows */
  const rows = document.getElementById('rows');
  notes.forEach((n, i) => {
    const li = h('li', 'row');
    li.style.setProperty('--accent', n.accent);
    li.dataset.reveal = 600 + i * 800;
    li.innerHTML =
      `<span class="row__glyph">${AS.glyphs[n.id]}</span>` +
      `<span class="row__bio" data-haze>${n.strategy}</span>` +
      `<span class="row__link" aria-hidden="true"><i class="dot dot--a"></i><b></b><i class="dot dot--b"></i></span>` +
      `<span class="row__resp" data-haze>${n.response}</span>`;
    rows.appendChild(li);
  });
})();
