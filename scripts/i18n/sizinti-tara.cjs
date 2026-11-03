const fs = require('fs');
const esbuild = require('esbuild');

function yukle(yol, json) {
  if (json) {
    return duz(JSON.parse(fs.readFileSync(yol, 'utf8').replace(/^\uFEFF/, '')));
  }
  const r = esbuild.buildSync({
    stdin: { contents: fs.readFileSync(yol, 'utf8'), loader: 'ts' },
    write: false,
    bundle: true,
    format: 'cjs',
  });
  const m = { exports: {} };
  new Function('module', 'exports', r.outputFiles[0].text)(m, m.exports);
  return duz(m.exports.default || Object.values(m.exports)[0]);
}
function duz(o, p = '', c = {}) {
  for (const [k, v] of Object.entries(o)) {
    const y = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object') duz(v, y, c);
    else c[y] = v;
  }
  return c;
}
const KOK = 'src/i18n/locales/';
const tr = yukle(`${KOK}tr.ts`);
const en = yukle(`${KOK}en.ts`);
const diller = {
  es: [`${KOK}es.ts`, false],
  pt: [`${KOK}pt.ts`, false],
  ar: [`${KOK}ar.json`, true],
  fr: [`${KOK}fr.json`, true],
  fil: [`${KOK}fil.json`, true],
};
const atla = new Set(['Coin', 'PK', 'VIP', 'OK', 'AI', 'Tamuso', 'DeepSeek', 'YouTube', 'Google', 'Apple', 'X', 'Twitch', 'Spotify', 'ID', 'QR', 'SMS', 'USD']);
const cikti = {};
for (const [dil, [yol, json]] of Object.entries(diller)) {
  const sozluk = yukle(yol, json);
  const sizinti = [];
  for (const k of Object.keys(sozluk)) {
    const v = sozluk[k];
    if (typeof v !== 'string') continue;
    if (!en[k] || en[k] !== v) continue;
    if (tr[k] === v) continue;
    if (atla.has(v.trim())) continue;
    if (v.length < 4) continue;
    sizinti.push([k, v]);
  }
  cikti[dil] = Object.fromEntries(sizinti);
  console.log(dil, 'İngilizce sızıntı:', sizinti.length);
}
fs.writeFileSync(
  'scripts/i18n/kaynak/ingilizce-sizinti.json',
  JSON.stringify(cikti, null, 2),
  'utf8',
);
