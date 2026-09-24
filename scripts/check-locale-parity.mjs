import fs from 'fs';

function extract(src, name) {
  const marker = `export const ${name}`;
  const start = src.indexOf(marker);
  let i = src.indexOf('{', start);
  let depth = 0;
  let inStr = null;
  let esc = false;
  const begin = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(begin, i + 1);
    }
  }
  throw new Error('fail ' + name);
}

function leaves(obj, p = '', acc = []) {
  for (const [k, v] of Object.entries(obj)) {
    const nk = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, nk, acc);
    else acc.push(nk);
  }
  return acc;
}

const tr = Function(
  `return (${extract(fs.readFileSync('src/i18n/locales/tr.ts', 'utf8'), 'tr')})`,
)();
const en = Function(
  `return (${extract(fs.readFileSync('src/i18n/locales/en.ts', 'utf8'), 'en')})`,
)();
const es = Function(
  `return (${extract(fs.readFileSync('src/i18n/locales/es.ts', 'utf8'), 'es')})`,
)();
const ar = JSON.parse(fs.readFileSync('src/i18n/locales/ar.json', 'utf8'));

const tl = new Set(leaves(tr));
const el = new Set(leaves(en));
const sl = new Set(leaves(es));
const al = new Set(leaves(ar));

const missEn = [...tl].filter((k) => !el.has(k));
const missEs = [...tl].filter((k) => !sl.has(k));
const missAr = [...tl].filter((k) => !al.has(k));
const extraEn = [...el].filter((k) => !tl.has(k));

console.log(
  JSON.stringify(
    {
      counts: { tr: tl.size, en: el.size, es: sl.size, ar: al.size },
      missingInEn: missEn.length,
      missingInEs: missEs.length,
      missingInAr: missAr.length,
      extraInEn: extraEn.length,
      sampleMissEn: missEn.slice(0, 20),
      sampleMissAr: missAr.slice(0, 20),
      sampleExtraEn: extraEn.slice(0, 20),
    },
    null,
    2,
  ),
);
