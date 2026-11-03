const { execSync } = require('child_process');
const esbuild = require('esbuild');

function objeAl(kaynakKod, ad) {
  const r = esbuild.buildSync({
    stdin: { contents: kaynakKod, loader: 'ts' },
    write: false,
    bundle: true,
    format: 'cjs',
    platform: 'node',
  });
  const kod = r.outputFiles[0].text;
  const mod = { exports: {} };
  new Function('module', 'exports', kod)(mod, mod.exports);
  return mod.exports.default || mod.exports[ad] || mod.exports;
}

function duzlestir(obj, onek = '', cikti = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const yol = onek ? `${onek}.${k}` : k;
    if (v && typeof v === 'object') duzlestir(v, yol, cikti);
    else cikti[yol] = v;
  }
  return cikti;
}

const eskiKod = execSync('git show 3befdbe:src/i18n/locales/es.ts', {
  cwd: 'C:/Users/ilkse/muta',
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 20,
});
const yeniKod = require('fs').readFileSync('C:/Users/ilkse/muta/src/i18n/locales/es.ts', 'utf8');

const eski = duzlestir(objeAl(eskiKod, 'es'));
const yeni = duzlestir(objeAl(yeniKod, 'es'));

const bozuk = Object.entries(yeni).filter(([, v]) => typeof v === 'string' && v.includes('?'));
const kurtarilabilir = bozuk.filter(([k]) => eski[k] && eski[k] !== yeni[k]);
const kurtarilacak = kurtarilabilir
  .filter(([k]) => !eski[k].includes('?'))
  .map(([k]) => [k, eski[k]]);
console.log('eski anahtar:', Object.keys(eski).length);
console.log('yeni anahtar:', Object.keys(yeni).length);
console.log('bozuk (soru işaretli):', bozuk.length);
console.log('eski sürümde var:', kurtarilabilir.length);
console.log('eski sürümde temiz:', kurtarilacak.length);
require('fs').writeFileSync(
  'C:/Users/ilkse/muta/scripts/i18n/kaynak/es-eski-sozluk.json',
  JSON.stringify(eski, null, 0),
  'utf8',
);
require('fs').writeFileSync(
  'C:/Users/ilkse/muta/scripts/i18n/kaynak/es-kurtarilacak.json',
  JSON.stringify(Object.fromEntries(kurtarilacak), null, 2),
  'utf8',
);
const kalanlar = bozuk.filter(([k]) => !kurtarilacak.some(([kk]) => kk === k));
console.log('elle çevrilecek:', kalanlar.length);
require('fs').writeFileSync(
  'C:/Users/ilkse/muta/scripts/i18n/kaynak/es-elle.json',
  JSON.stringify(Object.fromEntries(kalanlar), null, 2),
  'utf8',
);
