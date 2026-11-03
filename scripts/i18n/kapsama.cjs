/**
 * Kapsama raporu — her dilin tr referansına göre eksik anahtarları.
 *
 *   node scripts/i18n/kapsama.cjs            → özet tablo
 *   node scripts/i18n/kapsama.cjs verify     → namespace detayı + eksik anahtarlar
 */
const Y = require('./locale-yardimcilari.cjs');

const hedef = process.argv[2];

const sozlukler = {};
for (const d of Y.DILLER) sozlukler[d] = Y.sozluk(d);

const trAnahtarlar = Object.keys(sozlukler.tr);
const trSet = new Set(trAnahtarlar);

if (!hedef) {
  console.log('=== LEAF ANAHTAR KAPSAMASI (tr referans) ===');
  for (const d of Y.DILLER) {
    const ks = Object.keys(sozlukler[d]);
    const eksik = trAnahtarlar.filter((k) => !(k in sozlukler[d]));
    console.log(
      `${d.padEnd(4)} toplam=${String(ks.length).padStart(5)}  eksik=${String(eksik.length).padStart(4)}`,
    );
  }

  const nsler = [...new Set(trAnahtarlar.map((k) => k.split('.')[0]))].sort();
  const satirlar = nsler
    .map((ns) => {
      const keys = trAnahtarlar.filter((k) => k.startsWith(`${ns}.`));
      const s = { ns, tr: keys.length };
      for (const d of Y.DILLER) {
        if (d === 'tr') continue;
        s[d] = keys.filter((k) => !(k in sozlukler[d])).length;
      }
      return s;
    })
    .filter((s) => Y.DILLER.some((d) => d !== 'tr' && s[d] > 0))
    .sort((a, b) => Math.max(b.es, b.ar) - Math.max(a.es, a.ar));

  console.log('\n=== EKSİK OLAN NAMESPACE\'LER ===');
  console.log('namespace            tr  |  en  es  pt  ar  fr fil');
  for (const s of satirlar) {
    console.log(
      `${s.ns.padEnd(20)} ${String(s.tr).padStart(4)} | ${String(s.en).padStart(3)} ${String(s.es).padStart(3)} ${String(s.pt).padStart(3)} ${String(s.ar).padStart(3)} ${String(s.fr).padStart(3)} ${String(s.fil).padStart(3)}`,
    );
  }
  const toplamEksik = Y.DILLER.filter((d) => d !== 'tr').reduce(
    (t, d) => t + trAnahtarlar.filter((k) => !(k in sozlukler[d])).length,
    0,
  );
  console.log(`\nToplam eksik çeviri (6 dil): ${toplamEksik}`);
  process.exit(0);
}

// namespace detayı
const keys = trAnahtarlar.filter((k) => k.startsWith(`${hedef}.`) || k === hedef);
console.log(`${hedef}: ${keys.length} anahtar (tr)`);
for (const d of Y.DILLER) {
  const eksik = keys.filter((k) => !(k in sozlukler[d]));
  console.log(`  ${d.padEnd(4)} eksik=${eksik.length}`);
}
const diller = Y.DILLER.filter((d) => d !== 'tr');
console.log('\n--- TR kaynak metinleri ---');
for (const k of keys) console.log(`${k}\t${sozlukler.tr[k]}`);
const herDildeEksik = keys.filter((k) => diller.some((d) => !(k in sozlukler[d])));
console.log('\n--- En az bir dilde eksik olan anahtarlar ---');
console.log(herDildeEksik.join('\n'));
