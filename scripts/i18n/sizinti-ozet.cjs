const fs = require('fs');
const sizinti = JSON.parse(fs.readFileSync('scripts/i18n/kaynak/ingilizce-sizinti.json', 'utf8'));
for (const [dil, kayit] of Object.entries(sizinti)) {
  const anahtarlar = Object.keys(kayit);
  const uzun = anahtarlar.filter((k) => kayit[k].includes(' ') && kayit[k].length > 12);
  const ns = {};
  for (const k of uzun) {
    const n = k.split('.')[0];
    ns[n] = (ns[n] || 0) + 1;
  }
  const enCok = Object.entries(ns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([n, c]) => `${n}(${c})`)
    .join(' ');
  console.log(`${dil}: toplam sızıntı ${anahtarlar.length} · cümle düzeyinde ${uzun.length}`);
  console.log(`   ${enCok}`);
}
