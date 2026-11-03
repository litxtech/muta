/* Virgülü eksik kalan tek satırlık kayıtları tespit eder ve düzeltir. */
const fs = require('fs');
const Y = require('./locale-yardimcilari.cjs');

const dosyalar = process.argv.slice(2);
for (const dosya of dosyalar) {
  const yol = `src/i18n/locales/${dosya}`;
  const satirlar = fs.readFileSync(yol, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const duzeltilen = [];
  for (let i = 0; i < satirlar.length - 1; i += 1) {
    const s = satirlar[i];
    const kayit = /^(\s+)(?:"[\w.]+"|[\w.]+):\s+.+$/.test(s);
    if (!kayit) continue;
    if (/[,{[(\\]$/.test(s.trimEnd())) continue;
    let j = i + 1;
    while (j < satirlar.length && satirlar[j].trim() === '') j += 1;
    if (j >= satirlar.length) continue;
    const sonraki = satirlar[j].trim();
    if (sonraki.startsWith('}')) continue;
    satirlar[i] = `${s},`;
    duzeltilen.push(i + 1);
  }
  if (duzeltilen.length) {
    Y.guvenliYaz(yol, satirlar.join('\n'));
    console.log(`${dosya}: ${duzeltilen.length} virgül eklendi (satır: ${duzeltilen.slice(0, 12).join(', ')})`);
  } else {
    console.log(`${dosya}: virgül sorunu yok`);
  }
}
