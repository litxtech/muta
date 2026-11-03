const fs = require('fs');
const yol = process.argv[2];
const s = fs.readFileSync(yol, 'utf8');
const jetonlar = s.match(/[^\s"'`]*\?[^\s"'`]*/g) || [];
const say = new Map();
for (const j of jetonlar) say.set(j, (say.get(j) || 0) + 1);
const liste = [...say.entries()].sort((a, b) => b[1] - a[1]);
console.log('toplam jeton:', liste.length, 'toplam adet:', jetonlar.length);
for (const [j, n] of liste.slice(0, Number(process.argv[3] || 500))) {
  console.log(String(n).padStart(4), j);
}
