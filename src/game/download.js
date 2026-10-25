// Dosya indirici: sha1 doğrulaması, yeniden deneme ve sınırlı eşzamanlılık.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Dosya zaten varsa (ve boyutu biliniyorsa eşleşiyorsa) indirmez. true = indirildi.
async function file(url, dest, { sha1, size } = {}) {
  if (fs.existsSync(dest) && (!size || fs.statSync(dest).size === size)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (sha1 && crypto.createHash('sha1').update(buf).digest('hex') !== sha1) throw new Error(`Bozuk dosya (sha1): ${path.basename(dest)}`);
      const tmp = dest + '.part';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, dest);
      return true;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// items listesini n paralel işçiyle işler; her bitende onEach(tamamlanan, toplam) çağrılır.
async function pool(items, n, fn, onEach) {
  let i = 0, done = 0;
  const worker = async () => {
    while (i < items.length) {
      const it = items[i++];
      await fn(it);
      done++;
      if (onEach) onEach(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

module.exports = { file, json, pool };
