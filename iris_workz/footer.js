// Shared site footer renderer.
//
// This is the single markup and content source for the global footer.
// It reads window.SITE_HOME and window.SITE_NAVIGATION (see nav-data.js)
// for the identity link and footer navigation, and keeps the one
// verified contact configuration (email + Instagram) here rather than
// duplicating it per page. Independent of header.js by design — this
// file does not depend on it and does not duplicate its current-page
// route logic (a footer without current-state highlighting is fine).

// Root/subfolder path prefix, equivalent to header.js's proven approach.
function getFooterPathPrefix() {
  const path = window.location.pathname;
  if (path.includes('/mdp/')) {
    return '../';
  } else {
    return '';
  }
}

// Single source of contact details for the footer. Verified against the
// values already used consistently across the repository before this
// phase — do not duplicate these elsewhere.
const SITE_CONTACT = {
  email: 'iris000414@gmail.com',
  instagram: {
    href: 'https://www.instagram.com/irisxu_workz?igsh=NTc4MTIwNjQ2YQ%3D%3D&utm_source=qr',
    label: 'Instagram'
  }
};

function renderFooter() {
  const target = document.querySelector('[data-site-footer]');
  if (!target) return;

  const prefix = getFooterPathPrefix();
  const home = window.SITE_HOME;
  const year = new Date().getFullYear();

  const identityHtml = home
    ? '<a class="site-footer-home" href="' + prefix + home.path + '">Iris Xiaomeng Xu</a>'
    : '<span class="site-footer-home">Iris Xiaomeng Xu</span>';

  const navItems = window.SITE_NAVIGATION;
  let navHtml = '';
  if (Array.isArray(navItems)) {
    navHtml = navItems.map(function (item) {
      return '<a class="site-footer-nav-link" href="' + prefix + item.path + '">' + item.label + '</a>';
    }).join('\n        ');
  } else {
    console.error('footer.js: window.SITE_NAVIGATION is missing or invalid. Expected an array from nav-data.js. Footer navigation will be empty.');
  }

  target.innerHTML = `
    <div class="site-footer-inner">
      <div class="site-footer-identity">
        ${identityHtml}
        <p class="site-footer-description">Designer, artist, and creative technologist.</p>
      </div>

      <nav class="site-footer-navigation" aria-label="Footer">
        ${navHtml}
      </nav>

      <div class="site-footer-contact">
        <a class="site-footer-contact-link" href="mailto:${SITE_CONTACT.email}">${SITE_CONTACT.email}</a>
        <a class="site-footer-contact-link" href="${SITE_CONTACT.instagram.href}" target="_blank" rel="noopener noreferrer">${SITE_CONTACT.instagram.label}<span class="visually-hidden"> (opens in a new tab)</span></a>
      </div>

      <p class="site-footer-credit">&copy; ${year} Iris Xiaomeng Xu. Designed and built by Iris.</p>
    </div>
  `;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderFooter);
} else {
  renderFooter();
}
