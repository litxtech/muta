const b = require('esbuild');
const fs = require('fs');
function yukle(p) {
  const r = b.buildSync({
    stdin: { contents: fs.readFileSync(p, 'utf8'), loader: 'ts' },
    write: false,
    bundle: true,
    format: 'cjs',
  });
  const m = { exports: {} };
  new Function('module', 'exports', r.outputFiles[0].text)(m, m.exports);
  return m.exports.default || Object.values(m.exports)[0];
}
const duz = (o, p = '', c = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const y = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object') duz(v, y, c);
    else c[y] = v;
  }
  return c;
};
const en = duz(yukle('src/i18n/locales/en.ts'));
const tr = duz(yukle('src/i18n/locales/tr.ts'));
const anahtarlar = process.argv.slice(2);
for (const k of anahtarlar) {
  console.log(k);
  console.log('  tr:', JSON.stringify(tr[k]));
  console.log('  en:', JSON.stringify(en[k]));
}
