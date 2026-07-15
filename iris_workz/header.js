// 动态判断当前路径是否在子目录中
function getPathPrefix() {
  const path = window.location.pathname;
  if (path.includes('/mdp/')) {
    return '../'; // 说明当前页面在 mdp 子目录下
  } else {
    return ''; // 说明当前页面在根目录
  }
}

// Restrained per-item color identity. Not navigation content, so it
// stays here rather than in nav-data.js. Matched to each item's
// previous color from the old five-item navigation, carried forward
// for continuity with the site's existing palette.
const NAV_ITEM_COLOR_CLASS = {
  archive: 'color-6',
  about: 'color-4',
  writings: 'color-7'
};

// Which primary nav item (if any) matches the current page, and whether
// that match is the exact linked page ("page") or just the current
// section ("section"). mdp.html and pages under mdp/ are not literally
// index.html#floating-archive, so they get the Archive item marked as
// the current *section* only — aria-current="page" would be inaccurate
// there. Pages that are no longer primary navigation destinations
// (projects.html, artworks.html) intentionally return null.
function getCurrentNav() {
  const path = window.location.pathname;
  if (/\/about\.html$/.test(path)) return { id: 'about', kind: 'page' };
  if (/\/writings\.html$/.test(path)) return { id: 'writings', kind: 'page' };
  if (path.includes('/mdp/') || /\/mdp\.html$/.test(path)) return { id: 'archive', kind: 'section' };
  return null;
}

function renderHeader() {
  const header = document.querySelector('header');
  if (!header) return;

  const prefix = getPathPrefix();
  const home = window.SITE_HOME;

  if (!home) {
    console.error('header.js: window.SITE_HOME is missing or invalid. Expected an object from nav-data.js.');
    return;
  }

  const logoHtml = '<a class="logo" href="' + prefix + home.path + '">' + home.label + '</a>';

  const navItems = window.SITE_NAVIGATION;
  if (!Array.isArray(navItems)) {
    console.error('header.js: window.SITE_NAVIGATION is missing or invalid. Expected an array from nav-data.js. Rendering the logo only.');
    header.innerHTML = '<div class="content">' + logoHtml + '</div>';
    return;
  }

  const currentNav = getCurrentNav();
  const linksHtml = navItems.map(function (item) {
    const colorClass = NAV_ITEM_COLOR_CLASS[item.id] || '';
    const isCurrent = !!currentNav && item.id === currentNav.id;
    const isPageCurrent = isCurrent && currentNav.kind === 'page';
    const isSectionCurrent = isCurrent && currentNav.kind === 'section';

    const classes = ['menu-item', colorClass];
    if (isSectionCurrent) classes.push('is-section-current');

    const ariaCurrent = isPageCurrent ? ' aria-current="page"' : '';

    return '<a class="' + classes.filter(Boolean).join(' ') + '" href="' + prefix + item.path + '"' + ariaCurrent + '>' + item.label + '</a>';
  }).join('\n      ');

  header.innerHTML = `
  <div class="content">
    ${logoHtml}
    <nav class="menu-list" aria-label="Primary">
      ${linksHtml}
    </nav>
  </div>
`;
}

renderHeader();
