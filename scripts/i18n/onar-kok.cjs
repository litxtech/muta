/* tr.ts: tip bloğunun içine kaçmış yamaları temizler. */
const fs = require('fs');
const path = require('path');

const dosya = path.join(__dirname, '../../src/i18n/locales/tr.ts');
const satirlar = fs.readFileSync(dosya, 'utf8').split(/\r?\n/);

const tipSatiri = satirlar.findIndex((s) => /^export type CeviriSozlugu = \{/.test(s));
if (tipSatiri < 0) throw new Error('Tip bloğu bulunamadı');
let kapanis = -1;
for (let i = satirlar.length - 1; i > tipSatiri; i -= 1) {
  if (satirlar[i].trim() === '};') {
    kapanis = i;
    break;
  }
}
if (kapanis < 0) throw new Error('Tip bloğu kapanışı bulunamadı');

const once = satirlar.length;
const yeni = [
  ...satirlar.slice(0, tipSatiri + 1),
  '  [K in keyof typeof tr]: (typeof tr)[K] extends string',
  '    ? string',
  '    : { [P in keyof (typeof tr)[K]]: string };',
  '};',
];
fs.writeFileSync(dosya, `${yeni.join('\n')}\n`, 'utf8');
console.log(`tr.ts temizlendi: ${once} -> ${yeni.length} satır`);
