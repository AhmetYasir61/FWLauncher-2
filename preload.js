const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  win: { minimize: call('win:min'), maximize: call('win:max'), close: call('win:close') },
  settings: { get: call('settings:get'), set: call('settings:set') },
  mods: {
    list: call('mods:list'), search: call('mods:search'), install: call('mods:install'),
    toggle: call('mods:toggle'), remove: call('mods:remove'), addLocal: call('mods:addLocal')
  },
  launch: {
    start: call('launch:start'),
    onProgress: (cb) => ipcRenderer.on('launch:progress', (_e, p) => cb(p))
  },
  remote: { call: call('remote:call'), get: call('remote:get'), login: call('remote:login'), logout: call('remote:logout'), me: call('remote:me'), packs: call('remote:packs') },
  data: { get: call('data:get'), set: call('data:set') },
  files: { list: call('files:list') },
  openFolder: call('shell:openFolder')
});
