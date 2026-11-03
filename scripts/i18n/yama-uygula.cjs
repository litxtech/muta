/**
 * Çeviri yaması uygular.
 *
 * Yama dosyası: scripts/i18n/yamalar/<ad>.json
 *   { "es": { "verify.baslik": "..." }, "ar": { ... }, ... }
 *
 *   node scripts/i18n/yama-uygula.cjs verify
 *   node scripts/i18n/yama-uygula.cjs --tumu
 */
const fs = require('fs');
const path = require('path');
const Y = require('./locale-yardimcilari.cjs');

const YAMA_DIZIN = path.join(__dirname, 'yamalar');

const ad = process.argv[2];
if (!ad) {
  console.error('Kullanım: node scripts/i18n/yama-uygula.cjs <yama-adi>|--tumu');
  process.exit(1);
}

const dosyalar =
  ad === '--tumu'
    ? fs
        .readdirSync(YAMA_DIZIN)
        .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
        .sort()
        .map((f) => path.join(YAMA_DIZIN, f))
    : [path.join(YAMA_DIZIN, `${ad}.json`)];

let toplam = 0;
for (const dosya of dosyalar) {
  if (!fs.existsSync(dosya)) {
    console.error(`Yama bulunamadı: ${dosya}`);
    process.exit(1);
  }
  const yama = JSON.parse(fs.readFileSync(dosya, 'utf8').replace(/^\uFEFF/, ''));
  for (const [dil, kayitlar] of Object.entries(yama)) {
    if (!Y.DILLER.includes(dil)) {
      console.error(`Bilinmeyen dil: ${dil} (${path.basename(dosya)})`);
      process.exit(1);
    }
    const sayi = Y.yazCoklu(dil, kayitlar);
    toplam += sayi;
    console.log(`${path.basename(dosya)} → ${dil}: ${sayi} anahtar yazıldı`);
  }
}
console.log(`\nToplam ${toplam} çeviri uygulandı.`);
