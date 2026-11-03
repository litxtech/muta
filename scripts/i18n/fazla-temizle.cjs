/* Fazla/tekrarlı anahtarları temizler: es/pt verify.tekrarDene, fil durum.baglantiyiPayla */
const fs = require('fs');
const path = require('path');

function temizle(dosya, hedef) {
  const yol = path.join(__dirname, '../../src/i18n/locales', dosya);
  const satirlar = fs.readFileSync(yol, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  const kalacak = [];
  let namespace = '';
  let gorulen = new Set();
  let silinen = 0;
  for (const satir of satirlar) {
    const ns = satir.match(/^ {2}(?:"(\w+)"|(\w+)): \{/);
    if (ns) {
      namespace = ns[1] || ns[2];
      gorulen = new Set();
    }
    const anahtar = satir.match(/^ {4}(?:"(\w+)"|(\w+)):/);
    if (anahtar) {
      const ad = anahtar[1] || anahtar[2];
      if (`${namespace}.${ad}` === hedef) {
        if (gorulen.has(ad)) {
          silinen += 1;
          continue;
        }
        gorulen.add(ad);
      }
    }
    kalacak.push(satir);
  }
  fs.writeFileSync(yol, kalacak.join('\n'), 'utf8');
  console.log(`${dosya}: ${hedef} -> ${silinen} satır silindi`);
}

temizle('es.ts', 'verify.tekrarDene');
temizle('pt.ts', 'verify.tekrarDene');
temizle('fil.json', 'durum.baglantiyiPayla');
