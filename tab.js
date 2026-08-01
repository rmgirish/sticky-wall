window.api.logError('tab: script loaded');

window.addEventListener('error', (e) => {
  window.api.logError('tab: ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
});

const tab = document.getElementById('tab');

document.getElementById('hideBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  window.api.logError('tab: hide button clicked');
  window.api.hideTab();
});

tab.addEventListener('click', () => {
  window.api.logError('tab: clicked');
  window.api.toggleWall();
});

window.api.onTabHover((near) => {
  window.api.logError('tab: hover -> ' + near);
  tab.classList.toggle('active', near);
});
