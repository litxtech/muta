/**
 * Bir namespace'in TR + EN kaynak metinlerini TSV dosyasına döker.
 *
 *   node scripts/i18n/kaynak-dok.cjs verify
 *   → scripts/i18n/kaynak/verify.tsv
 */
const fs = require('fs');
const path = require('path');
const Y = require('./locale-yardimcilari.cjs');

const ns = process.argv[2];
if (!ns) {
  console.error('Kullanım: node scripts/i18n/kaynak-dok.cjs <namespace>');
  process.exit(1);
}

const tr = Y.sozluk('tr');
const en = Y.sozluk('en');
const sadeceEksik = process.argv[3] === 'eksik';
const digerleri = Y.DILLER.filter((d) => d !== 'tr').map((d) => Y.sozluk(d));

const anahtarlar = Object.keys(tr).filter((k) => {
  if (!(k.startsWith(`${ns}.`) || k === ns)) return false;
  if (!sadeceEksik) return true;
  return digerleri.some((s) => !(k in s));
});

const temiz = (s) => String(s ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, '\\n');
const satirlar = anahtarlar.map((k) => `${k}\t${temiz(tr[k])}\t${temiz(en[k])}`);

const dizin = path.join(__dirname, 'kaynak');
fs.mkdirSync(dizin, { recursive: true });
const yol = path.join(dizin, `${ns}${sadeceEksik ? '-eksik' : ''}.tsv`);
fs.writeFileSync(yol, `${satirlar.join('\n')}\n`, 'utf8');
console.log(`${yol} → ${anahtarlar.length} anahtar`);
