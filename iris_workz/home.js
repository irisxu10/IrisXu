// Renders the readable HTML project archive into #project-archive-root
// from window.PORTFOLIO_PROJECTS (see project-data.js).
//
// This file only builds DOM for the readable archive. It must stay free
// of canvas, p5.js, Matter.js, scroll animation, physics, or bubble
// behavior — that belongs to sketch.js / ball.js and later phases.

(function () {
  // Minimal bubble prototype (visibility-first rebuild). index/year/lenses/
  // secondaryLinks are intentionally not rendered here at all — the prior
  // attempt hid them with .visually-hidden and still left the project area
  // looking blank because the bubble itself wasn't rendering; this pass
  // has exactly one job, getting six real circular bubbles on screen, so
  // there is nothing else in the markup to introduce ambiguity. Their data
  // stays untouched in project-data.js.
  function createBubbleMedia(project) {
    var mediaWrap = document.createElement("span");
    mediaWrap.className = "project-bubble-media";

    var preview = project.preview || {};

    if (preview.type === "video") {
      var video = document.createElement("video");
      video.src = preview.src;
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("preload", "metadata");
      if (preview.alt) {
        video.setAttribute("aria-label", preview.alt);
      }
      mediaWrap.appendChild(video);
    } else if (preview.type === "image") {
      var img = document.createElement("img");
      img.src = preview.src;
      img.alt = preview.alt || "";
      img.loading = "lazy";
      mediaWrap.appendChild(img);
    }

    return mediaWrap;
  }

  // The title/description are real headings/paragraphs (h3/p), not spans —
  // each project's stable id (from project-data.js) becomes its element
  // IDs, which createBubbleLink below wires to the anchor via
  // aria-labelledby/aria-describedby instead of a generic aria-label.
  // h3 because the homepage's new identity layer (Part 5/6) introduced a
  // page h1 and demoted "Floating Archive" to h2 — these titles are its
  // subordinate project entries, not sibling sections.
  function createBubbleOverlay(project) {
    var overlay = document.createElement("span");
    overlay.className = "project-bubble-overlay";

    var title = document.createElement("h3");
    title.className = "project-bubble-title";
    title.id = "project-title-" + project.id;
    title.textContent = project.title;
    overlay.appendChild(title);

    if (project.description) {
      var desc = document.createElement("p");
      desc.className = "project-bubble-description";
      desc.id = "project-description-" + project.id;
      desc.textContent = project.description;
      overlay.appendChild(desc);
    }

    return overlay;
  }

  // The bubble anchor is the single primary link — shell, media, and
  // overlay are its direct children, with no intermediate wrapper. (Two
  // prior attempts collapsed to invisible because a wrapper between the
  // link and its layers had no explicit size; see the style.css comment
  // on .project-bubble for the full sizing-chain explanation.)
  function createBubbleLink(project) {
    var destination = project.destination || {};
    var link = document.createElement("a");
    link.className = "project-bubble";
    link.href = destination.href;

    var describedBy = "project-description-" + project.id;
    if (destination.external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      var externalId = "project-external-" + project.id;
      var externalIndicator = document.createElement("span");
      externalIndicator.className = "visually-hidden";
      externalIndicator.id = externalId;
      externalIndicator.textContent = "Opens in a new tab";
      link.appendChild(externalIndicator);

      describedBy += " " + externalId;
    }

    link.setAttribute("aria-labelledby", "project-title-" + project.id);
    if (project.description) {
      link.setAttribute("aria-describedby", describedBy);
    }

    var shell = document.createElement("span");
    shell.className = "project-bubble-shell";
    shell.setAttribute("aria-hidden", "true");
    link.appendChild(shell);

    link.appendChild(createBubbleMedia(project));
    link.appendChild(createBubbleOverlay(project));

    return link;
  }

  function createProjectEntry(project) {
    var li = document.createElement("li");
    li.className = "project-archive-item";
    li.dataset.projectId = project.id;

    var article = document.createElement("article");
    article.className = "project-entry";
    article.dataset.accent = project.accent || "";

    article.appendChild(createBubbleLink(project));

    li.appendChild(article);
    return li;
  }

  function renderArchive() {
    var root = document.getElementById("project-archive-root");
    if (!root) {
      console.error("home.js: #project-archive-root was not found in the document. Skipping archive render.");
      return;
    }

    var projects = window.PORTFOLIO_PROJECTS;
    if (!Array.isArray(projects)) {
      console.error("home.js: window.PORTFOLIO_PROJECTS is missing or invalid. Expected an array (see project-data.js). Skipping archive render.");
      return;
    }

    var list = document.createElement("ol");
    list.className = "project-archive-list";

    projects
      .filter(function (project) {
        return project && project.featured === true;
      })
      .slice()
      .sort(function (a, b) {
        return a.order - b.order;
      })
      .forEach(function (project) {
        try {
          list.appendChild(createProjectEntry(project));
        } catch (err) {
          console.error("home.js: failed to render project entry" + (project && project.id ? " \"" + project.id + "\"" : "") + ".", err);
        }
      });

    root.appendChild(list);
  }

  // Renders the three primary navigation bubbles (Archive / About /
  // Writings) into the first-viewport identity layer, from the same
  // window.SITE_NAVIGATION used by renderSiteNavigation() below and by
  // header.js/sketch.js — one content source, three renderers. This is
  // real HTML navigation; the old Canvas-drawn menu text and its click
  // hit-testing are disabled separately in sketch.js.
  function renderPrimaryNavigation() {
    var nav = document.getElementById("home-primary-bubbles");
    if (!nav) {
      console.error("home.js: #home-primary-bubbles was not found in the document. Skipping primary navigation render.");
      return;
    }

    var items = window.SITE_NAVIGATION;
    if (!Array.isArray(items)) {
      console.error("home.js: window.SITE_NAVIGATION is missing or invalid. Expected an array (see nav-data.js). Skipping primary navigation render.");
      return;
    }

    items.forEach(function (item) {
      var link = document.createElement("a");
      link.className = "home-nav-bubble home-nav-bubble--" + item.id;
      link.href = item.path;
      link.textContent = item.label;
      if (item.id === "archive") {
        link.setAttribute("aria-current", "location");
      }
      nav.appendChild(link);
    });
  }

  // Renders the semantic Archive / About / Writings row inside the
  // Floating Archive section, from window.SITE_NAVIGATION (see
  // nav-data.js). Kept independent of renderArchive() above — a failure
  // here must never prevent the project archive from rendering.
  function renderSiteNavigation() {
    var nav = document.getElementById("archive-site-navigation");
    if (!nav) {
      console.error("home.js: #archive-site-navigation was not found in the document. Skipping site navigation render.");
      return;
    }

    var items = window.SITE_NAVIGATION;
    if (!Array.isArray(items)) {
      console.error("home.js: window.SITE_NAVIGATION is missing or invalid. Expected an array (see nav-data.js). Skipping site navigation render.");
      return;
    }

    var list = document.createElement("ul");
    list.className = "archive-site-navigation-list";

    items.forEach(function (item) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.className = "archive-site-navigation-link";
      link.href = item.path;
      link.textContent = item.label;
      if (item.id === "archive") {
        link.setAttribute("aria-current", "location");
      }
      li.appendChild(link);
      list.appendChild(li);
    });

    nav.appendChild(list);
  }

  // Fixed (not randomized) decorative bubble layout for the transition
  // corridor between the hero and the Floating Archive. Positions are
  // hand-authored, not generated with Math.random(), so the corridor
  // looks identical on every load/refresh. Density and opacity fall off
  // in three unlabeled stages — near the hero boundary (denser, closer
  // to the edges), the corridor middle (sparser), and the archive
  // approach (sparse, larger, softer) — reusing the same ball palette
  // as sketch.js. x/y are percentages of the corridor box; a broad
  // central band (roughly x 32-66) is intentionally kept clear so the
  // corridor reads as an open passage rather than a wall of circles.
  // depth is a fixed, deterministic tier ("far" | "middle" | "near") used
  // only by the corridor depth choreography (H2.3) to pick how far a
  // bubble's CSS transform can travel on scroll — it is derived from each
  // bubble's own existing size (larger circles sit "nearer" and move more)
  // and carries no semantic/ARIA meaning. See setupCorridorDepthChoreography().
  var TRANSITION_BUBBLES = [
    // stage 1 — hero boundary
    { x: 6, y: 4, size: 46, opacity: 0.55, color: "rgb(255, 182, 193)", depth: "near" },
    { x: 14, y: 10, size: 30, opacity: 0.5, color: "rgb(255, 99, 71)", depth: "middle" },
    { x: 90, y: 6, size: 40, opacity: 0.5, color: "rgb(0, 191, 255)", depth: "near" },
    { x: 82, y: 14, size: 26, opacity: 0.45, color: "rgb(255, 215, 0)", depth: "middle" },
    { x: 4, y: 20, size: 24, opacity: 0.4, color: "rgb(34, 139, 34)", depth: "middle" },
    { x: 95, y: 22, size: 34, opacity: 0.45, color: "rgb(160, 82, 45)", depth: "middle" },
    { x: 20, y: 26, size: 20, opacity: 0.35, color: "rgb(210, 105, 30)", depth: "far" },
    { x: 76, y: 28, size: 22, opacity: 0.4, color: "rgb(255, 140, 0)", depth: "far" },
    { x: 10, y: 12, size: 18, opacity: 0.35, color: "rgb(165, 42, 42)", depth: "far" },
    { x: 88, y: 18, size: 16, opacity: 0.3, color: "rgb(139, 69, 19)", depth: "far" },

    // stage 2 — corridor middle
    { x: 8, y: 36, size: 30, opacity: 0.3, color: "rgb(255, 99, 71)", depth: "middle" },
    { x: 92, y: 40, size: 28, opacity: 0.3, color: "rgb(0, 191, 255)", depth: "middle" },
    { x: 16, y: 52, size: 22, opacity: 0.25, color: "rgb(34, 139, 34)", depth: "far" },
    { x: 84, y: 50, size: 18, opacity: 0.22, color: "rgb(255, 182, 193)", depth: "far" },
    { x: 6, y: 60, size: 24, opacity: 0.24, color: "rgb(160, 82, 45)", depth: "middle" },
    { x: 94, y: 62, size: 20, opacity: 0.22, color: "rgb(255, 140, 0)", depth: "far" },
    { x: 30, y: 46, size: 14, opacity: 0.2, color: "rgb(255, 215, 0)", depth: "far" },
    { x: 68, y: 58, size: 12, opacity: 0.18, color: "rgb(210, 105, 30)", depth: "far" },
    { x: 44, y: 56, size: 10, opacity: 0.16, color: "rgb(165, 42, 42)", depth: "far" },

    // stage 3 — archive approach
    { x: 12, y: 70, size: 54, opacity: 0.18, color: "rgb(0, 191, 255)", depth: "near" },
    { x: 88, y: 74, size: 60, opacity: 0.16, color: "rgb(255, 99, 71)", depth: "near" },
    { x: 24, y: 84, size: 38, opacity: 0.14, color: "rgb(34, 139, 34)", depth: "near" },
    { x: 76, y: 88, size: 44, opacity: 0.14, color: "rgb(255, 215, 0)", depth: "near" },
    { x: 50, y: 92, size: 26, opacity: 0.12, color: "rgb(160, 82, 45)", depth: "middle" },
    { x: 6, y: 94, size: 20, opacity: 0.12, color: "rgb(255, 140, 0)", depth: "far" },
    { x: 94, y: 96, size: 22, opacity: 0.1, color: "rgb(210, 105, 30)", depth: "far" }
  ];

  // Purely decorative — renders into an aria-hidden container between
  // the hero and the Floating Archive, no links, no text, no physics,
  // no per-frame animation loop. A failure here must never block the
  // archive or navigation renders above.
  function renderTransitionCorridor() {
    var root = document.getElementById("home-transition-bubbles");
    if (!root) {
      console.error("home.js: #home-transition-bubbles was not found in the document. Skipping transition corridor render.");
      return;
    }

    TRANSITION_BUBBLES.forEach(function (bubble) {
      var span = document.createElement("span");
      span.className = "home-transition-bubble";
      span.style.setProperty("--x", bubble.x + "%");
      span.style.setProperty("--y", bubble.y + "%");
      span.style.setProperty("--size", bubble.size + "px");
      span.style.setProperty("--opacity", bubble.opacity);
      span.style.setProperty("--color", bubble.color);
      span.setAttribute("data-depth", bubble.depth);
      root.appendChild(span);
    });
  }

  // Subtle scroll-linked depth for the 26 decorative corridor bubbles
  // (H2.3). Fully independent of setupProjectEcosystemReveal() below —
  // separate IntersectionObserver, separate concern (this never reveals
  // anything, it only adjusts three CSS custom properties on the
  // corridor root while it is near the viewport). Progressive
  // enhancement: without this running, the corridor is simply static
  // (see the --corridor-shift-* fallbacks in style.css).
  function setupCorridorDepthChoreography() {
    var corridor = document.querySelector(".home-transition-corridor");
    if (!corridor) {
      return;
    }

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (window.innerWidth <= 767) {
      return;
    }

    if (typeof IntersectionObserver !== "function" || typeof window.requestAnimationFrame !== "function") {
      return;
    }

    var framePending = false;
    var pendingFrameId = null;
    var scrollActive = false;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function updateCorridorState() {
      var rect = corridor.getBoundingClientRect();
      var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      var progress = clamp((viewportHeight - rect.top) / (viewportHeight + rect.height), 0, 1);

      // Same architecture serves tablet and desktop; only the maximum
      // travel per tier is reduced, checked live so a resize between
      // tiers takes effect on the next update without re-initializing.
      var isTablet = window.innerWidth <= 1023;
      var farMax = isTablet ? 8 : 10;
      var middleMax = isTablet ? 15 : 20;
      var nearMax = isTablet ? 25 : 34;

      corridor.style.setProperty("--corridor-shift-far", (progress * farMax).toFixed(2) + "px");
      corridor.style.setProperty("--corridor-shift-middle", (progress * middleMax).toFixed(2) + "px");
      corridor.style.setProperty("--corridor-shift-near", (progress * nearMax).toFixed(2) + "px");
    }

    function requestUpdate() {
      if (framePending) {
        return;
      }
      framePending = true;
      pendingFrameId = window.requestAnimationFrame(function () {
        framePending = false;
        pendingFrameId = null;
        updateCorridorState();
      });
    }

    function activateScroll() {
      if (scrollActive) {
        return;
      }
      scrollActive = true;
      window.addEventListener("scroll", requestUpdate, { passive: true });
      requestUpdate();
    }

    function deactivateScroll() {
      if (!scrollActive) {
        return;
      }
      scrollActive = false;
      window.removeEventListener("scroll", requestUpdate);
      if (framePending && pendingFrameId !== null && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(pendingFrameId);
        framePending = false;
        pendingFrameId = null;
      }
    }

    // Calculated once, before the observer exists, so a direct
    // #floating-archive link, a reload while already scrolled, or a
    // restored scroll position all land on the correct depth immediately
    // rather than flashing to 0px and waiting for the next scroll event.
    updateCorridorState();

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          activateScroll();
        } else {
          deactivateScroll();
        }
      });
    }, {
      threshold: 0,
      rootMargin: "35% 0px 35% 0px"
    });

    observer.observe(corridor);

    window.addEventListener("resize", function () {
      if (window.innerWidth <= 767) {
        deactivateScroll();
        return;
      }
      requestUpdate();
    }, { passive: true });
  }

  // Progressive enhancement only: the archive is fully visible and usable
  // without this. It opts into a one-time reveal (introduction, then the
  // six project entries in reading order) only once all entries exist,
  // reduced motion is not requested, and IntersectionObserver exists.
  // Entrance transforms live on .project-archive-item (the <li> wrapper),
  // never on .project-bubble itself, since the bubble already owns its
  // own hover/focus transform (see style.css) and a second transform on
  // the same element would overwrite rather than compose with it.
  function setupProjectEcosystemReveal() {
    var archive = document.getElementById("floating-archive");
    var items = archive ? archive.querySelectorAll(".project-archive-item") : null;

    if (!archive || !items || items.length === 0) {
      return;
    }

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (typeof IntersectionObserver !== "function") {
      return;
    }

    var observeTarget = archive.querySelector(".archive-introduction") || archive;
    var revealed = false;
    var observer = null;

    function reveal() {
      if (revealed) {
        return;
      }
      revealed = true;
      archive.classList.add("is-project-ecosystem-visible");
      if (observer) {
        observer.disconnect();
      }
      archive.removeEventListener("focusin", reveal);
    }

    archive.classList.add("is-reveal-ready");
    archive.addEventListener("focusin", reveal);

    // Direct #floating-archive navigation (link click, reload, back/
    // forward) must not land on six invisible bubbles.
    if (window.location.hash === "#floating-archive") {
      reveal();
      return;
    }

    // Already-in-view at load (e.g. a tall/short viewport landing mid-
    // page) gets revealed immediately rather than waiting on a scroll
    // that may never come.
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    if (observeTarget.getBoundingClientRect().top < viewportHeight) {
      reveal();
      return;
    }

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal();
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px"
    });

    observer.observe(observeTarget);
  }

  function renderHomepage() {
    renderPrimaryNavigation();
    renderArchive();
    renderSiteNavigation();
    renderTransitionCorridor();
    setupCorridorDepthChoreography();
    setupProjectEcosystemReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHomepage);
  } else {
    renderHomepage();
  }
})();
