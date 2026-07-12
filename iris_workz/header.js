// 动态判断当前路径是否在子目录中
function getPathPrefix() {
  const path = window.location.pathname;
  if (path.includes('/mdp/')) {
    return '../'; // 说明当前页面在 mdp 子目录下
  } else {
    return ''; // 说明当前页面在根目录
  }
}

const prefix = getPathPrefix();

document.querySelector('header').innerHTML = `
  <div class="content">
    <div class="logo">IRIS</div>
    <nav class="menu-list" aria-label="Primary">
      <a class="menu-item color-2" href="${prefix}index.html">HOME</a>
      <a class="menu-item color-4" href="${prefix}about.html">About Me</a>
      <a class="menu-item color-6" href="${prefix}mdp.html">ArtCenter_MDP</a>
      <a class="menu-item color-7" href="${prefix}writings.html">Writings</a>
      <a class="menu-item color-5" href="${prefix}projects.html">Projects</a>
      <a class="menu-item color-9" href="${prefix}artworks.html">Artworks</a>
    </nav>
  </div>
`;
