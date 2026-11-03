const fs = require('fs');
const eski = JSON.parse(fs.readFileSync('scripts/i18n/kaynak/es-eski-sozluk.json', 'utf8'));
const kurtarilacak = JSON.parse(fs.readFileSync('scripts/i18n/kaynak/es-kurtarilacak.json', 'utf8'));
const esbuild = require('esbuild');

const kod = fs.readFileSync('src/i18n/locales/es.ts', 'utf8');
const r = esbuild.buildSync({
  stdin: { contents: kod, loader: 'ts' },
  write: false,
  bundle: true,
  format: 'cjs',
  platform: 'node',
});
const mod = { exports: {} };
new Function('module', 'exports', r.outputFiles[0].text)(mod, mod.exports);
const duzlestir = (obj, onek = '', cikti = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const yol = onek ? `${onek}.${k}` : k;
    if (v && typeof v === 'object') duzlestir(v, yol, cikti);
    else cikti[yol] = v;
  }
  return cikti;
};
const yeni = duzlestir(mod.exports.default || mod.exports.es);

const degisken = (s) => ((s.match(/\{\{[^}]+\}\}/g) || []).sort().join(','));
const yama = {};
let atlanan = 0;
for (const [k, v] of Object.entries(kurtarilacak)) {
  if (degisken(v) !== degisken(yeni[k] || '')) {
    atlanan += 1;
    continue;
  }
  yama[k] = v;
}
fs.writeFileSync(
  'scripts/i18n/yamalar/es-kurtarma.json',
  JSON.stringify({ es: yama }, null, 2),
  'utf8',
);
console.log('yama anahtar:', Object.keys(yama).length, 'değişken uyuşmayan:', atlanan);
if (atlanan) {
  const uyusmayan = Object.entries(kurtarilacak).filter(
    ([k, v]) => degisken(v) !== degisken(yeni[k] || ''),
  );
  console.log(uyusmayan.slice(0, 10).map(([k, v]) => `${k} :: ${v} || ${yeni[k]}`).join('\n'));
}
