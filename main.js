const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const WALL_WIDTH = 580;
const TAB_WIN_W = 46;
const TAB_WIN_H = 160;
const SLIDE_MS = 280;

let wallWin = null;
let tabWin = null;
let tray = null;
let wallOpen = false;
let tabActive = false;
let hoverTimer = null;

const dataFile = () => path.join(app.getPath('userData'), 'notes.json');
const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');
const errorLogFile = () => path.join(app.getPath('userData'), 'error.log');

// log any main-process error to a file instead of showing the scary dialog
function logError(tag, err) {
  try {
    fs.appendFileSync(
      errorLogFile(),
      new Date().toISOString() + ' [' + tag + '] ' + (err && err.stack ? err.stack : String(err)) + '\n'
    );
  } catch {}
}
process.on('uncaughtException', (err) => logError('uncaughtException', err));
process.on('unhandledRejection', (reason) => logError('unhandledRejection', reason));

// only allow a single running instance
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // launching the app again should pop the wall up, not toggle it away
  app.on('second-instance', () => showWall());
}

// ---- tiny PNG generator (pure Node, no deps) so we can have a tray icon ----
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIconPng(size = 16) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const corner = (x === 0 && y === 0) || (x === size - 1 && y === 0) ||
                     (x === 0 && y === size - 1) || (x === size - 1 && y === size - 1);
      const edge = x < 1 || y < 1 || x >= size - 1 || y >= size - 1;
      if (corner) {
        raw[o++] = 0; raw[o++] = 0; raw[o++] = 0; raw[o++] = 0;
      } else if (edge) {
        raw[o++] = 0x96; raw[o++] = 0x6f; raw[o++] = 0x16; raw[o++] = 255;
      } else {
        raw[o++] = 255; raw[o++] = 213; raw[o++] = 79; raw[o++] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return nativeImage.createFromBuffer(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]));
}

function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function wallOpenX() {
  const wa = workArea();
  return wa.x + wa.width - WALL_WIDTH;
}

// The wall window NEVER moves offscreen (moving transparent windows offscreen
// makes Windows/DWM silently grow their width, pushing the header buttons out
// of view). Instead the wall content slides inside the fixed window via CSS.
function setWallOpen(open) {
  if (!wallWin || wallWin.isDestroyed()) return;
  wallOpen = open;
  wallWin.setIgnoreMouseEvents(!open, { forward: true });
  if (!wallWin.webContents.isDestroyed()) {
    wallWin.webContents.send('wall:set', open);
  }
}

function toggleWall() {
  if (!wallWin) return;
  if (tabWin) tabWin.moveTop();
  setWallOpen(!wallOpen);
}

// Bring the wall back up (used when the app is launched a second time)
function showWall() {
  if (!wallWin || wallWin.isDestroyed()) return;
  if (tabWin && !tabWin.isDestroyed()) tabWin.moveTop();
  wallWin.moveTop();
  wallWin.showInactive();
  setWallOpen(true);
}

// ---- subtle pull tab: click-through until the cursor gets near it ----
function getTabVisible() {
  return getPrefs().tabVisible !== false;
}

function setTabVisible(on) {
  const prefs = getPrefs();
  prefs.tabVisible = on;
  savePrefs(prefs);
  if (tabWin) {
    if (on) {
      tabWin.showInactive();
      tabWin.setIgnoreMouseEvents(true, { forward: true });
      updateTabCursorTracking(true);
    } else {
      tabActive = false;
      updateTabCursorTracking(false);
      tabWin.hide();
    }
  }
  if (tray) rebuildTrayMenu();
}

function updateTabCursorTracking(enabled) {
  if (hoverTimer) {
    clearInterval(hoverTimer);
    hoverTimer = null;
  }
  if (!enabled || !tabWin || tabWin.isDestroyed()) return;
  hoverTimer = setInterval(() => {
    const pt = screen.getCursorScreenPoint();
    const b = tabWin.getBounds();
    const pad = 14;
    const near =
      pt.x >= b.x - pad && pt.x <= b.x + b.width + pad &&
      pt.y >= b.y - pad && pt.y <= b.y + b.height + pad;
    if (near !== tabActive) {
      tabActive = near;
      tabWin.setIgnoreMouseEvents(!near, { forward: true });
      if (!tabWin.webContents.isDestroyed()) {
        tabWin.webContents.send('tab:hover', near);
      }
    }
  }, 110);
}

function createWindows() {
  const wa = workArea();
  const { height } = screen.getPrimaryDisplay().size;

  wallWin = new BrowserWindow({
    width: WALL_WIDTH,
    height,
    x: wallOpenX(),
    y: wa.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  wallWin.setAlwaysOnTop(true, 'screen-saver');
  wallWin.loadFile('wall.html');
  wallWin.webContents.on('render-process-gone', (_e, details) => logError('wall renderer gone', JSON.stringify(details)));
  wallWin.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) logError('wall console', message);
  });

  // the wall opens automatically as soon as the app starts
  wallWin.webContents.once('did-finish-load', () => {
    wallWin.setIgnoreMouseEvents(true, { forward: true });
    wallWin.webContents.send('wall:set', false);
    wallWin.showInactive();
    setTimeout(() => setWallOpen(true), 80);
  });

  const tabX = wa.x + wa.width - TAB_WIN_W;
  const tabY = wa.y + Math.round(wa.height * 0.3) - Math.round(TAB_WIN_H / 2);

  tabWin = new BrowserWindow({
    width: TAB_WIN_W,
    height: TAB_WIN_H,
    x: tabX,
    y: tabY,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  tabWin.setAlwaysOnTop(true, 'screen-saver');
  tabWin.loadFile('tab.html');
  tabWin.webContents.on('render-process-gone', (_e, details) => logError('tab renderer gone', JSON.stringify(details)));
  tabWin.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) logError('tab console', message);
  });
  tabWin.webContents.once('did-finish-load', () => {
    if (!getTabVisible()) {
      tabWin.hide();
    } else {
      tabWin.setIgnoreMouseEvents(true, { forward: true });
      updateTabCursorTracking(true);
    }
  });
}

function getPrefs() {
  try {
    return JSON.parse(fs.readFileSync(prefsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
    fs.writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2));
  } catch (err) {
    console.error('Failed to save prefs:', err);
  }
}

function getAutostart() {
  const prefs = getPrefs();
  return prefs.autostart !== false;
}

function setAutostart(on) {
  app.setLoginItemSettings({ openAtLogin: on, path: process.execPath });
  const prefs = getPrefs();
  prefs.autostart = on;
  savePrefs(prefs);
}

function createTray() {
  tray = new Tray(makeIconPng());
  tray.setToolTip('Sticky Wall');
  rebuildTrayMenu();
  tray.on('click', () => toggleWall());
  tray.on('double-click', () => toggleWall());
}

function rebuildTrayMenu() {
  const menu = Menu.buildFromTemplate([
    { label: 'Toggle Wall', click: () => toggleWall() },
    {
      label: getTabVisible() ? 'Hide Pull Tab' : 'Show Pull Tab',
      click: () => setTabVisible(!getTabVisible()),
    },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: getAutostart(),
      click: (item) => setAutostart(item.checked),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

app.whenReady().then(() => {
  if (getAutostart()) {
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
  }
  createWindows();
  createTray();
});

app.on('window-all-closed', () => app.quit());

// ---- IPC ----
ipcMain.on('wall:toggle', () => toggleWall());
ipcMain.on('tab:hide', () => setTabVisible(false));
ipcMain.on('log:error', (_e, message) => logError('renderer', message));

ipcMain.handle('notes:load', () => {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return { notes: [] };
  }
});

ipcMain.handle('notes:save', (_e, data) => {
  try {
    fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
    fs.writeFileSync(dataFile(), JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save notes:', err);
  }
});
