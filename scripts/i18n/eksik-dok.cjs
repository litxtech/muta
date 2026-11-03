const fs = require('fs');
const Y = require('./locale-yardimcilari.cjs');

const tr = Y.sozluk('tr');
const en = Y.sozluk('en');
const dil = process.argv[2];
const s = Y.sozluk(dil);
const nsn = process.argv.slice(3);
const satirlar = [];
for (const k of Object.keys(tr)) {
  if (nsn.length && !nsn.some((n) => k.startsWith(`${n}.`))) continue;
  if (s[k] && s[k] !== en[k]) continue;
  satirlar.push(`${k} | ${tr[k]} | ${en[k]}`);
}
fs.writeFileSync(`scripts/i18n/kaynak/eksik-${dil}.txt`, satirlar.join('\n'), 'utf8');
console.log(dil, satirlar.length, 'anahtar yazıldı');
