const fs = require('fs');
const yol = process.argv[2] || 'src/i18n/locales/es.ts';
const satirlar = fs.readFileSync(yol, 'utf8').split(/\r?\n/);
let ns = '';
const say = {};
const ornek = {};
for (const l of satirlar) {
  const m = l.match(/^ {2}(?:"(\w+)"|(\w+)): \{/);
  if (m) ns = m[1] || m[2];
  const sus = (l.match(/[^\x00-\x7F]/g) || []).length;
  const q = (l.match(/\?/g) || []).length;
  // "?" followed by harf veya boşluk, kelime ortasında: bozulma işareti
  const bozuk = (l.match(/[A-Za-z]\?[A-Za-z]|\?\s|\?\"]/g) || []).length;
  if (bozuk) {
    say[ns] = (say[ns] || 0) + bozuk;
    if (!ornek[ns]) ornek[ns] = l.trim().slice(0, 110);
  }
  void sus; void q;
}
Object.entries(say)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(String(v).padStart(5), k.padEnd(22), ornek[k]));
