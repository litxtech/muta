/**
 * Yanlış bloğa yazılmış anahtarları temizler.
 *
 * Kullanım: node scripts/i18n/onar.cjs <dil> <ustAnahtar>
 * Örn: node scripts/i18n/onar.cjs es sehir
 *
 * tr'de <ustAnahtar> altında bulunmayan, ama locale dosyasında o blok
 * içinde duran üye satırlarını siler.
 */
const fs = require('fs');
const Y = require('./locale-yardimcilari.cjs');

const dil = process.argv[2];
const ust = process.argv[3];
if (!dil || !ust) {
  console.error('Kullanım: node scripts/i18n/onar.cjs <dil> <ustAnahtar>');
  process.exit(1);
}

const tr = Y.sozluk('tr');
const gecerli = new Set(
  Object.keys(tr)
    .filter((k) => k.startsWith(`${ust}.`))
    .map((k) => k.slice(ust.length + 1).split('.')[0]),
);

const yol = Y.localeYolu(dil);
const satirlar = fs.readFileSync(yol, 'utf8').split('\n');

const acilis = satirlar.findIndex((s) => new RegExp(`^\\s*${ust}:\\s*\\{\\s*$`).test(s));
if (acilis < 0) throw new Error(`${dil}: ${ust} bloğu bulunamadı`);
const { kapanis } = Y.eslesenKapanis(satirlar, acilis, satirlar.length);

const silinen = [];
for (let i = kapanis - 1; i > acilis; i -= 1) {
  const m = satirlar[i].match(/^\s*("([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*)):\s*/);
  if (!m) continue;
  const ad = m[2] ?? m[3] ?? m[4];
  if (gecerli.has(ad)) continue;
  silinen.push(`${i + 1}:${ad}`);
  satirlar.splice(i, 1);
}

Y.guvenliYaz(yol, satirlar.join('\n'));
console.log(`${dil}.${ust}: ${silinen.length} satır silindi`);
if (silinen.length) console.log(silinen.slice(0, 10).join(', '));
