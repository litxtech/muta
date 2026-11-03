const fs = require('fs');
const esbuild = require('esbuild');
function duz(o, p = '', c = {}) {
  for (const [k, v] of Object.entries(o)) {
    const y = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object') duz(v, y, c);
    else c[y] = v;
  }
  return c;
}
function yukle(yol, json) {
  if (json) return duz(JSON.parse(fs.readFileSync(yol, 'utf8').replace(/^\uFEFF/, '')));
  const r = esbuild.buildSync({
    stdin: { contents: fs.readFileSync(yol, 'utf8'), loader: 'ts' },
    write: false,
    bundle: true,
    format: 'cjs',
  });
  const m = { exports: {} };
  new Function('module', 'exports', r.outputFiles[0].text)(m, m.exports);
  return duz(m.exports.default || Object.values(m.exports)[0]);
}
const KOK = 'src/i18n/locales/';
const tr = yukle(`${KOK}tr.ts`);
const en = yukle(`${KOK}en.ts`);
const diller = {
  es: [`${KOK}es.ts`, false],
  pt: [`${KOK}pt.ts`, false],
  ar: [`${KOK}ar.json`, true],
  fr: [`${KOK}fr.json`, true],
  fil: [`${KOK}fil.json`, true],
};
const ilgi = ['kyc', 'yayinciK', 'banka', 'cuzdanX', 'cuzdanXExtra', 'cuzdan', 'belge', 'satinAlma', 'verify', 'profilDuzenle', 'auth', 'ajans'];
const satirlar = [];
satirlar.push(['namespace', 'tr', 'es', 'pt', 'ar', 'fr', 'fil'].join('\t'));
for (const ns of ilgi) {
  const satir = [ns];
  satir.push(Object.keys(tr).filter((k) => k.startsWith(`${ns}.`)).length);
  for (const [dil, [yol, json]] of Object.entries(diller)) {
    const s = yukle(yol, json);
    const eksik = Object.keys(tr).filter(
      (k) => k.startsWith(`${ns}.`) && (!s[k] || s[k] === en[k]),
    ).length;
    satir.push(eksik);
  }
  satirlar.push(satir.join('\t'));
}
console.log(satirlar.join('\n'));
