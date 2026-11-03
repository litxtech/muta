/**
 * Kodda kullanılan ama sözlükte tanımsız olan anahtarları listeler.
 *
 * Kullanım: node scripts/i18n/tanimsiz.cjs [dil]
 */
const fs = require('fs');
const path = require('path');
const Y = require('./locale-yardimcilari.cjs');

const dil = process.argv[2] || 'tr';
const sozluk = Y.sozluk(dil);
const kok = Y.KOK;
const atla = new Set([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'build',
  'ios',
  'android',
  'scripts',
  'locales',
]);

const desen = /(?:\bt|\$t|i18n\.t)\(\s*['"`]([A-Za-z0-9_]+\.[A-Za-z0-9_.]+)['"`]/g;
const bulunan = new Map();

function gez(dir) {
  for (const ad of fs.readdirSync(dir)) {
    if (atla.has(ad)) continue;
    const tam = path.join(dir, ad);
    const st = fs.statSync(tam);
    if (st.isDirectory()) {
      gez(tam);
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(ad)) continue;
    const icerik = fs.readFileSync(tam, 'utf8');
    let m;
    while ((m = desen.exec(icerik)) !== null) {
      const k = m[1];
      if (!bulunan.has(k)) bulunan.set(k, new Set());
      bulunan.get(k).add(path.relative(kok, tam));
    }
  }
}

gez(kok);

const eksik = [...bulunan.keys()].filter((k) => !(k in sozluk)).sort();
console.log(`${dil}: kodda ${bulunan.size} anahtar, tanımsız ${eksik.length}`);
for (const k of eksik) {
  console.log(`${k}\t${[...bulunan.get(k)].slice(0, 2).join(', ')}`);
}
