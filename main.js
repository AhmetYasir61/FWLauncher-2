const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { dirs } = require('./src/paths');
const settings = require('./src/settings');
const mods = require('./src/mods/manager');
const launch = require('./src/launch');
const remote = require('./src/remote');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 740, minWidth: 980, minHeight: 640,
    frame: false, backgroundColor: '#0b0914', icon: path.join(__dirname, 'renderer', 'assets', 'logo.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// Hata mesajını arayüze düzgün taşı.
const safe = (fn) => async (_e, ...a) => {
  try { return { ok: true, data: await fn(...a) }; } catch (err) { return { ok: false, error: err.message }; }
};

ipcMain.handle('win:min', () => win.minimize());
ipcMain.handle('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.handle('win:close', () => win.close());

ipcMain.handle('settings:get', safe(() => { const { session, ...rest } = settings.get(); return { ...rest, loggedIn: !!session }; }));
ipcMain.handle('settings:set', safe((p) => {
  const { session: _s, deviceId: _d, ...safeP } = p || {};
  // API adresi değişirse eski oturum belirteci yeni adrese gönderilmesin.
  if (safeP.apiUrl !== undefined && safeP.apiUrl !== settings.get().apiUrl) safeP.session = null;
  const { session, ...rest } = settings.set(safeP);
  return { ...rest, loggedIn: !!session };
}));

ipcMain.handle('mods:list', safe(() => mods.list()));
ipcMain.handle('mods:search', safe((q) => mods.search(q)));
ipcMain.handle('mods:install', safe((q) => mods.install(q)));
ipcMain.handle('mods:toggle', safe((f, k) => mods.toggle(f, k)));
ipcMain.handle('mods:remove', safe((f, k) => mods.remove(f, k)));
ipcMain.handle('mods:addLocal', safe(async (kind = 'mod') => {
  const ext = kind === 'mod' ? 'jar' : 'zip';
  const r = await dialog.showOpenDialog(win, { filters: [{ name: ext === 'jar' ? 'Minecraft modu' : 'Paket (.zip)', extensions: [ext] }], properties: ['openFile'] });
  if (r.canceled) return mods.readIndex();
  return mods.addLocal(r.filePaths[0], kind);
}));

// Panel verileri (ürünler, duyurular, kullanıcılar...). Sunucu API'si bağlanana kadar yerel JSON.
const fs = require('fs');
const dataFile = () => path.join(dirs().root, 'data.json');
const readData = () => { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return {}; } };
ipcMain.handle('data:get', safe((k) => readData()[k] ?? null));
ipcMain.handle('data:set', safe((k, v) => { const d = readData(); d[k] = v; fs.writeFileSync(dataFile(), JSON.stringify(d, null, 2)); return v; }));
ipcMain.handle('files:list', safe(() => {
  const r = dirs().root;
  return fs.readdirSync(r, { withFileTypes: true }).map((e) => ({ name: e.name, dir: e.isDirectory() }));
}));

// FireWing API (web/api). Oturum bilgisi renderer'a hiç verilmez, sadece ana süreçte kullanılır.
ipcMain.handle('remote:call', safe((ep, body) => remote.call(ep, body || {})));
ipcMain.handle('remote:get', safe((ep) => remote.get(ep)));
ipcMain.handle('remote:login', safe((u, p) => remote.login(u, p)));
ipcMain.handle('remote:logout', safe(() => remote.logout()));
ipcMain.handle('remote:me', safe(() => (settings.get().session ? remote.call('me.php') : null)));
ipcMain.handle('remote:packs', safe(() => remote.packs()));

ipcMain.handle('launch:start', safe(() => launch.start((p) => { if (win && !win.isDestroyed()) win.webContents.send('launch:progress', p); })));

ipcMain.handle('shell:openFolder', safe((which) => {
  const d = dirs();
  return shell.openPath({ main: d.mainMods, root: d.root, shader: d.userShaders, pack: d.userPacks }[which] || d.userMods);
}));

app.whenReady().then(() => { dirs(); createWindow(); });
app.on('window-all-closed', () => app.quit());
