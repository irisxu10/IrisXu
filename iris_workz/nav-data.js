// Shared primary-navigation content.
//
// This is the single content source for:
// - the inner-page HTML header navigation (header.js)
// - the homepage Canvas menu (sketch.js)
// - the semantic homepage navigation below the Canvas (home.js)
//
// It intentionally contains no Canvas coordinates, font sizes, collision
// body dimensions, animation timing, CSS classes, DOM rendering code, or
// path-prefix detection — those belong to whichever consumer renders
// this data, not to the data itself.

window.SITE_NAVIGATION = Object.freeze([
  Object.freeze({
    id: "archive",
    label: "Archive",
    path: "index.html#floating-archive"
  }),
  Object.freeze({
    id: "about",
    label: "About",
    path: "about.html"
  }),
  Object.freeze({
    id: "writings",
    label: "Writings",
    path: "writings.html"
  })
]);

window.SITE_HOME = Object.freeze({
  label: "IRIS",
  path: "index.html"
});
