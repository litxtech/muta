const Y = require('./locale-yardimcilari.cjs');
const diller = ['tr', 'en', 'es', 'pt', 'ar', 'fr', 'fil'];
const anahtarlar = process.argv.slice(2);
for (const k of anahtarlar) {
  console.log(`\n${k}`);
  for (const d of diller) {
    const s = Y.sozluk(d);
    console.log(`  ${d.padEnd(4)} ${s[k] ?? '— (YOK)'}`);
  }
}
