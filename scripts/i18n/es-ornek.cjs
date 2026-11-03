const fs = require('fs');
const esbuild = require('esbuild');

function yukle(yol) {
  const kod = fs.readFileSync(yol, 'utf8');
  const r = esbuild.buildSync({
    stdin: { contents: kod, loader: 'ts' },
    write: false,
    bundle: true,
    format: 'cjs',
    platform: 'node',
  });
  const mod = { exports: {} };
  new Function('module', 'exports', r.outputFiles[0].text)(mod, mod.exports);
  return duzlestir(mod.exports.default || Object.values(mod.exports)[0]);
}
function duzlestir(obj, onek = '', cikti = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const yol = onek ? `${onek}.${k}` : k;
    if (v && typeof v === 'object') duzlestir(v, yol, cikti);
    else cikti[yol] = v;
  }
  return cikti;
}
const tr = yukle('src/i18n/locales/tr.ts');
const en = yukle('src/i18n/locales/en.ts');
const es = yukle('src/i18n/locales/es.ts');
const eski = JSON.parse(fs.readFileSync('scripts/i18n/kaynak/es-eski-sozluk.json', 'utf8'));
const yama = JSON.parse(fs.readFileSync('scripts/i18n/yamalar/es-kurtarma.json', 'utf8')).es;
const anahtarlar = Object.keys(yama);
const adim = Math.max(1, Math.floor(anahtarlar.length / Number(process.argv[2] || 12)));
for (let i = 0; i < anahtarlar.length; i += adim) {
  const k = anahtarlar[i];
  console.log('###', k);
  console.log('  tr:', String(tr[k]).slice(0, 120));
  console.log('  en:', String(en[k]).slice(0, 120));
  console.log('  es(bozuk):', String(es[k]).slice(0, 120));
  console.log('  es(eski):', String(yama[k]).slice(0, 120));
  void eski;
}
