const { execSync } = require('child_process');
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
function tsYukle(kod) {
  const r = esbuild.buildSync({
    stdin: { contents: kod, loader: 'ts' },
    write: false,
    bundle: true,
    format: 'cjs',
  });
  const m = { exports: {} };
  new Function('module', 'exports', r.outputFiles[0].text)(m, m.exports);
  return duz(m.exports.default || Object.values(m.exports)[0]);
}
function jsonYukle(kod) {
  return duz(JSON.parse(kod.replace(/^\uFEFF/, '')));
}

const rev = process.argv[2] || '3befdbe';
const dosyalar = [
  ['es', 'es.ts', tsYukle],
  ['pt', 'pt.ts', tsYukle],
  ['ar', 'ar.json', jsonYukle],
  ['fr', 'fr.json', jsonYukle],
  ['fil', 'fil.json', jsonYukle],
];
const sizinti = JSON.parse(fs.readFileSync('scripts/i18n/kaynak/ingilizce-sizinti.json', 'utf8'));
const sonuc = {};
for (const [dil, dosya, yukle] of dosyalar) {
  let eski;
  try {
    const kod = execSync(`git show ${rev}:src/i18n/locales/${dosya}`, {
      cwd: 'C:/Users/ilkse/muta',
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 30,
    });
    eski = yukle(kod);
  } catch {
    console.log(dil, 'eski sürüm yok');
    continue;
  }
  const hedef = sizinti[dil] || {};
  const kurtarilacak = {};
  for (const [k, v] of Object.entries(hedef)) {
    const e = eski[k];
    if (typeof e === 'string' && e.trim() && e !== v) kurtarilacak[k] = e;
  }
  sonuc[dil] = kurtarilacak;
  console.log(
    dil,
    'sızıntı:', Object.keys(hedef).length,
    'eski sürümde çeviri:', Object.keys(kurtarilacak).length,
  );
}
fs.writeFileSync(
  'scripts/i18n/kaynak/gecmis-kurtarma.json',
  JSON.stringify(sonuc, null, 2),
  'utf8',
);
