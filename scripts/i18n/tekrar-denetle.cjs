/* Aynı namespace içinde tekrarlanan anahtarları raporlar. */
const fs = require('fs');
const Y = require('./locale-yardimcilari.cjs');

for (const dil of Y.DILLER) {
  const yol = Y.localeYolu(dil);
  const satirlar = fs.readFileSync(yol, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  let ns = '';
  const sayac = new Map();
  const tekrar = [];
  satirlar.forEach((l, i) => {
    const m = l.match(/^ {2}(?:"(\w+)"|(\w+)): \{/);
    if (m) {
      ns = m[1] || m[2];
      return;
    }
    const k = l.match(/^ {4}(?:"(\w+)"|(\w+)):/);
    if (!k) return;
    const tam = `${ns}.${k[1] || k[2]}`;
    if (sayac.has(tam)) tekrar.push(`${tam}@${i + 1}`);
    sayac.set(tam, i + 1);
  });
  console.log(`${dil}: ${tekrar.length ? tekrar.join(', ') : 'tekrar yok'}`);
}
