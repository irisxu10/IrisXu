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

  // The title/description are real headings/paragraphs (h2/p), not spans —
  // each project's stable id (from project-data.js) becomes its element
  // IDs, which createBubbleLink below wires to the anchor via
  // aria-labelledby/aria-describedby instead of a generic aria-label.
  function createBubbleOverlay(project) {
    var overlay = document.createElement("span");
    overlay.className = "project-bubble-overlay";

    var title = document.createElement("h2");
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderHomepage);
  } else {
    renderHomepage();
  }
})();
