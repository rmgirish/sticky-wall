const bridge = window.api;

window.addEventListener('error', (e) => {
  bridge.logError('wall: ' + e.message + ' @ ' + e.filename + ':' + e.lineno);
});

const board = document.getElementById('board');
const ctxMenu = document.getElementById('ctxMenu');
const emptyState = document.getElementById('emptyState');

function updateEmptyState() {
  emptyState.classList.toggle('hidden', notes.length > 0);
}

const NOTE_W = 172;
const COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'white'];

let notes = [];
let topZ = 10;
let nextId = 1;
let saveTimer = null;
let ctxTarget = null;

const rnd = (a, b) => Math.random() * (b - a) + a;

function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => bridge.saveNotes({ notes }), 250);
}

function autosize(el) {
  const ta = el.querySelector('textarea');
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function findNote(id) {
  return notes.find((n) => n.id === Number(id));
}

function noteEl(id) {
  return board.querySelector('.note[data-id="' + Number(id) + '"]');
}

function bringToFront(el) {
  el.style.zIndex = ++topZ;
}

function makeNoteEl(data) {
  const el = document.createElement('div');
  el.className = 'note ' + data.color;
  el.dataset.id = data.id;
  el.style.left = data.x + 'px';
  el.style.top = data.y + 'px';
  el.style.transform = 'rotate(' + (data.rotate || 0) + 'deg)';
  el.style.zIndex = data.z || 10;
  el.innerHTML =
    '<div class="pin"></div>' +
    '<textarea spellcheck="false" placeholder="Write something..."></textarea>' +
    '<button class="del" title="Delete">&times;</button>';

  el.classList.toggle('pinned', !!data.pinned);
  el.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';

  const pin = el.querySelector('.pin');
  pin.title = data.pinned ? 'Unpin note' : 'Pin note';
  pin.addEventListener('pointerdown', (e) => e.stopPropagation());
  pin.addEventListener('click', (e) => {
    e.stopPropagation();
    bringToFront(el);
    togglePin(data.id);
  });

  const ta = el.querySelector('textarea');
  ta.value = data.text || '';
  ta.addEventListener('input', () => {
    autosize(el);
    const n = findNote(data.id);
    if (n) {
      n.text = ta.value;
      saveSoon();
    }
    applySearch();
  });
  ta.addEventListener('blur', saveSoon);

  el.querySelector('.del').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteNote(data.id);
  });

  el.addEventListener('pointerdown', (e) => onNotePointerDown(e, el));
  el.addEventListener('contextmenu', (e) => onNoteContextMenu(e, el));

  board.appendChild(el);
  autosize(el);
  return el;
}

function createNote(data) {
  const note = {
    id: nextId++,
    x: data.x,
    y: data.y,
    text: data.text || '',
    color: data.color || COLORS[Math.floor(Math.random() * COLORS.length)],
    rotate: Math.round(rnd(-4, 4) * 10) / 10,
    z: ++topZ,
    pinned: false,
  };
  notes.push(note);
  makeNoteEl(note);
  applySearch();
  updateEmptyState();
  saveSoon();
  return note;
}

function deleteNote(id) {
  const numId = Number(id);
  notes = notes.filter((n) => n.id !== numId);
  const el = noteEl(numId);
  if (el) el.remove();
  applySearch();
  updateEmptyState();
  saveSoon();
}

function togglePin(id) {
  const n = findNote(id);
  if (!n) return;
  n.pinned = !n.pinned;
  const el = noteEl(n.id);
  if (el) {
    el.classList.toggle('pinned', n.pinned);
    const pin = el.querySelector('.pin');
    if (pin) pin.title = n.pinned ? 'Unpin note' : 'Pin note';
  }
  saveSoon();
}

function onNotePointerDown(e, el) {
  if (e.button !== 0) return;
  const note = findNote(el.dataset.id);
  if (note && note.pinned) return;
  const ta = el.querySelector('textarea');
  if (e.target === ta || e.target.closest('.del')) return;

  bringToFront(el);

  const rect = el.getBoundingClientRect();
  const offX = e.clientX - rect.left;
  const offY = e.clientY - rect.top;

  el.classList.add('dragging');
  board.classList.add('dragging');
  el.setPointerCapture(e.pointerId);

  const move = (ev) => {
    const brect = board.getBoundingClientRect();
    const x = ev.clientX - brect.left + board.scrollLeft - offX;
    const y = ev.clientY - brect.top + board.scrollTop - offY;
    el.style.left = Math.max(-70, Math.min(x, brect.width - rect.width + 70)) + 'px';
    el.style.top = Math.max(-50, Math.min(y, brect.height - rect.height + 50)) + 'px';
  };

  const up = () => {
    el.classList.remove('dragging');
    board.classList.remove('dragging');
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    const n = findNote(el.dataset.id);
    if (n) {
      n.x = parseFloat(el.style.left);
      n.y = parseFloat(el.style.top);
      n.z = topZ;
      saveSoon();
    }
  };

  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
}

function onNoteContextMenu(e, el) {
  e.preventDefault();
  e.stopPropagation();
  const n = findNote(el.dataset.id);
  if (!n) return;
  ctxTarget = el;

  ctxMenu.querySelectorAll('.swatch').forEach((sw) => {
    sw.classList.toggle('current', sw.dataset.color === n.color);
  });

  ctxMenu.classList.remove('hidden');
  const menuW = ctxMenu.offsetWidth;
  const menuH = ctxMenu.offsetHeight;
  let x = e.clientX;
  let y = e.clientY;
  if (x + menuW > window.innerWidth - 8) x = window.innerWidth - menuW - 8;
  if (y + menuH > window.innerHeight - 8) y = window.innerHeight - menuH - 8;
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top = y + 'px';
}

function hideMenu() {
  ctxMenu.classList.add('hidden');
  ctxTarget = null;
}

// ----- board interactions -----
board.addEventListener('dblclick', (e) => {
  if (e.target !== board) return;
  const brect = board.getBoundingClientRect();
  createNote({
    x: e.clientX - brect.left + board.scrollLeft - NOTE_W / 2,
    y: e.clientY - brect.top + board.scrollTop - 70,
  });
});

board.addEventListener('scroll', hideMenu);

document.addEventListener('click', (e) => {
  if (!ctxMenu.classList.contains('hidden') && !ctxMenu.contains(e.target)) hideMenu();
});

document.addEventListener('contextmenu', (e) => {
  if (!ctxMenu.contains(e.target)) hideMenu();
});

document.addEventListener('pointerdown', (e) => {
  if (ctxMenu.classList.contains('hidden')) return;
  if (!ctxMenu.contains(e.target)) hideMenu();
});

// ----- context menu actions -----
ctxMenu.querySelectorAll('.swatch').forEach((sw) => {
  sw.addEventListener('click', (e) => {
    e.stopPropagation();
    const color = sw.dataset.color;
    const n = findNote(ctxTarget.dataset.id);
    if (n) {
      n.color = color;
      ctxTarget.className = 'note ' + color;
      saveSoon();
    }
    hideMenu();
  });
});

document.getElementById('ctxDelete').addEventListener('click', () => {
  if (ctxTarget) deleteNote(ctxTarget.dataset.id);
  hideMenu();
});

// ----- header buttons -----
document.getElementById('hideBtn').addEventListener('click', () => bridge.toggleWall());
window.addEventListener('beforeunload', () => {
  bridge.saveNotesSync({ notes });
});

// ----- search -----
const searchInput = document.getElementById('search');
const searchCount = document.getElementById('searchCount');
const searchClear = document.getElementById('searchClear');

function applySearch() {
  const q = searchInput.value.trim().toLowerCase();
  let matches = 0;
  notes.forEach((n) => {
    const el = noteEl(n.id);
    if (!el) return;
    const hit = !q || (n.text || '').toLowerCase().includes(q);
    el.classList.toggle('dimmed', !hit);
    if (hit) matches++;
  });
  searchCount.textContent = matches + '/' + notes.length;
  searchCount.classList.toggle('hidden', !q);
  searchCount.classList.toggle('zero', q && matches === 0);
  searchClear.classList.toggle('hidden', !q);
}

searchInput.addEventListener('input', applySearch);

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  applySearch();
  searchInput.focus();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    applySearch();
    searchInput.blur();
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

// ----- load saved notes -----
(async function init() {
  let saved = null;
  try {
    saved = await bridge.loadNotes();
  } catch {}
  if (saved && Array.isArray(saved.notes)) {
    notes = saved.notes;
    notes.forEach((n) => makeNoteEl(n));
    nextId = notes.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1;
    topZ = notes.reduce((m, n) => Math.max(m, n.z || 10), 10);
  }
  updateEmptyState();
})();

bridge.onWallSet((open) => {
  document.getElementById('wall').classList.toggle('closed', !open);
});
