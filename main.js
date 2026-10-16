const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { dirs } = require('./src/paths');
const settings = require('./src/settings');
const mods = require('./src/mods/manager');
const launch = require('./src/launch');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 740, minWidth: 980, minHeight: 640,
    frame: false, backgroundColor: '#120d0b',
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

ipcMain.handle('settings:get', safe(() => settings.get()));
ipcMain.handle('settings:set', safe((p) => settings.set(p)));

ipcMain.handle('mods:list', safe(() => mods.list()));
ipcMain.handle('mods:search', safe((q) => mods.search(q)));
ipcMain.handle('mods:install', safe((q) => mods.install(q)));
ipcMain.handle('mods:toggle', safe((f) => mods.toggle(f)));
ipcMain.handle('mods:remove', safe((f) => mods.remove(f)));
ipcMain.handle('mods:addLocal', safe(async () => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: 'Minecraft modu', extensions: ['jar'] }], properties: ['openFile'] });
  if (r.canceled) return mods.readIndex();
  return mods.addLocal(r.filePaths[0]);
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

ipcMain.handle('launch:start', safe(() => launch.start((p) => win.webContents.send('launch:progress', p))));

ipcMain.handle('shell:openFolder', safe((which) => {
  const d = dirs();
  return shell.openPath(which === 'main' ? d.mainMods : which === 'root' ? d.root : d.userMods);
}));

app.whenReady().then(() => { dirs(); createWindow(); });
app.on('window-all-closed', () => app.quit());
