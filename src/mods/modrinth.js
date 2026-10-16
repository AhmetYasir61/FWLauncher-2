// Modrinth API v2: anahtar gerekmez, User-Agent zorunlu.
const BASE = 'https://api.modrinth.com/v2';
const UA = { 'User-Agent': 'FireWingNetwork/FireWingLauncher/0.1 (store.firewing.launcher)' };

async function get(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Modrinth ${res.status}`);
  return res.json();
}

async function search({ query, mcVersion, loader, offset = 0 }) {
  const facets = JSON.stringify([['project_type:mod'], [`versions:${mcVersion}`], [`categories:${loader}`]]);
  const url = `${BASE}/search?query=${encodeURIComponent(query || '')}&facets=${encodeURIComponent(facets)}&limit=20&offset=${offset}`;
  const data = await get(url);
  return data.hits.map((h) => ({
    source: 'modrinth',
    projectId: h.project_id,
    name: h.title,
    description: h.description,
    downloads: h.downloads,
    iconUrl: h.icon_url
  }));
}

// Profile uyan en yeni dosyayı + zorunlu bağımlılıkları döndürür.
async function resolve({ projectId, mcVersion, loader }) {
  const q = `game_versions=${encodeURIComponent(JSON.stringify([mcVersion]))}&loaders=${encodeURIComponent(JSON.stringify([loader]))}`;
  const versions = await get(`${BASE}/project/${projectId}/version?${q}`);
  if (!versions.length) throw new Error('Bu sürüm/loader için uyumlu dosya yok.');
  const v = versions[0];
  const f = v.files.find((x) => x.primary) || v.files[0];
  return {
    fileName: f.filename,
    url: f.url,
    hash: { algo: 'sha512', value: f.hashes.sha512 },
    version: v.version_number,
    dependencies: v.dependencies.filter((d) => d.dependency_type === 'required' && d.project_id).map((d) => d.project_id)
  };
}

async function info(projectId) {
  const p = await get(`${BASE}/project/${projectId}`);
  return { name: p.title, iconUrl: p.icon_url };
}

module.exports = { search, resolve, info };
