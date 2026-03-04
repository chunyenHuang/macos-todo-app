const { app, BrowserWindow, Tray, ipcMain, nativeImage, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

let tray = null;
let win = null;

const todosPath = () => path.join(app.getPath('userData'), 'todos.json');

function loadTodos() {
  try {
    const data = JSON.parse(fs.readFileSync(todosPath(), 'utf8'));
    if (Array.isArray(data)) return { todos: data, trash: [] };
    return data;
  } catch {
    return { todos: [], trash: [] };
  }
}

function saveTodos(data) {
  fs.writeFileSync(todosPath(), JSON.stringify(data, null, 2));
}

// ── PNG generation ────────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xFF];
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function makePNG(pixels, width, height) {
  const rowBytes = width * 4;
  const filtered = Buffer.alloc(height * (1 + rowBytes));
  for (let y = 0; y < height; y++) {
    filtered[y * (1 + rowBytes)] = 0;
    pixels.copy(filtered, y * (1 + rowBytes) + 1, y * rowBytes, (y + 1) * rowBytes);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(filtered)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildIcon() {
  const S = 32; // 32x32 @2x = 16pt
  const px = Buffer.alloc(S * S * 4);
  const fg = nativeTheme.shouldUseDarkColors ? 255 : 0;

  for (let y = 5; y <= 10; y++)
    for (let x = 3; x <= 28; x++) {
      const i = (y * S + x) * 4;
      px[i] = fg; px[i+1] = fg; px[i+2] = fg; px[i+3] = 220;
    }
  for (let y = 14; y <= 19; y++)
    for (let x = 3; x <= 28; x++) {
      const i = (y * S + x) * 4;
      px[i] = fg; px[i+1] = fg; px[i+2] = fg; px[i+3] = 220;
    }
  for (let y = 23; y <= 28; y++)
    for (let x = 3; x <= 28; x++) {
      const i = (y * S + x) * 4;
      px[i] = fg; px[i+1] = fg; px[i+2] = fg; px[i+3] = 220;
    }

  return nativeImage.createFromBuffer(makePNG(px, S, S), { scaleFactor: 2.0 });
}

function updateTrayIcon() {
  if (tray) tray.setImage(buildIcon());
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 320,
    height: 450,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');
  win.on('blur', () => win.hide());
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(buildIcon());
  tray.setToolTip('Todos');
  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      positionWindow();
      win.show();
      win.focus();
    }
  });
}

function positionWindow() {
  const { screen } = require('electron');
  const tb = tray.getBounds();
  const wb = win.getBounds();
  const { workArea } = screen.getPrimaryDisplay();
  let x = Math.round(tb.x + tb.width / 2 - wb.width / 2);
  let y = Math.round(tb.y + tb.height + 4);
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - wb.width));
  y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - wb.height));
  win.setPosition(x, y);
}

// ── App ───────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  app.dock.hide();
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

  createWindow();
  createTray();

  ipcMain.handle('get-todos', () => loadTodos());
  ipcMain.handle('save-todos', (_, data) => saveTodos(data));
  ipcMain.handle('update-badge', (_, count) => {
    tray.setTitle(count > 0 ? String(count) : '');
  });

  nativeTheme.on('updated', updateTrayIcon);
});

app.on('window-all-closed', (e) => e.preventDefault());
