// CurseForge API: x-api-key gerekir (Ayarlar > CurseForge API anahtarı).
const BASE = 'https://api.curseforge.com/v1';
const GAME_ID = 432; // Minecraft
const CLASS_MODS = 6;
const LOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const ALGO = { 1: 'sha1', 2: 'md5' };

async function get(url, key) {
  if (!key) throw new Error('CurseForge API anahtarı girilmemiş (Ayarlar).');
  const res = await fetch(url, { headers: { 'x-api-key': key, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CurseForge ${res.status}`);
  return res.json();
}

async function search({ query, mcVersion, loader, offset = 0, apiKey }) {
  const url = `${BASE}/mods/search?gameId=${GAME_ID}&classId=${CLASS_MODS}&gameVersion=${encodeURIComponent(mcVersion)}&modLoaderType=${LOADER[loader]}&searchFilter=${encodeURIComponent(query || '')}&pageSize=20&index=${offset}&sortField=2&sortOrder=desc`;
  const { data } = await get(url, apiKey);
  return data.map((m) => ({
    source: 'curseforge',
    projectId: String(m.id),
    name: m.name,
    description: m.summary,
    downloads: m.downloadCount,
    iconUrl: m.logo && m.logo.thumbnailUrl
  }));
}

async function resolve({ projectId, mcVersion, loader, apiKey }) {
  const { data } = await get(`${BASE}/mods/${projectId}/files?gameVersion=${encodeURIComponent(mcVersion)}&modLoaderType=${LOADER[loader]}&pageSize=1`, apiKey);
  if (!data.length) throw new Error('Bu sürüm/loader için uyumlu dosya yok.');
  const f = data[0];
  let url = f.downloadUrl;
  if (!url) {
    // Bazı modlar üçüncü taraf dağıtımı kapatır; resmi uç noktayı dene.
    try { url = (await get(`${BASE}/mods/${projectId}/files/${f.id}/download-url`, apiKey)).data; } catch { /* aşağıda hata */ }
  }
  if (!url) throw new Error('Bu mod yazarı launcher indirmesine izin vermiyor.');
  const h = (f.hashes || []).find((x) => x.algo === 1) || (f.hashes || [])[0];
  return {
    fileName: f.fileName,
    url,
    hash: h ? { algo: ALGO[h.algo], value: h.value } : null,
    version: f.displayName,
    dependencies: (f.dependencies || []).filter((d) => d.relationType === 3).map((d) => String(d.modId))
  };
}

async function info(projectId, apiKey) {
  const { data } = await get(`${BASE}/mods/${projectId}`, apiKey);
  return { name: data.name, iconUrl: data.logo && data.logo.thumbnailUrl };
}

module.exports = { search, resolve, info };
