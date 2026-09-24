/**
 * Rebuild src/i18n/locales/ar.ts from scripts/ar_parts + en.ts skeleton.
 * Priority per leaf: ar_parts (Arabic) → existing ar.ts (Arabic) → en.
 * Never writes ???. Writes via temp file then byte-copy (UTF-8, no BOM).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const partsDir = 'scripts/ar_parts';
const outTsPath = 'src/i18n/locales/ar.ts';
const outJsonPath = 'src/i18n/locales/ar.json';

function loadJson(name) {
  const p = path.join(partsDir, `${name}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function extractObjectLiteral(src, exportName) {
  const marker = `export const ${exportName}`;
  const start = src.indexOf(marker);
  if (start < 0) throw new Error(`export ${exportName} not found`);
  let i = src.indexOf('{', start);
  let depth = 0;
  let inStr = null;
  let escape = false;
  const begin = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
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
  throw new Error('unclosed object');
}

function isUsableAr(s) {
  return (
    typeof s === 'string' &&
    s.length > 0 &&
    /[\u0600-\u06FF]/.test(s) &&
    !/\?{3,}/.test(s)
  );
}

function isUsableLatin(s) {
  return typeof s === 'string' && s.length > 0 && !/\?{3,}/.test(s);
}

/** parts → existing ar → en */
function deepMergeFill(enNode, partsNode, existingNode) {
  if (typeof enNode !== 'object' || enNode === null) {
    if (isUsableAr(partsNode)) return partsNode;
    if (isUsableAr(existingNode)) return existingNode;
    if (isUsableLatin(partsNode)) return partsNode;
    if (isUsableLatin(existingNode)) return existingNode;
    return enNode;
  }
  const out = {};
  for (const k of Object.keys(enNode)) {
    const enVal = enNode[k];
    const partsVal =
      partsNode && typeof partsNode === 'object' ? partsNode[k] : undefined;
    const existVal =
      existingNode && typeof existingNode === 'object'
        ? existingNode[k]
        : undefined;
    if (typeof enVal === 'object' && enVal !== null && !Array.isArray(enVal)) {
      out[k] = deepMergeFill(enVal, partsVal, existVal);
    } else {
      if (isUsableAr(partsVal)) out[k] = partsVal;
      else if (isUsableAr(existVal)) out[k] = existVal;
      else if (isUsableLatin(partsVal)) out[k] = partsVal;
      else if (isUsableLatin(existVal)) out[k] = existVal;
      else out[k] = enVal;
    }
  }
  return out;
}

function collectLeaves(obj, prefix = '', acc = []) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') collectLeaves(v, p, acc);
    else acc.push([p, v]);
  }
  return acc;
}

function esc(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function serialize(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  const padIn = ' '.repeat(indent + 2);
  const entries = Object.entries(obj);
  const lines = entries.map(([k, v], idx) => {
    const comma = idx < entries.length - 1 ? ',' : '';
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return `${padIn}${k}: ${serialize(v, indent + 2)}${comma}`;
    }
    return `${padIn}${k}: '${esc(v)}'${comma}`;
  });
  return `{\n${lines.join('\n')}\n${pad}}`;
}

const enSrc = fs.readFileSync('src/i18n/locales/en.ts', 'utf8');
const enObj = Function(
  `"use strict"; return (${extractObjectLiteral(enSrc, 'en')})`,
)();

let existingAr = null;
if (fs.existsSync(outJsonPath)) {
  try {
    const raw = fs.readFileSync(outJsonPath, 'utf8');
    if (/[\u0600-\u06FF]/.test(raw) && !/\?{20,}/.test(raw)) {
      existingAr = JSON.parse(raw);
    }
  } catch {
    existingAr = null;
  }
} else if (fs.existsSync(outTsPath)) {
  try {
    const arSrc = fs.readFileSync(outTsPath, 'utf8');
    if (/[\u0600-\u06FF]/.test(arSrc) && !/\?{20,}/.test(arSrc)) {
      existingAr = Function(
        `"use strict"; return (${extractObjectLiteral(arSrc, 'ar')})`,
      )();
    }
  } catch {
    existingAr = null;
  }
}

const small = loadJson('_small_sections') || {};
const partsMap = {
  ortak: loadJson('ortak'),
  sekmeler: loadJson('sekmeler'),
  ayarlar: loadJson('ayarlar'),
  auth: loadJson('auth'),
  profil: loadJson('profil'),
  profilDuzenle: loadJson('profilDuzenle'),
  misafirHesap: loadJson('misafirHesap'),
  mesajlar: loadJson('mesajlar'),
  odalar: loadJson('odalar'),
  cuzdan: loadJson('cuzdan'),
  durum: loadJson('durum'),
  bildirimler: loadJson('bildirimler'),
  bildirimAyar: loadJson('bildirimAyar'),
  destek: loadJson('destek'),
  guvenlik: loadJson('guvenlik'),
  politika: small.politika,
  takip: loadJson('takip'),
  ajans: small.ajans,
  sehir: small.sehir,
  oyun: small.oyun,
  aiMuzik: small.aiMuzik,
  fikirler: small.fikirler,
  kyc: small.kyc,
  canli: loadJson('canli'),
  host: small.host,
  siralamalar: small.siralamalar,
  kesfet: loadJson('kesfet'),
  modlar: loadJson('modlar'),
  kisiler: loadJson('kisiler'),
  engellenen: loadJson('engellenen'),
  hesapSil: loadJson('hesapSil'),
  islemHacmi: small.islemHacmi,
  gizlilik: loadJson('gizlilik'),
  kisilerAyar: loadJson('kisilerAyar'),
  satinAlma: loadJson('satinAlma'),
  bildir: small.bildir,
  raporlarim: small.raporlarim,
  duyuru: small.duyuru,
  pk: small.pk,
  paylasim: small.paylasim,
  sertifikasyon: small.sertifikasyon,
  platform: small.platform,
  takas: small.takas,
  anaSayfa: loadJson('anaSayfa'),
  cuzdanX: loadJson('cuzdanX'),
  profilTab: loadJson('profilTab'),
  olusturTab: loadJson('olusturTab'),
  cihazlar: loadJson('cihazlar'),
  genel: small.genel,
  mesajSohbet: loadJson('mesajSohbet'),
  gorusme: loadJson('gorusme'),
  sesOda: loadJson('sesOda'),
  kisilerX: loadJson('kisilerX'),
  durumX: loadJson('durumX'),
  cuzdanXExtra: loadJson('cuzdanXExtra'),
  kesfetX: loadJson('kesfetX'),
  cocukKoruma: loadJson('cocukKoruma'),
  hediye: loadJson('hediye'),
  hediyeAd: loadJson('hediyeAd'),
  canliYayin: loadJson('canliYayin'),
};

const ar = deepMergeFill(enObj, partsMap, existingAr);
const leaves = collectLeaves(ar);
const arabicLeaves = leaves.filter(([, v]) =>
  /[\u0600-\u06FF]/.test(String(v)),
);
const englishFill = leaves.filter(
  ([, v]) => !/[\u0600-\u06FF]/.test(String(v)),
);
const corrupted = leaves.filter(([, v]) => /\?{3,}/.test(String(v)));

/** Arabic lives in JSON — IDE encoding cannot wipe .ts wrapper */
const jsonBody = `${JSON.stringify(ar, null, 2)}\n`;
const wrapper =
  `import type { CeviriSozlugu } from './tr';\n` +
  `import raw from './ar.json';\n\n` +
  `/** Arabic UI strings live in ar.json (UTF-8). Do not paste Arabic into this file. */\n` +
  `export const ar = raw as CeviriSozlugu;\n`;

const tmpJson = path.join(os.tmpdir(), `tamuso-ar-${Date.now()}.json`);
const tmpTs = path.join(os.tmpdir(), `tamuso-ar-wrap-${Date.now()}.ts`);
fs.writeFileSync(tmpJson, jsonBody, 'utf8');
fs.writeFileSync(tmpTs, wrapper, 'utf8');
fs.copyFileSync(tmpJson, outJsonPath);
fs.copyFileSync(tmpTs, outTsPath);
fs.unlinkSync(tmpJson);
fs.unlinkSync(tmpTs);

const buf = fs.readFileSync(outJsonPath);
const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
const text = buf.toString('utf8');
const arabicCodepoints = (text.match(/[\u0600-\u06FF]/g) || []).length;
if (arabicCodepoints < 10_000 || corrupted.length > 0) {
  console.error('WRITE FAILED / CORRUPT', { arabicCodepoints, corrupted: corrupted.length });
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      leafCount: leaves.length,
      arabicLeaves: arabicLeaves.length,
      englishFill: englishFill.length,
      englishFillKeys: englishFill.slice(0, 20).map(([k]) => k),
      corruptedLeft: corrupted.length,
      arabicCodepoints,
      bom,
      jsonBytes: buf.length,
      sampleIptal: ar.ortak.iptal,
      sampleGrupYardim: ar.anaSayfa?.grupYardim,
    },
    null,
    2,
  ),
);
