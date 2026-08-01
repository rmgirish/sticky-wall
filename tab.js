window.addEventListener('error', (e) => {
  window.api.logError('tab: ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
});

const tab = document.getElementById('tab');

document.getElementById('hideBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  window.api.hideTab();
});

tab.addEventListener('click', () => {
  window.api.toggleWall();
});

window.api.onTabHover((near) => {
  tab.classList.toggle('active', near);
});
