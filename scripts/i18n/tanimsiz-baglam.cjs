/**
 * Tanımsız anahtarların koddaki kullanım bağlamını yazar.
 *
 * Kullanım: node scripts/i18n/tanimsiz-baglam.cjs [dil]
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

const desen = /(?:\bt|\$t|i18n\.t)\(\s*['"`]([A-Za-z0-9_]+\.[A-Za-z0-9_.]+)['"`]/;
const satirlar = [];

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
    const icerik = fs.readFileSync(tam, 'utf8').split('\n');
    icerik.forEach((satir, i) => {
      const m = satir.match(desen);
      if (!m) return;
      if (m[1] in sozluk) return;
      satirlar.push(`${m[1]}\t${path.relative(kok, tam)}:${i + 1}\t${satir.trim()}`);
    });
  }
}

gez(kok);
satirlar.sort();
const yol = path.join(__dirname, 'kaynak', 'tanimsiz-baglam.txt');
fs.mkdirSync(path.dirname(yol), { recursive: true });
fs.writeFileSync(yol, `${satirlar.join('\n')}\n`, 'utf8');
console.log(`${yol} → ${satirlar.length} satır`);
