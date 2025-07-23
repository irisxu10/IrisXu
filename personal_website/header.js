document.querySelector('header').innerHTML = `
  <div class="content">
    <div class="logo">IRIS</div>
    <div class="menu-list">
      <div class="menu-item color-2" onclick="toPage('index.html')">HOME</div>
      <div class="menu-item color-4" onclick="toPage('about.html')">About Me</div>
      <div class="menu-item color-6" onclick="toPage('mdp.html')">MDP Works</div>
      <div class="menu-item color-7" onclick="toPage('writings.html')">Writings</div>
      <div class="menu-item color-5" onclick="toPage('projects.html')">Projects</div>
      <div class="menu-item color-9" onclick="toPage('artworks.html')">Artworks</div>
    </div>
  </div>
`

function toPage(page) {
  window.location.href = page;
}