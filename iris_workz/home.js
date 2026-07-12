// Renders the readable HTML project archive into #project-archive-root
// from window.PORTFOLIO_PROJECTS (see project-data.js).
//
// This file only builds DOM for the readable archive. It must stay free
// of canvas, p5.js, Matter.js, scroll animation, physics, or bubble
// behavior — that belongs to sketch.js / ball.js and later phases.

(function () {
  var LENS_LABELS = {
    "systems": "Systems",
    "interfaces": "Interfaces",
    "materials": "Materials",
    "speculative-worlds": "Speculative Worlds",
    "playful-tools": "Playful Tools",
    "nonhuman-perspectives": "Nonhuman Perspectives"
  };

  function createExternalIndicator() {
    var span = document.createElement("span");
    span.className = "visually-hidden";
    span.textContent = " (opens in a new tab)";
    return span;
  }

  function createPreview(project) {
    var figure = document.createElement("figure");
    figure.className = "project-entry-preview";

    var preview = project.preview || {};

    if (preview.type === "video") {
      var video = document.createElement("video");
      video.src = preview.src;
      video.muted = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("preload", "metadata");
      video.controls = true;
      figure.appendChild(video);

      var caption = document.createElement("figcaption");
      caption.className = "project-entry-preview-caption";
      caption.textContent = preview.alt || "";
      figure.appendChild(caption);
    } else if (preview.type === "image") {
      var img = document.createElement("img");
      img.src = preview.src;
      img.alt = preview.alt || "";
      img.loading = "lazy";
      figure.appendChild(img);
    }

    return figure;
  }

  function createLensList(lenses) {
    var list = document.createElement("ul");
    list.className = "project-entry-lenses";
    (lenses || []).forEach(function (lens) {
      var item = document.createElement("li");
      item.textContent = LENS_LABELS[lens] || lens;
      list.appendChild(item);
    });
    return list;
  }

  function createPrimaryLink(project) {
    var destination = project.destination || {};
    var link = document.createElement("a");
    link.className = "project-entry-link";
    link.href = destination.href;
    link.textContent = project.title;
    if (destination.external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.appendChild(createExternalIndicator());
    }
    return link;
  }

  function createSecondaryLinks(secondaryLinks) {
    if (!secondaryLinks || secondaryLinks.length === 0) {
      return null;
    }
    var list = document.createElement("ul");
    list.className = "project-entry-secondary-links";
    secondaryLinks.forEach(function (linkData) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.href = linkData.href;
      link.textContent = linkData.label;
      if (linkData.external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.appendChild(createExternalIndicator());
      }
      item.appendChild(link);
      list.appendChild(item);
    });
    return list;
  }

  function createProjectEntry(project) {
    var li = document.createElement("li");
    li.className = "project-archive-item";
    li.dataset.projectId = project.id;

    var article = document.createElement("article");
    article.className = "project-entry";
    article.dataset.accent = project.accent || "";

    article.appendChild(createPreview(project));

    var index = document.createElement("p");
    index.className = "project-entry-index";
    index.setAttribute("aria-hidden", "true");
    index.textContent = String(project.order).padStart(2, "0");
    article.appendChild(index);

    var year = document.createElement("p");
    year.className = "project-entry-year";
    year.textContent = project.year;
    article.appendChild(year);

    var heading = document.createElement("h3");
    heading.className = "project-entry-title";
    heading.appendChild(createPrimaryLink(project));
    article.appendChild(heading);

    if (project.description) {
      var desc = document.createElement("p");
      desc.className = "project-entry-description";
      desc.textContent = project.description;
      article.appendChild(desc);
    }

    if (project.lenses && project.lenses.length) {
      article.appendChild(createLensList(project.lenses));
    }

    var secondary = createSecondaryLinks(project.secondaryLinks);
    if (secondary) {
      article.appendChild(secondary);
    }

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
