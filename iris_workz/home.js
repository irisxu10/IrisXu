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

  function createBubbleOverlay(project) {
    var overlay = document.createElement("span");
    overlay.className = "project-bubble-overlay";

    var title = document.createElement("span");
    title.className = "project-bubble-title";
    title.textContent = project.title;
    overlay.appendChild(title);

    if (project.description) {
      var desc = document.createElement("span");
      desc.className = "project-bubble-description";
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

    var accessibleName = "View " + project.title;
    if (destination.external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      accessibleName += " (opens in a new tab)";
    }
    link.setAttribute("aria-label", accessibleName);

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

  // Prototype diagnostics only (Part 15): confirms every bubble actually
  // has visible geometry after render, since two prior passes silently
  // collapsed to zero size. Safe to remove once Iris confirms the six
  // bubbles render reliably — not part of the permanent implementation.
  function checkBubbleGeometry() {
    requestAnimationFrame(function () {
      try {
        document.querySelectorAll(".project-bubble").forEach(function (bubble) {
          var rect = bubble.getBoundingClientRect();
          if (rect.width < 50 || rect.height < 50) {
            console.error("Bubble geometry failed:", bubble, rect);
          }
        });
      } catch (err) {
        console.error("home.js: bubble geometry diagnostic failed.", err);
      }
    });
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

  function renderHomepage() {
    renderArchive();
    renderSiteNavigation();
    checkBubbleGeometry();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHomepage);
  } else {
    renderHomepage();
  }
})();
