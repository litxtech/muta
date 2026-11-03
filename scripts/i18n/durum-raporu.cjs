const Y = require('./locale-yardimcilari.cjs');
const en = Y.sozluk('en');
const tr = Y.sozluk('tr');
const atla = new Set(['Coin', 'PK', 'VIP', 'OK', 'AI', 'Tamuso', 'DeepSeek', 'YouTube', 'Google', 'Apple', 'X', 'Twitch', 'Spotify', 'ID', 'QR', 'SMS', 'USD', 'PDF / Excel', 'Flash']);
console.log('dil\tanahtar\tİngilizce kalan\tbozuk(kelime içi ?)\n');
for (const dil of Y.DILLER) {
  const s = Y.sozluk(dil);
  const anahtarlar = Object.keys(s);
  let sizinti = 0;
  let bozuk = 0;
  for (const k of anahtarlar) {
    const v = s[k];
    if (typeof v !== 'string') continue;
    if (v.length > 3 && en[k] === v && tr[k] !== v && !atla.has(v.trim())) sizinti += 1;
    if (/[A-Za-z]\?[A-Za-z]/.test(v)) bozuk += 1;
  }
  console.log(`${dil}\t${anahtarlar.length}\t${sizinti}\t${bozuk}`);
}
