const fs = require('fs');
const { dirs } = require('./paths');

const DEFAULTS = {
  ramGb: 6,
  javaPath: '',
  minimizeOnLaunch: true,
  checkCompat: true,
  loadUserMods: true,
  curseforgeApiKey: '',
  profile: { name: 'FireWing Network', mcVersion: '1.21.4', loader: 'neoforge' }
};

function get() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(dirs().settings, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function set(patch) {
  const next = { ...get(), ...patch };
  fs.writeFileSync(dirs().settings, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { get, set };
