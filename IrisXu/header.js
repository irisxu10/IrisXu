document.querySelector('header').innerHTML = `
  <div class="content">
    <div class="logo">IRIS</div>
    <div class="menu-list">
      <div class="menu-item color-4" onclick="toPage('index.html')">HOME</div>
      <div class="menu-item color-5" onclick="toPage('page1.html')">WORKS</div>
      <div class="menu-item color-6" onclick="toPage('page2.html')">PAGE2</div>
      <div class="menu-item color-7" onclick="toPage('page3.html')">PAGE3</div>
      <div class="menu-item color-8" onclick="toPage('page4.html')">PAGE4</div>
      <div class="menu-item color-9" onclick="toPage('page5.html')">PAGE5</div>
    </div>
  </div>
`

function toPage(page) {
  window.location.href = page;
}