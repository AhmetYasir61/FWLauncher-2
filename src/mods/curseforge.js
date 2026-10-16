// CurseForge API: x-api-key gerekir (Ayarlar > Modlar > CurseForge API anahtarı).
const BASE = 'https://api.curseforge.com/v1';
const GAME_ID = 432; // Minecraft
const CLASS = { mod: 6, pack: 12, shader: 6552 };
const LOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const ALGO = { 1: 'sha1', 2: 'md5' };

async function get(url, key) {
  if (!key) throw new Error('CurseForge API anahtarı girilmemiş (Ayarlar > Modlar).');
  const res = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CurseForge ${res.status}`);
  return res.json();
}
const loaderPart = (kind, loader) => (kind === 'mod' ? `&modLoaderType=${LOADER[loader]}` : '');

async function search({ kind = 'mod', query, mcVersion, loader, offset = 0, apiKey }) {
  const url = `${BASE}/mods/search?gameId=${GAME_ID}&classId=${CLASS[kind]}&gameVersion=${encodeURIComponent(mcVersion)}${loaderPart(kind, loader)}&searchFilter=${encodeURIComponent(query || '')}&pageSize=20&index=${offset}&sortField=2&sortOrder=desc`;
  const { data } = await get(url, apiKey);
  return data.map((m) => ({
    source: 'curseforge', kind, projectId: String(m.id), name: m.name,
    description: m.summary, downloads: m.downloadCount, iconUrl: m.logo && m.logo.thumbnailUrl
  }));
}

async function resolve({ kind = 'mod', projectId, mcVersion, loader, apiKey }) {
  const { data } = await get(`${BASE}/mods/${projectId}/files?gameVersion=${encodeURIComponent(mcVersion)}${loaderPart(kind, loader)}&pageSize=1`, apiKey);
  if (!data.length) throw new Error('Bu sürüm için uyumlu dosya yok.');
  const f = data[0];
  let url = f.downloadUrl;
  if (!url) {
    // Bazı yazarlar üçüncü taraf indirmesini kapatır; resmi uç noktayı dene.
    try { url = (await get(`${BASE}/mods/${projectId}/files/${f.id}/download-url`, apiKey)).data; } catch { /* aşağıda hata */ }
  }
  if (!url) throw new Error('Bu yazar launcher indirmesine izin vermiyor.');
  const h = (f.hashes || []).find((x) => x.algo === 1) || (f.hashes || [])[0];
  return {
    fileName: f.fileName, url, hash: h ? { algo: ALGO[h.algo], value: h.value } : null, version: f.displayName,
    dependencies: kind === 'mod' ? (f.dependencies || []).filter((d) => d.relationType === 3).map((d) => String(d.modId)) : []
  };
}

async function info(projectId, apiKey) {
  const { data } = await get(`${BASE}/mods/${projectId}`, apiKey);
  return { name: data.name, iconUrl: data.logo && data.logo.thumbnailUrl };
}

module.exports = { search, resolve, info };
